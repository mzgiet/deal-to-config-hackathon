/*
 * /configure flow: intake modal -> Claude -> questions modal (if needed)
 * -> Claude final pass -> card in the channel.
 *
 * Slack gives 3 seconds to ack every command, action and submission. Claude
 * takes longer, so each submission acks by swapping the modal to a progress
 * view, then the slow work runs and the modal is updated by view id.
 */

const { analyseRequest } = require('../extraction');
const { createSession, getSession } = require('../store');
const { EXAMPLES } = require('./examples');
const { buildCard } = require('./card');
const views = require('./views');
const { startProgress, safeUpdate, short } = require('./modal-utils');

const FIRST_PASS = ['Reading the request', 'Matching products and prices', 'Checking what is missing'];
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

    if (text.length < 10) {
      await ack({
        response_action: 'errors',
        errors: { [requestBlock]: 'Tell me a bit more: which products, and any prices or discounts?' },
      });
      return;
    }

    const session = createSession({ ...meta, rawRequest: text, hints });
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
        if (await safeUpdate(client, view.id, views.questionsView(session))) return;
        // The rep closed the modal - post anyway, open questions become assumptions.
        foldQuestionsIntoAssumptions(session.analysis);
      }

      await publishCard(client, session);
      await safeUpdate(client, view.id, views.doneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, views.intakeView({
        meta, text, hints, error: `That didn't work: ${short(err.message)} Try again?`,
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
      await publishCard(client, session);
      await safeUpdate(client, view.id, views.doneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, views.questionsView(session, `That didn't work: ${short(err.message)} Try again?`));
    }
  });
}

/* ------------------------------------------------------------------ */

async function publishCard(client, session) {
  session.status = 'ready';
  try {
    const res = await client.chat.postMessage({ channel: session.channelId, ...buildCard(session) });
    session.card = { channel: res.channel, ts: res.ts };
  } catch (err) {
    if (['not_in_channel', 'channel_not_found'].includes(err.data?.error)) {
      throw new Error('I can\'t post in this channel. Invite me with /invite @Sales Copilot, or use a public channel.');
    }
    throw err;
  }
}

function foldQuestionsIntoAssumptions(analysis) {
  for (const q of analysis.questions) {
    analysis.assumptions.push(`${q.question} (not answered${q.suggested ? `, assumed ${q.suggested}` : ''})`);
  }
  analysis.questions = [];
}

module.exports = { registerConfigure };
