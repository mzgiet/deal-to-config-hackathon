/*
 * /quote: the sales rep's words + a Salesforce customer -> quote proposal.
 *
 * Claude sees the customer (services, contract end, open quotes) and the
 * catalog for their segment, and proposes lines from that catalog only.
 * Anything the catalog does not sell comes back in `notInCatalog`, written as
 * a request for the product manager (the /configure hand-off).
 *
 * QUOTE_SCHEMA     - Claude's output.
 * normalizeQuote() - forces it through POST quote's validation and prices it
 *                    locally (pricing.js), so the card shows what will be quoted.
 * toQuoteRequest() - the POST quote body.
 *
 * The prompt is skills/sales-quote-extraction.md.
 */

const { generateJson } = require('./llm');
const { strictObject, QUESTIONS_SCHEMA } = require('./contract');
const {
  QUOTE_SECTIONS, presentationSchema, normalizePresentation, toPresentationPayload,
} = require('./presentation');
const { priceQuote } = require('./pricing');
const { getCatalog } = require('./salesforce');
const { loadSkill, catalogForPrompt } = require('./prompt-utils');

const SKILL = loadSkill('sales-quote-extraction.md');
const MAX_QUESTIONS = 3;
const SHOWN_QUOTES = 5;

const QUOTE_SCHEMA = strictObject({
  lines: {
    type: 'array',
    items: strictObject({
      product: { type: 'string' },
      quantity: { type: 'number' },
      discountPct: { type: 'number' },
      addOns: { type: 'array', items: { type: 'string' } },
    }),
  },
  notInCatalog: {
    type: 'array',
    items: strictObject({
      asked: { type: 'string' },
      productManagerRequest: { type: 'string' },
    }),
  },
  summary: { type: 'string' },
  assumptions: { type: 'array', items: { type: 'string' } },
  presentation: presentationSchema(QUOTE_SECTIONS),
  questions: QUESTIONS_SCHEMA,
});

/* session: { rawRequest, customer, answers } */
async function analyseQuote(session) {
  const finalPass = session.answers?.length > 0;
  const catalog = await getCatalog(session.customer.segment);
  const analysis = await generateJson({ system: SKILL, input: buildInput(session, catalog), schema: QUOTE_SCHEMA });

  const questions = finalPass ? [] : analysis.questions.slice(0, MAX_QUESTIONS);
  return { ...normalizeQuote(analysis, catalog, session.customer), questions };
}

async function reviseQuote({ session, change }) {
  const catalog = await getCatalog(session.customer.segment);
  const { lines, notInCatalog, summary, assumptions, presentation } = session.analysis;
  const input = [
    buildInput(session, catalog),
    `Current proposal:\n${JSON.stringify({ lines, notInCatalog, summary, assumptions, presentation }, null, 2)}`,
    `Requested change:\n${change}`,
  ].join('\n\n');

  const analysis = await generateJson({ system: SKILL, input, schema: QUOTE_SCHEMA });
  return { ...normalizeQuote(analysis, catalog, session.customer), questions: [] };
}

function buildInput({ rawRequest, customer, answers = [] }, catalog) {
  const c = {
    name: customer.name,
    segment: customer.segment,
    industry: customer.industry,
    employees: customer.employees,
    notes: customer.notes,
    services: customer.services ?? [],
    openQuotes: (customer.openQuotes ?? []).slice(0, SHOWN_QUOTES),
  };
  const parts = [
    `The sales rep's request:\n${rawRequest}`,
    `Customer (from Salesforce):\n${JSON.stringify(c, null, 2)}`,
    `Catalog for ${customer.segment} customers (the only products you may quote):\n${catalogForPrompt(catalog.products ?? [])}`,
    `Discount the rep may give without a manager: up to ${catalog.maxDiscountWithoutApprovalPct}%`,
  ];
  if (answers.length) {
    parts.push('Answers to your questions:\n' + answers.map((a) => `- ${a.question}\n  ${a.answer}`).join('\n'));
  }
  return parts.join('\n\n');
}

/*
 * Pure. catalog: GET catalog for the customer's segment.
 * Returns the analysis plus `preview` (local pricing) and `maxDiscountPct`.
 */
function normalizeQuote(analysis, catalog, customer) {
  const products = catalog.products ?? [];
  const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]));
  const byCode = new Map(products.filter((p) => p.productCode).map((p) => [p.productCode.toLowerCase(), p]));
  const maxDiscountPct = Number(catalog.maxDiscountWithoutApprovalPct ?? 10);

  const assumptions = [...analysis.assumptions];
  const note = (text) => { if (!assumptions.includes(text)) assumptions.push(text); };
  const notInCatalog = [...analysis.notInCatalog];

  const lines = [];
  for (const l of analysis.lines) {
    const key = String(l.product).trim().toLowerCase();
    const product = byName.get(key) ?? byCode.get(key);
    if (!product) {
      // Claude quoted something the catalog does not sell to this segment.
      if (!notInCatalog.some((n) => n.asked.toLowerCase() === key)) {
        notInCatalog.push({
          asked: l.product,
          productManagerRequest: `${customer.name} (${customer.segment}) wants ${l.product}. Not in the catalog for ${customer.segment} customers. Price and discount: to be set by the product manager.`,
        });
      }
      continue;
    }

    const quantity = Math.max(1, Math.round(Number(l.quantity) || 1));
    let discountPct = Number(l.discountPct) || 0;
    if (discountPct < 0 || discountPct >= 100) {
      note(`Discount ${discountPct}% on ${product.name} is not possible; quoted without it`);
      discountPct = 0;
    }
    const optional = new Set((product.components ?? []).filter((c) => !c.required).map((c) => c.name.toLowerCase()));
    const addOns = product.type === 'Bundle'
      ? (product.components ?? [])
        .filter((c) => optional.has(c.name.toLowerCase())
          && (l.addOns ?? []).some((a) => a.toLowerCase() === c.name.toLowerCase()))
        .map((c) => c.name)
      : [];

    lines.push({ product: product.name, quantity, discountPct, addOns });
  }

  const productsByName = new Map(products.map((p) => [p.name, p]));
  const presentation = normalizePresentation(
    withDefaultCustomer(analysis.presentation, customer, lines),
    { allowed: QUOTE_SECTIONS, savingsNeedsQuantity: false },
  );

  return {
    ...analysis,
    lines,
    notInCatalog,
    assumptions,
    presentation: lines.length ? presentation : null,
    preview: priceQuote(lines, productsByName, maxDiscountPct),
    maxDiscountPct,
  };
}

// The page always names the account; the quantity defaults to the main line's.
function withDefaultCustomer(p, customer, lines) {
  if (!p) return p;
  const quantity = Number(p.customer?.quantity) >= 1 ? p.customer.quantity : lines[0]?.quantity ?? 0;
  return { ...p, customer: { name: customer.name, quantity } };
}

function toQuoteRequest(session) {
  const { lines, presentation } = session.analysis;
  return {
    account: session.customer.accountId,
    lines: lines.map((l) => ({
      product: l.product,
      quantity: l.quantity,
      ...(l.discountPct && { discountPct: l.discountPct }),
      ...(l.addOns.length && { addOns: l.addOns }),
    })),
    ...(presentation && { presentation: toPresentationPayload(presentation) }),
  };
}

module.exports = { QUOTE_SCHEMA, analyseQuote, reviseQuote, normalizeQuote, toQuoteRequest };
