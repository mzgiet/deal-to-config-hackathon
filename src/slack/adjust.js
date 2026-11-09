/*
 * Adjust: the rep revises a card in plain words before building it.
 *
 * Button on the card -> modal ("What should change?") -> progress -> Claude
 * revises the configuration -> the existing card is updated in place.
 * Same 3-second rules as /configure: open the modal right after ack(), and
 * ack the submission by swapping the modal to a progress view.
 */

const { reviseAnalysis } = require('../extraction');
const { getSession } = require('../store');
const { buildCard } = require('./card');
const views = require('./views');
const { startProgress, safeUpdate, short } = require('./modal-utils');

const STEPS = ['Reading your change', 'Updating the configuration'];
const EDITABLE = ['ready', 'failed'];
const MIN_LENGTH = 3;

function registerAdjust(app) {
  app.action('adjust_config', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);

    if (!session) {
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: 'That request is no longer in memory (the app was restarted). Run /configure again.',
      });
      return;
    }
    if (!EDITABLE.includes(session.status)) return; // building, built or discarded

    console.log(`<-- adjust ${session.id} by ${body.user.name}`);
    await client.views.open({ trigger_id: body.trigger_id, view: views.adjustView(session) });
  });

  app.view('adjust', async ({ ack, view, body, client }) => {
    const { sessionId } = JSON.parse(view.private_metadata);
    const session = getSession(sessionId);
    const change = views.readAdjust(view);

    if (!session) {
      await ack({ response_action: 'errors', errors: { change: 'This request expired - run /configure again.' } });
      return;
    }
    if (change.length < MIN_LENGTH) {
      await ack({ response_action: 'errors', errors: { change: 'Tell me what to change, e.g. "15% instead of 10%".' } });
      return;
    }

    console.log(`    ${session.id} adjust: ${change}`);
    const progress = (step) => views.progressView({
      meta: { sessionId }, step, steps: STEPS, rawRequest: change, channelId: session.card.channel,
    });
    await ack({ response_action: 'update', view: progress(0) });
    const stopProgress = startProgress(client, view.id, progress, STEPS.length);

    try {
      const analysis = await reviseAnalysis({ session, change });
      await stopProgress();

      if (!EDITABLE.includes(session.status)) {
        // Someone clicked Build or Discard while Claude was working - leave the card alone.
        await safeUpdate(client, view.id, views.adjustBlockedView(session));
        return;
      }

      session.analysis = analysis;
      session.revisions = [...(session.revisions ?? []), { userId: body.user.id, text: change }];
      await client.chat.update({ ...session.card, ...buildCard(session) });
      await safeUpdate(client, view.id, views.adjustDoneView(session));
    } catch (err) {
      await stopProgress();
      console.error(err);
      await safeUpdate(client, view.id, views.adjustView(session, {
        change, error: `That didn't work: ${short(err.message)} Try again?`,
      }));
    }
  });
}

module.exports = { registerAdjust };
