/*
 * Shapes that cross a boundary.
 *
 * ANALYSIS_SCHEMA - what Claude returns to us. The contract fields plus
 *                   `questions`, which never leave the orchestrator.
 * normalizeAnalysis() - forces the analysis to pass the Salesforce endpoint's
 *                   validation (SalesCopilotRequestWrapper.validate()).
 * toContract()    - what we hand to the Salesforce side. Contract v1
 *                   (v2 proposal in docs/salesforce-integration.md).
 *
 * Every object has additionalProperties: false and lists all fields as
 * required - the API's structured outputs need that.
 */

const strictObject = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const ANALYSIS_SCHEMA = strictObject({
  extracted: strictObject({
    products: {
      type: 'array',
      items: strictObject({
        name: { type: 'string' },
        basePrice: { type: 'number' },
        currency: { type: 'string', enum: ['USD'] },
      }),
    },
    pricing: strictObject({
      type: { type: 'string', enum: ['flat', 'volume-tier', 'bundle'] },
      tiers: {
        type: 'array',
        items: strictObject({
          from: { type: 'number' },
          discountPct: { type: 'number' },
        }),
      },
    }),
    availability: { type: 'string', enum: ['B2B', 'B2C', 'both'] },
  }),
  summary: { type: 'string' },
  assumptions: { type: 'array', items: { type: 'string' } },
  questions: {
    type: 'array',
    items: strictObject({
      question: { type: 'string' },
      why: { type: 'string' },
      kind: { type: 'string', enum: ['number', 'text', 'choice'] },
      options: { type: 'array', items: { type: 'string' } },
      suggested: { type: 'string' },
    }),
  },
});

const ORG_CURRENCY = 'USD'; // the Salesforce org is single-currency

/*
 * Claude can ignore the skill, and Salesforce answers 400 to anything it does
 * not accept. So enforce its rules here, before the card is rendered - the card
 * then shows exactly what will be built. Pure: returns a new analysis,
 * `questions` untouched.
 */
function normalizeAnalysis(analysis) {
  const assumptions = [...analysis.assumptions];
  // Adjust feeds the previous assumptions back to Claude - don't add the same note twice.
  const note = (text) => { if (!assumptions.includes(text)) assumptions.push(text); };

  const products = normalizeProducts(analysis.extracted.products, note);
  const pricing = normalizePricing(analysis.extracted.pricing, note);

  return {
    ...analysis,
    extracted: { ...analysis.extracted, products, pricing },
    assumptions,
  };
}

function normalizeProducts(products, note) {
  const seen = new Set();
  const result = [];

  for (const p of products) {
    const key = String(p.name).trim().toLowerCase();
    if (seen.has(key)) {
      note(`"${p.name}" was listed twice; kept one`);
      continue;
    }
    seen.add(key);

    let { basePrice } = p;
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      basePrice = 0;
      note(`Price for ${p.name} to be confirmed`);
    }
    if (p.currency !== ORG_CURRENCY) {
      note(`${p.name} was quoted in ${p.currency}; entered as ${ORG_CURRENCY} - confirm conversion`);
    }
    result.push({ ...p, basePrice, currency: ORG_CURRENCY });
  }
  return result;
}

function normalizePricing(pricing, note) {
  const tiers = pricing.tiers.map(describeTier);

  // Bundles and flat prices carry no discount in Salesforce yet.
  if (pricing.type !== 'volume-tier') {
    if (tiers.length) note(`The discount (${tiers.map((t) => t.label).join(', ')}) is not applied yet - ${pricing.type} pricing has no discounts`);
    return { type: pricing.type, tiers: [] };
  }

  const valid = [];
  for (const t of [...tiers].sort((a, b) => a.from - b.from)) {
    if (!(t.discountPct > 0 && t.discountPct <= 100)) {
      note(`Dropped discount tier ${t.label}: the discount must be between 0 and 100%`);
    } else if (valid.some((v) => v.from === t.from)) {
      note(`Dropped duplicate discount tier ${t.label}`);
    } else {
      valid.push(t);
    }
  }

  if (!valid.length) {
    note('No valid discount tiers; priced as a flat price');
    return { type: 'flat', tiers: [] };
  }
  return { type: 'volume-tier', tiers: valid.map(({ from, discountPct }) => ({ from, discountPct })) };
}

// `from` must be a whole quantity >= 1.
function describeTier(t) {
  const from = Math.max(1, Math.round(Number.isFinite(t.from) ? t.from : 1));
  return { from, discountPct: t.discountPct, label: `${t.discountPct}% from ${from}` };
}

function toContract(session) {
  const { extracted, summary, assumptions } = session.analysis;

  return {
    requestId: session.id,
    rawRequest: session.rawRequest,
    extracted,
    summary,
    assumptions,
    target: 'revenue-cloud',
  };
}

module.exports = { ANALYSIS_SCHEMA, normalizeAnalysis, toContract };
