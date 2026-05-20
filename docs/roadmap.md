# Roadmap

A living plan for `bag-of-holding`. Versions are tentative — they
describe *order and grouping*, not commitments to a calendar. Each
milestone names what lands and **why now**; deliverables that need a
real consumer driving them are deferred until that consumer exists.

> Status as of 2026-05-20: **`1.0.0` — feature complete** for the
> kernel surface (dice, slots, conditions, XP, character derivation,
> beats, plugins). All 12 SRD 5.2 base classes at levels 1–10; full
> Phase A/B/C plugin systems; forensically inspectable randomness;
> character-sheet derivation; encounter system with logged initiative;
> spellcasting mechanics; condition effects; beat runtime v2 with
> sub-threads; XP/proficiency tables through L20; broad item/spell/
> monster registries; bundle-size CI gate; 453 tests at 100 / 100 / 100
> coverage. The public API in `index.d.ts` is the frozen 1.0 contract
> — semver from here on means something.
>
> **SRD coverage is not yet complete**: death saves, rest-based HP
> recovery, hit-dice spending, and class-feature *mechanics* (vs the
> current metadata) are tracked under [SRD 5.2 completeness](#srd-52-completeness)
> below. A handful of math bugs against the published rule text are
> queued for `1.0.1`.

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

### `0.6.0` — Class breadth ✅ shipped

All 12 SRD 5.2 base classes at levels 1–5 with one subclass each.

- **Added**: Barbarian (Berserker), Bard (College of Lore), Druid
  (Circle of the Land), Monk (Open Hand), Paladin (Oath of
  Devotion), Ranger (Hunter), Sorcerer (Draconic Sorcery), Warlock
  (The Fiend).
- **Movesets** dispatch over per-class chip providers with `minLevel`
  gates and an optional `combatOnly` predicate. Each class declares
  its signature chips (Rage, Bardic Inspiration, Cunning Action,
  Wild Shape, Eldritch Blast, etc.).

### `0.7.0` — Condition effects ✅ shipped

Mechanical effects baked into the math; condition-aware movesets.

- **CONDITION_EFFECTS table**: each SRD condition declares its flags
  (`ownAttackDisadvantage`, `targetAdvantage`, `speedZero`,
  `autoFailStrDexSaves`, `critIfAttackerWithin5`, `cantSee`,
  `cantHear`, `incapacitates`, `proneOnTarget`, …).
- **`Conditions.effectsFor(actor)`** unions flags across all active
  conditions (boolean OR).
- **`Conditions.attackStance({ attacker, target, attackerDistanceFt })`**
  computes the advantage/disadvantage stance — adv+dis cancel.
- **`Combat.attackRoll`** now accepts optional `attacker`, `target`,
  `attackerDistanceFt` and rolls advantage/disadvantage accordingly;
  the result surfaces `stance` for UI labelling.
- **Condition-aware movesets**: incapacitating conditions collapse
  the chip set to a `wait` affordance; prone replaces it with
  `stand-up`.

### `0.8.0` — Beat runtime v2 ✅ shipped

The beat schema's `successors[]` is now walked by the runtime.

- **Branching threads.** `advance(thread, state, { chooseSuccessor })`
  walks a graph instead of a list. With no picker, the first ready
  successor is taken (deterministic for previewing).
- **Conditional successors.** Successors are filtered by their own
  `prerequisites[]` against `state.flags` before being offered to
  the picker.
- **Nested threads.** `Beats.pushSubThread(thread, beats)` pushes a
  sub-thread; the runtime walks it transparently and pops on
  completion. Tracked via `Beats.subThreadDepth(thread)`.

## Late-term: completeness and ecosystem

### `0.9.0` — Levels 6+ ✅ shipped

Tier 2 (and the full L1–20 numerical curve) shipped.

- **XP table** through L20: 14 000 (L6) … 355 000 (L20).
- **Proficiency bonus** table through L20: +2 → +6.
- **Spell slot tables** were already L1–20 (full caster, half
  caster, Warlock); 0.9.0 wires the host-visible class progression
  past L5.
- **Class features at L6–10** for all 12 base classes (Ability
  Score Improvements, subclass-feature checkpoints, signature
  features per SRD). Subclass body content for tiers 3–4 is
  deferred to 1.0.
- **Cantrip scaling** at the L5 and (still-out-of-scope) L11/17
  breakpoints already implemented in 0.5.0.

### `1.0.0` — Feature complete ✅ shipped

The stable contract.

- **SRD 5.2 content.** All 12 classes through L10 with one subclass
  each, a broad weapon/armor/consumable item table, a representative
  spell list (cantrips through L5) covering the reaction-cast and
  concentration archetypes the host loop expects, and a starter
  monster registry (`engine.monsters`) with `extraMonsters` plugin
  extension.
- **Frozen public API.** `index.d.ts` is the contract. Semver
  starts here.
- **Worked-example integration test** (`tests/integration.test.js`)
  exercises the full kernel end-to-end: derive sheet, run encounter,
  fire hooks, consume slots, level up, replay the roll log.
- **Performance budget gate.** `npm run bundle-size` measures the
  approx-minified and gzipped surface and fails CI if it exceeds
  the documented budget (120 kB min / 30 kB gz — see
  `scripts/measure-bundle.js` for the rationale).
- **Replay covers the encounter system.** Initiative rolls flow
  into `engine.rollLog`; `verifyLog` reconstructs them.
- **Documentation site** (TypeDoc-style generated reference) is
  deferred to post-1.0 — `index.d.ts` doc-comments cover the same
  ground for now.
- **Real production consumer** — the integration test is the
  highest-fidelity stand-in until a downstream host adopts the
  package.

## SRD 5.2 completeness

Gaps and bugs identified by reading the engine against the published
[SRD 5.2 (2025)](https://www.dndbeyond.com/srd) text. Unlike the
parking lot below these are tracked commitments — the kernel is not
honestly "SRD 5.2 compliant" until they land.

### `1.0.1` — SRD math fixes (patch)

Three handlers return values that diverge from the published rule
text. Patch-level because public signatures are unchanged; only the
numbers move (and the fixtures pinning the buggy values).

- **Topple save DC double-counts proficiency** (`src/combat.js:164–167`).
  SRD 5.2 § *Weapon Mastery Properties — Topple*: the Constitution
  save DC is **8 + the attacker's ability modifier + their
  proficiency bonus**. The handler computes
  `8 + result.attackBonus + attacker.proficiencyBonus`, but
  `attackBonus` already includes proficiency, so it's added twice. A
  L5 Fighter (+4 STR, +3 prof) currently produces DC 18; the SRD
  value is 15. Fix: split the inputs at the handler boundary — pass
  the raw ability modifier alongside the composite `attackBonus`, or
  recover it as `attackBonus − proficiencyBonus` when only the
  composite is available. Pin a fixture covering the L5 Fighter
  case.
- **Graze damage uses full attack bonus instead of ability modifier**
  (`src/combat.js:133`). SRD 5.2 § *Weapon Mastery Properties —
  Graze*: "the target takes damage equal to **the ability modifier
  you used to make the attack roll**." The handler returns
  `result.attackBonus`, inflating graze by the proficiency bonus.
  Same boundary change as Topple — the handler needs the ability
  modifier separately. A L5 STR-16 Fighter should graze for 3, not 6.
- **DC clamp ceiling: 25 → 30 (or document the deviation)**
  (`src/checks.js:8`). SRD 5.2 § *Ability Checks — Typical
  Difficulty Classes* lists DC 30 as **Nearly Impossible**; clamping
  at 25 silently rewrites it to Very Hard. Either raise `MAX_DC` to
  30 (matches the table) or rename the constant to
  `AI_SANITY_DC_CEILING` and document the deviation in `spec.md` so
  consumers reading the SRD don't get surprised by the silent
  rewrite.

*Why first:* All three are quietly wrong against published text. The
fix is small, the blast radius is contained (each is one handler /
one constant), and shipping them as 1.0.1 keeps semver honest before
any feature work lands on top.

### `1.1.0` — Death saving throws

The 0-HP-to-dead pipeline is entirely absent. SRD 5.2 § *Death
Saving Throws* and § *Damage at 0 Hit Points* still apply: at 0 HP a
creature falls Unconscious and rolls a DC 10 d20 on each of its
turns; three successes stabilise, three failures kill; a natural 1
counts as two failures, a natural 20 restores 1 HP and consciousness;
damage taken while at 0 HP counts as a failed save (two if a crit),
and damage ≥ HP max while at 0 is instant death.

- **`Combat.deathSave(actor, rng?, rules?)`** — pure function,
  returns `{ d20, outcome: 'success' | 'failure' | 'stable' | 'dead'
  | 'revived', actor: nextActor }`. Tracks state on
  `actor.deathSaves: { successes, failures, stable, dead }`,
  immutably.
- **`Combat.applyDamageWhileDown(actor, damageTaken, { critical })`**
  — encodes the failed-save-on-damage rule from § *Damage at 0 Hit
  Points*, including the massive-damage instant-death threshold.
- **`Combat.dropToZero(actor)`** — applies the Unconscious condition,
  zeroes HP, initialises the death-save tracker. Fires the existing
  `onConditionApplied` hook.
- **`Combat.stabilize(actor)`** and **`Combat.reviveTo(actor, hp)`**
  — for healing-word, spare-the-dying, and Medicine-check
  stabilise paths. `reviveTo` clears the tracker and removes
  Unconscious.
- **Rules knobs:** `deathSaveDC: number` (default 10) and
  `deathSaveSuccessesRequired: number` (default 3) for gritty /
  heroic packs.

*Why now:* Hosts cannot run a real session without this — the HP
loop bottoms out at "actor.hp === 0" with no engine handling. The
`onDeath` hook surface exists but only fires from exhaustion; this
wires the second pathway.

### `1.2.0` — Rest mechanics (HP recovery + hit-dice spending)

`Spellcasting.longRest` and `Spellcasting.shortRest` currently only
refill spell slots. SRD 5.2 § *Short Rest* and § *Long Rest* both
touch HP and hit dice.

- **Short rest, SRD § *Short Rest*:** `Character.spendHitDie(actor,
  rng?)` rolls one Hit Die + CON modifier (minimum 1 per the rule)
  and restores that HP, decrementing the actor's hit-dice pool. The
  host decides how many to spend in one rest; the engine resolves
  one die at a time.
- **Long rest, SRD § *Long Rest*:** add `Character.longRest(actor)`
  that:
  - restores HP to max,
  - restores **half the actor's total Hit Dice** (rounded down,
    minimum 1) per the SRD text,
  - resets the death-save tracker from 1.1,
  - reduces one level of Exhaustion (delegates to
    `exhaustion.reduce`),
  - refills spell slots (delegates to existing `Spellcasting.longRest`).
- **Hit-dice pool on the record.** Extend `CharacterRecord` with
  `hitDiceTotal` and `hitDiceUsed`; derive `hitDiceRemaining` on
  the sheet. Document the additions in `docs/character-sheet.md` and
  update the golden fixtures.
- **Rules knob:** `longRestHitDiceRecovery: 'half' | 'all' | 'none'`
  for gritty (`'none'`) and heroic (`'all'`) variants.

*Why now:* Spells refill on rest, HP doesn't — asymmetric and
visibly broken in any extended session. 1.1's "back to 1 HP" pathway
needs a "back to max HP" counterpart to close the loop.

### `1.3.0` — Class feature mechanics

Class definitions currently expose features as strings
(`features: { 1: ['Second Wind', 'Action Surge', ...] }`). The
engine *names* features but doesn't enforce them. SRD 5.2 § *Classes*
specifies the mechanics for each; implementing them is the long tail.

Scope this milestone to **resource-bearing features** (the ones that
consume a counter and need engine bookkeeping). Purely narrative
features stay with the host. For each base class, ship handlers +
actor-state shape + rest-reset wiring:

- **Barbarian** § *Rage* — per-day uses, advantage on STR
  checks/saves, +damage by level, resistance to
  bludgeoning/piercing/slashing.
- **Bard** § *Bardic Inspiration* — CHA-mod uses, long-rest refresh
  (short rest from L5 per *Font of Inspiration*).
- **Cleric** § *Channel Divinity* — uses scale with level, short-rest
  refresh.
- **Druid** § *Wild Shape* — uses per short rest, CR cap by level.
- **Fighter** § *Second Wind* (`1d10 + level` HP, per short rest) and
  § *Action Surge* (extra action, per short/long rest).
- **Monk** § *Martial Arts* dice and § *Focus Points* (replaces Ki in
  the 2024 SRD): point pool, point-spend handlers, short-rest
  refresh.
- **Paladin** § *Divine Sense*, § *Lay on Hands* (pool = 5 × level),
  § *Divine Smite* (consume a spell slot, add radiant dice scaled
  per slot level).
- **Ranger** § *Hunter's Mark* binding to a slot, § *Favored Enemy*
  free-cast accounting.
- **Rogue** § *Sneak Attack* (1d6 per two levels, once per turn,
  finesse/ranged + advantage *or* qualifying ally adjacent).
- **Sorcerer** § *Sorcery Points* and § *Metamagic* — the
  convert-slot↔point loop.
- **Warlock** § *Eldritch Invocations* — selection and validation
  (pact magic itself already ships).
- **Wizard** § *Arcane Recovery* — recover spell-slot levels equal to
  ½ wizard level (rounded up), once per long rest, on a short rest.

Shape contract: each handler is a pure function
`(actor, args?, rng?) → { actor: nextActor, result }` registered on
the class def under a `mechanics` map, so a custom-class plugin can
ship its own without forking. Resource counters all live on
`actor.resources[<id>]` with a normalized
`{ used, max, refreshes: 'short' | 'long' | 'day' }` shape so 1.2's
rest functions reset them generically.

*Why now:* Without this, the "12 SRD 5.2 base classes" claim
overstates what the engine actually enforces. Metadata is fine for
chip rendering; class *mechanics* are what the rules-kernel boundary
promises. Largest milestone here — likely split into per-class
sub-releases (`1.3.1`, `1.3.2`, …) once a real consumer drives the
priority order.

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
