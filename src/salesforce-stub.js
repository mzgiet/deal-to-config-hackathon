/*
 * Stand-in for the Salesforce side when SF_* is not set. Fictional data only,
 * shaped like the real endpoints' answers, so every Slack flow runs offline.
 */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const PRODUCTS = [
  {
    productId: '01tSTUB000000001',
    name: 'Cloud Analytics licence',
    type: 'Simple',
    billing: 'one-time',
    listPrice: 40,
    audience: 'Business',
    volumeTiers: [
      { fromQuantity: 100, toQuantity: 499, adjustment: 'percent', value: 10 },
      { fromQuantity: 500, adjustment: 'percent', value: 15 },
    ],
    components: [],
    includedIn: [],
  },
  {
    productId: '01tSTUB000000002',
    name: 'Business VoIP',
    type: 'Simple',
    billing: 'monthly',
    listPrice: 12,
    audience: 'Business',
    volumeTiers: [],
    components: [],
    includedIn: [],
  },
  {
    productId: '01tSTUB000000003',
    name: 'Mobile Internet',
    type: 'Simple',
    billing: 'monthly',
    listPrice: 10,
    audience: 'Consumer',
    volumeTiers: [],
    components: [],
    includedIn: [],
  },
];

const CUSTOMERS = [
  {
    accountId: '001STUB000000001',
    name: 'Acme Logistics',
    segment: 'Business',
    industry: 'Transportation',
    employees: 120,
    notes: 'Fictitious demo customer.',
    services: [{ product: 'Cloud Analytics licence', quantity: 40, unitPrice: 40, status: 'Installed', daysToContractEnd: 82 }],
    openQuotes: [],
  },
  {
    accountId: '001STUB000000002',
    name: 'Nowak Design',
    segment: 'Business',
    industry: 'Media',
    employees: 8,
    notes: 'Fictitious demo customer.',
    services: [],
    openQuotes: [],
  },
];

async function build(contract) {
  await delay(1500);
  return { requestId: contract.requestId, status: 'created', artifactUrl: `https://example.invalid/configurator/${contract.requestId}` };
}

function catalog(audience) {
  const products = PRODUCTS.filter((p) => !audience || p.audience === audience || p.audience === 'Both');
  return { status: 'found', audience: audience ?? null, maxDiscountWithoutApprovalPct: 10, products };
}

function customers(query) {
  const q = query.toLowerCase();
  return CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q));
}

async function quote(body) {
  await delay(1500);
  const discount = Math.max(0, ...body.lines.map((l) => l.discountPct ?? 0));
  const needsReview = discount > 10;
  const quoteId = `0Q0STUB${Date.now()}`;
  return {
    status: 'created',
    quoteId,
    quoteUrl: `https://example.invalid/quote/${quoteId}`,
    pageUrl: body.presentation ? `https://example.invalid/configurator?quoteId=${quoteId}` : null,
    quoteStatus: needsReview ? 'Needs Review' : 'Draft',
    grandTotal: null, // the stub does not price; the card's preview stands
    approvalRequired: needsReview,
    approvalReasons: needsReview ? [`Discount ${discount}% is above the 10% limit`] : [],
  };
}

module.exports = { build, catalog, customers, quote };
