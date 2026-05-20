// === Solo namespace barrel (since 2.0.0) ===
//
// The engine binds these into `engine.Solo`, `engine.Session`, and
// `engine.Replay`; index.js re-exports them as top-level names so
// pure callers can do `import { Solo, Session, Replay } from
// '@zeeuw/bag-of-holding'` without constructing an engine first.

import { oracle, ODDS_BANDS, OUTCOMES } from './oracle.js';
import { create, restore } from './session.js';
import { share, verify } from './replay-share.js';
import { STARTER_PARTY } from './starter.js';

/** Solo-play oracle. See `src/solo/oracle.js`. */
export const Solo = Object.freeze({ oracle, ODDS_BANDS, OUTCOMES });

/** Session orchestrator. See `src/solo/session.js`. */
export const Session = Object.freeze({ create, restore });

/** Replay sharing. See `src/solo/replay-share.js`. The base
 *  verifyLog primitive still lives on the engine; this is the
 *  portable-payload wrapper. */
export const Replay = Object.freeze({ share, verify });

export { STARTER_PARTY };
