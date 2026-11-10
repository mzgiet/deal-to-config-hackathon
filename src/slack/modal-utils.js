/*
 * Helpers shared by the flows that run Claude behind a modal (/configure,
 * /quote, Adjust): progress steps while waiting, tolerant views.update,
 * posting a card.
 */

const STEP_MS = 4000;

/*
 * Walk the progress view through its steps while Claude works. stop() waits
 * for any in-flight update, so it can never land on top of the next view.
 */
function startProgress(client, viewId, render, stepCount) {
  let step = 0;
  let stopped = false;
  let inFlight = Promise.resolve();

  const timer = setInterval(() => {
    if (step >= stepCount - 1) return;
    step += 1;
    const current = step;
    inFlight = inFlight.then(() => (stopped ? null : safeUpdate(client, viewId, render(current))));
  }, STEP_MS);

  return async () => {
    stopped = true;
    clearInterval(timer);
    await inFlight;
  };
}

/* views.update fails if the modal was closed meanwhile - not an error for us. */
async function safeUpdate(client, viewId, view, hash) {
  try {
    await client.views.update({ view_id: viewId, view, hash });
    return true;
  } catch (err) {
    console.warn(`views.update skipped: ${err.data?.error ?? err.message}`);
    return false;
  }
}

function short(message) {
  const first = String(message).split('\n')[0];
  return first.length > 200 ? `${first.slice(0, 199)}…` : first;
}

/* Post the session's card in its channel and remember where it is. */
async function postCard(client, session, render) {
  try {
    const res = await client.chat.postMessage({ channel: session.channelId, ...render(session) });
    session.card = { channel: res.channel, ts: res.ts };
  } catch (err) {
    if (['not_in_channel', 'channel_not_found'].includes(err.data?.error)) {
      throw new Error('I can\'t post in this channel. Invite me with /invite @Sales Copilot, or use a public channel.');
    }
    throw err;
  }
}

function foldQuestionsIntoAssumptions(analysis) {
  for (const q of analysis.questions) {
    analysis.assumptions.push(`${q.question} (not answered${q.suggested ? `, assumed ${q.suggested}` : ''})`);
  }
  analysis.questions = [];
}

module.exports = { startProgress, safeUpdate, short, postCard, foldQuestionsIntoAssumptions };
