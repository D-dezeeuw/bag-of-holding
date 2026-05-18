import { validateBeat } from './schema.js';

/**
 * Validate every beat up front so a thread is either fully sound or
 * rejected — half-validated threads would silently fail later in
 * the run, far from the offending beat. The `<no id>` fallback in
 * the error message means an unidentifiable bad beat still produces
 * a usable diagnostic instead of `Invalid beat undefined:`.
 */
export function createThread(beats) {
  for (const beat of beats) {
    const { valid, errors } = validateBeat(beat);
    if (!valid) throw new Error(`Invalid beat ${beat?.id ?? '<no id>'}: ${errors.join(', ')}`);
  }
  return { beats, currentIndex: 0 };
}

/**
 * Returns `null` past the end of the thread (rather than throwing
 * or returning undefined) so the loop can distinguish "thread is
 * still walking" from "thread is exhausted" with a simple null
 * check at the caller. Throwing would make a finished thread feel
 * like an error condition; it isn't.
 */
export function currentBeat(thread) {
  return thread.beats[thread.currentIndex] ?? null;
}

/**
 * Beat is ready when every prerequisite flag is set. We chain
 * through `state?.flags?.[flag]` so a half-built save (or a
 * test fixture) that omits the flags object still evaluates
 * cleanly to "not ready" instead of crashing.
 *
 * Symmetric with `isComplete` so authoring tools can render
 * "ready: ✓ / complete: ✗" tables side-by-side without
 * special-casing either branch.
 */
export function isReady(beat, state) {
  if (!beat) return false;
  return (beat.prerequisites ?? []).every(flag => state?.flags?.[flag] === true);
}

/**
 * A beat is complete when every flag it promises to set is in
 * state. The mirror of `isReady`: prerequisites gate entry,
 * setRequiredFlags gate exit, both keyed off the same flags object.
 */
export function isComplete(beat, state) {
  if (!beat) return false;
  return (beat.setRequiredFlags ?? []).every(flag => state?.flags?.[flag] === true);
}

/**
 * Step forward iff the current beat reports complete. Returns
 * `{ thread, advanced, reason?, finished? }` rather than throwing
 * on "not yet" because the game loop is allowed to *try* advancing
 * after every player action — failure is the normal case, not an
 * error.
 *
 * `finished: true` is the signal the loop reads to end the
 * chronicle ("the story ends"). The thread is still returned with
 * an out-of-range `currentIndex` so the loop can keep it around
 * for save-file purposes without special-casing the "done" state.
 */
export function advance(thread, state) {
  const beat = currentBeat(thread);
  if (!beat) return { thread, advanced: false, reason: 'no current beat' };
  if (!isComplete(beat, state)) return { thread, advanced: false, reason: 'current beat not complete' };

  const nextIndex = thread.currentIndex + 1;
  const finished = nextIndex >= thread.beats.length;
  return {
    thread: { ...thread, currentIndex: nextIndex },
    advanced: true,
    finished
  };
}
