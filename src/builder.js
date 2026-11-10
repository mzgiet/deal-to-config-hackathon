/*
 * Hand the contract to the Salesforce side and get back { requestId, status, artifactUrl }.
 *
 * SF_DOMAIN + SF_CLIENT_ID + SF_CLIENT_SECRET set -> Apex REST endpoint in the
 * sandbox, authenticated with OAuth client credentials (server to server).
 * Otherwise -> stub, so the demo path runs end to end without a Salesforce org.
 */

const { config } = require('./config');

const BUILD_PATH = '/services/apexrest/salescopilot/build';
const TIMEOUT_MS = 90_000;

function buildConfiguration(contract) {
  console.log('--> handing to builder:', JSON.stringify(contract, null, 2));
  return config.salesforce.enabled ? buildInSalesforce(contract) : buildStub(contract);
}

/* ------------------------------------------------------------------ */

let sfToken = null;

async function getSalesforceToken() {
  if (sfToken) return sfToken;

  const { domain, clientId, clientSecret } = config.salesforce;
  const res = await fetch(`${domain}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Salesforce auth failed: ${await res.text()}`);

  sfToken = (await res.json()).access_token;
  return sfToken;
}

async function buildInSalesforce(contract) {
  const call = async () => fetch(`${config.salesforce.domain}${BUILD_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getSalesforceToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contract),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  let res = await call();
  if (res.status === 401) { // token expired - refresh once
    sfToken = null;
    res = await call();
  }
  if (!res.ok) throw new Error(await errorMessage(res));

  const result = await res.json();
  if (result.status !== 'created') throw new Error(result.error || `Salesforce returned status "${result.status}"`);
  return result;
}

// Dawid's endpoint explains rejections in { error }; show that, not raw JSON.
async function errorMessage(res) {
  const text = await res.text();
  try {
    const { error } = JSON.parse(text);
    if (error) return String(error);
  } catch { /* not JSON - fall through */ }
  return `Salesforce returned ${res.status}: ${text}`;
}

/* ------------------------------------------------------------------ */

async function buildStub(contract) {
  await new Promise((r) => setTimeout(r, 1500));

  return {
    requestId: contract.requestId,
    status: 'created',
    artifactUrl: `https://example.invalid/configurator/${contract.requestId}`,
  };
}

const builderName = config.salesforce.enabled ? `Salesforce (${config.salesforce.domain})` : 'stub';

module.exports = { buildConfiguration, builderName };
