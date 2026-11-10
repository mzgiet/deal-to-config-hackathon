/*
 * /quote flow (sales rep): intake modal (customer + request) -> Salesforce
 * customer and catalog -> Claude -> questions modal (if needed) -> quote card.
 *
 * Same 3-second rules as /configure. The customer picker is an external
 * select: Slack asks app.options() for matches as the rep types, and that
 * handler must answer within 3 seconds too.
 */

const { analyseQuote } = require('../quote');
const { findCustomers } = require('../salesforce');
const { createSession, getSession } = require('../store');
const { QUOTE_EXAMPLES } = require('./examples');
const { buildQuoteCard } = require('./quote-card');
const views = require('./views');
const { startProgress, safeUpdate, short, postCard, foldQuestionsIntoAssumptions } = require('./modal-utils');
const { truncate } = require('./format');

const FIRST_PASS = ['Reading the customer in Salesforce', 'Checking the catalog for their segment', 'Pricing the lines', 'Composing the customer page'];
const FINAL_PASS = ['Applying your answers', 'Pricing the quote'];
const MAX_NAME_LOOKUPS = 4; // each is a Salesforce call while the rep waits
const STOP_WORDS = new Set(['the', 'and', 'for', 'wants', 'want', 'they', 'their', 'give', 'more', 'with']);

function registerQuote(app) {
  app.command('/quote', async ({ command, ack, client }) => {
    await ack();
    console.log(`<-- /quote from ${command.user_name} in #${command.channel_name}`);
    await openQuoteIntake(client, command.trigger_id, {
      channelId: command.channel_id, userId: command.user_id, text: command.text.trim(),
    });
  });

  /* Customer search as the rep types. */
  app.options('customer_select', async ({ options, ack }) => {
    try {
      const customers = await findCustomers(options.value);
      await ack({
        options: customers.map((c) => ({
          text: { type: 'plain_text', text: truncate(`${c.name} · ${c.segment}${c.employees ? ` · ${c.employees} employees` : ''}`, 75) },
          value: `${c.accountId}|${c.name}`.slice(0, 150),
        })),
      });
    } catch (err) {
      console.warn(`customer search failed: ${err.message}`);
      await ack({ options: [] });
    }
  });

  app.action(/^quote_example_\d+$/, async ({ ack, body, action, client }) => {
    await ack();
    const { view } = body;
    const current = views.readQuoteIntake(view);
    const example = QUOTE_EXAMPLES[Number(action.value)];

    await safeUpdate(client, view.id, views.quoteIntakeView({
      meta: JSON.parse(view.private_metadata),
      text: example.text,
      customer: { name: example.customer },
      version: current.version + 1,
    }), view.hash);
  });

  app.view('quote_intake', async ({ ack, view, client }) => {
    const meta = JSON.parse(view.private_metadata);
    const { requestBlock, text, customer: picked, version } = views.readQuoteIntake(view);

    if (text.length < 5) {
      await ack({ response_action: 'errors', errors: { [requestBlock]: 'Tell me what the customer wants.' } });
      return;
    }

    const progress = (step) => views.progressView({ meta, step, steps: FIRST_PASS, rawRequest: text, channelId: meta.channelId });
    await ack({ response_action: 'update', view: progress(0) });
    const stopProgress = startProgress(client, view.id, progress, FIRST_PASS.length);
    const retry = (error) => views.quoteIntakeView({ meta, text, customer: picked, error, version: version + 1 });

    try {
      const customer = await resolveCustomer(picked, text);
      if (!customer.found) {
        await stopProgress();
        await safeUpdate(client, view.id, retry(customer.problem));
        return;
      }

      const session = createSession({
        kind: 'quote', channelId: meta.channelId, userId: meta.userId, rawRequest: text, customer: customer.found,
      });
      console.log(`    ${session.id}: ${customer.found.name}: ${text}`);

      session.analysis = await analyseQuote(session);
      await stopProgress();

      if (session.analysis.questions.length) {
        if (await safeUpdate(client, view.id, questionsView(session))) return;
        foldQuestionsIntoAssumptions(session.analysis);
      }

      await publish(client, session);
      await safeUpdate(client, view.id, doneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, retry(`${short(err.message)} Try again?`));
    }
  });

  app.view('quote_questions', async ({ ack, view, client }) => {
    const { sessionId } = JSON.parse(view.private_metadata);
    const session = getSession(sessionId);

    if (!session) {
      await ack({ response_action: 'errors', errors: { q_0: 'This request expired - run /quote again.' } });
      return;
    }

    session.answers = views.readAnswers(view, session.analysis.questions);
    const progress = (step) => views.progressView({
      meta: { sessionId }, step, steps: FINAL_PASS, rawRequest: session.rawRequest, channelId: session.channelId,
    });
    await ack({ response_action: 'update', view: progress(0) });
    const stopProgress = startProgress(client, view.id, progress, FINAL_PASS.length);

    try {
      session.analysis = await analyseQuote(session);
      await stopProgress();
      await publish(client, session);
      await safeUpdate(client, view.id, doneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, questionsView(session, `${short(err.message)} Try again?`));
    }
  });
}

/* ------------------------------------------------------------------ */

function openQuoteIntake(client, triggerId, { channelId, userId, text = '', customer }) {
  return client.views.open({
    trigger_id: triggerId,
    view: views.quoteIntakeView({ meta: { channelId, userId }, text, customer }),
  });
}

/*
 * Picked in the select -> that account. Otherwise look for a customer named
 * in the request ("Acme wants ..."): each word of 3+ letters is searched,
 * and the first word with exactly one match wins.
 */
async function resolveCustomer(picked, text) {
  if (picked) {
    const matches = await findCustomers(picked.name);
    const found = matches.find((c) => c.accountId === picked.accountId)
      ?? matches.find((c) => c.name.toLowerCase() === picked.name.toLowerCase())
      ?? (matches.length === 1 ? matches[0] : undefined);
    return found ? { found } : { problem: `I can't find "${picked.name}" in Salesforce any more.` };
  }

  const words = [...new Set(text.match(/\p{Lu}[\p{L}&'-]{2,}/gu) ?? [])]
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, MAX_NAME_LOOKUPS);
  for (const word of words) {
    const matches = await findCustomers(word);
    if (matches.length === 1) return { found: matches[0] };
  }
  return { problem: 'Which customer is it for? Pick them in the Customer field.' };
}

function questionsView(session, error) {
  return views.questionsView({
    callbackId: 'quote_questions',
    session,
    understood: `*${session.customer.name}* · ${session.analysis.lines.map((l) => l.product).join(', ') || 'nothing from the catalog yet'}`,
    submitLabel: 'Prepare offer',
    error,
  });
}

function doneView(session) {
  return views.doneView(session, {
    what: 'Offer posted',
    next: session.analysis.lines.length
      ? 'Check it there and click *Create quote* when it looks right.'
      : 'The catalog does not sell this yet. Send it to the product manager from the card.',
  });
}

async function publish(client, session) {
  session.status = 'ready';
  await postCard(client, session, buildQuoteCard);
}

module.exports = { registerQuote, openQuoteIntake };
