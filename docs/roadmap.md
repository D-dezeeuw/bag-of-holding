# Roadmap

A living plan for `bag-of-holding`. Versions are tentative; they
describe *order and grouping*, not commitments to a calendar. Each
milestone names what lands and **why now**; deliverables that need a
real consumer driving them are deferred until that consumer exists.

> Status as of 2026-08-17: **`3.10.0`**. Every numbered roadmap row
> through `5.3.0` is shipped and the grind that closed them ran
> 2.6.0 → 3.9.0: *The Quiet Stair* starter adventure (2.6.0),
> Bestiary I/II/III (2.7.0–2.9.0, 90 invented blocks + legendary,
> lair and mythic machinery), Grimoire I/II (2.10.0–2.11.0, 80
> spells), the Treasury (2.12.0), the Origin pack (2.13.0), the
> three variant-rule namespaces (2.14.0–2.16.0), hazards back-fill
> (2.17.0), the Sundermark / Brassgear / Hollow Vale setting packs
> plus the plugin contract (3.0.0–3.3.0), localization (3.4.0),
> reference cards (3.5.0), the plugin manifest (3.6.0), conversion
> tools (3.7.0), the content index (3.8.0) and the generated
> documentation site (3.9.0). 3.9.1–3.9.3 were docs/sandbox patches;
> 3.10.0 added the second SRD gap-block sweep (registry at 79
> blocks). **1,735 tests**, `node --test`, strict typecheck, bundle
> budgets in CI. Earlier:
>
> Status as of 2026-08-15: `2.6.0`. *The Quiet Stair* shipped:
> the starter adventure lives inside the package (adventure format +
> validateAdventure, 6 beats with a real branch, 7 scenes, 4
> budget-validated encounters), with its 15-creature invented
> bestiary (the first authored 1.10 deep fields), 8-item batch (the
> first cursed item), 3 named NPCs, the `Combat.influence` named
> verb, 8 SRD registry gap blocks, the kernel's first legal sweep,
> and the sandbox’s adventure panel. **1,643 tests.** Earlier:
>
> Status as of 2026-08-11: `2.5.1`. Kernel surface (dice, slots,
> conditions, XP, character derivation, beats, plugins) feature
> complete since 1.0; the 1.x line closed SRD 5.2 coverage; 2.0
> added `Solo` / `Session` / `Replay` + the sandbox; 2.2.0 added the
> monster tier templates (CR 16–24 derived from verified blocks);
> 2.3.0 was a correctness pass (replay totality, half-caster L1
> slots, castSpell slot semantics); 2.4.0 shipped the SRD class
> spell lists; 2.5.0 closes the remaining replay desync paths
> (surprised initiative, auto-failed saves, four unlogged draw
> sites), restores the v1.6.1 condition-record API that a merge had
> dropped (it survived only in the typings), makes `castSpell`
> actually consult the 2.4.0 spell lists, fixes the tier templates'
> legendary-action shape so a derived boss can USE its actions, and
> moves Fighter resources and prepared-spell counts onto the real
> SRD 5.2 tables. **1,613 tests**, `node --test`, strict typecheck.
> `2.5.1` re-pins the bundle budget and moves that gate into CI.
>
> npm registry lags the repo: latest published is `2.1.0` (2026-06-01)
> — publishing every version since is a pending owner action. Two
> things blocked it originally and are long fixed: a publish attempt
> from a stale checkout re-packed the already-published `2.1.0` byte
> for byte, and `prepublishOnly`'s bundle gate had been failing since
> `2.4.0` overran the 1.27.0 budget. Publish from a tree that matches
> `origin/main`.
>
> **SRD 5.2 coverage is complete** for the kernel's scope: death
> saves, rest mechanics, hit-dice spending and class-feature
> mechanics all shipped across 1.0.1–1.27.0; the remaining
> unchecked rows in [srd-coverage](srd-coverage.md) are deliberate
> "when a consumer asks" deferrals (per-application condition
> metadata, save-at-end-of-turn timers, spell-duration binding,
> attunement short-rest gate, casting-time scheduling, host-side
> starting equipment), not gaps.

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

## Where we started (historical `0.x` snapshot — see the status line above for today)

| Area | State |
| --- | --- |
| SRD 5.2 surface, levels 1-5 | 4 classes, 9 species, 4 backgrounds, 3 origin feats, weapon mastery, numeric exhaustion, 14 boolean conditions |
| Core math | `Dice` (incl. `seededRng`, `rollExplosive`), `Checks`, `Combat.{attackRoll, damageRoll, rollInitiative, applyMastery}`, `XP`, `Movesets` (placeholder) |
| Beat runtime | Linear walking (v1); branching schema accepted but ignored |
| Plugins | **Phase A** (content) + **Phase B** (rule knobs: critOn/fumbleOn, damageFloor, explodingDamageDice, xpThresholds, proficiencyByLevel) + **Phase C** (hooks: beforeAttack/afterDamage/onLevelUp/onConditionApplied/onDeath) shipped via `createEngine(opts)` |
| Character sheets | `Character.deriveSheet(record, engine)`; host owns the persistent record, engine derives the sheet |
| Determinism | Seedable RNG, append-only `engine.rollLog`, context tags, `verifyLog` replay verifier (all 0.1.0+) |
| Types | Hand-maintained `index.d.ts`, strict-mode typecheck gate |
| Tests | `node --test`, 230 tests, 100 / 100 / 100 line / branch / function |
| Published | GitHub-tagged through `v0.2.0`; npm publish pending |

## Near-term: stabilise and round out the kernel

### `0.1.0`: Determinism with audit, test, and trace-back ✅ shipped

The blocking gap before any consumer can rely on replay. Going
beyond "seedable", this release makes the engine's stochastic
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

  Plain JSON; serialise it, attach it to a bug report, ship it to
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
  implementation the tests fail loud, preventing silent
  determinism regressions across versions. Coverage stays at
  100 / 100 / 100.
- **First milestone npm publish.** Tag `v0.1.0`, publish to npm.
  The `0.0.1` placeholder publish (already shipped or in flight) is
  superseded; consumers pin `^0.1.0` from here on.

*Why first:* Dungeons-and-Dans depends on Spektrum's history primitive
for undo and chapter rewinds; the rules engine must be replay-
compatible before the app can wire it in. The audit / test / trace-
back surface also unlocks reliable AI-loop testing; *"the AI claims
it rolled X, did it?"* becomes a verifiable question, not a vibes-
based dispute.

### `0.1.5`: Character sheet derivation ✅ shipped

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
  registries)`.** Same function, two call sites: engine-bound for
  the common case, module-level for unit tests and multi-engine
  hosts.
- **Pinned fixtures.** Golden expected sheets for L1 Rogue,
  L3 Fighter, L5 Wizard cover the worked example in the doc and
  pin every line of math.
- **Validation with pointer-quality errors.** `CharacterRecord.classId
  'paladin' not registered with engine`, same style as the plugin
  validator.

*Why now:* the app's UI panel needs *some* function to call when a
record changes, and "render the sheet" is the most common
recompute trigger in a session (equip, condition, level-up). Without
this, every consumer would re-implement the math and drift from
the rules. Lands before 0.2's rule knobs (`damageFloor`,
`proficiencyByLevel`) so the rule knobs flow through derivation
cleanly.

### `0.2.0`: Rule modifications (plugin Phase B) ✅ shipped

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

*Why now:* Real homebrew demands more than data. House rules,
weapon-specific crit ranges, exploding dice, "saves crit on 20" all
hit the math. Without Phase B, themed packs are limited to
re-skinning content.

### `0.3.0`: Behavioural hooks (plugin Phase C) ✅ shipped

Closes the plugin trifecta: content (A), rules (B), behaviour (C).

- **Hook surface, deliberately small.** `beforeAttack`,
  `afterDamage`, `onLevelUp`, `onConditionApplied`, `onDeath`. Each
  hook has a documented contract: fire order, can-mutate-input,
  can-short-circuit, throw semantics.
- **Hook registration via the engine factory.** No global event bus;
  hooks live on the engine instance and don't leak across instances.
- **Tests for hook ordering and isolation** between engines.

## Mid-term: combat and spellcasting depth

### `0.4.0`: Combat completeness ✅ shipped

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

### `0.5.0`: Spellcasting mechanics ✅ shipped

Spell *records* ship at `0.0`; spell *mechanics* land here.

- **Spell slot tables** for full-caster (Wizard et al., L1-20),
  half-caster (Paladin/Ranger, L2-20), and Warlock Pact slots.
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

### `0.6.0`: Class breadth ✅ shipped

All 12 SRD 5.2 base classes at levels 1-5 with one subclass each.

- **Added**: Barbarian (Berserker), Bard (College of Lore), Druid
  (Circle of the Land), Monk (Open Hand), Paladin (Oath of
  Devotion), Ranger (Hunter), Sorcerer (Draconic Sorcery), Warlock
  (The Fiend).
- **Movesets** dispatch over per-class chip providers with `minLevel`
  gates and an optional `combatOnly` predicate. Each class declares
  its signature chips (Rage, Bardic Inspiration, Cunning Action,
  Wild Shape, Eldritch Blast, etc.).

### `0.7.0`: Condition effects ✅ shipped

Mechanical effects baked into the math; condition-aware movesets.

- **CONDITION_EFFECTS table**: each SRD condition declares its flags
  (`ownAttackDisadvantage`, `targetAdvantage`, `speedZero`,
  `autoFailStrDexSaves`, `critIfAttackerWithin5`, `cantSee`,
  `cantHear`, `incapacitates`, `proneOnTarget`, …).
- **`Conditions.effectsFor(actor)`** unions flags across all active
  conditions (boolean OR).
- **`Conditions.attackStance({ attacker, target, attackerDistanceFt })`**
  computes the advantage/disadvantage stance (adv+dis cancel).
- **`Combat.attackRoll`** now accepts optional `attacker`, `target`,
  `attackerDistanceFt` and rolls advantage/disadvantage accordingly;
  the result surfaces `stance` for UI labelling.
- **Condition-aware movesets**: incapacitating conditions collapse
  the chip set to a `wait` affordance; prone replaces it with
  `stand-up`.

### `0.8.0`: Beat runtime v2 ✅ shipped

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

### `0.9.0`: Levels 6+ ✅ shipped

Tier 2 (and the full L1-20 numerical curve) shipped.

- **XP table** through L20: 14 000 (L6) … 355 000 (L20).
- **Proficiency bonus** table through L20: +2 → +6.
- **Spell slot tables** were already L1-20 (full caster, half
  caster, Warlock); 0.9.0 wires the host-visible class progression
  past L5.
- **Class features at L6-10** for all 12 base classes (Ability
  Score Improvements, subclass-feature checkpoints, signature
  features per SRD). Subclass body content for tiers 3-4 is
  deferred to 1.0.
- **Cantrip scaling** at the L5 and (still-out-of-scope) L11/17
  breakpoints already implemented in 0.5.0.

### `1.0.0`: Feature complete ✅ shipped

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
  the documented budget (120 kB min / 30 kB gz; see
  `scripts/measure-bundle.js` for the rationale).
- **Replay covers the encounter system.** Initiative rolls flow
  into `engine.rollLog`; `verifyLog` reconstructs them.
- **Documentation site** (TypeDoc-style generated reference) is
  deferred to post-1.0. `index.d.ts` doc-comments cover the same
  ground for now.
- **Real production consumer.** The integration test is the
  highest-fidelity stand-in until a downstream host adopts the
  package.

## SRD 5.2 completeness

Gaps and bugs identified by reading the engine against the published
[SRD 5.2 (2025)](https://www.dndbeyond.com/srd) text. Unlike the
parking lot at the bottom of this file these are tracked
commitments; the kernel is not honestly "SRD 5.2 compliant" until
they all land.

The full line-by-line worklist lives in
[docs/srd-coverage.md](srd-coverage.md); each milestone below
references the checklist section(s) it closes. The version numbering
runs `1.0.1 → 1.24.0`, with data-only registry growth folded in as
parallel patch releases (`1.x.y`). `2.0.0` is reserved for any
breaking-change cleanup once SRD coverage is closed; it may not be
needed at all.

### `1.0.1`: SRD math fixes (patch) ✅ shipped

Three handlers return values that diverge from the published rule
text. Patch-level because public signatures are unchanged; only the
numbers move (and the fixtures pinning the buggy values).

- **Topple save DC double-counts proficiency** (`src/combat.js:164-167`).
  SRD 5.2 § *Weapon Mastery Properties, Topple*: the Constitution
  save DC is **8 + the attacker's ability modifier + their
  proficiency bonus**. The handler computes
  `8 + result.attackBonus + attacker.proficiencyBonus`, but
  `attackBonus` already includes proficiency, so it's added twice. A
  L5 Fighter (+4 STR, +3 prof) currently produces DC 18; the SRD
  value is 15. Fix: split the inputs at the handler boundary, passing
  the raw ability modifier alongside the composite `attackBonus`, or
  recover it as `attackBonus − proficiencyBonus` when only the
  composite is available. Pin a fixture covering the L5 Fighter
  case.
- **Graze damage uses full attack bonus instead of ability modifier**
  (`src/combat.js:133`). SRD 5.2 § *Weapon Mastery Properties,
  Graze*: "the target takes damage equal to **the ability modifier
  you used to make the attack roll**." The handler returns
  `result.attackBonus`, inflating graze by the proficiency bonus.
  Same boundary change as Topple; the handler needs the ability
  modifier separately. A L5 STR-16 Fighter should graze for 3, not 6.
- **DC clamp ceiling: 25 → 30 (or document the deviation)**
  (`src/checks.js:8`). SRD 5.2 § *Ability Checks, Typical
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

### `1.1.0`: Death saving throws ✅ shipped

The 0-HP-to-dead pipeline is entirely absent. SRD 5.2 § *Death
Saving Throws* and § *Damage at 0 Hit Points* still apply: at 0 HP a
creature falls Unconscious and rolls a DC 10 d20 on each of its
turns; three successes stabilise, three failures kill; a natural 1
counts as two failures, a natural 20 restores 1 HP and consciousness;
damage taken while at 0 HP counts as a failed save (two if a crit),
and damage ≥ HP max while at 0 is instant death.

- **`Combat.deathSave(actor, rng?, rules?)`.** Pure function,
  returns `{ d20, outcome: 'success' | 'failure' | 'stable' | 'dead'
  | 'revived', actor: nextActor }`. Tracks state on
  `actor.deathSaves: { successes, failures, stable, dead }`,
  immutably.
- **`Combat.applyDamageWhileDown(actor, damageTaken, { critical })`.**
  Encodes the failed-save-on-damage rule from § *Damage at 0 Hit
  Points*, including the massive-damage instant-death threshold.
- **`Combat.dropToZero(actor)`.** Applies the Unconscious condition,
  zeroes HP, initialises the death-save tracker. Fires the existing
  `onConditionApplied` hook.
- **`Combat.stabilize(actor)`** and **`Combat.reviveTo(actor, hp)`.**
  For healing-word, spare-the-dying, and Medicine-check
  stabilise paths. `reviveTo` clears the tracker and removes
  Unconscious.
- **Rules knobs:** `deathSaveDC: number` (default 10) and
  `deathSaveSuccessesRequired: number` (default 3) for gritty /
  heroic packs.

*Why now:* Hosts cannot run a real session without this; the HP
loop bottoms out at "actor.hp === 0" with no engine handling. The
`onDeath` hook surface exists but only fires from exhaustion; this
wires the second pathway.

### `1.2.0`: Rest mechanics (HP recovery + hit-dice spending) ✅ shipped

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

*Why now:* Spells refill on rest, HP doesn't; asymmetric and
visibly broken in any extended session. 1.1's "back to 1 HP" pathway
needs a "back to max HP" counterpart to close the loop.

### `1.3.0`: Class feature mechanics (foundation + Fighter/Rogue) ✅ shipped

Class definitions currently expose features as strings
(`features: { 1: ['Second Wind', 'Action Surge', ...] }`). The
engine *names* features but doesn't enforce them. SRD 5.2 § *Classes*
specifies the mechanics for each; implementing them is the long tail.

**Shipped in 1.3.0:** the foundation (resource shape, mechanics
dispatch, rest integration), plus reference implementations for
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

### `1.3.x`: Per-class feature rollout ✅ shipped (all 10 sub-releases)

Each sub-release adds one class's resource-bearing mechanics on top
of the 1.3.0 foundation, with full test coverage and a smoke entry
in the typecheck file:

- **`1.3.1`** Barbarian § *Rage*: uses per long rest (with 1
  recovered on a short rest, per 2024 SRD), Rage Damage bonus
  scaling (+2/+3/+4), BPS resistance flags, 10-minute / 100-round
  duration cap. State on `actor.rage`; `Mechanics.refreshResources`
  extended with a `shortRestRecovery` field. ✅ shipped
- **`1.3.2`** Bard § *Bardic Inspiration*: CHA-mod uses (min 1),
  die size scaling (d6 → d8 → d10 → d12 at L1 / L5 / L10 / L15),
  refresh tag flips from `'long'` to `'short'` at L5 via Font of
  Inspiration, plus `fontOfInspiration(actor, { slotLevel })` to
  refund a use by spending a slot. `freshResources` extended to
  evaluate spec fields as functions of `(level, actor)`. ✅ shipped
- **`1.3.3`** Cleric § *Channel Divinity*: uses 2/3/4 at L2/L6/L18,
  full refresh on Long Rest, 1 use on Short Rest (2024); plus two
  worked effect handlers (Divine Spark heal/damage modes; Turn
  Undead) and the `channelDivinityDC` helper (8 + prof + WIS). ✅ shipped
- **`1.3.4`** Druid § *Wild Shape*: 2 uses with partial short-rest
  recovery; CR cap (1/4 / 1/2 / 1 at L2/L4/L8) and movement-mode
  unlocks (swim L4, fly L8) enforced; `actor.wildShape` form record
  + revert mechanic + caps lookup. ✅ shipped
- **`1.3.5`** Monk § *Focus Points* (replaces Ki in 2024): pool =
  level from L2, short-rest full refresh; Martial Arts die scaling
  (d6/d8/d10/d12 at L1/L5/L11/L17); Flurry of Blows (1 FP → 2 strikes,
  3 at L10 via Heightened Focus); Patient Defense (free Disengage,
  or 1 FP for Disengage + Dodge + 2 MA-die tempHp); Step of the Wind
  (free Dash, or 1 FP for Disengage + Dash + doubled jump + ally
  carry). ✅ shipped
- **`1.3.6`** Paladin § *Lay on Hands* (HP pool sized to 5 × level,
  bonus-action heal-from-pool, long-rest refresh) and § *Divine
  Smite* (now a 2024 spell: 2d8 radiant at slot 1, +1d8 per slot
  above 1, +1d8 vs Fiend/Undead; one free cast per Long Rest). ✅ shipped
- **`1.3.7`** Ranger § *Favored Enemy* + § *Hunter's Mark*: free
  Hunter's Mark casts per Long Rest scaling with PB (2/3/4/5/6),
  `actor.huntersMark = { targetId, castLevel }` binding, slot-spend
  fallback when free casts exhausted, 1d6 force damage rider vs the
  marked target. ✅ shipped
- **`1.3.8`** Sorcerer § *Font of Magic* + § *Metamagic*: Sorcery
  Points pool (= level from L2, long refresh); `convertSlotToPoints`
  and `createSpellSlot` (with `SLOT_CREATION_COSTS` table; created
  slots tagged `temporary` for 1.6.0 long-rest stripping);
  `applyMetamagic` with a 10-option `METAMAGIC_OPTIONS` registry
  (each declaring cost + effect schema). ✅ shipped
- **`1.3.9`** Warlock § *Eldritch Invocations*: registry of 10
  canonical SRD invocations with prerequisite metadata (warlock
  level, required cantrip, repeatable flag), per-level count table,
  `validateInvocations` checker + `setInvocations` mechanic +
  `agonizingBlastBonus` lookup. ✅ shipped
- **`1.3.10`** Wizard § *Arcane Recovery*: recover spell-slot
  levels equal to ⌈½ wizard level⌉, slot-level cap 5, once per Long
  Rest, executed on a Short Rest; non-mutating per-slot validation
  + atomic apply. ✅ shipped

### `1.4.0`: Damage pipeline ✅ shipped

`damageRoll` returned a number; the resistance / immunity /
vulnerability layer between that number and applied HP loss didn't
exist. This release ships the full SRD pipeline.

- **`Combat.applyDamage(actor, { amount, type, critical?, source? })`.**
  Canonical entry point. Applies modifiers in SRD order
  (Immunity → Resistance → Vulnerability), absorbs through Temp HP,
  subtracts HP, routes through `dropToZero` on cross, fires
  `applyDamageWhileDown` for hits at 0 HP, and triggers
  massive-damage instant death when the SRD condition is met.
  Returns a tagged outcome (`damaged` / `downed` / `dead` /
  `absorbed` / `immune`).
- **`Combat.applyDamageModifiers`.** Pure helper exposing just the
  modifier layer; useful for previewing damage in UI without
  applying it.
- **Damage-type propagation.** `damageRoll` accepts an optional
  `damageType` and surfaces it on the result; consumed by the
  modifier layer.
- **Temporary HP.** `actor.tempHp`, `Combat.grantTempHp(actor,
  amount)` (non-stacking, replace if larger); absorbed before HP on
  damage; Long Rest clearing of tempHp is queued for the 1.6
  turn-lifecycle release.
- **`Combat.heal(actor, amount)`.** Caps at hpMax; removes
  Unconscious + clears the death-save tracker when HP rises above 0.
- **Hook wiring.** `engine.Combat.applyDamage` fires
  `onConditionApplied` on downed outcomes (Unconscious application)
  and `onDeath` on instant-death / damage-while-down kills, with
  duplicate-firing suppression for already-unconscious / already-
  dead actors.

Closes [§ 5 Damage pipeline](srd-coverage.md#5-damage-pipeline) and
unblocks rows in §§ 11, 18, 19, 22.

### `1.5.0`: Condition system completion ✅ shipped

`CONDITION_EFFECTS` declared flags that the math layer didn't yet
fully consume; this release wires the remaining branches.

- **Condition immunity.** `actor.conditionImmunities: ConditionName[]`,
  filtered inside `Conditions.apply` (no-op on immune). Companion
  predicate `Conditions.isImmuneTo(actor, name)` for chip / UI gating.
- **Auto-fail STR/DEX saves.** Engine binding of `Checks.savingThrow`
  reads the target actor + ability and short-circuits to a failed
  save with `autoFailed: true` when the SRD conditions force it.
  Module-level `savingThrow({ ..., autoFailed: true })` also short-
  circuits for callers that already know the answer.
- **Auto-crit from within 5 ft.** `Combat.attackRoll` reads the
  target's `critIfAttackerWithin5` flag (paralyzed, unconscious,
  petrified, stunned) plus `attackerDistanceFt` and upgrades the
  hit to a crit.
- **Concentration auto-drop.** Engine's bound `Conditions.apply`
  calls `Spellcasting.endConcentration` when an `incapacitates`-
  flagged condition lands (or the actor was just made immune to it,
  which is a no-op and bypasses both the drop and the hook fire).
- **`Conditions.effectsFor` / `attackStance` re-exported** on the
  engine binding for parity with the module-level surface.

**Per-application metadata** (`{ name, source?, dc?, saveAbility?,
endsOn? }`) is *deferred* to the 1.6.0 turn-lifecycle release;
the save-end-of-turn binding it enables lives there anyway, and
keeping conditions as strings for now means existing fixtures and
host integrations don't churn.

**Bundle budget bumped** from 120 kB / 30 kB gz to 160 kB / 40 kB
gz to absorb the 10-class mechanics + damage pipeline + condition
completion shipped since 1.0.0. New range covers expected growth
through the 1.x line.

Closes [§ 4 Conditions](srd-coverage.md#4-conditions) and the
concentration half of
[§ 10](srd-coverage.md#10-spellcasting--slots--concentration).

### `1.6.0`: Turn lifecycle hooks + time tracking ✅ shipped

Foundation for spell durations, end-of-turn saves, dawn timers,
and the 1.7+ reaction-cast wiring. Big surface; some sub-pieces
deferred to 1.6.1 where they couple to surfaces that don't exist
yet.

**Shipped in 1.6.0:**
- **7 new hook events:** `onTurnStart`, `onTurnEnd`, `onLongRest`,
  `onShortRest`, `onCast`, `onDamageApplied`, `onHpChanged`.
- **Round-scoped timers.** `actor.timers: [{ id, kind?,
  remainingRounds, source? }]`; `Combat.addTimer` + `Combat.tickTimers`
  for the read/write surface.
- **Turn lifecycle.** `Combat.turnStart(actor, context?)` and
  `Combat.turnEnd(actor, context?)` are the canonical dispatch
  points; the bound `turnEnd` ticks timers, fires `onTurnEnd` with
  the expired list, returns the new actor + expired entries.
- **Scene clock.** `SceneClock.freshScene`, `SceneClock.advanceTime`,
  `SceneClock.formatTimeOfDay`. Pure functions; the host owns the
  scene state and threads it. `advanceTime` enumerates `'dawn'` /
  `'dusk'` crossings in chronological order, even across multiple
  day cycles.
- **Engine bindings.** `Rest.longRest`/`shortRest` fire their
  matching events; `Combat.applyDamage` fires `onDamageApplied`
  (always) and `onHpChanged` (only when HP actually moved); same
  for `Combat.heal`.

**Deferred to 1.6.1** *(historical note: no 1.6.1 milestone was ever
written — parts of it were folded into the burned 2.1.0 merge, and
the four rows below remain open "when a consumer asks" deferrals,
tracked in srd-coverage.md)*:
- **Per-application condition metadata.** `{ name, source?, dc?,
  saveAbility?, endsOn? }` shape on `actor.conditions[]`. Needed
  for save-end-of-turn but is a non-trivial schema change; rides
  with the related auto-save wiring.
- **Save-at-end-of-turn.** Auto-roll on `turnEnd` for conditions
  with `endsOn: 'turnEnd'`. Depends on the metadata above.
- **Spell-duration auto-binding.** `castSpell` adding a timer
  automatically. Rides with the 1.8.0 spellcasting completion
  release where casts have richer metadata anyway.
- **Stable-creatures-regain-1-HP-after-1d4-hours.** Small scene-
  clock plugin handler; small enough to fold in once a consumer
  needs it.

Closes [§ 9 Time and duration
tracking](srd-coverage.md#9-time-and-duration-tracking) for the
round-clock + scene-clock halves. The condition-metadata + save-
end-of-turn rows stay open in srd-coverage.md (the "planned 1.6.1"
never materialized; see the note above).

### `1.7.0`: Combat actions menu ✅ shipped

The encounter system spent a generic `'action'` budget previously
but knew none of the action semantics. This release adds the SRD
action verbs as engine helpers.

- **Dash, Disengage, Dodge, Help, Hide, Ready, Search, Study,
  Influence.** Each lands as a verb on `engine.Combat`: consumes a
  budget, returns a state delta. Dodge tags
  `dodgeUntilNextTurn` (consumed by attack stance / DEX saves);
  Disengage sets the flag `opportunityAttack` already reads.
- **Grapple, Shove.** Fixed-DC `8 + STR + prof` per the 2024
  single-roll change. Grapple applies `grappled` + binds the target;
  Shove offers `prone` or push-5-ft.
- **Two-Weapon Fighting.** `Combat.offHandAttack(state, attacker,
  weapon)`: bonus-action gated, no ability mod on damage; interacts
  with the existing Nick mastery rider.
- **Improvised attacks.** D4 default; proficiency suppressed.
- **Surprise on initiative.** Disadvantage on the initiative roll
  per the 2024 change (no more skip-turn).
- **Initiative tiebreak chain.** DEX, then random.
- **Mounted combat.** `actor.mountedOn` linkage; opportunity
  attacks redirect appropriately.
- **Object interaction.** Free, one per turn, registered with the
  budget.

Closes [§ 3 Combat actions menu](srd-coverage.md#3-combat-actions-menu)
and the surprise + tiebreak rows of
[§ 2](srd-coverage.md#2-combat-math-attacks-damage-criticals).

### `1.8.0`: Spellcasting completion ✅ shipped

Components, ritual, casting time variants, area-of-effect targeting,
save-for-half outcomes, upcast deltas, reaction-cast canonical
wiring. Big release; bundled because the spell record contract
shifts in one coherent step.

- **Components.** `spell.components: { v?, s?, m?: { cost?,
  consumed? } }`; `castSpell` enforces silenced-vs-V, free-hand-vs-S,
  focus / pouch substitution for non-cost M.
- **Ritual casting.** `Spellcasting.castAsRitual(spell, caster)`:
  +10 minutes, no slot, prepared-only.
- **Casting time variants.** `spell.castingTime: 'action' | 'bonus'
  | 'reaction' | { minutes } | { hours }` typed on records.
- **Concentration auto-bind.** `spell.concentration: true` triggers
  `startConcentration` on cast (paired with 1.5's auto-drop).
- **One leveled spell per turn.** `castSpell` enforces SRD § *Spells,
  Casting a Spell* ("only one leveled spell per turn").
- **Area-of-effect targeting.** `Spellcasting.targetsInArea({
  origin, shape, size, facing }, candidates)`. Shapes: cone, line,
  sphere, cube, cylinder, emanation.
- **`Spellcasting.castSpellSave(spell, targets, dc, { halfOnSuccess
  })`.** Per-target save outcomes packaged uniformly.
- **Higher-level slot deltas.** `spell.upcast(level)` returns the
  per-slot-level delta the engine merges with the base effect.
- **Reaction-cast canonical wiring.** Shield is shipped; this
  release adds Counterspell (the `onCast` interception path),
  Absorb Elements, Hellish Rebuke, and Silvery Barbs as worked
  examples.

Closes
[§ 11 Spellcasting, components & casting modes](srd-coverage.md#11-spellcasting--components--casting-modes),
[§ 12 Spellcasting, targeting & effects](srd-coverage.md#12-spellcasting--targeting--effects),
and the unfinished rows of
[§ 10](srd-coverage.md#10-spellcasting--slots--concentration).

### `1.9.0`: Magic items system ✅ shipped

Items were pure data before; this release adds the lifecycle.

- **Rarity bands.** `item.rarity: 'common' | 'uncommon' | 'rare' |
  'veryRare' | 'legendary' | 'artifact'`.
- **Attunement.** `item.requiresAttunement?: { classId?,
  spellcaster?, abilityMin? }`; `actor.attunedItems: string[]` capped
  at 3; attunement needs a Short Rest.
- **Charges + dawn recharge.** `item.charges?: { max, recovers,
  rechargesOn }`; per-actor charge state; the dawn event from 1.6
  drives the recovery handler.
- **Cursed items.** `item.cursed?: true | { effect }`; cannot
  voluntarily un-attune; Remove Curse clears.
- **Identify / known properties.** `actor.identifiedItems`; default
  perception lists name + AC bonus only; full properties after
  Identify or attunement.
- **Magic item resilience.** `item.savingThrow?: { type, dc }` for
  forced destruction attempts.
- **Sentient items.** `{ intelligence, wisdom, charisma, alignment,
  communication, will }`; conflict-resolution save against the
  attuned creature.

Closes [§ 18 Magic items](srd-coverage.md#18-magic-items).

### `1.10.0`: Monster stat block depth ✅ shipped

Monster records gain the structural fields needed to run them as
opponents: Multiattack, Legendary / Lair / Mythic Actions,
Legendary Resistance, Innate Spellcasting, senses, save bonuses.

- **Multiattack.** `monster.multiattack: { attacks: AttackRef[] }`
  resolves in order on a single Attack action.
- **Legendary Actions.** `{ uses, refreshOn: 'turnStart', options:
  [...] }`; 2024 each costs 1 use. Engine offers them at the right
  moments.
- **Lair Actions.** `{ triggersOnInitiative: 20, options: [...] }`;
  fires automatically at initiative count 20 when `inLair`.
- **Mythic Actions.** Analogous schema.
- **Innate Spellcasting.** `{ atWill, 3day, 1day }`; per-day
  counter resets on long rest.
- **Senses.** `{ darkvision?, blindsight?, tremorsense?,
  truesight?, passivePerception }` (ft for ranged senses).
- **Resistance / Vulnerability / Immunity / Condition Immunity**
  arrays per monster, consumed by 1.4's damage pipeline.
- **Saving-throw proficiencies.** `monster.saves: { dex: +6, ... }`.
- **Languages.** `monster.languages: string[]`.
- **Legendary Resistance.** N uses/day, "convert a failed save to
  a success" helper.

Closes the mechanics half of
[§ 19 Monsters](srd-coverage.md#19-monsters); data expansion is
parallel work tracked under `1.x.y`.

### `1.11.0`: Movement modes + vision ✅ shipped

The single `speed` number expanded to per-mode + environment-aware,
and the vision layer came online.

- **Per-mode speeds.** Species / monster records carry `speeds: {
  walk, fly?, swim?, climb?, burrow? }`. Sheet derivation surfaces
  the full map.
- **Difficult terrain.** `Combat.spend(state, id, 'movement', feet,
  { difficult: true })` doubles cost.
- **Falling damage.** `Combat.fall(actor, distanceFt)` →
  `1d6 per 10 ft` (max 20d6), applies `prone`.
- **Jumping.** `Combat.longJump(actor)`, `Combat.highJump(actor)`
  returning feet.
- **Crawling.** Double-cost movement while prone.
- **Light levels.** `LIGHT_LEVELS = ['bright', 'dim', 'darkness']`;
  combat math reads the active level for sight-dependent rules.
- **Special senses.** Darkvision range converts dim → bright /
  darkness → dim; blindsight, tremorsense, truesight as flags.
- **Obscured.** Heavily obscured = effectively blinded; lightly
  obscured = Perception disadvantage.
- **Line of sight / line of effect.**
  `Combat.hasLineOfSight(observer, target, obstacles)`, separate
  from cover.

Closes the movement + vision halves of
[§ 8 Movement, vision, exploration](srd-coverage.md#8-movement-vision-exploration);
travel pace is 1.18.

### `1.12.0`: Character creation pipeline ✅ shipped

Adds the multiclass record shape, prereq validation, multiclass
caster-level formula, language + tool proficiency helpers. The
existing `deriveSheet` continues to honour the single-class shape;
consumers needing multiclass features call `Multiclass.*` helpers.

- **Multiclass record shape.** `record.classes: { fighter: 3,
  rogue: 2 }`. Single-class shorthand still works as a single-key map.
- **Multiclass prerequisites.**
  `Character.canMulticlassInto(record, classId, registries)` enforces
  SRD § *Multiclassing, Prerequisites*.
- **Multiclass spell-slot table.** Derived from per-class caster
  levels (full = 1, half = ½, third = ⅓).
- **Languages.** `record.languages`; background contributions
  merged.
- **Tool proficiencies.** `record.tools`; `Checks.toolCheck` +
  proficiency-with-tool advantage helper.
- **Origin feat auto-application.** Backgrounds carry `originFeat`;
  derivation merges the feat's mechanical effects (proficiencies,
  ability bumps, mechanic registrations).
- **Starting equipment.**
  `Character.applyStartingPackage(record, classId, backgroundId,
  choices)`.

Closes [§ 15 Character creation
pipeline](srd-coverage.md#15-character-creation-pipeline).

### `1.13.0`: Species traits as mechanics ✅ shipped in v1.17.0

Species records now carry a structured `effects` block alongside the
free-form `traits` labels. `deriveSheet` lifts those effects onto the
sheet so hosts and hooks can read them directly.

- **Darkvision range** on `sheet.senses.darkvision`; blindsight and
  truesight ride the same block.
- **Trait flags.** Stonecunning, Lucky, Fey Ancestry, Trance, Brave,
  and similar surface on `sheet.traitFlags` as a flat boolean map.
- **Alternate movement modes.** A species `effects.extraSpeeds`
  block (fly / swim / climb / burrow) merges into `sheet.speed`,
  honouring exhaustion penalties and speed-zero conditions.
- **Resistances.** `effects.damageResistances` lands on
  `sheet.damageResistances` so the 1.4 damage pipeline picks them up
  when the host stamps the sheet onto an actor.

Closes the trait-mechanics half of
[§ 16 Species, backgrounds, feats](srd-coverage.md#16-species-backgrounds-feats);
content expansion (extra species, cantrip-from-species) is parallel
`1.x.y` work.

### `1.14.0`: Saves & edge mechanics ✅ shipped

Reroll-on-save patterns and group/help skill semantics.

- **Heroic Inspiration.** `actor.inspiration: boolean`;
  `Inspiration.grant(actor)`, `Inspiration.spend(actor)`.
- **Halfling Lucky.** Auto-reroll-on-1 hook on D20 Tests.
- **Indomitable.** Fighter L9 reroll-once-per-long-rest.
- **Diamond Soul / Stillness of Mind / Magic Resistance.**
  Patterned reroll handlers using the same hook surface.
- **Group checks.** `Checks.groupCheck(checks)` succeeds if half
  or more pass.
- **Working together.** Help variant: advantage on a skill check
  if a single ally is proficient.

Closes [§ 21 Saves & edge
mechanics](srd-coverage.md#21-saves--edge-mechanics).

### `1.15.0`: Hazards & environment ✅ shipped in v1.18.0

Disease, poison, suffocation, starvation, extreme temperature, and
underwater combat: all the SRD § Hazards material in one focused
namespace.

- **`Hazards.DISEASES`** with onset save + per-stage progression.
- **`Hazards.POISONS`** keyed by contact / ingested / inhaled /
  injury vector.
- **`Hazards.exposure`** rolls the onset / poison save through the
  engine rng and returns the structured save + effect.
- **`Hazards.tickSuffocation`** + `holdBreathRounds` for breath-hold
  bookkeeping.
- **`Hazards.starvationTick`** accrues exhaustion past the food
  grace window and on failed thirst saves.
- **`Hazards.extremeTemperatureTick`** handles heat / cold with
  per-hour DC ramps and a gear-acclimatised proxy.
- **`Hazards.classifyUnderwaterAttack`** returns stance + auto-miss
  for melee / ranged underwater combat per SRD.

Closes [§ 22 Diseases, poisons, environmental
hazards](srd-coverage.md#22-diseases-poisons-environmental-hazards).

### `1.16.0`: Encounter design tools ✅ shipped

XP-by-CR table and 2024 simplified encounter difficulty bands.
Treasure tables deferred to a later content-only patch.

- **`Encounter.xpForCR(cr)`.** Full SRD § *Monsters, CR* table.
- **`Encounter.budget(partyLevels, difficulty)`.** Low / moderate /
  high XP bands per the 2024 simplified table.
- **`Encounter.classify(monsters, partyLevels)`.** Inverse: given
  a monster mix, returns the difficulty band.
- **Treasure tables** by hoard CR band, pure data.
- **Random encounter scaffolding.** Weighted pick over a
  tier-bucket list.

Closes [§ 20 Encounter design](srd-coverage.md#20-encounter-design).

### `1.17.0`: Equipment depth ✅ shipped in v1.19.0

Armor mechanics, tools, and the long tail of mundane gear, all in
the new `Equipment` namespace.

- **`Equipment.encumbranceLevel`** for the variant rule. Returns
  `'none' | 'encumbered' | 'heavily-encumbered'`.
- **Armor records gain `category`, `weight`, `donTime`, `doffTime`,
  `strRequired`, `stealthDisadvantage`.** All SRD § Armor table
  fields available off `engine.items.<id>`.
- **`deriveSheet` surfaces stealth disadvantage** as
  `sheet.skills.stealth.disadvantage` when heavy armor is equipped.
- **STR-requirement speed penalty.** Heavy armor below the
  `strRequired` threshold subtracts 10 ft from every movement mode
  on the sheet.
- **Encumbrance speed penalty.** `record.encumbrance: 'encumbered'`
  or `'heavily-encumbered'` subtracts 10 / 20 ft per the variant.
- **`Equipment.toolCheck`.** Proficiency-aware tool check that
  routes through the engine rng.
- **`ADVENTURING_GEAR`, `TOOLS`, `LIFESTYLES`, `SERVICES`** pure-data
  registries.

Deferred to `1.x.y` content patch: adventuring gear / services / lifestyle
/ trade goods as registry entries.

Closes the mechanics half of
[§ 17 Equipment & inventory](srd-coverage.md#17-equipment--inventory).

### `1.18.0`: Travel & exploration ✅ shipped in v1.20.0

Out-of-combat time has rules attached: a new `Travel` namespace
covers pace, forced march, rest interruption, foraging, and
navigation.

- **`TRAVEL_PACES`** with per-hour and per-day mileage for slow /
  normal / fast plus the passive Perception trade-off on fast.
- **`milesTravelled`** multiplies hours by pace.
- **`forcedMarchCheck`** CON save per hour past 8, DC ramps with
  the over-cap count; failure costs 1 exhaustion.
- **`checkRestInterruption`** with a host-supplied probability.
- **`forageCheck`** WIS (Survival) against a terrain DC; success
  returns pounds of food + gallons of water scaled by the surplus.
- **`navigateCheck`** WIS (Survival) or navigator's-tools check
  against a terrain DC; failure flags the party lost.

All save and ability rolls route through the engine rng so a
seeded session reproduces travel days end to end.

Closes the exploration half of
[§ 8 Movement, vision, exploration](srd-coverage.md#8-movement-vision-exploration).

### `1.19.0`: Tier 3 class features (L11-L16) ✅ shipped in v1.21.0

Every base class now lists features through L16 and the signature
tier-3 mechanics dispatch through the existing `mechanics` contract.

- All 12 classes carry `features[11..16]` strings (ASIs at L12 and
  L16; per-class signature names at L11/L13/L14/L15).
- Fighter `extraAttacks[11] = 2`, surfacing a third attack through
  `attacksPerAction`.
- Fighter `mechanics.indomitable`: spends a long-rest resource and
  flags `reroll: true` for the host to re-run the failed save.
- Rogue `mechanics.reliableTalent`: treats a d20 of 9 or lower as
  10 for proficient checks.
- Barbarian `mechanics.relentlessRage`: CON save (DC 10, +5 per
  prior use this rest) to drop to 1 HP instead of 0.

Per-subclass L11/L14 features ride with the subclass handler maps
in [v1.21.0](#1210--subclass-handler-maps); the base-class lines
are complete.

Closes the L11-L16 row of [§ 14 Classes, subclasses and tier 3/4](srd-coverage.md#14-classes--subclasses-and-tier-34).

### `1.20.0`: Tier 4 class features (L17-L20) + Epic Boons ✅ shipped in v1.22.0

The capstone tier ships across every class.

- All 12 classes carry `features[17..20]` strings with the SRD
  signature names (Primal Champion, Words of Creation, Eldritch
  Master, Signature Spells, ...).
- Fighter `extraAttacks[20] = 3`, surfacing a fourth attack through
  `attacksPerAction`.
- L19 Epic Boon row populated on every class.
- 11 Epic Boon feats added to the feats registry with
  `category: 'epic-boon'` (Combat Prowess, Dimensional Travel,
  Energy Resistance, Fate, Fortitude, Irresistible Offense,
  Recovery, Skill, Spell Recall, Night Spirit, Truesight).

Closes the L17-L20 row of [§ 14](srd-coverage.md#14-classes--subclasses-and-tier-34)
and the Epic Boons row of [§ 16](srd-coverage.md#16-species-backgrounds-feats).

### `1.21.0`: Subclass handler maps ✅ shipped in v1.23.0

Each of the 12 base subclasses now ships its own `mechanics` map
alongside its feature progression through tier 3/4. The engine's
mechanic dispatcher consults the subclass map first when the actor
carries a `subclassId`, falling back to the class-level handler
when the subclass doesn't override it.

- Berserker (Barb): frenzy, mindlessRageImmunities.
- College of Lore (Bard): cuttingWords.
- Life Domain (Cleric): discipleOfLife.
- Circle of the Land (Druid): landsAid.
- Champion (Fighter, new): improvedCritOn returning [19,20] / [18,20].
- Way of the Open Hand (Monk): openHandTechnique.
- Oath of Devotion (Paladin): sacredWeapon.
- Hunter (Ranger): huntersPrey.
- Thief (Rogue, new): fastHands.
- Draconic Sorcery (Sorcerer): elementalAffinity.
- Fiend Patron (Warlock): darkOnesBlessing.
- Evoker (Wizard): sculptSpells.

Closes the subclass-handlers row of
[§ 14](srd-coverage.md#14-classes--subclasses-and-tier-34).

### `1.22.0`: Plugin surface expansion ✅ shipped in v1.24.0

The Phase A/B/C plugin contract grew to match the engine surface
accrued through 1.21.

- **`extraResources`**: graft new resource specs onto any class
  (including homebrew classes added through `extraClasses`).
- **`extraMechanics`**: graft new mechanic handlers onto any class
  without forking the class def. Subclass mechanic dispatch still
  consults the subclass map first.
- **`extraSenses`** and **`extraLightLevels`**: appendable
  vocabularies exposed as frozen lists on `engine.senses` and
  `engine.lightLevels`.
- All four contributions validate at construction time with the
  same pointer-quality errors as the registry validators (unknown
  classId, non-function handler, missing `refreshes`).

Closes [§ 24 Plugin system](srd-coverage.md#24-plugin-system).

### `1.23.0`: Audit / replay surface completion ✅ shipped in v1.25.0

The roll log now captures every state-shaping event, not just the
dice inside.

- **`mechanicApplied` op.** Every `engine.Mechanics.apply` call
  appends an entry with the dispatched classId, subclassId, mechanic
  id, and the handler's `ok` field (defaults to `true` when absent).
- **`hookFired` op.** When `opts.logHooks: true`, every fired hook
  with at least one registered handler appends a log entry
  (event name + handler count). Events with no handlers stay silent.
- **`engine.rulesFingerprint`.** A stable 8-character FNV-1a digest
  over the resolved rules object. Two engines with identical rule
  knobs produce identical fingerprints; any knob change reflects in
  the digest so a replay can flag mismatched-pack divergence at the
  boundary.
- **`deathSave` previous-state snapshot.** `previousSuccesses` and
  `previousFailures` now ride along on each `deathSave` log entry
  for full reconstructability without external state.

Closes [§ 23 Audit / replay surface](srd-coverage.md#23-audit--replay-surface).

### `1.24.0`: Documentation & host-contract sweep ✅ shipped in v1.26.0

Bring the docs back in sync with the engine surface after a year
of releases.

- **`spec.md`** plugin contract extended with the Phase A.2
  contributions (extraMechanics / extraResources / extraSenses /
  extraLightLevels) and the Phase D hook events (onTurnStart,
  onTurnEnd, onLongRest, onShortRest, onCast, onDamageApplied,
  onHpChanged) plus the `opts.logHooks` toggle.
- **`docs/`** sweep aligned with shipped state through v1.25.0
  (character-sheet schema, recipes refresh, boundary doc).

Deferred from this milestone (rolled forward into later patches):
- A TypeDoc-style reference site generated from `index.d.ts`; the
  hand-maintained `.d.ts` already serves as the canonical reference,
  and a separate site needs hosting infrastructure outside the
  zero-dep boundary.
- A standalone "kernel-boundary checklist" page; `boundary.md`
  already covers the contract, and dedicated checklist content can
  live alongside the worked recipes when a real consumer surfaces
  the need.

Closes [§ 25 Documentation & host
contracts](srd-coverage.md#25-documentation--host-contracts).

### `1.x.y`: Content registry expansion ✅ shipped in v1.27.0

The SRD content registries grew to support actual play out of the
box. Engine surface didn't change; this is pure-data work.

- **Backgrounds**: 4 → 16 (all SRD 5.2 backgrounds).
- **Feats**: 14 → 43 (origin: 3; fighting style: 6; general: 23;
  epic boon: 11).
- **Spells**: 33 → 104 (cantrips through level 9, covering the
  canonical SRD spell selection).
- **Items + magic items**: 44 → 102 (full SRD weapons + armor
  table, adventuring gear, wondrous items, magic weapons + armor,
  scrolls, wands, staves, rods).
- **Monsters**: 9 → 66 (CR 0 through CR 15, every major tier).

Closes the registry-depth rows of
[§ 16](srd-coverage.md#16-species-backgrounds-feats),
[§ 17](srd-coverage.md#17-equipment--inventory),
[§ 18](srd-coverage.md#18-magic-items), and
[§ 19](srd-coverage.md#19-monsters). Further content can land in
patches as plugin contributions or future content packs (Bestiary
2.2-2.4, Grimoire 2.5-2.6, Treasury 2.7) without touching the
engine surface.

### `1.25.0`: SRD-complete maintenance release ✅ not needed

Reserved for any non-breaking cleanup needed after `1.24.0` landed
the SRD-coverage close. The 1.4 → 1.24 milestones (shipped as
v1.13.0 → v1.26.0) landed cleanly, and any further cleanup was
absorbed into v1.27.0 alongside the content registry expansion.
Skipping straight to the 2.x line.

## Post-SRD: playable foundation, content, settings

Closing SRD coverage at `1.24` leaves the kernel mechanically
sound but the user still has no way to *play* without bringing
their own characters, monsters, locations, and narrative. This
section maps the path from "math kernel" to "play tonight from
the package alone": solo testing infrastructure first, then
foundation content, then settings, then ecosystem.

**Solo mode anchors `2.0.0`** because it doubles as our deepest
end-to-end test: the engine drives a session through encounter →
rest → travel → encounter cycles, every roll is logged, and a
recorded session can be replayed to detect drift after every
release.

The `2.x` line follows additive semver: content packs, variant
rules, and the orchestrator are layered on top of the 1.0 contract,
not breaking changes. The major bump marks the *surface
expansion* (a new top-level `Solo` namespace, `Session`
orchestrator, CLI entry point), not an incompatibility.

### `2.0.0`: Solo mode foundation ✅ shipped

The proof point for the boundary contract: "math kernel is enough,
given a small orchestrator and an oracle." Drives the end-to-end
demo and proves the kernel hangs together for actual play.

- **`Solo.oracle({ rng })`.** Yes/no/and/but answers with nine
  odds bands (or a raw 0-100 probability), twists, complications,
  and a `pick(table)` helper for any weighted host table.
  Deliberately uses its own rng (default `Math.random`) — sharing
  the engine's dice rng would silently perturb `engine.rollLog`
  and break replay. Pass `{ rng: Dice.seededRng(seed) }` for a
  reproducible oracle stream.
- **`Session.create({ engine, party, encounter?, scene?, seed?, oracle? })`.**
  Turn loop (endTurn ticks timers + advances the encounter
  state), short/long rest applied across the whole party, scene-
  clock advance, attack / applyDamage / heal / condition helpers,
  plus a high-level event log that rides alongside the dice log.
- **`session.serialize()` + `Session.restore(payload, engine)`.**
  Save-and-load primitives. Fingerprint-gated: a payload built
  under one rule pack can't restore onto a mismatched engine.
- **`Replay.share(session)`.** Pin roll log + seed + character
  records into a portable JSON. *"Here's how the boss died."*
  `Replay.verify(payload)` proves the dice stream reproduces.
- **`examples/solo.html` — browser sandbox.** Zero-build ESM page
  that loads the kernel from `../index.js`, renders the starter
  party + an initial encounter, and wires every solo namespace
  into clickable buttons (oracle, time advance, attack, rest,
  replay share / verify). Stand-in for the CLI runner from the
  original milestone description; a `readline`-only CLI rides
  with a later patch when a real consumer asks for it.
- **Pre-built starter party shipped inline.** 4 ready L3
  characters (Thora Dwarf-Fighter, Sable Halfling-Rogue, Oran
  Human-Cleric, Merrick Elf-Wizard) baked into `src/solo/starter.js`
  and re-exported as `STARTER_PARTY`. Derives cleanly through
  `engine.deriveSheet`; the sandbox boots into a playable
  encounter with no host-supplied content.

*Why 2.0 and not 1.32:* the `Solo` / `Session` / `Replay`
namespaces + `STARTER_PARTY` constant are a meaningful API
expansion. The 1.0 contract stays intact (every 1.x export still
works); the major bump signals "the engine ships its own
playable surface now," not a break.

### `2.0.1`: Sandbox depth + LLM-GM chat ✅ shipped

Patch-level because **zero kernel API surface changed**: every
deliverable lives in `examples/solo.html` and `tests/solo.test.js`.
The sandbox stops being a wiring-test page and starts being a
playable demo.

- **Character-sheet expand.** Click a party member's name to
  unfurl an inline detail row: ability scores + mods, saves with
  proficiency indicators, proficient skills (with expertise
  pips), weapon attacks, spell-slot pip bar, class resources,
  remaining hit dice. Reads through `engine.deriveSheet` so
  equipment changes propagate.
- **Spell-casting UI.** Caster filtered to party members with
  `sheet.spellcasting`; spell list pulls L0-L2 entries from
  `engine.spells`; slot-level picker derives from the caster's
  `spellSlots` filtered by the spell's base level (so upcasting
  is one click). Routes through `engine.Spellcasting.castSpell`
  for slot consumption + concentration auto-bind, then the host
  resolves the effect (damage / save-for-half / healing).
- **Per-actor condition controls.** Every party and foe row gets
  an in-place dropdown + apply/remove buttons over the 11
  toggle-friendly SRD conditions. Wires `engine.Conditions.apply`
  / `remove`, which fires the existing `onConditionApplied`
  chain (and auto-drops concentration on incapacitating
  conditions per 1.5.0).
- **Save / Load to browser localStorage.** Per-mutation autosave
  under `bag-of-holding/solo-session@1`; on page load, restores
  the last saved session if one exists. Round-trips through
  `Session.serialize` + `Session.restore` — both fingerprint-
  gated, so a wrong-pack save throws cleanly.
- **LLM-GM chat.** A free-text panel powered by OpenRouter
  (`tencent/hy3-preview`, paste-in-browser key, never committed).
  Two-call loop: Prompt A classifies the chat message into ONE
  structured intent from a closed 13-kind vocabulary; a
  dispatcher routes it to the existing `session.*` surfaces;
  Prompt B narrates the actual engine outcomes back in-character.
  Existing buttons skip Prompt A and feed straight into
  narration. **The LLM never invents dice or HP** — mechanical
  values are read from `engine.deriveSheet` inside the
  dispatcher; the intent schema only carries IDs. 500 ms
  debounce + 2 s min gap + 30-call session cap; XSS-safe
  rendering via `textContent`. Mock mode (keyword router) lets
  hosts demo the loop without burning quota.
- **Coverage tightening.** 18 new tests in `tests/solo.test.js`
  close the gap between the prior roadmap claim ("100/100/100")
  and reality (was 99.86 / 98.99 / 99.37). New numbers: 100% /
  99.92% / 100%. The remaining branch gap is two unreachable
  defensive guards in `src/solo/session.js:186` (the `?? null`
  fallback for `actors.get(p.id)` — `adoptParticipant` always
  populates the map on every public code path).

*Why .1 and not .x:* the sandbox upgrades are demo / example
changes — the published `@zeeuw/bag-of-holding` kernel exports
the same surface as 2.0.0. `2.1.0` / `2.2.0` were reserved here
for the adventure + bestiary milestones below; none of those
reservations survived. `2.2.0`–`2.5.0` were spent on engine work
(see the entries below), and `2.1.0` was consumed by a merge
resolution and published — the content batches are unnumbered
until they ship.

### `2.0.9`: Encounter verb completeness + day/night cycle ✅ shipped

Additive kernel API changes on the 2.0.x line. (This entry once
reserved `2.1.0` for *The Quiet Stair*; the merge that followed
this release spent that number instead — see below.)

**Action economy fixes and new verbs (`src/encounter.js`):**

- **`beginAttackAction(state, actorId, numAttacks)`** — opens the
  Attack action budget by spending the `action` slot and setting
  `budget.attacksLeft`. `grapple` and `shove` now spend one attack
  slot each (fixing a bug where they consumed the whole action),
  enabling a Fighter with Extra Attack to grapple + strike in the
  same turn.
- **`utilize(state, actor, args)`** — Utilize action verb; spends
  `action` for a second object interaction. `args.item` optional.
- **`bonusAction(state, actor, args)`** — generic bonus-action escape
  hatch for class features not modelled as dedicated verbs (Cunning
  Action, Second Wind, etc.). `args.kind` required for log fidelity.
- **`reveal(state, actor)`** — clears `actor.hidden` as an automatic
  consequence (no budget spent); called by the host after any action
  that breaks concealment.
- **`clearReady(actor)`** — pure helper that strips `actor.readied`
  after a readied action fires or the trigger window closes.
- **`hide()`** now accepts `args.canHide = false` to refuse before
  spending the action (host asserts cover availability), and surfaces
  `stealthDisadvantage` from `actor.skills.stealth.disadvantage` in
  the result.

**Day/night cycle (`src/scene-clock.js`):**

- **`MINUTES_PER_EXPLORATION_TURN = 10`** — SRD exploration turn
  constant.
- **`freshScene`** now accepts `minutesPerTurn` (default 10); stored
  on the scene object so `advanceTime` and `advanceTurn` read it.
- **`advanceTime`** supports `delta.turns` (each turn =
  `scene.minutesPerTurn` minutes).
- **`advanceTurn(scene, turns = 1)`** — convenience wrapper for
  exploration-pace time tracking.
- **`isDaytime(scene)`** — returns `true` between `dawnMinute` and
  `duskMinute`.
- **`timeOfDayLabel(scene)`** — returns `'dawn'` | `'day'` | `'dusk'`
  | `'night'`; dawn/dusk windows are the opening/closing 30 minutes
  of the day period, never contradicting `isDaytime`.

All new verbs follow the existing `{ allowed, state, actor, result }`
shape and are exposed on `engine.Combat.*` / `engine.SceneClock.*`.
Docs: Recipes 41–44 added to `docs/recipes.md`.

### `2.1.0`: spent, not shipped ⚠️

This slot held *The Quiet Stair* (moved to the unnumbered
milestones below). It is not available: the merge in `c4654c7`
reconciled a 1.16.0 branch against 2.0.9 and its conflict
resolution wrote `2.1.0` into `package.json`; that build was
published to npm on 2026-06-01 and is still `latest`. No release
notes correspond to it — the tree it was cut from is the 2.0.9
surface plus the merged 1.6.1 / 1.13.0 / 1.17.0 back-fills.
Nothing to un-publish and nothing to re-use; the number is gone.

### `2.2.0`: Monster tier templates ✅ shipped

Reserved as *Bestiary I*; spent on `src/monster-templates.js`
instead — Elite / Champion / Ancient variants (CR +4 / +8 / +12,
HP x1.8 / x2.8 / x4.0) DERIVED from verified SRD stat blocks, so
a campaign reaches CR 16–24 without inventing balance that was
never tested against anything. The actual 50-creature Bestiary I
batch keeps its title below and takes the next free minor when it
ships.

### `2.3.0`: Engine correctness pass ✅ shipped

Reserved as *Bestiary II*; spent instead on what a cross-repo
audit turned up, because shipping more content on top of a
non-total replay would have buried the problem rather than fixed
it. The content batches below keep their titles and lose their
numbers — each takes the next free minor when it actually ships.

- **Replay is total.** `verifyLog` had no case for `deathSave`,
  `mechanicApplied`, `hookFired`, or `rngDraws`; an unhandled
  entry desynced the RNG stream, so every later roll verified
  against the wrong draw and the forensic replay reported a
  divergence at the wrong turn, or none at all.
  `abilityCheck` / `savingThrow` now replay under the stance they
  were rolled with.
- **Seven un-logged RNG draw sites** — forage, navigate, rest
  interruption, tool check, fall, item recharge, item saving
  throw — now record an `rngDraws` entry, so a campaign that used
  any of them replays at all.
- **Rules fixes.** Half-caster slots start at L1 (a level-1
  paladin could not cast); `castSpell` consumes the level
  actually cast at, not the spell's base level; `longJump` reads
  the STR score rather than the modifier (a 20-STR character
  jumped five feet); dice count and sides are bounded;
  `abilityCheck` accepts advantage/disadvantage and reports the
  stance it rolled under.
- **Solo session restore** stopped promoting adopted NPCs to PCs.

### `2.4.0`: SRD class spell lists ✅ shipped

Reserved as *Bestiary III*; spent on `src/srd/spell-lists.js` —
which classes can learn which spells. The spell records always
carried the mechanics and never the permissions, so a host
offering a player their real spell list had to invent one from
school and level, and an invented list gets a wizard casting Cure
Wounds.

- `classesFor(spellId)`, `isOnClassList(classId, spellId)`,
  `spellsFor(classId, { level, maxLevel })`, `CASTER_CLASSES`.
- `maxSpellLevel(casterLevel, progression)` for `full` / `half` /
  `pact`, asserted against the slot tables themselves rather than
  against its own arithmetic.
- Scope is the SRD 5.2 lists over the 104 spells this package
  ships. Subclass-granted spells (Domain, Circle, Patron, Oath)
  stay with their subclass.

### `2.5.0`: Verification-audit fixes ✅ shipped

A follow-up audit adversarially re-verified the 2.3.0/2.4.0 claims
and found the increments that were promised but not performed.
This release closes them:

- **Replay is total, for real this time.** Six proven desync paths
  remained: surprised initiative (two d20s drawn, one recorded —
  the 2.3.0 comment listed it as fixed), auto-failed STR/DEX saves
  (recorded `d20: 0` while replay rolled a die), and four unlogged
  draw sites (`rollStableRegenHours`, `applyHalflingLucky`,
  `rerollFailedSave`, `castFromScroll`). All record now; replay
  consumes matching draws; each has a round-trip test.
- **Condition-record API restored.** `conditionName`,
  `conditionsRequiringSave` and record-form `apply`/`remove`
  (v1.6.1) had been dropped by a merge and survived only in
  `index.d.ts` — the typecheck never compares declarations to
  `src/`. Implemented to the declared contract; string entries
  keep their legacy stored shape; a conformance test now walks the
  declared namespace members against the runtime exports.
- **`castSpell` consults the spell lists.** A wizard can no longer
  cast Cure Wounds (`ok: false`, names the list); monsters,
  classless actors and unlisted spells pass through;
  `ignoreClassList` opts out; scrolls opt out by design and
  `castFromScroll` now derives its `onClassList` default from the
  real lists.
- **Derived bosses can use their legendary actions.** The tier
  templates emitted `actions[]` by name while `useLegendaryAction`
  looks up `options[].id` — permanently "unknown legendary
  option". The templates now emit the consumer's contract, a
  single-attack base multiattacks twice, and the test drives the
  consumer against the producer's output.
- **SRD 5.2 tables, not 2014 leftovers.** Fighter Second Wind
  scales 2/3/4 (L1/4/10) with long-rest refresh + one back per
  short rest; Action Surge gains its L17 second use; Indomitable
  scales 1/2/3; prepared-spell counts read the fixed 5.2 per-level
  tables (the 2014 `mod + level` formula is gone — a HOUSE RULE
  note covers the shared-column simplification); the goblin has
  its 5.2 hit points; the orc is tagged as the 2014 holdover it
  is; `magicResistanceDcFor`'s −5 hack is retired in favour of
  `magicResistanceAdvantage` feeding the real advantage flag.
- **The CI gate stops crying wolf.** The unseeded death-save test
  omitted `'revived'` from its outcome enum, failing ~1 run in 20
  on a natural 20 — the flake is fixed by completing the enum.

### `2.5.1`: Release plumbing ✅ shipped

No kernel changes — a patch bump per the versioning rule, cut to
make `npm publish` possible again after it had been failing for
two reasons at once.

- **Bundle budget re-pinned to 340 kB min / 80 kB gz**
  (`scripts/measure-bundle.js`). The 1.27.0 budget (280/65) was
  overrun at `2.4.0` (283.90 kB approx-minified) and again at
  `2.5.0` (286.12 kB), so `prepublishOnly` exited 1 before it
  could reach the registry. The overrun is SRD content — class
  spell lists and tier-derived stat blocks — which is what the
  gate is meant to make deliberate rather than forbid.
- **The budget now runs in CI** (`.github/workflows/ci.yml`).
  Previously it fired only from `prepublishOnly`, so it went
  unchecked across every commit between publishes; that is how a
  breach at `2.4.0` stayed invisible until `2.5.0` was ready to
  ship.
- **`2.1.0` recorded as spent** here and in `CLAUDE.md`, with a
  pre-publish resync step added to the versioning rules. The
  failed publish that prompted this release re-packed the
  already-published `2.1.0` byte for byte (identical shasum
  `21d66d7c…`) from a checkout two months behind `main`.

### Starter adventure: *The Quiet Stair* — ✅ shipped as `2.6.0`

The first complete adventure shipped *inside* the package.
Designed to use only mechanics shipped through `1.24` and content
from this release; about a 90-minute playthrough. Without an
inline adventure the `2.0.0` CLI has nothing to drive; *The
Quiet Stair* is both the demo and the smoke test. (Held `2.1.0`
until a merge resolution spent that number — see above.)

- **Adventure JSON.** Scene graph, encounter compositions, NPC
  cast, treasure rewards. Uses the existing `Beats` runtime.
- **15 supporting monsters** (invented; CR 0 to 4) populate the
  encounter slots. Same legal hygiene as the Void Thrall test
  fixture (see [docs/legal.md](legal.md)).
- **8 supporting items.** Keyed mundane-and-magical mix; one
  charged, one cursed, one consumable. Exercises the 1.9
  magic-item lifecycle end-to-end.
- **3 named NPCs** with motives + voice tags, designed to
  exercise the social action verbs (Help, Influence) and the
  reaction-cast surface.

*(As shipped in `2.6.0`: all four components landed — the adventure
format is `src/adventures/` (`validateAdventure` + run glue over the
unmodified Beats runtime), the packs mount via
`extraMonsters`/`extraItems` so the SRD registries stay SRD-only,
`influence()` became a named Combat verb, and the NPC record stayed
adventure-scoped by design (casting.js's boundary: the app owns the
cast). Legendary/lair/innate mechanics were deliberately left to
Bestiary II/III — wrong tier at CR 0–4.)*

### Bestiary I (CR 0-5) — ✅ shipped as `2.7.0`

50 invented creatures across the common ecology niches: humanoid
warbands, beasts, undead, fey, elementals, oozes, constructs.
Each carries the full 1.10 stat-block surface (multiattack,
senses, condition immunities, save bonuses). The first batch
that meaningfully populates a homebrew sandbox.

*(As shipped: `BESTIARY_I` export, mounted via `extraMonsters` —
the SRD registry stays SRD-only. Also closes the dungeon-overlay
debt: `fungal-zombie`, `stone-sentinel`, `myconid-sovereign`,
`young-drake` and `lesser-demon` now exist under their exact
downstream ids. Legendary/lair/innate deliberately absent at this
tier — they arrive with Bestiary II/III.)*

### Bestiary II (CR 6-15) — ✅ shipped as `2.8.0`

30 boss-tier opponents with Legendary Actions, Lair Actions, and
Innate Spellcasting wired through 1.10. Gives a real tier-2 /
tier-3 climactic fight without falling back on Wizards'
proprietary creatures.

*(As shipped: `BESTIARY_II` via `extraMonsters`. Every block
multiattacks and trains saves; 15 carry Legendary Actions, all of
CR 10+ carry Legendary Resistance, 8 home-holders carry lair
actions, 8 cast innately from real SRD spell ids. This release
also re-pins the bundle budget to 480/115 kB — one deliberate pin
for the whole planned content track; see
scripts/measure-bundle.js.)*

### Bestiary III (CR 16-20) — ✅ shipped as `2.9.0`

10 capstone monsters for tier-4 play. Includes Legendary
Resistance pools, Mythic Actions, and Innate Spellcasting at
spell levels 6+. Unlocks meaningful end-of-campaign showdowns.

*(As shipped: `BESTIARY_III` via `extraMonsters`. All 10 carry
full Legendary Resistance pools (3 uses), legendary actions,
multiattack routines, 3+ trained saves and capstone senses; 6
carry Mythic Actions — and the mythic CONSUMER lands with them
(`Monsters.freshMythicState` / `activateMythic` /
`useMythicAction` / `refreshMythicActions`), the mechanic the
1.10 header promised but no data ever drove; 5 cast innately at
spell level 6+, up to power-word-kill and gate. With Bestiary
I/II and the Quiet Stair pack the invented bestiary is 105 blocks
on a continuous CR 0–20 ladder.)*

### Grimoire I (cantrips through 5th) — ✅ shipped as `2.10.0`

50 invented spells covering schools and tactical roles the SRD 33
left thin: more reaction-cast options, more save-for-half AoE
shapes (cylinder, line variants), more concentration buffs, more
single-target debuffs. Each entry uses the 1.8 spell-record
contract: components, ritual flag, upcast deltas.

*(As shipped: `GRIMOIRE_I` via `extraSpells`. 10/10/8/8/7/7 across
levels 0–5, all eight schools represented; 3 reaction casts, 3
cylinder + 2 line save-for-half AoEs, 12+ concentration effects,
4 rituals, 5+ single-target debuffs. First shipped data carrying
1.8's `upcast(castLevel)` deltas — `castSpell` consumed the field
for eight minors with nothing to consume. Records carry a
`classes` array as host data; the SRD class-list gate stays
SRD-scoped by design.)*

### Grimoire II (6th-9th) — ✅ shipped as `2.11.0`

30 high-tier spells. City-sized AoEs, plane-shifting
alternatives, complex multi-target control. Less common usage;
included so tier-3/4 spellcasters have a real spell list.

*(As shipped: `GRIMOIRE_II` via `extraSpells`. 9/8/7/6 across
levels 6–9, all eight schools; 3+ city-sized AoEs (up to
cylinder-300 at a mile's range), 3 plane-shift alternatives all
gated behind costed material components, 3+ mass-control
concentration effects, 3 high-tier reactions. Composable with
Grimoire I — the invented list runs cantrip to 9th with no SRD
dependency, asserted per-level.)*

### `2.7.0`: Treasury — ✅ shipped as `2.12.0`

40 magic items spread across all six rarity bands. Demonstrates
every 1.9 mechanic: charged items (with dawn-recharge dice
specs), attunement-with-prereqs (class / spellcaster / ability),
cursed items with Remove Curse paths, sentient item conflict
hooks, items with their own saving throws.

*(As shipped: `TREASURY` via `extraItems`, 8/10/9/6/4/3 across
the six bands. Charges appear on all FOUR recharge schedules the
engine knows, not just dawn; all three attunement-prereq kinds
refuse and admit through `canAttune`; four cursed items climb the
bands; sentience ships as pack DATA — ego scores, purpose,
`conflictDc` for a host-run Charisma contest — because the engine
deliberately has no sentience mechanic. Also corrects the Item
rarity union: the band is `veryRare` per RARITY_BANDS, not the
`very-rare` the d.ts claimed since 2.6.0.)*

### `2.8.0`: Origin pack — ✅ shipped as `2.13.0`

5 invented species, 8 invented backgrounds, 12 invented feats.
Distinct from the SRD baseline, not recolors. Each species
exercises a species-trait mechanic (darkvision, resistance,
movement mode, racial cantrip), back-filling the 1.13 deferral.

*(As shipped: `ORIGIN_SPECIES` / `ORIGIN_BACKGROUNDS` /
`ORIGIN_FEATS` via the matching `extra*` slots. All five trait
mechanics are LIVE through deriveSheet — swim/climb/fly extra
speeds, 120-ft darkvision, fire/necrotic resistances — and the
racial cantrip ships as `effects.cantripId` data whose reference
the tests resolve. Backgrounds keep the exact SRD 5.2 shape but
grant this pack's own Origin Feats; feats split 6 origin /
4 general / 2 epic boons with a typed `prerequisite` field new to
the Feat interface.)*

### `2.9.0`: Variant rules: combat — ✅ shipped as `2.14.0`

Flanking, called shots, lingering injuries, severity-table
massive-damage, cleave-through, fumble crits. Each lands as
either a `rules` knob (Phase B) or a hook bundle (Phase C) so
host tables opt in per-game.

*(As shipped: the `VariantCombat` namespace — six pure opt-in
helpers rather than knobs, because none of them change baseline
math: flanking is strict midpoint geometry over host-supplied
grid squares paying off through the existing advantage path;
called shots price five locations against riders that map to real
engine conditions; lingering injuries (d20), system shock (d10)
and fumble effects (d6) are total tables — every face lands on
exactly one row — rolled through counted() so seeded replay stays
aligned; cleave-through is exact carryover arithmetic. The
`fumbleOn` rules knob from Phase B still decides WHICH faces
fumble; the new table decides what a fumble means.)*

### `2.10.0`: Variant rules: rest + downtime — ✅ shipped as `2.15.0`

Gritty resting (8-hour short / week-long), slow natural healing,
Healer's Kit dependency, sanity track, exhaustion-on-failure
checks. Three more `longRestHitDiceRecovery`-style knobs on top
of the rest-rule extension shipped at `1.2.0`.

*(As shipped: exactly the three promised knobs —
`longRestHpRecovery: 'none'` withholds the free long-rest hp while
Hit Dice still recover, `hitDiceRequireHealersKit` makes
spendHitDie refuse untended actors, and `restDurationScale:
'gritty'` is consumed by the new `Rest.restDurations()` query
(1/8 vs 8/168 hours; the engine keeps no clock, so the query IS
the consumer). The non-knob half lands as `VariantRest`: an
opt-in sanity track (a seventh score, d20 + modFromScore checks,
loss clamping to a mindBroken STATE rather than death) and
`exhaustionOnFailure`, which drives the real exhaustion ladder —
six failed checks kill through the SRD machinery.)*

### `2.11.0`: Variant rules: encounter + skills — ✅ shipped as `2.16.0`

Group / side initiative, honor / piety / renown stat tracking,
background-as-proficiency, fewer-skills-more-options variant.

*(As shipped: the `VariantEncounter` namespace, closing the
variant-rules track. Side initiative (one unmodified d20 per side)
and group initiative (d20 + group DEX; near-ties break toward the
higher modifier) both reroll ties until the order is strict.
Honor/piety/renown are clamped scalar tracks with preset bands, a
rank ladder (`rankFor` + `RENOWN_RANKS`) and room for custom
tracks. Background-as-proficiency ships as the DEFAULT judgment
(`backgroundApplies`) feeding abilityCheck's existing `proficient`
flag — no new check math. The six SKILL_GROUPS partition the 18
SRD skills exactly, asserted against SKILL_ABILITY so a future
skill can't slip through ungrouped.)*

### `2.12.0`: Hazards & environment (back-fill of 1.15) — ✅ shipped as `2.17.0`

Closes the row deferred from the SRD-coverage track. Disease
registry, poison vectors (contact / ingested / inhaled / injury),
suffocation, starvation / thirst, extreme heat / cold,
underwater combat. Each gets a starter content registry alongside
the mechanic surface.

*(As shipped: the mechanics all landed at 1.18.0 — the remaining
debt was the "starter content registry" clause, and 2.17.0 pays
it. The disease registry is now COMPLETE SRD coverage (sight-rot
joins sewer-plague and cackle-fever; deliberately no recoveryDc —
mundane rest never clears it, the `cure` field says what does).
The poison registry triples to 12: every vector has multiple
entries and the DC spread runs the full SRD band 10–19, so an
encounter builder can pick by delivery method AND tier. Every new
entry resolves through `exposure` on the replay contract.)*

### `2.13.0`: Travel & exploration (back-fill of 1.18) — ✅ already delivered at `1.20.0`

Closes the other deferred row. Travel pace (slow / normal / fast),
forced-march exhaustion saves, foraging / navigation DC tables,
resting in dangerous terrain. Surfaces a `Travel` namespace.

*(Verified 2026-08-16: every clause of this row shipped with the
1.18 milestone at v1.20.0 — `TRAVEL_PACES`, `forcedMarchCheck`
(DC 10 + hours-past-8 CON save into the exhaustion ladder),
`forageCheck` / `navigateCheck` with per-terrain DC tables, and
`checkRestInterruption` for dangerous-terrain rests, all on the
`Travel` namespace. Nothing left to build; the row was a
bookkeeping artifact of the two-track roadmap split.)*

### `3.0.0`: Setting: *Sundermark* (high fantasy) — ✅ shipped as `3.0.0`

The first complete setting pack. Faerûn-grade scope (a continent,
multiple kingdoms, classic adventuring vibe) with one defining
twist: **the gods have died** centuries ago. Clerics draw from
preserved relics; paladins swear oaths to memories; divinations
feel like séances. Less *gods walk among us*, more
*Pillars of Eternity*-style "what's left after the divine left."

- ~6 regions, ~15 factions, ~10 cities mapped with adventure hooks.
- 1 setting-specific species (the Vesperin, echoes-of-the-dead-
  gods bloodline), 3 background variants, 5 setting feats.
- 2 starter adventures (*The Singing Tower*, *Halberd's Edge*).
- 12 named NPCs with motives, voice tags, and faction ties.
- **New plugin slots**: `extraRegions`, `extraNpcs`,
  `extraStoryHooks`, `extraAdventures` contracts the engine
  surfaces alongside existing content plugins.

*(As shipped: the four setting slots land with empty default
registries — no setting is on by default, asserted — and
`SUNDERMARK` fills them: 6 regions, 10 cities, 15 factions whose
stances are 15 DISTINCT answers to "what do you do with a dead
god?", 13 hooks, 12 NPCs, the Vesperin, 3 backgrounds, 5 feats,
and both promised adventures in the 2.6.0 pack format with
difficulty claims re-derived (the Singing Tower climax is pinned
at exactly 1600 XP like the Quiet Stair's; Halberd's Edge claims
'deadly' honestly). Referential integrity — region→city→hook→
adventure, faction→seat, npc→faction — is asserted edge by edge.
The 2.6.0 "no kernel NPC registry" decision is REVISED here,
which is part of why this is a major. Note: bundle at 462/480 kB
— resolved at 3.1.0, which split settings onto their own measured
track (200/60 kB) and brought the kernel back to 431 kB.)*

### `3.1.0`: Setting: *Brassgear* (magitech-noir) — ✅ shipped as `3.1.0`

Eberron-grade scope with the twist: **the magic is dying**. The
Last War (or its local equivalent) bled the world's arcane
reserves; PCs are scavengers in the wreckage of a magical-
industrial peak. Bankrupt dynasties, decaying constructs, black-
market schematics. Closer to *Tales of Arcadia* / *Mortal Engines*
than peak Eberron.

- ~5 city-states, a dragonmark-equivalent inherited-talent system,
  ~10 noir-adventure hooks.
- 1 species (the Cogborn), 2 backgrounds, an Artificer-equivalent
  shipped via the Mechanics plugin surface (no new top-level class).
- 1 starter adventure (*The Greenmist Heist*).

*(As shipped: 5 city-state regions with one seat each (asserted),
5 corporate factions, 10 noir hooks, 6 inherited talents — one
per bankrupt house, the dragonmark equivalent as pure data — and
the Tinker: infuse/overclock mechanics + an infusion-charges pool
grafted onto the wizard chassis through Phase A.2, proven in CI
to add ZERO new classes and to refresh through the standard
long-rest machinery. The Greenmist Heist validates deep and runs
a full sitting. This release also splits the bundle budget:
settings now measure under their own 200/60 kB track (kernel back
to 431/480) because sideEffects:false lets bundlers tree-shake
unmounted packs; setting packs are also importable as subpaths —
`@zeeuw/bag-of-holding/settings/brassgear`.)*

### `3.2.0`: Setting: *The Hollow Vale* (gothic horror) — ✅ shipped as `3.2.0`

Ravenloft-grade scope with the twist: **the Darklords are people
the PCs knew**. The Vale is small: a dozen villages, one valley.
Darklords are a baker, a kindly priest, a former adventuring
partner. Each domain has a moral arc, not a slay-the-vampire arc.
Closer to *The Wicker Man* than *Dracula*.

- 8 domains, 8 Darklord NPCs with motives and tragic backstories.
- Gothic mechanics: dread track, light-as-resource, dream
  sequences as engine-supported beats.
- 1 starter adventure (*Bramblefell*).

*(As shipped: 8 one-seat domains, each ruled by its Darklord —
and every Darklord record carries a `tragedy` AND a `redemption`,
asserted, because a domain here is a moral arc with a door out,
not a slay-the-vampire arc. The gothic mechanics ride EXISTING
surfaces on purpose: the dread track is a VariantEncounter custom
track (band + thresholds + a gains table), composing with the
VariantRest sanity system at the 'breaking' rank without either
knowing the other exists; light-as-resource is the pure
`burnLight` helper whose empty pool costs dread; the dream
sequence in Bramblefell is an ordinary beat flagged `dream: true`
that Beats.validateBeat accepts unchanged. Bramblefell validates
deep and runs a full sitting in CI.)*

### `3.3.0`: Setting plugin contract — ✅ shipped as `3.3.0`

Formalises the pack shape that 3.0-3.2 each shipped ad-hoc.
`Setting.register({ regions, npcs, hooks, species, backgrounds,
items, monsters, spells, adventures })` with validation. Settings
become composable; a campaign can declare two settings active
simultaneously for crossover play.

*(As shipped: the `Settings` namespace — `validate` returns a
report (never throws, so a catalog UI can render it),
`register` gates with the full report in the throw, and
`compose(...packs)` merges N validated packs into ONE
createEngine options object. All three shipped settings validate
clean — the contract DESCRIBES them rather than prescribing at
them — and CI runs a Sundermark + Hollow Vale crossover engine
where both packs' adventures validate against the same merged
registries, plus the all-three grand mount. Cross-pack id
collisions throw with both owners named instead of silently
last-write-winning; composing the same pack twice is idempotent.)*

### `4.0.0`: AI prompt scaffolding — ✅ delivered in the client (`0.26.0`, `0.29.0`) + mcp (`0.12.0`)

*(The row's point was that the kernel never imports this — and the
client repo IS the host-side toolkit, so it lives there with the
boundary intact: templates per resolution kind whose user half
carries ONLY the engine's numbers, FNV cache keys over a stable
stringify, the parseable NARRATION_SCHEMA + parseNarration, and
adapters emitting request bodies for the three major API shapes
(`0.26.0`), plus the end-to-end `narrate()` loop with LRU cache
and one-shot repair pass (`0.29.0`). The MCP server carries the
sidecar slice: a narration-style guide and the `narration_prompt`
tool (`0.12.0`). This in-repo layout is SETTLED — the owner
decided against fragmenting code across more repositories, so no
standalone `@zeeuw/bag-of-holding-ai` package will be split out.)*

Structured templates that take the engine's deterministic output
and feed it to an LLM for narration. Provider-agnostic
(Anthropic / OpenAI / local). Lives in the client toolkit,
**never imported by the kernel**, preserving the boundary
contract.

- Prompt templates per resolution kind (attack hit, miss, crit,
  death-save fail, condition applied, scene transition).
- Provider adapters for the three major API shapes.
- Cache-key derivation so repeated identical resolutions hit the
  same narration (cost saver).
- Structured-output schemas so the AI's response is parseable
  before it reaches the player.

### `4.1.0`: Initiative-tracker reference UI — ✅ delivered in the client (`0.27.0`, `0.30.0`)

*(Same boundary logic: `<boh-initiative-tracker>` in the client —
a PURE view model (stable tie-breaks, clamped hp bars, downed-but-
listed combatants, wrap-bumped rounds) fully covered by node
tests, plus a custom element registered only where custom elements
exist, emitting advance-turn/select-combatant events upward
(`0.27.0`). The completeness pass (`0.30.0`) added baked
shadow-DOM styles with `::part()` hooks, a built-in next-turn
control, the `rollEncounterInitiative` kernel-shape adapter with
an injected engine-bound roll, and the `examples/initiative.html`
reference demo. This in-repo layout is SETTLED — per the owner's
no-fragmentation decision, no standalone `@zeeuw/bag-of-holding-ui`
package will be split out.)*

A tiny web component that consumes encounter state and renders a
turn UI. Reference example, not part of the engine: host-side,
optional, lives in the client toolkit outside the kernel per the
boundary contract.

### `4.2.0`: Localization layer — ✅ shipped as `3.4.0`

`Strings.t(key, lang)` shim for non-English condition labels,
class names, action verbs. Kernel stays English by default;
locale packs ship as separate plugins. Covers the localizable-
strings idea moved here from the old parking lot.

*(As shipped — out of roadmap order because it's additive API,
not the 4.0 major the row number implied. `DEFAULT_STRINGS` is
the complete English table over the rules vocabulary and CI
asserts completeness against the LIVE registries, so a new
condition or class fails a test instead of shipping untranslated.
Three-step lookup: locale → English → the key itself (unknown
keys stay visible and greppable). Partial locales are legal;
`missingIn(lang)` is the gap report a locale pack gates its own
CI on. Engines bind per-instance via `extraLocales`; the
module-level `Strings` is the English-only shim.)*

### `4.3.0`: Reference card generator — ✅ shipped as `3.5.0`

Generates printable PDFs from the engine's data: one-page combat
cheat-sheet, per-spell cards from the spell registry, per-class
feature cards. Pure data output (no rendering library bake-in);
the host runs the layout pass.

*(As shipped — additive API, so it takes a 3.x minor rather than
the row's aspirational 4.3.0. The `Cards` namespace emits ONE
Card shape across five kinds (spell/item/monster/class cards +
the combat cheat-sheet) so a host writes one layout pass. CI
proves the generators are TOTAL — a clean card for every record
in every shipped registry and pack, 300+ spells/items/monsters —
and that the cheat-sheet reads the LIVE rules: a gritty engine
(19-20 crits, DC 12 death saves, slow healing, 168-hour rests)
prints a gritty sheet. "PDF" stays the host's layout pass, per
the row's own no-bake-in boundary.)*

### `5.0.0`: Plugin manifest format — ✅ shipped as `3.6.0`

`bag-of-holding.json` shape third-parties publish content packs
against. Validation script gates against the plugin contract;
versioned schema so pack authors can pin to a kernel API range.

*(As shipped — additive API, so a 3.x minor. The `Manifest`
namespace: `validate` reports per-defect pointers (never throws —
catalog UIs render the report), `satisfies` implements the range
grammar (`^X.Y.Z` caret-major, `>=X.Y.Z` open floor,
`>=X.Y.Z <A.B.C` half-open window, exact) with garbage-in-false-
out in the loader path, and `matches` is the loader's red/green
with reasons. `Manifest.TABLES` maps every declarable table to
the engine option it mounts through — the 3.3.0 setting slots
plus the Phase A/B/C surfaces — and `manifestVersion` versions
the schema itself so the format can grow without stranding
published packs.)*

### `5.1.0`: Content index — ✅ shipped as `3.8.0`

A static site listing community plugin packs by setting / class /
theme. Search + categorise + screenshots. Built from the plugin
manifests. Covers the community-content-channel idea from the
old parking lot.

*(As shipped: `scripts/build-content-index.mjs` → the static
`/plugins.html` page on the Pages site, built FROM the 3.6.0
manifest format — the index dogfoods it. Every in-repo setting
pack gets a mechanically derived manifest (contribution counts
are the packs' real table sizes, asserted), each is validated
through `Manifest.validate` + `Settings.validate` and matched
against the generating kernel, and the page embeds the verdicts
and the full bag-of-holding.json per pack. A third-party pack
joins the index by publishing the same file. The generator exits
non-zero if any pack fails validation, so the index can't ship a
broken card. Search/screenshots deferred until there are
community packs to index.)*

### `5.2.0`: Conversion tools — ✅ shipped as `3.7.0`

5.1 → 5.2 character migrations, third-party SRD-OGL-compatible
content importers, save-format conversions across major kernel
versions.

*(As shipped — the `Convert` namespace. Importers map the common
third-party SRD-JSON family (snake_case fields, textual CRs like
'1/4', prose dice like '2d4 + 2', long ability names) onto kernel
records, and every guess is REPORTED in the result rather than
logged — CI proves an imported stat block mounts via
extraMonsters and fights through the real combat math, and an
imported spell casts through castSpell. `migrateCharacter` is the
migration seam with an EMPTY ledger by design: no breaking record
change has shipped as of 3.x (the 2.x→3.x majors were additive),
so it validates identity and passes through; a future breaking
change lands its migration here instead of in release notes.
`sessionFromJson` re-validates save snapshots and reports unknown
fields — preserved, never dropped.)*

### `5.3.0`: Documentation site — ✅ shipped as `3.9.0`

Generated from `index.d.ts` doc comments + the recipes + a
tutorial path. Replaces the deferred TypeDoc site from `1.0.0`'s
"deferred to post-1.0" promise.

*(As shipped: `scripts/build-docs.mjs` → the static `/docs.html`
page — 219 declarations across 22 sections parsed straight from
index.d.ts (no TypeDoc; zero deps), grouped by the file's own
section banners, doc comments extracted, plus the full recipe
cookbook rendered through a dependency-free markdown pass. The
coverage test makes the doc site an API-HONESTY GATE, not a
best-effort artifact: every `export const/function` in index.d.ts
must surface in the reference or CI fails. The page is fully
static and version-stamped by its generating kernel.)*

## Post-SRD ideas (no commitment)

Remaining ideas that aren't yet on the planned track. These move
into a numbered milestone when a real consumer drives priority.

- **Code splitting.** Separate entry points for
  `bag-of-holding/srd` (data only) and `bag-of-holding/engine`
  (math only), so a tiny app that only needs dice + checks can
  ship < 5 kB.
- **Optional rules variants beyond `2.9`/`2.10`/`2.11`:**
  herbalism, alchemy-as-mechanic, plotting / web-of-influence
  tracking, mass-combat rules.
- **Procedural dungeon scaffolding.** Room graphs, door / trap
  data, encounter slot generator. Useful for both solo play and
  AI-DM hosts; defer until the bestiary depth supports it.

## What we will deliberately *not* build

These no-build constraints apply to the **engine kernel**. The
host-side surfaces the `4.0.0` / `4.1.0` rows delivered live in
the client and MCP repos and carry their own scope; the kernel
stays clean per the [boundary contract](boundary.md).

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
