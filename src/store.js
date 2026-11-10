/*
 * In-memory session store. One session per card, keyed by id.
 * A Map is enough for a demo - state lives in the orchestrator.
 *
 * kind 'build' (/configure):
 *   { id, kind, channelId, userId, rawRequest, hints, answers, analysis,
 *     handoff?: { quoteSessionId, customer, rawRequest, userId },
 *     revisions, status, card: { channel, ts }, result, pricingRefreshed }
 *   status: draft -> ready -> building -> built | failed | exists, or discarded
 *
 * kind 'quote' (/quote):
 *   { id, kind, channelId, userId, rawRequest, customer, answers, analysis,
 *     revisions, status, card, result, handedOffBy }
 *   status: draft -> ready -> creating -> created | failed, or discarded
 *   (ready + handedOffBy: the missing product went to the product manager)
 */

const crypto = require('node:crypto');

const sessions = new Map();
let counter = 0;
// Build ids end up on Salesforce records, so they must not repeat after a
// restart (Salesforce returns the OLD link for a repeated id).
const RUN = crypto.randomBytes(3).toString('hex');
const PREFIX = { build: 'req', quote: 'quo' };

function createSession({ kind = 'build', ...fields }) {
  const id = `${PREFIX[kind]}_${RUN}_${String(++counter).padStart(3, '0')}`;
  const session = { id, kind, status: 'draft', answers: [], revisions: [], ...fields };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

module.exports = { createSession, getSession };
