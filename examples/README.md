# Examples

Self-contained reference apps built on `@zeeuw/bag-of-holding`. Each
example loads the kernel as ESM from the repo root — no build step.

## `solo.html` — solo-mode sandbox (since 2.0.0)

A one-page browser playground for the 2.0.0 solo namespace: the
four-character starter party in a turn-based encounter against
goblins / orcs, an oracle for yes/no/maybe rulings, a scene clock,
and one-click `Replay.share` + `Replay.verify` to prove the dice
stream reproduces from the seed.

### Run it

From the repo root:

```sh
# Node 22 ships an HTTP serve helper; any static server works.
npx http-server -p 8765 .
# or:
python3 -m http.server 8765
```

Then open <http://localhost:8765/examples/solo.html>.

### What it shows

- `STARTER_PARTY` — 4 ready-to-play L3 characters baked into the
  package, derived through `engine.deriveSheet`.
- `engine.Session.create({ party, encounter, scene, seed })` —
  the orchestrator that ties turn loop + scene clock + save/load.
- `engine.Solo.oracle({ rng })` — yes/no answers with odds bands,
  twists, complications.
- `engine.Replay.share(session)` + `engine.Replay.verify(payload)`
  — portable replay payloads.
- The full `engine.rollLog` audit trail captured from every dice
  draw the session produces.
