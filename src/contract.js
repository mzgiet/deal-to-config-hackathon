/*
 * The build contract: what Claude returns for /configure and what we hand to
 * POST build. Contract v2 (docs/salesforce-integration.md, salesforce/README.md).
 *
 * ANALYSIS_SCHEMA     - Claude's output. The contract fields plus `questions`,
 *                       which never leave the orchestrator.
 * normalizeAnalysis() - forces the analysis through the endpoint's validation
 *                       (SalesCopilotRequestWrapper.validate()), so the card shows
 *                       exactly what will be built.
 * toContract()        - the POST build body.
 *
 * Every object has additionalProperties: false and lists all fields as
 * required - structured outputs need that. "Not applicable" is an empty
 * string or list, stripped in toContract().
 */

const {
  BUILD_SECTIONS, presentationSchema, normalizePresentation, toPresentationPayload,
} = require('./presentation');

const strictObject = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const QUESTIONS_SCHEMA = {
  type: 'array',
  items: strictObject({
    question: { type: 'string' },
    why: { type: 'string' },
    kind: { type: 'string', enum: ['number', 'text', 'choice'] },
    options: { type: 'array', items: { type: 'string' } },
    suggested: { type: 'string' },
  }),
};

const ANALYSIS_SCHEMA = strictObject({
  extracted: strictObject({
    products: {
      type: 'array',
      items: strictObject({
        name: { type: 'string' },
        basePrice: { type: 'number' },
        currency: { type: 'string', enum: ['USD'] },
        sellingModel: { type: 'string', enum: ['one-time', 'evergreen'] },
        catalogProductId: { type: 'string' },
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
      appliesTo: { type: 'string' },
    }),
    bundle: strictObject({
      name: { type: 'string' },
      components: {
        type: 'array',
        items: strictObject({
          product: { type: 'string' },
          qty: { type: 'number' },
          optional: { type: 'boolean' },
        }),
      },
    }),
    availability: { type: 'string', enum: ['B2B', 'B2C', 'both'] },
  }),
  summary: { type: 'string' },
  assumptions: { type: 'array', items: { type: 'string' } },
  presentation: presentationSchema(BUILD_SECTIONS),
  questions: QUESTIONS_SCHEMA,
});

const ORG_CURRENCY = 'USD'; // the Salesforce org is single-currency

/*
 * Claude can ignore the skill, and Salesforce answers 400 to anything it does
 * not accept. Pure: returns a new analysis, `questions` untouched.
 * catalog: GET catalog products, to check reused product ids.
 */
function normalizeAnalysis(analysis, catalog = []) {
  const assumptions = [...analysis.assumptions];
  // Adjust feeds the previous assumptions back to Claude - don't add the same note twice.
  const note = (text) => { if (!assumptions.includes(text)) assumptions.push(text); };

  const pricing = normalizePricing(analysis.extracted.pricing, note);
  const products = normalizeProducts(analysis.extracted.products, pricing.type, catalog, note);
  const bundle = normalizeBundle(analysis.extracted.bundle, pricing.type, products);

  if (pricing.appliesTo && !(pricing.type === 'volume-tier' && products.length > 1
    && products.some((p) => p.name === pricing.appliesTo))) {
    pricing.appliesTo = '';
  }

  return {
    ...analysis,
    extracted: { ...analysis.extracted, products, pricing, bundle },
    assumptions,
    presentation: normalizePresentation(analysis.presentation, {
      allowed: BUILD_SECTIONS,
      canShowSavings: pricing.type === 'volume-tier',
    }),
    // Products the catalog already sells on their own: the build will stop with "exists".
    existing: findExisting(products, pricing.type, catalog),
  };
}

function normalizeProducts(products, pricingType, catalog, note) {
  const byId = new Map(catalog.map((c) => [c.productId, c]));
  const seen = new Set();
  const result = [];

  for (const p of products) {
    const key = String(p.name).trim().toLowerCase();
    if (seen.has(key)) {
      note(`"${p.name}" was listed twice; kept one`);
      continue;
    }
    seen.add(key);

    // A catalog product can only be reused inside a new bundle; it keeps its own price.
    const reused = pricingType === 'bundle' ? byId.get(p.catalogProductId) : undefined;
    if (reused) {
      result.push({
        name: reused.name,
        basePrice: Number(reused.listPrice) || 0,
        currency: ORG_CURRENCY,
        sellingModel: reused.billing === 'one-time' ? 'one-time' : 'evergreen',
        catalogProductId: reused.productId,
      });
      continue;
    }

    let { basePrice } = p;
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      basePrice = 0;
      note(`Price for ${p.name} to be confirmed`);
    }
    if (p.currency !== ORG_CURRENCY) {
      note(`${p.name} was quoted in ${p.currency}; entered as ${ORG_CURRENCY} - confirm conversion`);
    }
    result.push({
      name: String(p.name).trim(),
      basePrice,
      currency: ORG_CURRENCY,
      sellingModel: p.sellingModel === 'evergreen' ? 'evergreen' : 'one-time',
      catalogProductId: '',
    });
  }
  return result;
}

function normalizePricing(pricing, note) {
  const tiers = pricing.tiers.map(describeTier);
  const appliesTo = String(pricing.appliesTo ?? '').trim();

  // Bundles and flat prices carry no discount in Salesforce yet.
  if (pricing.type !== 'volume-tier') {
    if (tiers.length) note(`The discount (${tiers.map((t) => t.label).join(', ')}) is not applied yet - ${pricing.type} pricing has no discounts`);
    return { type: pricing.type, tiers: [], appliesTo: '' };
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
    return { type: 'flat', tiers: [], appliesTo: '' };
  }
  return { type: 'volume-tier', tiers: valid.map(({ from, discountPct }) => ({ from, discountPct })), appliesTo };
}

// `from` must be a whole quantity >= 1.
function describeTier(t) {
  const from = Math.max(1, Math.round(Number.isFinite(t.from) ? t.from : 1));
  return { from, discountPct: t.discountPct, label: `${t.discountPct}% from ${from}` };
}

function normalizeBundle(bundle, pricingType, products) {
  if (pricingType !== 'bundle') return { name: '', components: [] };

  const names = new Map(products.map((p) => [p.name.toLowerCase(), p.name]));
  const seen = new Set();
  const components = [];
  for (const c of bundle?.components ?? []) {
    const name = names.get(String(c.product).trim().toLowerCase());
    if (!name || seen.has(name)) continue;
    seen.add(name);
    components.push({ product: name, qty: Math.max(1, Math.round(Number(c.qty) || 1)), optional: Boolean(c.optional) });
  }
  return { name: String(bundle?.name ?? '').trim(), components };
}

function findExisting(products, pricingType, catalog) {
  if (pricingType === 'bundle') return [];
  const byName = new Map(catalog.map((c) => [c.name.toLowerCase(), c]));
  return products.map((p) => byName.get(p.name.toLowerCase())).filter(Boolean);
}

function toContract(session) {
  const { extracted, summary, assumptions, presentation } = session.analysis;
  const { products, pricing, bundle, availability } = extracted;

  return {
    requestId: session.id,
    rawRequest: session.rawRequest,
    source: { channel: 'slack' },
    extracted: {
      products: products.map((p) => (p.catalogProductId
        ? { productId: p.catalogProductId, name: p.name }
        : { name: p.name, basePrice: p.basePrice, currency: p.currency, sellingModel: p.sellingModel })),
      pricing: {
        type: pricing.type,
        tiers: pricing.tiers,
        ...(pricing.appliesTo && { appliesTo: pricing.appliesTo }),
      },
      ...(pricing.type === 'bundle' && {
        bundle: {
          ...(bundle.name && { name: bundle.name }),
          ...(bundle.components.length && {
            components: bundle.components.map((c) => ({ product: c.product, qty: c.qty, ...(c.optional && { optional: true }) })),
          }),
        },
      }),
      availability,
    },
    summary,
    assumptions,
    ...(presentation && { presentation: toPresentationPayload(presentation) }),
    target: 'revenue-cloud',
  };
}

module.exports = { ANALYSIS_SCHEMA, QUESTIONS_SCHEMA, normalizeAnalysis, toContract, strictObject };
