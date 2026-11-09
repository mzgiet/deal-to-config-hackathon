/*
 * Helpers shared by the flows that run Claude behind a modal (/configure,
 * Adjust): progress steps while waiting, and tolerant views.update.
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

/* views.update fails if the rep closed the modal meanwhile - not an error for us. */
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
  const first = message.split('\n')[0];
  return first.length > 200 ? `${first.slice(0, 199)}…` : first;
}

module.exports = { startProgress, safeUpdate, short };
