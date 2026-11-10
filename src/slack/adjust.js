/*
 * Adjust: revise a card in plain words before building it or creating the quote.
 *
 * Button on the card -> modal ("What should change?") -> progress -> Claude
 * revises the configuration or the offer -> the existing card is updated in place.
 * Same 3-second rules as /configure: open the modal right after ack(), and
 * ack the submission by swapping the modal to a progress view.
 */

const { reviseAnalysis } = require('../extraction');
const { reviseQuote } = require('../quote');
const { getSession } = require('../store');
const { buildCard } = require('./card');
const { buildQuoteCard } = require('./quote-card');
const views = require('./views');
const { startProgress, safeUpdate, short } = require('./modal-utils');

const KIND = {
  // 'exists': the product manager can rename the product and build again.
  build: { editable: ['ready', 'failed', 'exists'], revise: reviseAnalysis, render: buildCard, steps: ['Reading your change', 'Updating the configuration'] },
  quote: { editable: ['ready', 'failed'], revise: reviseQuote, render: buildQuoteCard, steps: ['Reading your change', 'Pricing it again', 'Composing the page again'] },
};
const MIN_LENGTH = 3;

function registerAdjust(app) {
  app.action('adjust_card', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);

    if (!session) {
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: 'That card is no longer in memory (the app was restarted). Run the command again.',
      });
      return;
    }
    if (!KIND[session.kind].editable.includes(session.status)) return;

    console.log(`<-- adjust ${session.id} by ${body.user.name}`);
    await client.views.open({ trigger_id: body.trigger_id, view: views.adjustView(session) });
  });

  app.view('adjust', async ({ ack, view, body, client }) => {
    const { sessionId } = JSON.parse(view.private_metadata);
    const session = getSession(sessionId);
    const change = views.readAdjust(view);

    if (!session) {
      await ack({ response_action: 'errors', errors: { change: 'This card expired - run the command again.' } });
      return;
    }
    if (change.length < MIN_LENGTH) {
      await ack({ response_action: 'errors', errors: { change: 'Tell me what to change, e.g. "15% instead of 10%".' } });
      return;
    }

    const kind = KIND[session.kind];
    console.log(`    ${session.id} adjust: ${change}`);
    const progress = (step) => views.progressView({
      meta: { sessionId }, step, steps: kind.steps, rawRequest: change, channelId: session.card.channel,
    });
    await ack({ response_action: 'update', view: progress(0) });
    const stopProgress = startProgress(client, view.id, progress, kind.steps.length);

    try {
      const analysis = await kind.revise({ session, change });
      await stopProgress();

      if (!kind.editable.includes(session.status)) {
        // Someone completed or discarded the card while Claude was working - leave it alone.
        await safeUpdate(client, view.id, views.adjustBlockedView(session));
        return;
      }

      session.analysis = analysis;
      if (['exists', 'failed'].includes(session.status)) session.status = 'ready'; // revised - can go again
      session.revisions = [...session.revisions, { userId: body.user.id, text: change }];
      await client.chat.update({ ...session.card, ...kind.render(session) });
      await safeUpdate(client, view.id, views.adjustDoneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, views.adjustView(session, { change, error: `${short(err.message)} Try again?` }));
    }
  });
}

module.exports = { registerAdjust };
