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
parking lot at the bottom of this file these are tracked
commitments — the kernel is not honestly "SRD 5.2 compliant" until
they all land.

The full line-by-line worklist lives in
[docs/srd-coverage.md](srd-coverage.md); each milestone below
references the checklist section(s) it closes. The version numbering
runs `1.0.1 → 1.24.0`, with data-only registry growth folded in as
parallel patch releases (`1.x.y`). `2.0.0` is reserved for any
breaking-change cleanup once SRD coverage is closed; it may not be
needed at all.

### `1.0.1` — SRD math fixes (patch) ✅ shipped

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

### `1.1.0` — Death saving throws ✅ shipped

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

### `1.2.0` — Rest mechanics (HP recovery + hit-dice spending) ✅ shipped

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

### `1.3.0` — Class feature mechanics (foundation + Fighter/Rogue) ✅ shipped

Class definitions currently expose features as strings
(`features: { 1: ['Second Wind', 'Action Surge', ...] }`). The
engine *names* features but doesn't enforce them. SRD 5.2 § *Classes*
specifies the mechanics for each; implementing them is the long tail.

**Shipped in 1.3.0:** the foundation — resource shape, mechanics
dispatch, rest integration — plus reference implementations for
**Fighter** (§ *Second Wind*, § *Action Surge*) and **Rogue**
(§ *Sneak Attack*, plus an `endTurn` reset hook the host calls at
turn end). The shape contract:

- Resource counters live on `actor.resources[<id>]` as
  `{ used, max, refreshes: 'short' | 'long' | 'day' }`.
- Class defs declare their `resources` spec and `mechanics` handler
  map. `mechanics.<id>(actor, args, ctx)` returns a result object
  the host interprets.
- `Mechanics.freshResources(classDef, level)` initialises the pool
  for a new character; `Mechanics.spendResource(actor, id, amount?)`
  decrements it; `Mechanics.refreshResources(actor, kind)` resets
  matching counters on rest.
- `Rest.longRest` and the new `Rest.shortRest` call
  `refreshResources` with `'long'` and `'short'` respectively. Long
  Rest is a superset of Short Rest per SRD 5.2 § Long Rest.
- `Mechanics.apply(actor, id, args?, context?)` is the engine-bound
  dispatcher: looks the class up from the registry, threads the
  engine's rng + audit log into the handler's context.

**Per-class continuations (`1.3.x`):** the remaining ten classes
follow the same shape; each sub-release adds one class. Tracked
under [SRD 5.2 completeness § 1.3.x](#13x-per-class-feature-rollout).

*Why scope it this way:* implementing all 12 classes' resource
features in one release would ship a 2000-line PR with no real-world
feedback on the contract shape. Two reference implementations prove
the foundation (Second Wind exercises a healing-with-die mechanic;
Sneak Attack exercises a damage-rider / once-per-turn flag), and the
remaining ten classes can be added incrementally as a consumer
drives priority.

### `1.3.x` — Per-class feature rollout

Each sub-release adds one class's resource-bearing mechanics on top
of the 1.3.0 foundation, with full test coverage and a smoke entry
in the typecheck file:

- **`1.3.1`** Barbarian § *Rage* — uses per long rest (with 1
  recovered on a short rest, per 2024 SRD), Rage Damage bonus
  scaling (+2/+3/+4), BPS resistance flags, 10-minute / 100-round
  duration cap. State on `actor.rage`; `Mechanics.refreshResources`
  extended with a `shortRestRecovery` field. ✅ shipped
- **`1.3.2`** Bard § *Bardic Inspiration* — CHA-mod uses (min 1),
  die size scaling (d6 → d8 → d10 → d12 at L1 / L5 / L10 / L15),
  refresh tag flips from `'long'` to `'short'` at L5 via Font of
  Inspiration, plus `fontOfInspiration(actor, { slotLevel })` to
  refund a use by spending a slot. `freshResources` extended to
  evaluate spec fields as functions of `(level, actor)`. ✅ shipped
- **`1.3.3`** Cleric § *Channel Divinity* — uses 2/3/4 at L2/L6/L18,
  full refresh on Long Rest, 1 use on Short Rest (2024); plus two
  worked effect handlers (Divine Spark heal/damage modes; Turn
  Undead) and the `channelDivinityDC` helper (8 + prof + WIS). ✅ shipped
- **`1.3.4`** Druid § *Wild Shape* (uses per short rest, CR cap by
  level).
- **`1.3.5`** Monk § *Martial Arts* + § *Focus Points* (replaces Ki
  in the 2024 SRD): point pool, spend handlers, short-rest refresh.
- **`1.3.6`** Paladin § *Lay on Hands* (pool = 5 × level), § *Divine
  Smite* (consume a slot, add radiant dice scaled per slot level).
- **`1.3.7`** Ranger § *Hunter's Mark* binding, § *Favored Enemy*
  free-cast accounting.
- **`1.3.8`** Sorcerer § *Sorcery Points* + § *Metamagic* — the
  convert-slot↔point loop.
- **`1.3.9`** Warlock § *Eldritch Invocations* selection and
  validation (pact magic itself already ships).
- **`1.3.10`** Wizard § *Arcane Recovery* — recover spell-slot
  levels equal to ⌈½ wizard level⌉, once per long rest, on a short
  rest.

### `1.4.0` — Damage pipeline

`damageRoll` returns a number; the resistance / immunity /
vulnerability layer between that number and applied HP loss doesn't
exist. Until it does, monster immunities, magic-item resistances,
spell save-for-half outcomes, and class-feature resistances all have
nowhere to plug in.

- **`Combat.applyDamage(actor, { amount, type, critical?, source? })`** —
  canonical entry point. Applies modifiers in SRD order
  (adjustments → Resistance → Vulnerability), zeros on Immunity,
  delegates to `dropToZero` when crossing 0.
- **Damage-type propagation** — `damageRoll` result carries a
  `damageType` field sourced from the weapon / spell record.
- **Temporary HP** — `actor.tempHp`, `Combat.grantTempHp(actor,
  amount)` (non-stacking, replace if larger, lost on Long Rest);
  absorbed before HP on damage.
- **`Combat.heal(actor, amount)`** — generic healing capped at
  hpMax; removes Unconscious when HP rises above 0.

*Why first after `1.3.x`:* almost every other section blocks on
this. Closes [§ 5 Damage pipeline](srd-coverage.md#5-damage-pipeline)
and unblocks rows in §§ 11, 18, 19, 22.

### `1.5.0` — Condition system completion

`CONDITION_EFFECTS` declares flags that the math layer doesn't yet
fully consume; this release wires the remaining branches.

- **Condition immunity** — `actor.conditionImmunities: ConditionName[]`,
  filtered on `Conditions.apply`. Monster stat blocks consume the
  same field.
- **Auto-fail STR/DEX saves** under paralyzed / stunned / petrified /
  unconscious — `Checks.savingThrow` reads the flag and returns
  `{ success: false, autoFailed: true }`.
- **Auto-crit from within 5 ft** on paralyzed / unconscious /
  petrified / stunned — `Combat.attackRoll` checks the target's
  flag plus attacker distance.
- **Concentration auto-drop** on incapacitating conditions —
  Conditions binding fires `endConcentration` when an
  `incapacitates`-flagged condition lands.
- **Per-application metadata** — conditions become `{ name, source?,
  dc?, saveAbility?, endsOn? }`; the existing boolean-string API
  stays as a shorthand.

Closes [§ 4 Conditions](srd-coverage.md#4-conditions) and the
concentration half of
[§ 10](srd-coverage.md#10-spellcasting--slots--concentration).

### `1.6.0` — Turn lifecycle hooks + time tracking

Save-at-end-of-turn effects, spell durations, dawn timers, and the
1.7+ reaction-cast wiring all need a turn clock and scene clock.

- **New hook events:** `onTurnStart`, `onTurnEnd`, `onLongRest`,
  `onShortRest`, `onCast`, `onDamageApplied`, `onHpChanged`.
- **Round-scoped timers** — `actor.timers: [{ spellId, kind,
  remainingRounds }]`, decremented on `onTurnEnd`; expiry events
  fire.
- **Save-at-end-of-turn** — applied condition with `endsOn:
  'turnEnd'` triggers an auto-save before the timer ticks; passing
  removes the condition.
- **Scene clock** — `engine.advanceTime({ minutes, hours })` emits
  `dawn` / `dusk` events at boundary crossings.
- **Spell-duration ticker** — spell records' `duration` field parses
  into rounds / minutes / hours; self-applied buffs auto-register.
- **Stable creatures regain 1 HP after 1d4 hours** — wired via the
  scene clock.

*Why now:* every spell with a duration string is mute until this
ships; the action menu in 1.7 needs `onTurnStart`/`onTurnEnd` for
Dodge / Ready / Help expiry.

Closes [§ 9 Time and duration
tracking](srd-coverage.md#9-time-and-duration-tracking), the
Concentration auto-drop dependency in
[§ 10](srd-coverage.md#10-spellcasting--slots--concentration), and
the "Stable creatures regain 1 HP" row of
[§ 6](srd-coverage.md#6-healing--death).

### `1.7.0` — Combat actions menu

The encounter system spends a generic `'action'` budget today but
knows none of the action semantics. This release adds the SRD action
verbs and re-derives `opportunityAttack`'s `disengaged` flag
properly.

- **Dash, Disengage, Dodge, Help, Hide, Ready, Search, Study,
  Influence** — each as a verb on `engine.Combat`: consumes a
  budget, returns a state delta. Dodge tags
  `dodgeUntilNextTurn` (consumed by attack stance / DEX saves);
  Disengage sets the flag `opportunityAttack` already reads.
- **Grapple, Shove** — fixed-DC `8 + STR + prof` per the 2024
  single-roll change. Grapple applies `grappled` + binds the target;
  Shove offers `prone` or push-5-ft.
- **Two-Weapon Fighting** — `Combat.offHandAttack(state, attacker,
  weapon)`: bonus-action gated, no ability mod on damage; interacts
  with the existing Nick mastery rider.
- **Improvised attacks** — d4 default; proficiency suppressed.
- **Surprise on initiative** — disadvantage on the initiative roll
  per the 2024 change (no more skip-turn).
- **Initiative tiebreak chain** — DEX, then random.
- **Mounted combat** — `actor.mountedOn` linkage; opportunity
  attacks redirect appropriately.
- **Object interaction** — free, one per turn, registered with the
  budget.

Closes [§ 3 Combat actions menu](srd-coverage.md#3-combat-actions-menu)
and the surprise + tiebreak rows of
[§ 2](srd-coverage.md#2-combat-math-attacks-damage-criticals).

### `1.8.0` — Spellcasting completion

Components, ritual, casting time variants, area-of-effect targeting,
save-for-half outcomes, upcast deltas, reaction-cast canonical
wiring. Big release; bundled because the spell record contract
shifts in one coherent step.

- **Components** — `spell.components: { v?, s?, m?: { cost?,
  consumed? } }`; `castSpell` enforces silenced-vs-V, free-hand-vs-S,
  focus / pouch substitution for non-cost M.
- **Ritual casting** — `Spellcasting.castAsRitual(spell, caster)`:
  +10 minutes, no slot, prepared-only.
- **Casting time variants** — `spell.castingTime: 'action' | 'bonus'
  | 'reaction' | { minutes } | { hours }` typed on records.
- **Concentration auto-bind** — `spell.concentration: true` triggers
  `startConcentration` on cast (paired with 1.5's auto-drop).
- **One leveled spell per turn** — `castSpell` enforces SRD § *Spells
  — Casting a Spell* ("only one leveled spell per turn").
- **Area-of-effect targeting** — `Spellcasting.targetsInArea({
  origin, shape, size, facing }, candidates)`. Shapes: cone, line,
  sphere, cube, cylinder, emanation.
- **`Spellcasting.castSpellSave(spell, targets, dc, { halfOnSuccess
  })`** — per-target save outcomes packaged uniformly.
- **Higher-level slot deltas** — `spell.upcast(level)` returns the
  per-slot-level delta the engine merges with the base effect.
- **Reaction-cast canonical wiring** — Shield is shipped; this
  release adds Counterspell (the `onCast` interception path),
  Absorb Elements, Hellish Rebuke, and Silvery Barbs as worked
  examples.

Closes
[§ 11 Spellcasting — components & casting modes](srd-coverage.md#11-spellcasting--components--casting-modes),
[§ 12 Spellcasting — targeting & effects](srd-coverage.md#12-spellcasting--targeting--effects),
and the unfinished rows of
[§ 10](srd-coverage.md#10-spellcasting--slots--concentration).

### `1.9.0` — Magic items system

Items are pure data today. This release gives them a lifecycle.

- **Rarity bands** — `item.rarity: 'common' | 'uncommon' | 'rare' |
  'veryRare' | 'legendary' | 'artifact'`.
- **Attunement** — `item.requiresAttunement?: { classId?,
  spellcaster?, abilityMin? }`; `actor.attunedItems: string[]` capped
  at 3; attunement requires a Short Rest.
- **Charges + dawn recharge** — `item.charges?: { max, recovers,
  rechargesOn }`; per-actor charge state; the dawn event from 1.6
  drives the recovery handler.
- **Cursed items** — `item.cursed?: true | { effect }`; cannot
  voluntarily un-attune; Remove Curse clears.
- **Identify / known properties** — `actor.identifiedItems`; default
  perception lists name + AC bonus only; full properties after
  Identify or attunement.
- **Magic item resilience** — `item.savingThrow?: { type, dc }` for
  forced destruction attempts.
- **Sentient items** — `{ intelligence, wisdom, charisma, alignment,
  communication, will }`; conflict-resolution save against the
  attuned creature.

Closes [§ 18 Magic items](srd-coverage.md#18-magic-items).

### `1.10.0` — Monster stat block depth

Monster records get the structural fields needed to run them as
opponents rather than reference data.

- **Multiattack** — `monster.multiattack: { attacks: AttackRef[] }`
  resolves in order on a single Attack action.
- **Legendary Actions** — `{ uses, refreshOn: 'turnStart', options:
  [...] }`; 2024 each costs 1 use. Engine offers them at the right
  moments.
- **Lair Actions** — `{ triggersOnInitiative: 20, options: [...] }`;
  fires automatically at initiative count 20 when `inLair`.
- **Mythic Actions** — analogous schema.
- **Innate Spellcasting** — `{ atWill, 3day, 1day }`; per-day
  counter resets on long rest.
- **Senses** — `{ darkvision?, blindsight?, tremorsense?,
  truesight?, passivePerception }` (ft for ranged senses).
- **Resistance / Vulnerability / Immunity / Condition Immunity**
  arrays per monster — consumed by 1.4's damage pipeline.
- **Saving-throw proficiencies** — `monster.saves: { dex: +6, ... }`.
- **Languages** — `monster.languages: string[]`.
- **Legendary Resistance** — N uses/day, "convert a failed save to
  a success" helper.

Closes the mechanics half of
[§ 19 Monsters](srd-coverage.md#19-monsters); data expansion is
parallel work tracked under `1.x.y`.

### `1.11.0` — Movement modes + vision

The single `speed` number expands to per-mode + environment-aware,
and the vision layer comes online.

- **Per-mode speeds** — species / monster records carry `speeds: {
  walk, fly?, swim?, climb?, burrow? }`. Sheet derivation surfaces
  the full map.
- **Difficult terrain** — `Combat.spend(state, id, 'movement', feet,
  { difficult: true })` doubles cost.
- **Falling damage** — `Combat.fall(actor, distanceFt)` →
  `1d6 per 10 ft` (max 20d6), applies `prone`.
- **Jumping** — `Combat.longJump(actor)`, `Combat.highJump(actor)`
  returning feet.
- **Crawling** — double-cost movement while prone.
- **Light levels** — `LIGHT_LEVELS = ['bright', 'dim', 'darkness']`;
  combat math reads the active level for sight-dependent rules.
- **Special senses** — darkvision range converts dim → bright /
  darkness → dim; blindsight, tremorsense, truesight as flags.
- **Obscured** — heavily obscured = effectively blinded; lightly
  obscured = Perception disadvantage.
- **Line of sight / line of effect** —
  `Combat.hasLineOfSight(observer, target, obstacles)`, separate
  from cover.

Closes the movement + vision halves of
[§ 8 Movement, vision, exploration](srd-coverage.md#8-movement-vision-exploration);
travel pace is 1.18.

### `1.12.0` — Character creation pipeline

`deriveSheet` works on a hand-built record; this release supplies
the path to *build* the record.

- **Multiclass record shape** — `record.classes: { fighter: 3,
  rogue: 2 }`. Single-class shorthand still works as a single-key map.
- **Multiclass prerequisites** —
  `Character.canMulticlassInto(record, classId, registries)` enforces
  SRD § *Multiclassing — Prerequisites*.
- **Multiclass spell-slot table** — derived from per-class caster
  levels (full = 1, half = ½, third = ⅓).
- **Languages** — `record.languages`; background contributions
  merged.
- **Tool proficiencies** — `record.tools`; `Checks.toolCheck` +
  proficiency-with-tool advantage helper.
- **Origin feat auto-application** — backgrounds carry `originFeat`;
  derivation merges the feat's mechanical effects (proficiencies,
  ability bumps, mechanic registrations).
- **Starting equipment** —
  `Character.applyStartingPackage(record, classId, backgroundId,
  choices)`.

Closes [§ 15 Character creation
pipeline](srd-coverage.md#15-character-creation-pipeline).

### `1.13.0` — Species traits as mechanics

Species records carry `traits: string[]` today; this release turns
them into actionable mechanics.

- **Darkvision range** derivation onto the sheet's senses block.
- **Stonecunning, Lucky, Fey Ancestry, Trance, Brave** as effect
  flags read by 1.6 hooks.
- **Half movement modes** — Aarakocra fly, Triton swim, etc., surfaced
  through the `speeds` map.
- **Resistances** — Tiefling fire, Dragonborn elemental — feed the
  1.4 damage pipeline.
- **Cantrip-from-species** — High Elf cantrip slot becomes a real
  spell entry on the sheet.

Closes the trait-mechanics half of
[§ 16 Species, backgrounds, feats](srd-coverage.md#16-species-backgrounds-feats);
content expansion is parallel `1.x.y` work.

### `1.14.0` — Saves & edge mechanics

Reroll-on-save patterns and group/help skill semantics.

- **Heroic Inspiration** — `actor.inspiration: boolean`;
  `Inspiration.grant(actor)`, `Inspiration.spend(actor)`.
- **Halfling Lucky** — auto-reroll-on-1 hook on D20 Tests.
- **Indomitable** — Fighter L9 reroll-once-per-long-rest.
- **Diamond Soul / Stillness of Mind / Magic Resistance** —
  patterned reroll handlers using the same hook surface.
- **Group checks** — `Checks.groupCheck(checks)` succeeds if half
  or more pass.
- **Working together** — Help variant: advantage on a skill check
  if a single ally is proficient.

Closes [§ 21 Saves & edge
mechanics](srd-coverage.md#21-saves--edge-mechanics).

### `1.15.0` — Hazards & environment

Disease, poison, environmental damage.

- **Disease registry** — onset save + per-stage save DC progression.
- **Poison registry** — contact / ingested / inhaled / injury
  vectors; matching DC + duration.
- **Suffocation** — CON-mod-rounds breath-hold; HP=0 + can't recover
  until breathing.
- **Starvation / Thirst** — exhaustion accrual past the daily cap.
- **Extreme heat / cold** — saves + exhaustion.
- **Underwater combat** — disadvantage / immunity table.

Closes [§ 22 Diseases, poisons, environmental
hazards](srd-coverage.md#22-diseases-poisons-environmental-hazards).

### `1.16.0` — Encounter design tools

XP and treasure scaffolding for DMs.

- **`Encounter.xpForCR(cr)`** — full SRD § *Monsters — CR* table.
- **`Encounter.budget(partyLevels, difficulty)`** — low / moderate /
  high XP bands per the 2024 simplified table.
- **`Encounter.classify(monsters, partyLevels)`** — inverse: given
  a monster mix, returns the difficulty band.
- **Treasure tables** by hoard CR band — pure data.
- **Random encounter scaffolding** — weighted pick over a
  tier-bucket list.

Closes [§ 20 Encounter design](srd-coverage.md#20-encounter-design).

### `1.17.0` — Equipment depth

Armor mechanics, tools, and the long tail of mundane gear.

- **Encumbrance variant** — `Character.encumbranceLevel(actor)`
  returns `'none' | 'encumbered' | 'heavily-encumbered'`.
- **Armor donning / doffing time** — fields + helper.
- **Stealth disadvantage on heavy armor** — applied to the derived
  Stealth skill.
- **STR-requirement speed penalty** — heavy armor below the STR
  requirement reduces speed by 10 ft.
- **Tools as proficiency** — `record.tools`; `Checks.toolCheck`.
- **Adventuring gear / services / lifestyle / trade goods** as
  registry entries — pure data.

Closes [§ 17 Equipment & inventory](srd-coverage.md#17-equipment--inventory).

### `1.18.0` — Travel & exploration

Out-of-combat time finally has rules attached.

- **Travel pace** — slow / normal / fast tables (per-hour mileage,
  perception modifiers).
- **Forced march** — exhaustion saves per hour past 8.
- **Resting in dangerous terrain** — interruption probability
  handler.
- **Foraging / Navigation** — DC tables.

Closes the exploration half of
[§ 8 Movement, vision, exploration](srd-coverage.md#8-movement-vision-exploration).

### `1.19.0` — Tier 3 class features (L11–L16)

Each base class's tier-3 mechanics implemented behind the existing
`mechanics` contract.

- Per class: the signature L11 feature (e.g. Barbarian Relentless
  Rage, Fighter Indomitable, Sorcerer Sorcerous Restoration, Wizard
  Empowered Evocation).
- Ability Score Improvements at L12.
- Per-subclass L11 / L14 features.

Closes the L11–L16 row of [§ 14 Classes — subclasses and tier 3/4](srd-coverage.md#14-classes--subclasses-and-tier-34).

### `1.20.0` — Tier 4 class features (L17–L20) + Epic Boons

The capstone tier.

- Per class: L17 / L18 / L20 signature features (e.g. Barbarian
  Primal Champion, Sorcerer Spell Bombardment).
- L19 Epic Boon slot — feat-like records.
- Cantrip-scaling L17 breakpoint wired into derived sheets for
  casters.

Closes the L17–L20 row of [§ 14](srd-coverage.md#14-classes--subclasses-and-tier-34)
and the Epic Boons row of [§ 16](srd-coverage.md#16-species-backgrounds-feats).

### `1.21.0` — Subclass handler maps

Each of the 12 base subclasses ships its own `mechanics` map and
resource specs.

- Berserker (Barb), College of Lore (Bard), Life Domain (Cleric).
- Circle of the Land (Druid), Champion (Fighter), Way of the Open
  Hand (Monk).
- Oath of Devotion (Paladin), Hunter (Ranger), Thief (Rogue).
- Draconic Sorcery (Sorcerer), Fiend Patron (Warlock), Evoker
  (Wizard).

Closes the subclass-handlers row of
[§ 14](srd-coverage.md#14-classes--subclasses-and-tier-34).

### `1.22.0` — Plugin surface expansion

The Phase A/B/C plugin contract grows to match the engine surface
accrued through 1.21.

- **`extraResources`** plugin contribution — custom resource shapes
  for homebrew classes.
- **`extraMechanics`** — class mechanics contributable without
  forking a class def.
- **`extraSenses`** / **`extraLightLevels`** — for homebrew vision
  systems.
- **Standardised Phase D hook events** — the new events from 1.6
  (`onTurnStart`, `onTurnEnd`, `onLongRest`, `onShortRest`,
  `onCast`, `onDamageApplied`, `onHpChanged`) become first-class
  in the plugin contract docs.

Closes [§ 24 Plugin system](srd-coverage.md#24-plugin-system).

### `1.23.0` — Audit / replay surface completion

The roll log captures every random event; cross-pack divergence
becomes visible at the boundary instead of silently.

- **`mechanicApplied` op** — log resource transitions + result
  kind, not just the dice inside.
- **Hook fire log** — optional `hookFired` entries for
  plugin-stack debugging.
- **Rule-knob fingerprint** in the log header — resolved rules
  hash. Mismatched-pack replays diverge at the boundary entry,
  not at the first crit / damage-floor-affected roll.
- **`deathSave` previous-state snapshot** — `previousSuccesses` /
  `previousFailures` for full reconstructability without external
  state.

Closes [§ 23 Audit / replay surface](srd-coverage.md#23-audit--replay-surface).

### `1.24.0` — Documentation & host-contract sweep

Bring the docs back in sync with the engine surface after a year
of releases.

- **`character-sheet.md`** schema additions for everything added
  since 1.0 (hp / hpMax / hitDie / hitDiceTotal / hitDiceUsed /
  deathSaves / resources / concentration / spellSlots / per-class
  flags).
- **`recipes.md`** worked examples for each major release — Death
  Saves flow, Rest flow, Mechanics dispatch, plugin-contribute a
  class, action menu, magic-item attunement.
- **`spec.md`** plugin contract — new rule knobs, resource-spec
  shape, mechanic handler signature, Phase D hooks.
- **Kernel-boundary checklist** doc — what the engine claims to
  enforce vs. what's host-owned, at a glance.
- **TypeDoc-style reference site** — generated from `index.d.ts`
  doc comments (deferred from 1.0.0).

Closes [§ 25 Documentation & host
contracts](srd-coverage.md#25-documentation--host-contracts).

### `1.x.y` — Content registry expansion (parallel)

Pure-data work, no engine surface change. Drops in as patch
releases between minor versions whenever a contributor has time. The
engine doesn't require any of these to be complete to ship a feature
release; they're additive throughout the 1.x line.

- **Spells** — `33 → ~370` (SRD 5.2 § Spells A–Z).
- **Monsters** — `9 → hundreds` (SRD 5.2 § Monsters A–Z).
- **Items + magic items** — `44 → full SRD list` (Equipment + Magic
  Items chapters).
- **Backgrounds** — current registry → all 16 SRD backgrounds.
- **Feats** — `3 → full SRD list` (origin, general, fighting style,
  epic boon).

Closes the registry-depth rows of
[§ 16](srd-coverage.md#16-species-backgrounds-feats),
[§ 17](srd-coverage.md#17-equipment--inventory),
[§ 18](srd-coverage.md#18-magic-items), and
[§ 19](srd-coverage.md#19-monsters).

### `2.0.0` — SRD-complete kernel (held in reserve)

Reserved for the breaking-change cleanup that may or may not be
necessary once `1.4 → 1.24` SRD coverage closes:

- Any consolidation that requires breaking the frozen 1.0 contract
  (e.g. CharacterRecord shape collapse after multiclassing lands;
  `Actor` field reorganisation if `resources` / `timers` /
  `deathSaves` / `concentration` warrant a sub-namespace).
- Default-engine memory footprint review — anything that should
  become lazy-loaded.
- Doc-site v1 cut with migration notes from 1.x.

If 1.4 → 1.24 lands non-breakingly, the SRD-complete badge is what
ships *with* 1.24.0 and 2.0.0 is unnecessary.

## Post-SRD ideas (no commitment)

Out-of-scope-for-SRD-compliance work that may or may not be worth
doing afterwards. Items that *were* on this list and have since
moved into the SRD-completeness plan have been removed.

- **Optional rules variants beyond rule knobs** — flanking, called
  shots, lingering injuries, herbalism-as-mechanic — each as a
  shippable plugin.
- **Localizable strings** — class names, condition labels, etc.,
  for hosts that target non-English campaigns.
- **Code splitting** — separate entry points for `bag-of-holding/srd`
  (data only) and `bag-of-holding/engine` (math only), so a tiny
  app that only needs dice + checks can ship < 5 kB.
- **Community content channel** — a vetted contribution path for
  community-authored class/subclass plugins, validated against the
  plugin surface.

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
