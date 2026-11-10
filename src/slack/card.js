/*
 * The configuration card posted in the channel. Rendered from the session,
 * so every status change is just "update session, re-render, chat.update".
 */

const PRICING_LABEL = { flat: 'Flat price', 'volume-tier': 'Volume discount', bundle: 'Bundle' };
const AVAILABILITY_LABEL = { B2B: 'Businesses (B2B)', B2C: 'Consumers (B2C)', both: 'Businesses and consumers' };

const plain = (text) => ({ type: 'plain_text', text });
const mrkdwn = (text) => ({ type: 'mrkdwn', text });

function buildCard(session) {
  const { analysis } = session;
  const { extracted } = analysis;

  const blocks = [
    { type: 'header', text: plain(':clipboard: New client configuration') },
    { type: 'section', text: mrkdwn(`*${analysis.summary}*`) },
    { type: 'context', elements: [mrkdwn(`Requested by <@${session.userId}>  ·  \`${session.id}\``)] },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        mrkdwn(`*Products*\n${productList(extracted.products)}`),
        mrkdwn(`*${PRICING_LABEL[extracted.pricing.type] ?? 'Pricing'}*\n${tierList(extracted.pricing.tiers)}`),
        mrkdwn(`*Who buys*\n${AVAILABILITY_LABEL[extracted.availability] ?? extracted.availability}`),
      ],
    },
  ];

  if (session.answers.length) {
    blocks.push({
      type: 'context',
      elements: [mrkdwn(
        ':speech_balloon: *Confirmed by the rep:* ' +
        session.answers.map((a) => `${a.question} _${a.answer}_`).join('  ·  '),
      )],
    });
  }

  if (analysis.assumptions.length) {
    blocks.push({
      type: 'section',
      text: mrkdwn(`:warning: *Assumed - check before building*\n${analysis.assumptions.map((a) => `• ${a}`).join('\n')}`),
    });
  }

  if (session.revisions?.length) {
    blocks.push({ type: 'context', elements: [mrkdwn(revisionLines(session.revisions))] });
  }

  blocks.push(statusBlock(session));

  return { blocks, text: `Configuration ${session.id}: ${analysis.summary}` };
}

function statusBlock(session) {
  switch (session.status) {
    case 'building':
      return { type: 'context', elements: [mrkdwn(':hourglass_flowing_sand: *Building in the Salesforce sandbox…*')] };

    case 'built':
      return {
        type: 'actions',
        elements: [configuratorButton(session.result.artifactUrl)],
      };

    case 'exists': // Salesforce: a product with that name is already in the catalog
      return {
        type: 'actions',
        elements: [
          ...existingOfferButtons(session.result),
          { type: 'button', text: plain('Adjust'), action_id: 'adjust_config', value: session.id },
          { type: 'button', text: plain('Discard'), action_id: 'discard_config', value: session.id },
        ],
      };

    case 'discarded':
      return { type: 'context', elements: [mrkdwn(`:wastebasket: Discarded by <@${session.closedBy}>`)] };

    default: // ready, failed
      return {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: plain(session.status === 'failed' ? 'Try again' : 'Build it'),
            action_id: 'build_config',
            value: session.id,
          },
          {
            type: 'button',
            text: plain('Adjust'),
            action_id: 'adjust_config',
            value: session.id,
          },
          {
            type: 'button',
            text: plain('Discard'),
            action_id: 'discard_config',
            value: session.id,
          },
        ],
      };
  }
}

/* Last few revisions, one line each - the card must stay compact. */
const SHOWN_REVISIONS = 3;
const REVISION_CHARS = 200;

function revisionLines(revisions) {
  const hidden = revisions.length - SHOWN_REVISIONS;
  const lines = revisions.slice(-SHOWN_REVISIONS).map(({ userId, text }) => {
    const oneLine = text.replace(/\s+/g, ' ');
    const shown = oneLine.length > REVISION_CHARS ? `${oneLine.slice(0, REVISION_CHARS - 1)}…` : oneLine;
    return `:pencil2: Revised by <@${userId}>: "${shown}"`;
  });
  if (hidden > 0) lines.unshift(`_${hidden} earlier ${hidden === 1 ? 'revision' : 'revisions'}_`);
  return lines.join('\n');
}

function configuratorButton(url) {
  return {
    type: 'button',
    style: 'primary',
    text: plain(':rocket: Open configurator'),
    action_id: 'open_configurator',
    url,
  };
}

// Only products Sales Copilot built carry a configurator link.
function existingOfferButtons(result) {
  const url = result.existingProducts?.find((p) => p.artifactUrl)?.artifactUrl;
  return url ? [{ ...configuratorButton(url), text: plain(':mag: Open existing offer') }] : [];
}

function resultMessage(session) {
  if (session.status === 'exists') {
    const buttons = existingOfferButtons(session.result);
    return {
      text: `Already in the catalog: ${session.result.error}`,
      blocks: [
        {
          type: 'section',
          text: mrkdwn(`:information_source: *Already in the catalog* - nothing new was built.\n${session.result.error}\n_Open the existing offer, or Adjust to give the product a new name._`),
        },
        ...(buttons.length ? [{ type: 'actions', elements: buttons }] : []),
      ],
    };
  }

  return {
    text: `Ready: ${session.result.artifactUrl}`,
    blocks: [
      {
        type: 'section',
        text: mrkdwn(`:white_check_mark: *Ready.* Configuration \`${session.id}\` is built in the sandbox - you can show it to the client now.`),
      },
      { type: 'actions', elements: [configuratorButton(session.result.artifactUrl)] },
    ],
  };
}

/* ------------------------------------------------------------------ */

function productList(products) {
  if (!products.length) return '_none detected_';
  return products.map((p) => `• ${p.name} — ${formatPrice(p)}`).join('\n');
}

function tierList(tiers = []) {
  if (!tiers.length) return '_no discounts_';
  return tiers
    .map((t) => `• ${t.discountPct}% off from ${t.from.toLocaleString('en-US')} units`)
    .join('\n');
}

function formatPrice({ basePrice, currency }) {
  if (!basePrice) return '_price to confirm_';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(basePrice);
}

module.exports = { buildCard, resultMessage };
