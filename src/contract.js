/*
 * Shapes that cross a boundary.
 *
 * ANALYSIS_SCHEMA - what Claude returns to us. The contract fields plus
 *                   `questions`, which never leave the orchestrator.
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
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'PLN'] },
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

module.exports = { ANALYSIS_SCHEMA, toContract };
