/*
 * Every call to the Salesforce side goes through here.
 *
 * SF_DOMAIN + SF_CLIENT_ID + SF_CLIENT_SECRET set -> Apex REST endpoints in the
 * sandbox, OAuth client credentials (server to server, Run As user).
 * Otherwise -> a stub with fictional data, so every flow runs without an org.
 *
 *   build(contract)          POST build    -> { requestId, status, artifactUrl } | 409 { status: 'exists', ... }
 *   getCatalog(audience?)    GET  catalog  -> { maxDiscountWithoutApprovalPct, products[] }
 *   findCustomers(name)      GET  customer -> customers[] (up to 5)
 *   createQuote(body)        POST quote    -> { quoteId, quoteUrl, pageUrl, quoteStatus, grandTotal, ... }
 *   refreshPricing()         decision tables, so quotes price a product built a moment ago
 */

const { config } = require('./config');
const stub = require('./salesforce-stub');

const API = '/services/apexrest/salescopilot';
const SYNC_PATH = '/services/data/v66.0/connect/core-pricing/sync/syncData';
const TIMEOUT_MS = 90_000;
const CATALOG_TTL_MS = 30_000;

const enabled = config.salesforce.enabled;
const salesforceName = enabled ? `Salesforce (${config.salesforce.domain})` : 'stub';

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

let token = null;

async function getToken() {
  if (token) return token;

  const { domain, clientId, clientSecret } = config.salesforce;
  const res = await fetch(`${domain}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Salesforce auth failed: ${await res.text()}`);

  token = (await res.json()).access_token;
  return token;
}

/* Returns the raw Response; the caller decides which statuses are answers. */
async function request(method, path, body) {
  const call = async () => fetch(`${config.salesforce.domain}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  let res = await call();
  if (res.status === 401) { // token expired - refresh once
    token = null;
    res = await call();
  }
  return res;
}

async function requestJson(method, path, body) {
  const res = await request(method, path, body);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

// The endpoints explain rejections in { error }; show that, not raw JSON.
async function errorMessage(res) {
  const text = await res.text();
  try {
    const { error } = JSON.parse(text);
    if (error) return String(error);
  } catch { /* not JSON - fall through */ }
  return `Salesforce returned ${res.status}: ${text.slice(0, 300)}`;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

async function build(contract) {
  console.log('--> build:', JSON.stringify(contract, null, 2));
  if (!enabled) return stub.build(contract);

  const res = await request('POST', `${API}/build`, contract);
  // 409 "exists": a product with that name is already in the catalog. Nothing
  // failed - hand it back so the card can offer the existing offer instead.
  if (res.status === 409) {
    const body = await res.clone().json().catch(() => null);
    if (body?.status === 'exists') return body;
  }
  if (!res.ok) throw new Error(await errorMessage(res));

  const result = await res.json();
  if (result.status !== 'created') throw new Error(result.error || `Salesforce returned status "${result.status}"`);
  catalogCache.clear(); // the catalog just changed
  return result;
}

const catalogCache = new Map();

/* audience: 'Business' | 'Consumer' | undefined (everything) */
async function getCatalog(audience) {
  const key = audience ?? '*';
  const hit = catalogCache.get(key);
  if (hit && Date.now() - hit.at < CATALOG_TTL_MS) return hit.value;

  const value = enabled
    ? await requestJson('GET', `${API}/catalog${audience ? `?audience=${encodeURIComponent(audience)}` : ''}`)
    : stub.catalog(audience);
  catalogCache.set(key, { at: Date.now(), value });
  return value;
}

async function findCustomers(name) {
  const query = String(name ?? '').trim();
  if (query.length < 2) return [];
  if (!enabled) return stub.customers(query);

  const res = await request('GET', `${API}/customer?name=${encodeURIComponent(query)}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()).customers ?? [];
}

async function createQuote(body) {
  console.log('--> quote:', JSON.stringify(body, null, 2));
  if (!enabled) return stub.quote(body);
  return requestJson('POST', `${API}/quote`, body);
}

/*
 * Revenue Cloud prices quotes from decision tables that a build does not
 * refresh. Salesforce's guidance is to run the sync twice. Best effort:
 * returns false (and logs) when the Run As user may not call it.
 */
async function refreshPricing() {
  if (!enabled) return true;
  try {
    for (let i = 0; i < 2; i += 1) {
      const res = await request('GET', SYNC_PATH); // the sync endpoint allows GET and HEAD only
      if (!res.ok) throw new Error(await errorMessage(res));
    }
    return true;
  } catch (err) {
    console.warn(`pricing refresh failed: ${err.message}`);
    return false;
  }
}

module.exports = { build, getCatalog, findCustomers, createQuote, refreshPricing, salesforceName };
