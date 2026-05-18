# Roadmap

A living plan for `bag-of-holding`. Versions are tentative — they
describe *order and grouping*, not commitments to a calendar. Each
milestone names what lands and **why now**; deliverables that need a
real consumer driving them are deferred until that consumer exists.

> Status as of 2026-05-18: `0.0.0`, pre-release. Tier 1 (levels 1–5)
> SRD 5.2 surface with Phase A plugin system, hand-maintained
> TypeScript declarations, and 100 / 100 / 100 coverage. Not yet
> published to npm.

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
| Core math | `Dice`, `Checks`, `Combat.{attackRoll, damageRoll, rollInitiative, applyMastery}`, `XP`, `Movesets` (placeholder) |
| Beat runtime | Linear walking (v1); branching schema accepted but ignored |
| Plugins | Phase A: content registries via `createEngine(opts)` |
| Types | Hand-maintained `index.d.ts`, strict-mode typecheck gate |
| Tests | `node --test`, 115 tests, 100 / 100 / 100 line / branch / function |
| Determinism | Uses `Math.random` (non-seedable) — flagged for `0.1.0` |
| Published | No |

## Near-term: stabilise and round out the kernel

### `0.1.0` — Determinism

The blocking gap before any consumer can rely on replay.

- **Seedable RNG.** Replace the direct `Math.random` in `dice.js` with
  a thread-through-able RNG. Default to `Math.random` when none is
  supplied; engine factory accepts a `rng` option. Consumers that
  need replay (Spektrum-backed apps, AI agent tests) pass in a
  seeded generator.
- **Roll log.** Optional `recordRoll` hook on the engine so every
  `rollDie` call can be captured for replay or audit.
- **First npm publish.** Tag `v0.1.0`, push to npm with the existing
  `types` + `exports` shape. Verify the CDN paths
  (`unpkg.com/@zeeuw/bag-of-holding@0.1.0/index.js`) resolve.

*Why first:* Dungeons-and-Dans depends on Spektrum's history primitive
for undo and chapter rewinds; the rules engine must be replay-compatible
before the app can wire it in.

### `0.2.0` — Rule modifications (plugin Phase B)

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

### `0.3.0` — Behavioural hooks (plugin Phase C)

Closes the plugin trifecta: content (A), rules (B), behaviour (C).

- **Hook surface, deliberately small.** `beforeAttack`,
  `afterDamage`, `onLevelUp`, `onConditionApplied`, `onDeath`. Each
  hook has a documented contract: fire order, can-mutate-input,
  can-short-circuit, throw semantics.
- **Hook registration via the engine factory.** No global event bus;
  hooks live on the engine instance and don't leak across instances.
- **Tests for hook ordering and isolation** between engines.

*Why deferred until 0.3:* We don't yet know which hooks consumers
will actually reach for. Better to ship 0.1 and 0.2, get usage
feedback, and pick the right five than to ship fifteen speculative
ones.

## Mid-term: combat and spellcasting depth

### `0.4.0` — Combat completeness

Today the engine resolves *one attack*. To run a full encounter the
host has to compose the missing pieces by hand.

- **Initiative tracker.** `Combat.startEncounter(participants)`
  returns a turn-order object the loop steps through. Tracks
  conditions per actor between turns.
- **Action economy enforcement.** Per-turn budgets (action, bonus,
  reaction, movement); the engine refuses a second action and
  returns a structured `{ allowed: false, reason: 'no-action-left' }`.
- **Multi-attack** (Fighter L5's Extra Attack and the L1 weapon mastery
  count slot).
- **Opportunity attacks.** Triggered when an actor leaves another's
  reach; resolved through `attackRoll` with the reaction budget
  consumed.
- **Cover and range.** Abstract enough for text-based play
  (`cover: 'half' | 'three-quarter' | 'full'`).

### `0.5.0` — Spellcasting mechanics

Spell *records* ship at `0.0`; spell *mechanics* don't.

- **Spell slot tables and tracking.** Per-class, per-level, with rest
  semantics.
- **Concentration.** One concentration spell at a time; damage
  triggers a CON save; existing concentration drops on a new cast.
- **Preparation lists** for Cleric, Wizard, Druid, Paladin, Ranger.
- **Cantrip scaling** by character level (SRD's "at higher levels"
  table for damage cantrips).
- **Reaction-cast hooks.** Shield, Counterspell — surfaced as Phase
  C hooks once 0.3 lands.

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
