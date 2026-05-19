# Roadmap

A living plan for `bag-of-holding`. Versions are tentative — they
describe *order and grouping*, not commitments to a calendar. Each
milestone names what lands and **why now**; deliverables that need a
real consumer driving them are deferred until that consumer exists.

> Status as of 2026-05-19: `0.5.0`, pre-release. SRD 5.2 surface
> with Phase A/B/C plugin systems; forensically inspectable
> randomness from 0.1.0; character-sheet derivation; encounter
> system from 0.4.0; **spellcasting mechanics** (slots, rests,
> concentration, cantrip scaling, prep lists) from 0.5.0; 346
> tests at 100 / 100 / 100 coverage. GitHub-tagged through `v0.5.0`.

## Vision

A tiny, AI-agnostic 5e rules kernel that ships as a single CDN-loadable
ESM file, scales from a single quick-play app to a 100-hour persistent
campaign, and lets homebrewers and AI agents alike contribute content
and rules without forking the engine. The engine is the *math*; the
host owns the prose, the persistence, and the AI loop.

Three properties we won't trade away:

- **Zero runtime dependencies.** A single file, auditable line-by-line,
  pinned and SRI-hashed on the CDN.
- **Pure functions, plain data.** No globals, no I/O, no network, no
  DOM. Every result is a serialisable object the host can persist,
  replay, or hand to an AI.
- **Replay-deterministic.** Same inputs → same outputs. Required for
  Spektrum-style undo/redo, branching saves, and AI-tool testing.

## Where we are today (`0.x` pre-release)

| Area | State |
| --- | --- |
| SRD 5.2 surface, levels 1–5 | 4 classes, 9 species, 4 backgrounds, 3 origin feats, weapon mastery, numeric exhaustion, 14 boolean conditions |
| Core math | `Dice` (incl. `seededRng`, `rollExplosive`), `Checks`, `Combat.{attackRoll, damageRoll, rollInitiative, applyMastery}`, `XP`, `Movesets` (placeholder) |
| Beat runtime | Linear walking (v1); branching schema accepted but ignored |
| Plugins | **Phase A** (content) + **Phase B** (rule knobs: critOn/fumbleOn, damageFloor, explodingDamageDice, xpThresholds, proficiencyByLevel) + **Phase C** (hooks: beforeAttack/afterDamage/onLevelUp/onConditionApplied/onDeath) shipped via `createEngine(opts)` |
| Character sheets | `Character.deriveSheet(record, engine)` — host owns the persistent record, engine derives the sheet |
| Determinism | Seedable RNG, append-only `engine.rollLog`, context tags, `verifyLog` replay verifier — all 0.1.0+ |
| Types | Hand-maintained `index.d.ts`, strict-mode typecheck gate |
| Tests | `node --test`, 230 tests, 100 / 100 / 100 line / branch / function |
| Published | GitHub-tagged through `v0.2.0`; npm publish pending |

## Near-term: stabilise and round out the kernel

### `0.1.0` — Determinism with audit, test, and trace-back ✅ shipped

The blocking gap before any consumer can rely on replay. Going
beyond "seedable" — this release makes the engine's stochastic
surface *forensically inspectable*: every random outcome is
reproducible, recordable, and traceable back to the roll that
caused it.

- **Seedable RNG.** New `Dice.seededRng(seed)` returns a deterministic
  function with the same `() => [0, 1)` signature as `Math.random`.
  Default algorithm: Mulberry32 (32-bit state, ~6 lines, widely used
  for game RNG). Every rolling function (`rollDie`, `roll`,
  `attackRoll`, `damageRoll`, `abilityCheck`, `savingThrow`,
  `rollInitiative`) takes an optional `rng` parameter; the engine
  factory threads one shared rng to all of them via bound wrappers.
- **Roll log.** The engine maintains an append-only `rollLog`
  capturing every die roll. Entry shape:

  ```js
  { index, op, sides, value, context?: unknown, ts? }
  ```

  Plain JSON — serialise it, attach it to a bug report, ship it to
  a teammate, replay it later. Configurable size cap (drop-oldest on
  overflow) so long sessions don't balloon memory.
- **Context tags for trace-back.** Every rolling function accepts an
  optional `context` field (string or object) that's attached to the
  log entry. The loop tags rolls with what they were *for*
  (`'attack vs orc, turn 14'`, `'death save'`, `'wild magic surge
  check'`), so a postmortem can answer *"which roll caused this
  outcome?"* without re-running the session.
- **Replay verifier.** `Dice.verifyLog({ seed, log })` walks a
  recorded log forward from the seed, comparing each generated roll
  to the logged value. Returns `{ ok: true }` on match, or
  `{ ok: false, divergedAt: index, expected, actual }` on the first
  disagreement. Catches regressions, AI hallucinations claiming the
  engine rolled something it didn't, and state corruption across
  saves.
- **Test pins.** New `tests/rng.test.js` locks specific seed→output
  pairs across all rolling functions. If anyone touches the Mulberry32
  implementation the tests fail loud — preventing silent
  determinism regressions across versions. Coverage stays at
  100 / 100 / 100.
- **First milestone npm publish.** Tag `v0.1.0`, publish to npm.
  The `0.0.1` placeholder publish (already shipped or in flight) is
  superseded; consumers pin `^0.1.0` from here on.

*Why first:* Dungeons-and-Dans depends on Spektrum's history primitive
for undo and chapter rewinds; the rules engine must be replay-
compatible before the app can wire it in. The audit / test / trace-
back surface also unlocks reliable AI-loop testing — *"the AI claims
it rolled X, did it?"* becomes a verifiable question, not a vibes-
based dispute.

### `0.1.5` — Character sheet derivation ✅ shipped

Locks the host/engine boundary for the most consumer-visible surface:
the sheet a player reads. The host keeps owning the persistent
character record; the engine takes that record and returns every
number a paper sheet would show.

- **`CharacterRecord` schema.** Single source of truth for the host:
  identity (species / background / class / level), base ability
  scores, equipment by id, accumulated proficiencies, feats,
  conditions, exhaustion, xp. See
  [character-sheet.md](character-sheet.md).
- **`DerivedSheet` shape.** Frozen, fully-computed view: ability
  mods, prof bonus, AC with breakdown, HP, saves, all 18 SRD
  skills (with expertise), attacks per equipped weapon,
  spellcasting attack/DC, passives, post-condition speed, carrying
  capacity, active effects.
- **`engine.deriveSheet(record)` + `Character.deriveSheet(record,
  registries)`.** Same function, two call sites — engine-bound for
  the common case, module-level for unit tests and multi-engine
  hosts.
- **Pinned fixtures.** Golden expected sheets for L1 Rogue,
  L3 Fighter, L5 Wizard cover the worked example in the doc and
  pin every line of math.
- **Validation with pointer-quality errors.** `CharacterRecord.classId
  'paladin' not registered with engine` — same style as the plugin
  validator.

*Why now:* the app's UI panel needs *some* function to call when a
record changes, and "render the sheet" is the most common
recompute trigger in a session (equip, condition, level-up). Without
this, every consumer would re-implement the math and drift from
the rules. Lands before 0.2's rule knobs (`damageFloor`,
`proficiencyByLevel`) so the rule knobs flow through derivation
cleanly.

### `0.2.0` — Rule modifications (plugin Phase B) ✅ shipped

Plugins can already contribute *content*. Phase B lets them contribute
*rules*.

- **`rules` option on `createEngine`.** A small, named-knob object:
  `critOn: number[]`, `fumbleOn: number[]`, `damageFloor: number`,
  `explodingDamageDice: boolean`. Threaded into the math functions
  with sane defaults; most callers ignore it.
- **XP curve overrides.** Per-engine `THRESHOLDS` and
  `PROFICIENCY_BY_LEVEL` replacement so themes (heroic, gritty) can
  retune progression.
- **Documented compatibility surface.** Each knob ships with a one-
  line description in `spec.md` and an entry in `index.d.ts`.

*Why now:* Real homebrew demands more than data — house rules,
weapon-specific crit ranges, exploding dice, "saves crit on 20" all
hit the math. Without Phase B, themed packs are limited to
re-skinning content.

### `0.3.0` — Behavioural hooks (plugin Phase C) ✅ shipped

Closes the plugin trifecta: content (A), rules (B), behaviour (C).

- **Hook surface, deliberately small.** `beforeAttack`,
  `afterDamage`, `onLevelUp`, `onConditionApplied`, `onDeath`. Each
  hook has a documented contract: fire order, can-mutate-input,
  can-short-circuit, throw semantics.
- **Hook registration via the engine factory.** No global event bus;
  hooks live on the engine instance and don't leak across instances.
- **Tests for hook ordering and isolation** between engines.

## Mid-term: combat and spellcasting depth

### `0.4.0` — Combat completeness ✅ shipped

Today the engine resolves *one attack*. To run a full encounter the
host has to compose the missing pieces by hand.

- **Initiative tracker.** `Combat.startEncounter(participants)`
  returns a turn-order object the loop steps through. Tracks
  action budgets per actor between turns.
- **Action economy enforcement.** Per-turn budgets (action, bonus,
  reaction, movement); `Combat.spend(state, id, cost)` returns
  `{ allowed: true, state }` or `{ allowed: false, reason }`.
- **Multi-attack** via `Combat.attacksPerAction(classDef, level)`
  reading each class's `extraAttacks` table.
- **Opportunity attacks** via `Combat.opportunityAttack(state, …)`,
  consuming the reactor's reaction budget and rolling the attack.
- **Cover and range** via `Combat.effectiveAc(baseAc, cover)` and
  `Combat.rangeBand({ distance, normalRange, longRange })`.

### `0.5.0` — Spellcasting mechanics ✅ shipped

Spell *records* ship at `0.0`; spell *mechanics* land here.

- **Spell slot tables** for full-caster (Wizard et al., L1–20),
  half-caster (Paladin/Ranger, L2–20), and Warlock Pact slots.
  `Spellcasting.freshSlots(progression, level)`.
- **Slot consumption** with auto-upcasting and refund:
  `consumeSlot`, `refundSlot`.
- **Rest semantics.** `longRest` refills everything; `shortRest`
  refills only `source: 'pact'` slots.
- **Concentration.** `startConcentration`/`endConcentration` track
  one active spell per caster; `concentrationSaveDC(damage)`
  returns `max(10, floor(damage/2))`.
- **Cantrip scaling.** `cantripTier(level)` and
  `scaledDamageSpec(spec, level)` handle the 5/11/17 breakpoints.
- **Preparation lists.** `preparedSpellCount({ casterLevel,
  abilityMod, progression })` and `validatePreparation({ known,
  prepared, … })`.
- **Reaction-cast** integrates with Phase C hooks: register a
  `beforeAttack` handler that returns `{ ac: ac + 5 }` for the
  Shield spell pattern.

### `0.6.0` — Class breadth

Fill in the eight classes currently missing.

- **Add Barbarian, Bard, Druid, Monk, Paladin, Ranger, Sorcerer,
  Warlock** at levels 1–5, with one subclass each per SRD 5.2
  (Berserker, Lore, Land, Open Hand, Devotion, Hunter, Draconic,
  Fiend).
- **Class-specific moveset** providers: `Movesets.legal` becomes a
  dispatch over per-class providers, each returning the chips the
  class actually has at this level.

### `0.7.0` — Condition effects

Today conditions are *tracked*; their mechanical effects are
documented in comments but not enforced.

- **Bake effects into the math.** `Blinded → disadvantage on
  attacks`, `Restrained → speed 0`, `Stunned → automatic fail on
  STR/DEX saves`, etc.
- **Condition-aware moveset.** A stunned actor's moveset is empty;
  a prone one's moveset adds "stand up (half movement)".

### `0.8.0` — Beat runtime v2

The beat schema already accepts `successors[]`; the runtime ignores
it.

- **Branching threads.** `advance()` walks a graph instead of a
  list; the host (or the AI's classifier) picks the next beat from
  the current beat's successors.
- **Conditional successors.** Successors can be gated by flag
  predicates so the same beat fans out differently per playthrough.
- **Nested threads.** A beat can spawn a sub-thread (a side quest,
  a flashback) that completes back into the parent.

## Late-term: completeness and ecosystem

### `0.9.0` — Levels 6+

Stretch toward full level coverage.

- **Tier 2 (levels 6–10)** for the 12 base classes. Subclass
  features through L10. Spell slots through L5.
- **Tiers 3–4 deferred** until Tier 2 has been exercised by a real
  campaign — the higher tiers contain the most "you need a custom
  rule for this one thing" content and benefit from real-world
  pressure.

### `1.0.0` — Feature complete

The stable contract. Nothing here is novel; it's the bundle of
everything above plus the final coat of polish.

- **Full SRD 5.2 content.** All classes + subclasses, full spell
  list, magic items, monster stat blocks (for hosts that don't
  AI-generate creatures).
- **Frozen public API.** `index.d.ts` is the contract; semver from
  here on means something.
- **Documentation site** generated from JSDoc / d.ts (TypeDoc, like
  Spektrum).
- **Real production consumer.** Dungeons-and-Dans, or another app,
  has run a full campaign through the engine without forking.
- **Performance budget.** Bundle target: < 25 kB minified, < 10 kB
  gzipped. Verified in CI.

## Post-1.0 ideas (no commitment)

- **Optional rules variants** — gritty resting, slow natural healing,
  flanking, called shots — each as a shippable plugin.
- **Encounter builder helpers** — CR/XP budgets, difficulty estimates
  per party composition.
- **Localizable strings** — class names, condition labels, etc., for
  hosts that target non-English campaigns.
- **Code splitting** — separate entry points for `bag-of-holding/srd`
  (data only) and `bag-of-holding/engine` (math only), so a tiny app
  that only needs dice + checks can ship < 5 kB.
- **Streaming spell rules** — a community contribution channel for
  community-authored class/subclass plugins, vetted against the
  validation surface the engine already ships.

## What we will deliberately *not* build

- **Narration, prose, or AI calls.** That's the host's job. See
  [boundary.md](boundary.md).
- **Persistence and save format.** The engine returns serialisable
  data; the host owns the storage.
- **A combat AI.** Picking monster actions is the host's
  responsibility; the engine just resolves them.
- **Multiplayer / netcode.** The engine has no concept of clients
  or peers.
- **UI primitives.** No widgets, no rendering, no theming. The
  engine returns chips; the host renders them.

## How decisions land

Roadmap order can change when a real consumer needs something
sooner, or when usage shows a planned milestone isn't earning its
keep. Three rules of thumb when re-ordering:

1. **Block clearance.** Anything Dungeons-and-Dans (or another real
   consumer) is blocked on jumps the queue.
2. **Smallest defensible API first.** Ship the minimum surface that
   solves the next concrete problem; deferred features cost less
   than features that have to be unshipped.
3. **Keep the kernel small.** If a milestone would meaningfully
   inflate the minified bundle, split it into an opt-in entry point
   before merging.
