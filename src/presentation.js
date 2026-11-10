/*
 * `presentation`: the customer page Claude composes from the configurator's
 * fixed blocks (see salesforce/README.md). Shared by builds and quotes.
 *
 * presentationSchema(types) - the part of Claude's output schema.
 * normalizePresentation()    - forces it through the Apex validation
 *                              (SalesCopilotRequestWrapper.Presentation.validate()),
 *                              so a page problem can never fail a build or a quote.
 *                              Returns null when there is nothing to send.
 * toPresentationPayload()    - what goes over the wire.
 */

const BUILD_SECTIONS = ['offer', 'savings', 'highlights', 'assumptions', 'request'];
const QUOTE_SECTIONS = ['offer', 'savings', 'highlights'];
const HEADLINE_MAX = 160;
const HIGHLIGHTS_MAX = 5;

const SECTION_LABEL = {
  offer: 'the offer',
  savings: 'the savings',
  highlights: 'why it fits',
  assumptions: 'the assumptions',
  request: 'the request',
};

function presentationSchema(types) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'customer', 'sections'],
    properties: {
      headline: { type: 'string' },
      customer: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity'],
        properties: { name: { type: 'string' }, quantity: { type: 'number' } },
      },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title', 'items'],
          properties: {
            type: { type: 'string', enum: types },
            title: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

/*
 * allowed: BUILD_SECTIONS or QUOTE_SECTIONS.
 * canShowSavings: a build needs volume-tier pricing for the savings block.
 * savingsNeedsQuantity: a build prices the customer's quantity; a quote has its own lines.
 */
function normalizePresentation(p, { allowed, canShowSavings = true, savingsNeedsQuantity = true }) {
  if (!p) return null;

  const name = String(p.customer?.name ?? '').trim();
  const qty = Math.round(Number(p.customer?.quantity));
  const quantity = Number.isFinite(qty) && qty >= 1 ? qty : null;

  const seen = new Set();
  const sections = [];
  for (const s of p.sections ?? []) {
    const type = String(s.type ?? '').toLowerCase();
    if (!allowed.includes(type) || seen.has(type)) continue;
    if (type === 'savings' && !(canShowSavings && (quantity || !savingsNeedsQuantity))) continue;

    const section = { type };
    if (type === 'highlights') {
      const items = (s.items ?? []).map((i) => String(i).trim()).filter(Boolean).slice(0, HIGHLIGHTS_MAX);
      if (!items.length) continue;
      section.items = items;
    }
    if (String(s.title ?? '').trim()) section.title = String(s.title).trim();
    seen.add(type);
    sections.push(section);
  }
  // The offer carries the prices: a composed page may move it, never drop it.
  if (sections.length && !seen.has('offer')) sections.push({ type: 'offer' });

  let headline = String(p.headline ?? '').trim();
  if (headline.length > HEADLINE_MAX) headline = `${headline.slice(0, HEADLINE_MAX - 1)}…`;

  if (!headline && !sections.length) return null;
  return { headline, customer: { name, quantity }, sections };
}

function toPresentationPayload(p) {
  if (!p) return undefined;
  const customer = {};
  if (p.customer.name) customer.name = p.customer.name;
  if (p.customer.quantity) customer.quantity = p.customer.quantity;
  return {
    ...(p.headline && { headline: p.headline }),
    ...(Object.keys(customer).length && { customer }),
    sections: p.sections.map((s) => (s.title || s.items ? s : s.type)),
  };
}

/* "savings, then why it fits, then the offer" - for the card. */
function describeOutline(p) {
  if (!p?.sections.length) return '';
  const parts = p.sections.map((s) => (s.type === 'highlights' && s.title ? `"${s.title}"` : SECTION_LABEL[s.type]));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, then ${parts.at(-1)}`;
}

module.exports = {
  BUILD_SECTIONS,
  QUOTE_SECTIONS,
  presentationSchema,
  normalizePresentation,
  toPresentationPayload,
  describeOutline,
};
