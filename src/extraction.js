/*
 * Rep's words -> analysis (contract fields + follow-up questions).
 *
 * The prompt is the skill in skills/sales-request-extraction.md - the same
 * file that goes into Context Builder. Edit the skill, restart, done.
 * normalizeAnalysis() then enforces Salesforce's validation rules in code.
 */

const fs = require('node:fs');
const path = require('node:path');
const { generateJson } = require('./llm');
const { ANALYSIS_SCHEMA, normalizeAnalysis } = require('./contract');

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'sales-request-extraction.md');
const MAX_QUESTIONS = 3;

// Front matter is metadata for Context Builder, not prompt.
const SKILL = fs.readFileSync(SKILL_PATH, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim();

/*
 * First pass:  analyseRequest({ rawRequest, hints })          -> may return questions
 * Final pass:  analyseRequest({ rawRequest, hints, answers }) -> never returns questions
 */
async function analyseRequest({ rawRequest, hints = {}, answers = [] }) {
  const finalPass = answers.length > 0;
  const analysis = await generateJson({
    system: SKILL,
    input: buildInput({ rawRequest, hints, answers }),
    schema: ANALYSIS_SCHEMA,
  });

  const questions = finalPass ? [] : analysis.questions.slice(0, MAX_QUESTIONS);
  return { ...normalizeAnalysis(analysis), questions };
}

/*
 * Revision:    reviseAnalysis({ session, change }) -> same shape, never questions.
 * Claude sees the original request, the rep's earlier answers, the current
 * configuration and the requested change.
 */
async function reviseAnalysis({ session, change }) {
  const { extracted, summary, assumptions } = session.analysis;
  const input = [
    buildInput(session),
    `Current configuration:\n${JSON.stringify({ extracted, summary, assumptions }, null, 2)}`,
    `Requested change:\n${change}`,
  ].join('\n\n');

  const analysis = await generateJson({ system: SKILL, input, schema: ANALYSIS_SCHEMA });
  return { ...normalizeAnalysis(analysis), questions: [] };
}

function buildInput({ rawRequest, hints = {}, answers = [] }) {
  const parts = [`Client request, as described by the sales rep:\n${rawRequest}`];

  if (hints.availability) parts.push(`Rep's selections:\nWho buys: ${hints.availability}`);

  if (answers.length) {
    parts.push(
      'Answers to your questions:\n' +
      answers.map((a) => `- ${a.question}\n  ${a.answer}`).join('\n'),
    );
  }

  return parts.join('\n\n');
}

module.exports = { analyseRequest, reviseAnalysis };
