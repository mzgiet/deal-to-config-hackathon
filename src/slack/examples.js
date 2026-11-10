/*
 * Example requests behind the chips in the intake modals. Fictional products
 * and customers only - no client data. The customers exist in the sandbox
 * (salesforce/scripts/apex/salescopilot-seed-customers.apex).
 */

/* /configure: a new offer for the catalog. The last one is deliberately vague
 * so the demo shows the follow-up questions. */
const EXAMPLES = [
  {
    label: 'Volume discount',
    text: 'Team Chat licence at $6 per user per month. 10% off from 50 users and 15% from 200. Business customers only.',
  },
  {
    label: 'Package',
    text: 'Sell the Starter Router ($120 one-time) and Fibre Internet ($30 a month) together as a home package, ' +
      'with Wi-Fi Booster ($40) as an optional extra. Consumers.',
  },
  {
    label: 'Rough call notes',
    text: 'call w/ retail prospect - liked the Smart Shelf sensors and maybe the Analytics add-on, ' +
      'want it cheaper for big orders, they are based in Germany',
  },
];

/* /quote: a customer and what they want. */
const QUOTE_EXAMPLES = [
  {
    label: 'More licences',
    customer: 'Acme Logistics',
    text: 'Acme wants 120 more Cloud Analytics licences, give them 5%.',
  },
  {
    label: 'Discount above the limit',
    customer: 'Acme Logistics',
    text: 'Acme wants 120 more Cloud Analytics licences but pushes for 15% off.',
  },
  {
    label: 'Not in the catalog',
    customer: 'Nowak Design',
    text: 'Nowak Design wants a project management tool for their whole team.',
  },
];

module.exports = { EXAMPLES, QUOTE_EXAMPLES };
