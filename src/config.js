/*
 * All environment configuration in one place. Read once at startup.
 */

const env = process.env;

const config = {
  slack: {
    botToken: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
  },
  claude: {
    // API key present -> Anthropic API, otherwise headless Claude Code (`claude -p`).
    apiKey: env.ANTHROPIC_API_KEY,
    bin: env.CLAUDE_BIN || 'claude',
    model: env.CLAUDE_MODEL,
  },
  salesforce: {
    domain: env.SF_DOMAIN?.replace(/\/$/, ''),
    clientId: env.SF_CLIENT_ID,
    clientSecret: env.SF_CLIENT_SECRET,
  },
};

config.salesforce.enabled = Boolean(
  config.salesforce.domain && config.salesforce.clientId && config.salesforce.clientSecret,
);

function assertConfig() {
  const missing = [
    ['SLACK_BOT_TOKEN', 'Install App -> Bot User OAuth Token (xoxb-...)'],
    ['SLACK_APP_TOKEN', 'Basic Information -> App-Level Tokens (xapp-...)'],
  ].filter(([name]) => !env[name]);

  if (missing.length) {
    console.error('Missing configuration in .env:');
    for (const [name, where] of missing) console.error(`  ${name}  <- ${where}`);
    process.exit(1);
  }
}

module.exports = { config, assertConfig };
