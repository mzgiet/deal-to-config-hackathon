/*
 * Sales Copilot - Slack orchestrator.
 *
 * Socket Mode: the app opens a WebSocket from this machine, so there is no
 * public URL and nothing to deploy. Setup steps: docs/slack-setup.md.
 *
 *   npm start      (reads .env)
 */

const { config, assertConfig } = require('./config');

assertConfig();

const { App } = require('@slack/bolt');
const { backendName } = require('./llm');
const { builderName } = require('./builder');
const { registerSlack } = require('./slack');

const app = new App({
  token: config.slack.botToken,
  appToken: config.slack.appToken,
  socketMode: true,
});

registerSlack(app);

app.error(async (err) => {
  console.error('Unhandled Slack error:', err);
});

(async () => {
  await app.start();
  console.log(`Claude:  ${backendName}`);
  console.log(`Builder: ${builderName}`);
  console.log('Sales Copilot is listening (Socket Mode). Try /configure in Slack.');
})();
