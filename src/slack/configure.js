/*
 * /configure flow (product manager): intake modal -> Claude -> questions modal
 * (if needed) -> Claude final pass -> offer card in the channel.
 *
 * Also opened from a /quote card ("Send to product manager"): the intake is
 * pre-filled with the rep's request and the card remembers the customer, so
 * the built offer can be quoted for them in one click.
 *
 * Slack gives 3 seconds to ack every command, action and submission. Claude
 * takes longer, so each submission acks by swapping the modal to a progress
 * view, then the slow work runs and the modal is updated by view id.
 */

const { analyseRequest } = require('../extraction');
const { createSession, getSession } = require('../store');
const { EXAMPLES } = require('./examples');
const { buildCard } = require('./card');
const { buildQuoteCard } = require('./quote-card');
const views = require('./views');
const { startProgress, safeUpdate, short, postCard, foldQuestionsIntoAssumptions } = require('./modal-utils');

const FIRST_PASS = ['Reading the request', 'Checking the catalog', 'Matching products and prices', 'Checking what is missing'];
const FINAL_PASS = ['Applying your answers', 'Finalising the configuration'];

function registerConfigure(app) {
  /* Open the modal straight away - trigger_id expires in 3s. Any text typed
   * after the command pre-fills the request. */
  app.command('/configure', async ({ command, ack, client }) => {
    await ack();
    console.log(`<-- /configure from ${command.user_name} in #${command.channel_name}`);

    await client.views.open({
      trigger_id: command.trigger_id,
      view: views.intakeView({
        meta: { channelId: command.channel_id, userId: command.user_id },
        text: command.text.trim(),
      }),
    });
  });

  /* Example chips: replace the request text, keep the selects. */
  app.action(/^example_\d+$/, async ({ ack, body, action, client }) => {
    await ack();
    const { view } = body;
    const current = views.readIntake(view);

    await safeUpdate(client, view.id, views.intakeView({
      meta: JSON.parse(view.private_metadata),
      text: EXAMPLES[Number(action.value)].text,
      hints: current.hints,
      version: current.version + 1,
    }), view.hash);
  });

  app.view('intake', async ({ ack, view, client }) => {
    const meta = JSON.parse(view.private_metadata);
    const { requestBlock, text, hints } = views.readIntake(view);
    const handoff = handoffFrom(meta.handoffId);

    if (text.length < 10) {
      await ack({
        response_action: 'errors',
        errors: { [requestBlock]: 'Tell me a bit more: which products, and any prices or discounts?' },
      });
      return;
    }

    const session = createSession({
      kind: 'build', channelId: meta.channelId, userId: meta.userId, rawRequest: text, hints, handoff,
    });
    console.log(`    ${session.id}: ${text}`);

    const progress = (step) => views.progressView({
      meta, step, steps: FIRST_PASS, rawRequest: text, channelId: meta.channelId,
    });
    await ack({ response_action: 'update', view: progress(0) });
    const stopProgress = startProgress(client, view.id, progress, FIRST_PASS.length);

    try {
      session.analysis = await analyseRequest(session);
      await stopProgress();

      if (session.analysis.questions.length) {
        if (await safeUpdate(client, view.id, questionsView(session))) return;
        // The modal was closed - post anyway, open questions become assumptions.
        foldQuestionsIntoAssumptions(session.analysis);
      }

      await publish(client, session);
      await safeUpdate(client, view.id, views.doneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, views.intakeView({
        meta, text, hints, error: `${short(err.message)} Try again?`, handoff: handoffView(handoff),
      }));
    }
  });

  app.view('questions', async ({ ack, view, client }) => {
    const { sessionId } = JSON.parse(view.private_metadata);
    const session = getSession(sessionId);

    if (!session) {
      await ack({ response_action: 'errors', errors: { q_0: 'This request expired - run /configure again.' } });
      return;
    }

    session.answers = views.readAnswers(view, session.analysis.questions);

    const progress = (step) => views.progressView({
      meta: { sessionId }, step, steps: FINAL_PASS, rawRequest: session.rawRequest, channelId: session.channelId,
    });
    await ack({ response_action: 'update', view: progress(0) });
    const stopProgress = startProgress(client, view.id, progress, FINAL_PASS.length);

    try {
      session.analysis = await analyseRequest(session);
      await stopProgress();
      await publish(client, session);
      await safeUpdate(client, view.id, views.doneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, questionsView(session, `${short(err.message)} Try again?`));
    }
  });
}

/* ------------------------------------------------------------------ */

/* Opened from a quote card: the intake is pre-filled with the hand-off request. */
async function openHandoffIntake(client, triggerId, quoteSession, userId) {
  await client.views.open({
    trigger_id: triggerId,
    view: views.intakeView({
      meta: { channelId: quoteSession.card.channel, userId, handoffId: quoteSession.id },
      text: quoteSession.analysis.notInCatalog.map((n) => n.productManagerRequest).join('\n\n'),
      hints: { availability: quoteSession.customer.segment === 'Consumer' ? 'B2C' : 'B2B' },
      handoff: { customerName: quoteSession.customer.name, userId: quoteSession.userId },
    }),
  });
}

function handoffFrom(quoteSessionId) {
  const quote = quoteSessionId && getSession(quoteSessionId);
  if (!quote) return undefined;
  return { quoteSessionId: quote.id, customer: quote.customer, rawRequest: quote.rawRequest, userId: quote.userId };
}

function handoffView(handoff) {
  return handoff && { customerName: handoff.customer.name, userId: handoff.userId };
}

function questionsView(session, error) {
  return views.questionsView({
    callbackId: 'questions',
    session,
    understood: views.productLine(session.analysis.extracted.products),
    submitLabel: 'Create configuration',
    error,
  });
}

async function publish(client, session) {
  session.status = 'ready';
  await postCard(client, session, buildCard);

  // The rep's quote card says where the request went.
  const quote = session.handoff && getSession(session.handoff.quoteSessionId);
  if (quote?.card && !quote.handedOffBy) {
    quote.handedOffBy = session.userId;
    await client.chat.update({ ...quote.card, ...buildQuoteCard(quote) }).catch((err) => console.warn(err.message));
  }
}

module.exports = { registerConfigure, openHandoffIntake };
