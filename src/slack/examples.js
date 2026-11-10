/*
 * Example requests behind the chips in the intake modal. Fictional products
 * only - no client data. The last one is deliberately vague so the demo
 * shows the follow-up questions.
 */

const EXAMPLES = [
  {
    label: ':chart_with_upwards_trend: Volume discount',
    text: 'Client wants our Cloud Analytics licence at $40 per user per month for their sales team. ' +
      '10% off above 100 users and 15% above 500. Business customers only.',
  },
  {
    label: ':package: Bundle',
    text: 'They would like the Starter Hardware Kit ($200) and the Onboarding Service ($500) sold together ' +
      'as one package. B2B.',
  },
  {
    label: ':memo: Rough call notes',
    text: 'call w/ retail prospect - liked the Smart Shelf sensors and maybe the Analytics add-on, ' +
      'want it cheaper for big orders, they are based in Germany',
  },
];

module.exports = { EXAMPLES };
