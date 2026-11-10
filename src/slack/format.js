/*
 * Block Kit and number formatting shared by the cards and modals.
 * No emoji in card content: status is said in words.
 */

const plain = (text) => ({ type: 'plain_text', text: String(text).slice(0, 3000) });
const mrkdwn = (text) => ({ type: 'mrkdwn', text: String(text).slice(0, 3000) });
const context = (text) => ({ type: 'context', elements: [mrkdwn(text)] });
const section = (text) => ({ type: 'section', text: mrkdwn(text) });
const header = (text) => ({ type: 'header', text: plain(truncate(text, 150)) });

const button = (text, actionId, value, extra = {}) => ({
  type: 'button', text: plain(text), action_id: actionId, ...(value !== undefined && { value }), ...extra,
});
const linkButton = (text, url, actionId = 'open_link', extra = {}) => ({
  type: 'button', text: plain(text), action_id: actionId, url, ...extra,
});
/* Secondary actions live in the "…" menu, so the card has one clear next step. */
const menu = (sessionId, items) => ({
  type: 'overflow',
  action_id: 'card_menu',
  options: items.map(([label, verb]) => ({ text: plain(label), value: `${verb}:${sessionId}` })),
});

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (n) => usd.format(Number(n) || 0);

const BILLING_SUFFIX = { monthly: ' / month', yearly: ' / year', 'one-time': ' one-time' };
const priced = (amount, billing) => `${money(amount)}${BILLING_SUFFIX[billing] ?? ''}`;
const SELLING_MODEL_BILLING = { evergreen: 'monthly', 'one-time': 'one-time' };

/* { monthly: 864, 'one-time': 200 } -> "$864.00 / month + $200.00 one-time" */
function totalsLine(totals) {
  const order = ['monthly', 'yearly', 'one-time'];
  const entries = Object.entries(totals).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  return entries.length ? entries.map(([b, n]) => priced(n, b)).join(' + ') : money(0);
}

function truncate(text, max) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const bullets = (items) => items.map((i) => `• ${i}`).join('\n');

module.exports = {
  plain, mrkdwn, context, section, header, button, linkButton, menu,
  money, priced, totalsLine, SELLING_MODEL_BILLING, truncate, bullets,
};
