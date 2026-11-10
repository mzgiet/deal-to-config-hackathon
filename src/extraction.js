/*
 * /configure: the product manager's words -> analysis (contract fields + questions).
 *
 * The prompt is the skill in skills/sales-request-extraction.md - the same
 * file that goes into Context Builder. Edit the skill, restart, done.
 * Claude sees the current catalog, so a bundle can reuse catalog products and
 * a product that already exists is spotted before the build.
 * normalizeAnalysis() then enforces Salesforce's validation rules in code.
 */

const { generateJson } = require('./llm');
const { ANALYSIS_SCHEMA, normalizeAnalysis } = require('./contract');
const { getCatalog } = require('./salesforce');
const { loadSkill, catalogForPrompt } = require('./prompt-utils');

const SKILL = loadSkill('sales-request-extraction.md');
const MAX_QUESTIONS = 3;

/*
 * First pass:  analyseRequest(session)               -> may return questions
 * Final pass:  analyseRequest(session with answers)  -> never returns questions
 * session: { rawRequest, hints, answers, handoff? }
 */
async function analyseRequest(session) {
  const finalPass = session.answers?.length > 0;
  const catalog = await readCatalog();
  const analysis = await generateJson({
    system: SKILL,
    input: buildInput(session, catalog),
    schema: ANALYSIS_SCHEMA,
  });

  const questions = finalPass ? [] : analysis.questions.slice(0, MAX_QUESTIONS);
  return { ...normalizeAnalysis(analysis, catalog), questions };
}

/*
 * Revision: same shape, never questions. Claude sees the original request,
 * the earlier answers, the current configuration and the requested change.
 */
async function reviseAnalysis({ session, change }) {
  const catalog = await readCatalog();
  const { extracted, summary, assumptions, presentation } = session.analysis;
  const input = [
    buildInput(session, catalog),
    `Current configuration:\n${JSON.stringify({ extracted, summary, assumptions, presentation }, null, 2)}`,
    `Requested change:\n${change}`,
  ].join('\n\n');

  const analysis = await generateJson({ system: SKILL, input, schema: ANALYSIS_SCHEMA });
  return { ...normalizeAnalysis(analysis, catalog), questions: [] };
}

// The catalog makes the result better, but a build must not depend on reading it.
async function readCatalog() {
  try {
    return (await getCatalog()).products ?? [];
  } catch (err) {
    console.warn(`catalog not read, extracting without it: ${err.message}`);
    return [];
  }
}

function buildInput({ rawRequest, hints = {}, answers = [], handoff }, catalog) {
  const parts = [`Offer request, in the words of the person asking:\n${rawRequest}`];

  if (hints.availability) parts.push(`Explicit selections:\nWho buys: ${hints.availability}`);

  if (handoff) {
    const c = handoff.customer;
    parts.push(
      'This request was handed over by a sales rep for a customer deal. Compose the page for this customer:\n' +
      `Customer: ${c.name} (${c.segment}, ${c.industry || 'industry not given'}, ${c.employees ?? '?'} employees)\n` +
      `The rep's words: ${handoff.rawRequest}` +
      (handoff.quantity ? `\nQuantity the customer needs: ${handoff.quantity}` : ''),
    );
  }

  parts.push(`Current catalog:\n${catalogForPrompt(catalog)}`);

  if (answers.length) {
    parts.push(
      'Answers to your questions:\n' +
      answers.map((a) => `- ${a.question}\n  ${a.answer}`).join('\n'),
    );
  }

  return parts.join('\n\n');
}

module.exports = { analyseRequest, reviseAnalysis };
