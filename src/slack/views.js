/*
 * Modal views for the /configure flow.
 *
 *   intake    -> rep describes the request (+ optional who-buys)
 *   progress  -> shown while Claude works, steps rotate
 *   questions -> Claude's follow-up questions, pre-filled with its best guess
 *   done      -> "posted to #channel"
 *   adjust    -> rep says what to change on a posted card (+ its done / blocked views)
 *
 * Slack limits worth knowing: title/submit/close 24 chars, option text 75,
 * private_metadata 3000 - so only ids go in metadata, the rest lives in the store.
 */

const { EXAMPLES } = require('./examples');

const TITLE = { type: 'plain_text', text: 'Sales Copilot' };

const plain = (text) => ({ type: 'plain_text', text });
const mrkdwn = (text) => ({ type: 'mrkdwn', text });
const option = (value, label = value) => ({ text: plain(label.slice(0, 75)), value: value.slice(0, 150) });

const AVAILABILITY = [option('B2B', 'Businesses (B2B)'), option('B2C', 'Consumers (B2C)'), option('both', 'Both')];

/* ------------------------------------------------------------------ *
 * Intake
 * ------------------------------------------------------------------ */

/*
 * `version` goes into the request block_id. Slack keeps whatever the user
 * typed for an unchanged block_id, so filling in an example needs a new one.
 */
function intakeView({ meta, text = '', hints = {}, error, version = 0 }) {
  const blocks = [
    {
      type: 'section',
      text: mrkdwn(
        '*Just off a client call?* Tell me what they asked for, in your own words. ' +
        "I'll turn it into a Revenue Cloud product and price setup, and ask about anything that's missing.",
      ),
    },
  ];

  if (error) {
    blocks.push({ type: 'section', text: mrkdwn(`:warning: ${error}`) });
  }

  blocks.push(
    {
      type: 'input',
      block_id: `request_${version}`,
      label: plain('What did the client ask for?'),
      hint: plain('Products, prices, discounts, who buys. Rough notes are fine.'),
      element: {
        type: 'plain_text_input',
        action_id: 'value',
        multiline: true,
        focus_on_load: true,
        max_length: 3000,
        initial_value: text || undefined,
        placeholder: plain('e.g. They want the Analytics licence at $40 per user, 10% off above 100 users, business customers only'),
      },
    },
    { type: 'context', elements: [mrkdwn('Not sure how to put it? Start from an example:')] },
    {
      type: 'actions',
      block_id: 'examples',
      elements: EXAMPLES.map((ex, i) => ({
        type: 'button',
        action_id: `example_${i}`,
        text: plain(ex.label),
        value: String(i),
      })),
    },
    { type: 'divider' },
    selectInput('availability', 'Who buys?', AVAILABILITY, hints.availability),
  );

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
    hints: {
      availability: values.availability?.value.selected_option?.value,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

function progressView({ meta, step, steps, rawRequest, channelId }) {
  const checklist = steps
    .map((s, i) => (i < step ? `:white_check_mark: ${s}` : i === step ? `:hourglass_flowing_sand: *${s}*` : `:white_circle: ${s}`))
    .join('\n');

  return {
    type: 'modal',
    callback_id: 'progress',
    title: TITLE,
    close: plain('Close'),
    private_metadata: JSON.stringify(meta),
    blocks: [
      { type: 'section', text: mrkdwn(checklist) },
      { type: 'context', elements: [mrkdwn(`> ${truncate(rawRequest, 280).replace(/\n/g, '\n> ')}`)] },
      {
        type: 'context',
        elements: [mrkdwn(`Usually takes 10-20 seconds. If you close this, the result still lands in <#${channelId}>.`)],
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Questions
 * ------------------------------------------------------------------ */

function questionsView(session, error) {
  const { analysis } = session;
  const n = analysis.questions.length;
  const errorBlocks = error ? [{ type: 'section', text: mrkdwn(`:warning: ${error}`) }] : [];

  return {
    type: 'modal',
    callback_id: 'questions',
    title: TITLE,
    submit: plain('Create configuration'),
    close: plain('Cancel'),
    private_metadata: JSON.stringify({ sessionId: session.id }),
    blocks: [
      ...errorBlocks,
      { type: 'section', text: mrkdwn(`*Here's what I understood*\n${analysis.summary}`) },
      { type: 'context', elements: [mrkdwn(productLine(analysis.extracted.products))] },
      { type: 'divider' },
      {
        type: 'section',
        text: mrkdwn(`*${n === 1 ? 'One quick question' : `${n} quick questions`} before I build it*`),
      },
      { type: 'context', elements: [mrkdwn("I've pre-filled my best guess. Change anything that's wrong, skip what you don't know.")] },
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

function doneView(session) {
  return {
    type: 'modal',
    callback_id: 'done',
    title: TITLE,
    close: plain('Done'),
    blocks: [
      {
        type: 'section',
        text: mrkdwn(`:white_check_mark: *Configuration posted to <#${session.card.channel}>*\n${session.analysis.summary}`),
      },
      { type: 'context', elements: [mrkdwn('Check it there and click *Build it* when it looks right.')] },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Adjust
 * ------------------------------------------------------------------ */

function adjustView(session, { change = '', error } = {}) {
  const errorBlocks = error ? [{ type: 'section', text: mrkdwn(`:warning: ${error}`) }] : [];

  return {
    type: 'modal',
    callback_id: 'adjust',
    title: plain('Adjust configuration'),
    submit: plain('Update'),
    close: plain('Cancel'),
    private_metadata: JSON.stringify({ sessionId: session.id }),
    blocks: [
      ...errorBlocks,
      { type: 'section', text: mrkdwn(`*Current configuration*\n${session.analysis.summary}`) },
      { type: 'context', elements: [mrkdwn(productLine(session.analysis.extracted.products))] },
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
          placeholder: plain('e.g. 15% instead of 10%, and add a yearly subscription option'),
        },
      },
    ],
  };
}

function readAdjust(view) {
  return (view.state.values.change?.value.value || '').trim();
}

function adjustDoneView(session) {
  return {
    type: 'modal',
    callback_id: 'done',
    title: TITLE,
    close: plain('Done'),
    blocks: [
      {
        type: 'section',
        text: mrkdwn(`:white_check_mark: *Card updated in <#${session.card.channel}>*\n${session.analysis.summary}`),
      },
      { type: 'context', elements: [mrkdwn('Check it there and click *Build it* when it looks right.')] },
    ],
  };
}

function adjustBlockedView(session) {
  return {
    type: 'modal',
    callback_id: 'done',
    title: TITLE,
    close: plain('Close'),
    blocks: [
      {
        type: 'section',
        text: mrkdwn(`:no_entry: *Not applied.* This configuration was already built or discarded in <#${session.card.channel}> while I was working, so the card is unchanged.`),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */

function productLine(products) {
  if (!products.length) return '_No products detected_';
  return products.map((p) => `*${p.name}*`).join('  ·  ');
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

module.exports = {
  intakeView,
  readIntake,
  progressView,
  questionsView,
  readAnswers,
  doneView,
  adjustView,
  readAdjust,
  adjustDoneView,
  adjustBlockedView,
};
