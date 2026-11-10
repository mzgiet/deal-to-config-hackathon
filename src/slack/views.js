/*
 * Modal views for /configure and /quote.
 *
 *   intake / quote_intake  -> what is asked for (+ who buys / which customer)
 *   progress               -> shown while Claude works, steps rotate
 *   questions              -> Claude's follow-up questions, pre-filled with its best guess
 *   done                   -> "posted to #channel"
 *   adjust                 -> what to change on a posted card (+ its done / blocked views)
 *
 * Slack limits worth knowing: title/submit/close 24 chars, option text 75,
 * private_metadata 3000 - so only ids go in metadata, the rest lives in the store.
 */

const { EXAMPLES, QUOTE_EXAMPLES } = require('./examples');
const { plain, context, section, truncate } = require('./format');

const TITLE = plain('Sales Copilot');

const option = (value, label = value) => ({ text: plain(truncate(label, 75)), value: String(value).slice(0, 150) });

const AVAILABILITY = [option('B2B', 'Business customers'), option('B2C', 'Consumers'), option('both', 'Both')];

/* ------------------------------------------------------------------ *
 * /configure intake
 * ------------------------------------------------------------------ */

/*
 * `version` goes into the request block_id. Slack keeps whatever the user
 * typed for an unchanged block_id, so filling in an example needs a new one.
 * handoff: { customerName, userId } when a rep's quote handed this over.
 */
function intakeView({ meta, text = '', hints = {}, error, version = 0, handoff }) {
  const blocks = [
    section(handoff
      ? `*New offer for ${handoff.customerName}.* <@${handoff.userId}> needs something the catalog does not sell yet. ` +
        'Their request is below: add the price and discount, and I will set it up in Revenue Cloud.'
      : '*Need a new offer in the catalog?* Describe it in your own words. ' +
        "I'll turn it into a Revenue Cloud product and price setup, and ask about anything that's missing."),
  ];

  if (error) blocks.push(section(`*That didn't work.* ${error}`));

  blocks.push({
    type: 'input',
    block_id: `request_${version}`,
    label: plain('What should we sell?'),
    hint: plain('Products, prices, billing, discounts, who buys. Rough notes are fine.'),
    element: {
      type: 'plain_text_input',
      action_id: 'value',
      multiline: true,
      focus_on_load: true,
      max_length: 3000,
      initial_value: text || undefined,
      placeholder: plain('e.g. Cloud Analytics licence at $40 per user per month, 10% off from 100 users, business customers only'),
    },
  });

  if (!handoff) {
    blocks.push(
      context('Not sure how to put it? Start from an example:'),
      {
        type: 'actions',
        block_id: 'examples',
        elements: EXAMPLES.map((ex, i) => ({ type: 'button', action_id: `example_${i}`, text: plain(ex.label), value: String(i) })),
      },
    );
  }

  blocks.push({ type: 'divider' }, selectInput('availability', 'Who buys?', AVAILABILITY, hints.availability));

  return {
    type: 'modal',
    callback_id: 'intake',
    title: TITLE,
    submit: plain('Analyse'),
    close: plain('Cancel'),
    private_metadata: JSON.stringify(meta),
    blocks,
  };
}

function selectInput(blockId, label, options, selected) {
  return {
    type: 'input',
    block_id: blockId,
    optional: true,
    label: plain(label),
    element: {
      type: 'static_select',
      action_id: 'value',
      placeholder: plain("I'll work it out"),
      options,
      initial_option: options.find((o) => o.value === selected),
    },
  };
}

function readIntake(view) {
  const values = view.state.values;
  const requestBlock = Object.keys(values).find((id) => id.startsWith('request_'));

  return {
    requestBlock,
    version: Number(requestBlock.split('_')[1]),
    text: (values[requestBlock].value.value || '').trim(),
    hints: { availability: values.availability?.value.selected_option?.value },
  };
}

/* ------------------------------------------------------------------ *
 * /quote intake
 * ------------------------------------------------------------------ */

/*
 * The customer picker searches Salesforce as the rep types (app.options in
 * slack/quote.js). Option value: "<accountId>|<name>"; an example chip
 * pre-selects by name only ("|Acme Logistics").
 */
function quoteIntakeView({ meta, text = '', customer, error, version = 0 }) {
  const blocks = [
    section('*Preparing an offer for a customer?* Pick the customer and say what they want. ' +
      "I'll check what they already have and what the catalog sells them, and price it."),
  ];
  if (error) blocks.push(section(`*That didn't work.* ${error}`));

  blocks.push(
    {
      type: 'input',
      block_id: `customer_${version}`,
      optional: true,
      label: plain('Customer'),
      hint: plain('Searches Salesforce. Leave it empty if the request names the customer.'),
      element: {
        type: 'external_select',
        action_id: 'customer_select',
        min_query_length: 2,
        placeholder: plain('Start typing a customer name'),
        ...(customer && { initial_option: option(`${customer.accountId ?? ''}|${customer.name}`, customer.name) }),
      },
    },
    {
      type: 'input',
      block_id: `request_${version}`,
      label: plain('What do they want?'),
      hint: plain('Products, quantities, any discount you offered. Rough notes are fine.'),
      element: {
        type: 'plain_text_input',
        action_id: 'value',
        multiline: true,
        focus_on_load: !customer,
        max_length: 3000,
        initial_value: text || undefined,
        placeholder: plain('e.g. 120 more Cloud Analytics licences, and give them 5%'),
      },
    },
    context('Or start from an example:'),
    {
      type: 'actions',
      block_id: 'examples',
      elements: QUOTE_EXAMPLES.map((ex, i) => ({ type: 'button', action_id: `quote_example_${i}`, text: plain(ex.label), value: String(i) })),
    },
  );

  return {
    type: 'modal',
    callback_id: 'quote_intake',
    title: TITLE,
    submit: plain('Prepare offer'),
    close: plain('Cancel'),
    private_metadata: JSON.stringify(meta),
    blocks,
  };
}

function readQuoteIntake(view) {
  const values = view.state.values;
  const requestBlock = Object.keys(values).find((id) => id.startsWith('request_'));
  const customerBlock = Object.keys(values).find((id) => id.startsWith('customer_'));
  const picked = values[customerBlock]?.customer_select?.selected_option?.value;
  const [accountId, ...name] = (picked ?? '').split('|');

  return {
    requestBlock,
    version: Number(requestBlock.split('_')[1]),
    text: (values[requestBlock].value.value || '').trim(),
    customer: picked ? { accountId: accountId || undefined, name: name.join('|') } : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

function progressView({ meta, step, steps, rawRequest, channelId }) {
  const list = steps
    .map((s, i) => (i < step ? `~${s}~` : i === step ? `*${s}…*` : s))
    .join('\n');

  return {
    type: 'modal',
    callback_id: 'progress',
    title: TITLE,
    close: plain('Close'),
    private_metadata: JSON.stringify(meta),
    blocks: [
      context(`Step ${step + 1} of ${steps.length}`),
      section(list),
      context(`> ${truncate(rawRequest, 280).replace(/\n/g, '\n> ')}`),
      context(`Usually takes 10-20 seconds. If you close this, the result still lands in <#${channelId}>.`),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Questions
 * ------------------------------------------------------------------ */

/* understood: one line naming what Claude found (products, or customer + lines). */
function questionsView({ callbackId, session, understood, submitLabel, error }) {
  const { analysis } = session;
  const n = analysis.questions.length;

  return {
    type: 'modal',
    callback_id: callbackId,
    title: TITLE,
    submit: plain(submitLabel),
    close: plain('Cancel'),
    private_metadata: JSON.stringify({ sessionId: session.id }),
    blocks: [
      ...(error ? [section(`*That didn't work.* ${error}`)] : []),
      section(`*Here's what I understood*\n${analysis.summary}`),
      context(understood),
      { type: 'divider' },
      section(`*${n === 1 ? 'One quick question' : `${n} quick questions`} first*`),
      context("I've pre-filled my best guess. Change anything that's wrong, skip what you don't know."),
      ...analysis.questions.map(questionInput),
    ],
  };
}

function questionInput(q, i) {
  const block = {
    type: 'input',
    block_id: `q_${i}`,
    optional: true,
    label: plain(q.question.slice(0, 2000)),
    hint: q.why ? plain(q.why.slice(0, 2000)) : undefined,
  };

  const options = q.kind === 'choice' ? q.options.filter(Boolean).slice(0, 10).map((o) => option(o)) : [];

  if (options.length >= 2) {
    const initial = options.find((o) => o.value === q.suggested.slice(0, 150));
    block.element = {
      type: options.length <= 5 ? 'radio_buttons' : 'static_select',
      action_id: 'value',
      options,
      initial_option: initial,
      ...(options.length > 5 && { placeholder: plain('Choose one') }),
    };
  } else if (q.kind === 'number') {
    const suggested = q.suggested.replace(/[^\d.]/g, '');
    block.element = {
      type: 'number_input',
      action_id: 'value',
      is_decimal_allowed: true,
      initial_value: suggested && !Number.isNaN(Number(suggested)) ? suggested : undefined,
      placeholder: plain('Number'),
    };
  } else {
    block.element = {
      type: 'plain_text_input',
      action_id: 'value',
      initial_value: q.suggested || undefined,
      placeholder: plain('Your answer'),
    };
  }

  return block;
}

function readAnswers(view, questions) {
  return questions.map((q, i) => {
    const el = view.state.values[`q_${i}`]?.value ?? {};
    const answer = el.selected_option?.value ?? el.value;
    return { question: q.question, answer: answer?.trim() || '(no answer - use your best guess)' };
  });
}

/* ------------------------------------------------------------------ *
 * Done
 * ------------------------------------------------------------------ */

function doneView(session, { what = 'Posted', next = 'Check it there and click *Build it* when it looks right.' } = {}) {
  return {
    type: 'modal',
    callback_id: 'done',
    title: TITLE,
    close: plain('Done'),
    blocks: [
      section(`*${what} in <#${session.card.channel}>*\n${session.analysis.summary}`),
      context(next),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Adjust
 * ------------------------------------------------------------------ */

function adjustView(session, { change = '', error } = {}) {
  const isQuote = session.kind === 'quote';
  return {
    type: 'modal',
    callback_id: 'adjust',
    title: plain(isQuote ? 'Adjust offer' : 'Adjust configuration'),
    submit: plain('Update'),
    close: plain('Cancel'),
    private_metadata: JSON.stringify({ sessionId: session.id }),
    blocks: [
      ...(error ? [section(`*That didn't work.* ${error}`)] : []),
      section(`*Current ${isQuote ? 'offer' : 'configuration'}*\n${session.analysis.summary}`),
      {
        type: 'input',
        block_id: 'change',
        label: plain('What should change?'),
        hint: plain('Only what you say changes - everything else stays as it is.'),
        element: {
          type: 'plain_text_input',
          action_id: 'value',
          multiline: true,
          focus_on_load: true,
          max_length: 1000,
          initial_value: change || undefined,
          placeholder: plain(isQuote
            ? 'e.g. they want 15% now, and lead the page with the savings'
            : 'e.g. 15% instead of 10%, and bill it monthly'),
        },
      },
    ],
  };
}

function readAdjust(view) {
  return (view.state.values.change?.value.value || '').trim();
}

function adjustDoneView(session) {
  return doneView(session, {
    what: 'Card updated',
    next: `Check it there and click *${session.kind === 'quote' ? 'Create quote' : 'Build it'}* when it looks right.`,
  });
}

function adjustBlockedView(session) {
  return {
    type: 'modal',
    callback_id: 'done',
    title: TITLE,
    close: plain('Close'),
    blocks: [section(
      `*Not applied.* This card was already completed or discarded in <#${session.card.channel}> while I was working, so it is unchanged.`,
    )],
  };
}

/* ------------------------------------------------------------------ */

function productLine(products) {
  if (!products.length) return '_No products detected_';
  return products.map((p) => `*${p.name}*`).join('  ·  ');
}

module.exports = {
  intakeView,
  readIntake,
  quoteIntakeView,
  readQuoteIntake,
  progressView,
  questionsView,
  readAnswers,
  doneView,
  adjustView,
  readAdjust,
  adjustDoneView,
  adjustBlockedView,
  productLine,
};
