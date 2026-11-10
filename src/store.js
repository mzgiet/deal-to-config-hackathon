/*
 * In-memory session store. One session per /configure, keyed by request id.
 * A Map is enough for a demo - state lives in the orchestrator.
 *
 * Session: { id, channelId, userId, rawRequest, hints, answers,
 *            analysis, revisions: [{ userId, text }], status, card: { channel, ts }, result, error }
 * status:  draft -> ready -> building -> built | failed | exists, or discarded
 */

const crypto = require('node:crypto');

const sessions = new Map();
let counter = 0;
// Ids end up on Salesforce records, so they must not repeat after a restart.
// (Salesforce returns the OLD link for a repeated id.)
const RUN = crypto.randomBytes(3).toString('hex');

function createSession(fields) {
  const id = `req_${RUN}_${String(++counter).padStart(3, '0')}`;
  const session = { id, status: 'draft', answers: [], ...fields };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

module.exports = { createSession, getSession };
