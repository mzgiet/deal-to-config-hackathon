/*
 * The quote card for /quote: customer, priced lines, approval, the customer
 * page, and a hand-off for anything the catalog does not sell.
 */

const {
  context, section, header, button, linkButton, menu,
  money, priced, totalsLine, truncate, bullets,
} = require('./format');
const { describeOutline } = require('../presentation');
const { grandTotalOf } = require('../pricing');

const RENEWAL_DAYS = 90;

function buildQuoteCard(session) {
  const { analysis, customer } = session;
  const { preview, presentation } = analysis;
  const hasLines = analysis.lines.length > 0;

  const blocks = [
    header(presentation?.headline || (hasLines ? `Offer for ${customer.name}` : `${customer.name}: not in the catalog yet`)),
    section(analysis.summary),
    context(customerLine(customer, session.userId)),
  ];
  const owned = servicesLine(customer);
  if (owned) blocks.push(context(owned));
  blocks.push({ type: 'divider' });

  for (const line of preview.lines) blocks.push(section(lineText(line)));

  if (hasLines) {
    blocks.push(section(`*Total:* ${totalsLine(preview.totals)}`));
    blocks.push(preview.needsApproval
      ? section(`*Needs manager approval.* ${approvalReason(analysis)} The quote will be created as _Needs Review_.`)
      : context(`Within the ${analysis.maxDiscountPct}% discount the rep can give. No approval needed.`));
  }

  if (analysis.notInCatalog.length) {
    blocks.push(section(
      `*Not in the catalog yet:* ${analysis.notInCatalog.map((n) => n.asked).join(', ')}\n` +
      analysis.notInCatalog.map((n) => `>${n.productManagerRequest}`).join('\n'),
    ));
  }

  const outline = describeOutline(presentation);
  if (outline && hasLines) blocks.push(context(`Customer page leads with ${outline}.`));
  if (analysis.assumptions.length) blocks.push(section(`*To confirm*\n${bullets(analysis.assumptions)}`));
  if (session.revisions.length) {
    const last = session.revisions.at(-1);
    blocks.push(context(`Revised · last change by <@${last.userId}>: "${truncate(last.text.replace(/\s+/g, ' '), 160)}"`));
  }

  blocks.push(...statusBlocks(session));
  return { blocks, text: `Quote for ${customer.name}: ${analysis.summary}` };
}

function statusBlocks(session) {
  const { analysis } = session;
  const hasLines = analysis.lines.length > 0;
  const missing = analysis.notInCatalog.length > 0;

  switch (session.status) {
    case 'creating':
      return [context('*Creating the quote in Salesforce…*')];

    case 'created': {
      const r = session.result;
      return [{
        type: 'actions',
        elements: [
          ...(r.pageUrl ? [linkButton('Open customer page', r.pageUrl, 'open_page', { style: 'primary' })] : []),
          ...(r.quoteUrl ? [linkButton('Open quote in Salesforce', r.quoteUrl, 'open_quote')] : []),
        ],
      }];
    }

    case 'discarded':
      return [context(`Discarded by <@${session.closedBy}>`)];

    default: { // ready, failed
      const elements = [];
      if (hasLines) {
        elements.push(button(session.status === 'failed' ? 'Try again' : 'Create quote', 'create_quote', session.id, { style: 'primary' }));
      }
      if (missing && !session.handedOffBy) {
        elements.push(button('Send to product manager', 'handoff_quote', session.id, hasLines ? {} : { style: 'primary' }));
      }
      elements.push(button('Adjust', 'adjust_card', session.id), menu(session.id, [['Discard', 'discard']]));

      return [
        ...(session.status === 'failed' ? [context(`*Quote failed:* ${truncate(session.error, 300)}`)] : []),
        ...(session.handedOffBy ? [context(`Sent to the product manager by <@${session.handedOffBy}>. The offer gets its own card.`)] : []),
        { type: 'actions', elements },
      ];
    }
  }
}

/* The thread reply after Create quote. */
function quoteResultMessage(session) {
  const r = session.result;
  const total = r.grandTotal ?? grandTotalOf(session.analysis.preview.totals);
  const lines = [
    r.quoteStatus === 'Needs Review'
      ? `*Quote created, waiting for manager approval.* ${money(total)}`
      : `*Quote created.* ${r.quoteStatus || 'Draft'} · ${money(total)}`,
  ];
  if (r.approvalReasons?.length) lines.push(bullets(r.approvalReasons));

  const expected = grandTotalOf(session.analysis.preview.totals);
  if (r.grandTotal != null && Math.abs(r.grandTotal - expected) > 0.01) {
    lines.push(`_Salesforce priced it at ${money(r.grandTotal)}; the card showed ${money(expected)}. The pricing tables may need a refresh._`);
  }
  lines.push(r.pageUrl ? 'The customer page is ready to send.' : '');

  return {
    text: `Quote created for ${session.customer.name}`,
    blocks: [
      section(lines.filter(Boolean).join('\n')),
      ...(r.pageUrl || r.quoteUrl ? [{
        type: 'actions',
        elements: [
          ...(r.pageUrl ? [linkButton('Open customer page', r.pageUrl, 'open_page', { style: 'primary' })] : []),
          ...(r.quoteUrl ? [linkButton('Open quote in Salesforce', r.quoteUrl, 'open_quote')] : []),
        ],
      }] : []),
    ],
  };
}

/* ------------------------------------------------------------------ */

function customerLine(c, userId) {
  const facts = [c.segment, c.industry, c.employees && `${c.employees} employees`].filter(Boolean).join(' · ');
  return `*${c.name}* · ${facts} · prepared by <@${userId}>`;
}

function servicesLine(c) {
  const services = (c.services ?? []).map((s) => {
    const renewal = s.daysToContractEnd != null && s.daysToContractEnd <= RENEWAL_DAYS
      ? `, contract ends in ${s.daysToContractEnd} days` : '';
    return `${s.product} × ${Number(s.quantity)}${renewal}`;
  });
  const quotes = (c.openQuotes ?? []).length;
  const parts = [];
  if (services.length) parts.push(`Has: ${services.join('; ')}`);
  if (quotes) parts.push(`${quotes} open ${quotes === 1 ? 'quote' : 'quotes'}`);
  return parts.join(' · ');
}

function lineText(l) {
  const adjustments = [
    l.tierPct && `${l.tierPct}% volume rate`,
    l.discountPct && `${l.discountPct}% discount`,
  ].filter(Boolean).join(' + ');

  if (l.parts) {
    const parts = l.parts.map((p) => `${p.name}: ${priced(p.unitPrice, p.billing)}`).join(', ');
    return `*${l.product}* × ${l.quantity}\n${parts}${adjustments ? ` · ${adjustments}` : ''}\n*${totalsLine(l.totals)}*`;
  }

  const unit = l.unitPrice !== l.listPrice ? `${money(l.unitPrice)} ~${money(l.listPrice)}~` : money(l.unitPrice);
  const next = l.nextTier ? `\n_${l.nextTier.missing} more reach the ${l.nextTier.pct}% volume rate_` : '';
  return `*${l.product}* × ${l.quantity}\n${unit} each${adjustments ? ` · ${adjustments}` : ''}\n*${priced(l.total, l.billing)}*${next}`;
}

function approvalReason(analysis) {
  const over = analysis.lines.filter((l) => l.discountPct > analysis.maxDiscountPct);
  return `${over.map((l) => `${l.discountPct}% on ${l.product}`).join(', ')} is above the ${analysis.maxDiscountPct}% the rep can give.`;
}

module.exports = { buildQuoteCard, quoteResultMessage };
