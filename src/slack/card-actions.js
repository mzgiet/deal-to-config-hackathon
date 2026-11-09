/*
 * Buttons on the configuration card: Build it, Discard, Open configurator.
 */

const { getSession } = require('../store');
const { toContract } = require('../contract');
const { buildConfiguration } = require('../builder');
const { buildCard, resultMessage } = require('./card');

function registerCardActions(app) {
  app.action('build_config', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);

    if (!session) {
      await expired(respond);
      return;
    }
    if (!['ready', 'failed'].includes(session.status)) return; // double click

    const { channel, ts } = session.card;
    console.log(`<-- build ${session.id} by ${body.user.name}`);

    session.status = 'building';
    await client.chat.update({ channel, ts, ...buildCard(session) });

    try {
      session.result = await buildConfiguration(toContract(session));
      session.status = 'built';
      await client.chat.update({ channel, ts, ...buildCard(session) });
      await client.chat.postMessage({ channel, thread_ts: ts, ...resultMessage(session) });
    } catch (err) {
      console.error(err);
      session.status = 'failed';
      await client.chat.update({ channel, ts, ...buildCard(session) });
      await client.chat.postMessage({ channel, thread_ts: ts, text: `:x: Build failed: ${err.message}` });
    }
  });

  app.action('discard_config', async ({ ack, action, body, client, respond }) => {
    await ack();
    const session = getSession(action.value);

    if (!session) {
      await expired(respond);
      return;
    }
    if (!['ready', 'failed'].includes(session.status)) return;

    session.status = 'discarded';
    session.closedBy = body.user.id;
    await client.chat.update({ ...session.card, ...buildCard(session) });
  });

  // URL buttons still send an action; Slack expects an ack.
  app.action('open_configurator', async ({ ack }) => { await ack(); });
}

function expired(respond) {
  return respond({
    response_type: 'ephemeral',
    replace_original: false,
    text: 'That request is no longer in memory (the app was restarted). Run /configure again.',
  });
}

module.exports = { registerCardActions };
