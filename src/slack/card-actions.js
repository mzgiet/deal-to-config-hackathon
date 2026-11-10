/*
 * Buttons on the cards.
 *
 *   build_config       /configure card: build the offer in Salesforce
 *   create_quote       /quote card: create the quote in Salesforce
 *   handoff_quote      /quote card: the catalog lacks it -> /configure, pre-filled
 *   quote_from_build   built offer -> quote it (for the hand-off customer, or pick one)
 *   card_menu          the "…" menu: Discard
 *   open_*             URL buttons; Slack still expects an ack
 */

const { getSession, createSession } = require('../store');
const { toContract } = require('../contract');
const { analyseQuote, toQuoteRequest } = require('../quote');
const { build, createQuote, refreshPricing, findCustomers } = require('../salesforce');
const { buildCard, resultMessage } = require('./card');
const { buildQuoteCard, quoteResultMessage } = require('./quote-card');
const { openHandoffIntake } = require('./configure');
const { openQuoteIntake } = require('./quote');
const { foldQuestionsIntoAssumptions, short } = require('./modal-utils');
const { section, truncate } = require('./format');

const render = (session) => (session.kind === 'quote' ? buildQuoteCard(session) : buildCard(session));
const updateCard = (client, session) => client.chat.update({ ...session.card, ...render(session) });

function registerCardActions(app) {
  app.action('build_config', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);
    if (!session) return expired(respond, '/configure');
    if (!['ready', 'failed'].includes(session.status)) return; // double click

    console.log(`<-- build ${session.id} by ${body.user.name}`);
    session.status = 'building';
    await updateCard(client, session);

    try {
      session.result = await build(toContract(session));
      if (session.result.status === 'exists') {
        session.status = 'exists';
      } else {
        // Quotes price from decision tables; without a refresh the new product quotes wrong.
        session.pricingRefreshed = await refreshPricing();
        session.status = 'built';
      }
      await updateCard(client, session);
      await client.chat.postMessage({ channel: session.card.channel, thread_ts: session.card.ts, ...resultMessage(session) });
    } catch (err) {
      console.error(err);
      session.status = 'failed';
      session.error = err.message;
      await updateCard(client, session);
    }
  });

  app.action('create_quote', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);
    if (!session) return expired(respond, '/quote');
    if (!['ready', 'failed'].includes(session.status) || !session.analysis.lines.length) return;

    console.log(`<-- create quote ${session.id} by ${body.user.name}`);
    session.status = 'creating';
    await updateCard(client, session);

    try {
      session.result = await createQuote(toQuoteRequest(session));
      session.status = 'created';
      await updateCard(client, session);
      await client.chat.postMessage({ channel: session.card.channel, thread_ts: session.card.ts, ...quoteResultMessage(session) });
    } catch (err) {
      console.error(err);
      session.status = 'failed';
      session.error = err.message;
      await updateCard(client, session);
    }
  });

  app.action('handoff_quote', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);
    if (!session) return expired(respond, '/quote');

    console.log(`<-- hand-off ${session.id} by ${body.user.name}`);
    await openHandoffIntake(client, body.trigger_id, session, body.user.id);
  });

  /*
   * A built offer from a hand-off: quote it for that customer straight away,
   * no modal - the rep's request is already known. Otherwise open /quote.
   */
  app.action('quote_from_build', async ({ ack, action, body, client, respond }) => {
    await ack();
    const built = getSession(action.value);
    if (!built) return expired(respond, '/configure');

    const products = built.analysis.extracted.products.map((p) => p.name);
    const bundleName = built.analysis.extracted.bundle?.name;
    if (!built.handoff) {
      await openQuoteIntake(client, body.trigger_id, {
        channelId: built.card.channel,
        userId: body.user.id,
        text: `wants ${bundleName || products.join(' and ')}`,
      });
      return;
    }
    if (built.quotedAs) return; // double click
    built.quotedAs = 'pending';

    console.log(`<-- quote ${built.id} for ${built.handoff.customer.name} by ${body.user.name}`);
    const placeholder = await client.chat.postMessage({
      channel: built.card.channel,
      text: `Preparing the quote for ${built.handoff.customer.name}…`,
      blocks: [section(`*Preparing the quote for ${built.handoff.customer.name}…* Reading the customer and the updated catalog.`)],
    });

    try {
      // Fresh customer record: open quotes and services may have changed.
      const fresh = (await findCustomers(built.handoff.customer.name))
        .find((c) => c.accountId === built.handoff.customer.accountId) ?? built.handoff.customer;
      const session = createSession({
        kind: 'quote',
        channelId: built.card.channel,
        userId: built.handoff.userId,
        rawRequest: built.handoff.rawRequest,
        customer: fresh,
      });
      session.analysis = await analyseQuote(session);
      foldQuestionsIntoAssumptions(session.analysis); // no modal here: questions become things to confirm
      session.status = 'ready';
      session.card = { channel: placeholder.channel, ts: placeholder.ts };
      built.quotedAs = session.id;
      await updateCard(client, session);
    } catch (err) {
      console.error(err);
      built.quotedAs = null;
      await client.chat.update({
        channel: placeholder.channel,
        ts: placeholder.ts,
        text: `Could not prepare the quote: ${short(err.message)}`,
        blocks: [section(`*Could not prepare the quote.* ${truncate(short(err.message), 300)}\nTry *Quote it* again, or run /quote.`)],
      });
    }
  });

  app.action('card_menu', async ({ ack, action, body, client, respond }) => {
    await ack();
    const [verb, id] = action.selected_option.value.split(':');
    const session = getSession(id);
    if (!session) return expired(respond, '/configure or /quote');

    if (verb === 'discard') {
      const open = session.kind === 'quote' ? ['ready', 'failed'] : ['ready', 'failed', 'exists'];
      if (!open.includes(session.status)) return;
      session.status = 'discarded';
      session.closedBy = body.user.id;
      await updateCard(client, session);
    }
  });

  app.action(/^open_/, async ({ ack }) => { await ack(); });
}

function expired(respond, command) {
  return respond({
    response_type: 'ephemeral',
    replace_original: false,
    text: `That card is no longer in memory (the app was restarted). Run ${command} again.`,
  });
}

module.exports = { registerCardActions };
