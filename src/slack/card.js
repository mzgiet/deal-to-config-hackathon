/*
 * The offer card for /configure, posted in the channel. Rendered from the
 * session, so every status change is just "update session, re-render, chat.update".
 */

const {
  context, section, header, button, linkButton, menu, mrkdwn,
  priced, SELLING_MODEL_BILLING, truncate, bullets,
} = require('./format');
const { describeOutline } = require('../presentation');

const AVAILABILITY_LABEL = { B2B: 'Business customers', B2C: 'Consumers', both: 'Businesses and consumers' };
const SHOWN_REVISIONS = 2;

function buildCard(session) {
  const { analysis } = session;
  const { extracted, presentation } = analysis;
  const title = presentation?.headline || analysis.summary;

  const blocks = [header(title)];
  if (presentation?.headline) blocks.push(section(analysis.summary));
  blocks.push(context(byline(session)), { type: 'divider' });

  const fields = [
    mrkdwn(`*${extracted.pricing.type === 'bundle' ? 'In the package' : 'Products'}*\n${productList(extracted)}`),
    mrkdwn(`*Pricing*\n${pricingText(extracted)}`),
    mrkdwn(`*Who buys*\n${AVAILABILITY_LABEL[extracted.availability] ?? extracted.availability}`),
  ];
  const outline = describeOutline(presentation);
  if (outline) fields.push(mrkdwn(`*Customer page*\nLeads with ${outline}`));
  blocks.push({ type: 'section', fields });

  if (analysis.existing?.length && ['ready', 'failed'].includes(session.status)) {
    blocks.push(section(
      `*Already in the catalog:* ${analysis.existing.map((p) => `${p.name} (${priced(p.listPrice, p.billing)})`).join(', ')}. ` +
      'Building it again will stop. Rename it with *Adjust*, or quote the existing offer.',
    ));
  }

  if (analysis.assumptions.length) blocks.push(section(`*To confirm*\n${bullets(analysis.assumptions)}`));
  if (session.answers.length) {
    blocks.push(context(`Answered: ${session.answers.map((a) => `${a.question} _${a.answer}_`).join('  ·  ')}`));
  }
  if (session.revisions.length) blocks.push(context(revisionLine(session.revisions)));

  blocks.push(...statusBlocks(session));
  return { blocks, text: `Offer: ${analysis.summary}` };
}

function byline(session) {
  const c = session.handoff?.customer;
  return c
    ? `For *${c.name}* · handed over by <@${session.handoff.userId}> · prepared by <@${session.userId}>`
    : `Requested by <@${session.userId}>`;
}

function statusBlocks(session) {
  const quoteIt = quoteItButton(session);
  switch (session.status) {
    case 'building':
      return [context('*Building in Salesforce…*')];

    case 'built':
      return [{
        type: 'actions',
        elements: [linkButton('Open configurator', session.result.artifactUrl, 'open_configurator', { style: 'primary' }), quoteIt],
      }];

    case 'exists': // Salesforce: a product with that name is already in the catalog
      return [{
        type: 'actions',
        elements: [
          ...existingOfferButtons(session.result),
          quoteIt,
          button('Adjust', 'adjust_card', session.id),
          menu(session.id, [['Discard', 'discard']]),
        ],
      }];

    case 'discarded':
      return [context(`Discarded by <@${session.closedBy}>`)];

    default: // ready, failed
      return [
        ...(session.status === 'failed' ? [context(`*Build failed:* ${truncate(session.error, 300)}`)] : []),
        {
          type: 'actions',
          elements: [
            button(session.status === 'failed' ? 'Try again' : 'Build it', 'build_config', session.id, { style: 'primary' }),
            button('Adjust', 'adjust_card', session.id),
            menu(session.id, [['Discard', 'discard']]),
          ],
        },
      ];
  }
}

function quoteItButton(session) {
  const name = session.handoff?.customer?.name;
  return button(name ? truncate(`Quote it for ${name}`, 75) : 'Quote it for a customer', 'quote_from_build', session.id);
}

// Only products Sales Copilot built carry a configurator link.
function existingOfferButtons(result) {
  const url = result.existingProducts?.find((p) => p.artifactUrl)?.artifactUrl;
  return url ? [linkButton('Open existing offer', url, 'open_configurator')] : [];
}

/* The thread reply after Build it. */
function resultMessage(session) {
  if (session.status === 'exists') {
    return {
      text: `Already in the catalog: ${session.result.error}`,
      blocks: [section(
        `*Already in the catalog*, nothing new was built.\n${session.result.error}\n` +
        '_Open the existing offer, quote it, or Adjust to give the product a new name._',
      )],
    };
  }

  const lines = ['*Ready.* The offer is in Revenue Cloud and the configurator page is live.'];
  if (session.pricingRefreshed === false) {
    lines.push('_Pricing tables were not refreshed, so a quote may still use the old prices until someone refreshes them._');
  }
  return {
    text: `Ready: ${session.result.artifactUrl}`,
    blocks: [
      section(lines.join('\n')),
      {
        type: 'actions',
        elements: [linkButton('Open configurator', session.result.artifactUrl, 'open_configurator', { style: 'primary' }), quoteItButton(session)],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */

function productList({ products, pricing, bundle }) {
  if (!products.length) return '_none detected_';
  const optional = new Set(bundle?.components.filter((c) => c.optional).map((c) => c.product));
  const qty = new Map(bundle?.components.map((c) => [c.product, c.qty]));
  return products.map((p) => {
    const price = p.basePrice ? priced(p.basePrice, SELLING_MODEL_BILLING[p.sellingModel]) : '_price to confirm_';
    const notes = [
      pricing.type === 'bundle' && qty.get(p.name) > 1 && `× ${qty.get(p.name)}`,
      optional.has(p.name) && 'optional',
      p.catalogProductId && 'in the catalog',
    ].filter(Boolean);
    return `${p.name}: ${price}${notes.length ? ` (${notes.join(', ')})` : ''}`;
  }).join('\n');
}

function pricingText({ pricing, bundle, products }) {
  if (pricing.type === 'bundle') {
    return `One package${bundle?.name ? `: ${bundle.name}` : ''}\nPriced as the sum of its parts`;
  }
  if (pricing.type === 'flat' || !pricing.tiers.length) return 'One price, no volume discount';
  const on = pricing.appliesTo && products.length > 1 ? ` on ${pricing.appliesTo}` : '';
  return `Volume discount${on}\n${pricing.tiers.map((t) => `${t.discountPct}% from ${t.from.toLocaleString('en-US')}`).join('\n')}`;
}

function revisionLine(revisions) {
  const last = revisions.at(-1).text.replace(/\s+/g, ' ');
  const count = revisions.length > SHOWN_REVISIONS ? `Revised ${revisions.length} times` : `Revised`;
  return `${count} · last change by <@${revisions.at(-1).userId}>: "${truncate(last, 160)}"`;
}

module.exports = { buildCard, resultMessage };
