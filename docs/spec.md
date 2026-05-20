# Rules spec

What `bag-of-holding` covers, intentionally narrow. Targets the
**SRD 5.2** (Wizards of the Coast, 2025, [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/));
ships paraphrased mechanics, no copyrighted text. The full SRD is
freely available at [dndbeyond.com/srd](https://www.dndbeyond.com/srd).

## In scope

- **Six ability scores** (STR, DEX, CON, INT, WIS, CHA). `Checks.modFromScore`
  computes the `(score − 10) / 2` modifier.
- **Proficiency bonus** by level (`XP.PROFICIENCY_BY_LEVEL`), L1 to L20.
- **d20 checks, saves, attack rolls**. `Checks.abilityCheck`,
  `Checks.savingThrow`, `Combat.attackRoll`. DCs are clamped to `[5, 30]`
  (Very Easy to Nearly Impossible per SRD 5.2).
- **Crit / fumble** on attack rolls only (natural 20 always hits, natural 1
  always misses). Checks have no crit semantics.
- **Damage dice** parsing (`Dice.parse`, `Dice.roll`) for `'XdY±Z'` specs.
  Crit doubles the dice (`Combat.damageRoll` with `critical: true`).
- **Advantage / disadvantage** (`Dice.rollAdvantage`, `Dice.rollDisadvantage`).
- **Conditions**, the SRD 5.2 condition list (`Conditions.CONDITIONS`)
  plus immutable apply / remove / has helpers. **Exhaustion** is
  modelled separately as a 0 to 6 numeric scale per SRD 5.2 (−2 per level
  on D20 Tests, −5 ft Speed per level, death at 6); see
  `Conditions.exhaustion`.
- **Initiative** (`Combat.rollInitiative`), d20 + DEX mod.
- **Weapon Mastery**, every weapon carries one of eight mastery
  properties (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex).
  `Combat.applyMastery(weapon, target, attackResult)` returns the
  property-specific rider effect. Usable only by characters with a
  feature that unlocks it (Fighter L1, etc.).
- **All 12 SRD classes** (Barbarian, Bard, Cleric, Druid, Fighter,
  Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard) through
  the tier-2 features (L1 to L10), each shipping a `resources` map
  and a `mechanics` dispatch table for class-specific actions
  (Action Surge, Channel Divinity, Wild Shape, ...). Tier 3 and tier
  4 (L11 to L20) on roadmap. See [roadmap.md](roadmap.md).
- **Multiclassing.** Prerequisite checking, `casterLevel` formula
  with the SRD 5.2 caster-weight table (Warlock excluded; Pact Magic
  tracks separately). See `Multiclass` namespace.
- **Backgrounds**, the four SRD 5.2 backgrounds (Acolyte, Criminal,
  Sage, Soldier), each granting skill proficiencies, a tool proficiency,
  three ability bumps, and a specified Origin Feat. Backgrounds, not
  species, are where ability score increases come from in 5.2.
- **Origin Feats**, Magic Initiate, Alert, Savage Attacker
  (the three feats used by the four shipped backgrounds). Magic
  Initiate carries a `variant` of `cleric` / `wizard` / `druid` chosen
  at selection.
- **Milestone XP** (`XP.awardMilestone`) keyed off a beat's
  `targetPlaytimeMinutes`. Level thresholds match the SRD 5.2 table.
- **Movesets** (`Movesets.legal`), returns the legal action chips
  for a `(pc, scene)` pair, including class-mechanic-driven actions
  surfaced by `Mechanics.actionsFor(actor)`.
- **Combat actions menu.** Attack, Cast, Dash, Disengage, Dodge,
  Help, Hide, Ready, Search/Study/Influence, Grapple, Shove,
  Two-Weapon Fighting, Improvised. Each verb spends action budget
  and reports the resulting state mutation. See `Combat` namespace.
- **Damage pipeline.** Immunity → Resistance → Vulnerability →
  tempHp → HP → dropToZero → death saves, applied through
  `Combat.applyDamage` and `Combat.deathSave`.
- **Rest** (`Rest.shortRest`, `Rest.longRest`, `Rest.spendHitDie`).
  Refills slot/resource arrays by their `refreshes` field.
- **Spellcasting** (`Spellcasting.freshSlots`, `consumeSlot`,
  `refillSlots`, `castSpell`, AoE helpers, save-for-half). One
  leveled-spell-per-turn rule enforced.
- **Magic items** (`MagicItems.attune`, `unattune`, `consumeCharge`,
  `rechargeItem`). Attunement cap, cursed-item bookkeeping,
  charge-recovery dice.
- **Monsters** (`engine.monsters` registry). Multiattack helpers,
  legendary action budgets, lair-action timing. SRD bestiary subset
  shipped.
- **Movement** (`Movement.consume`, mode-aware speed: walk, climb,
  swim, fly, burrow; falling damage; vision-mode helpers).
- **Encounter design** (`EncounterDesign.xpForCR`,
  `classifyEncounter`).
- **Inspiration** (Heroic Inspiration with Halfling Lucky stacking
  and group-check helpers).
- **Scene clock** (`SceneClock.advanceTime` with dawn/dusk events).
- **Character sheet derivation** (`Character.deriveSheet`, also bound
  as `engine.deriveSheet`), turns a host-owned `CharacterRecord`
  into a frozen `DerivedSheet`: ability mods, prof bonus, AC with
  breakdown, HP, saves, skills (with expertise), attacks, spellcasting
  attack/DC, passives, speed (post-exhaustion + speed-zero conditions),
  carrying capacity. See [character-sheet.md](character-sheet.md) for
  the full schema and the worked example.
- **Determinism, audit, and replay** (since `0.1.0`),
  `Dice.seededRng(seed)` returns a `Math.random`-shaped deterministic
  generator; every engine-bound rolling function appends a structured
  entry to `engine.rollLog` with an optional caller-supplied `context`
  for trace-back; `verifyLog({ seed, log, rules? })` re-executes a
  session and reports the first divergence. See [§ Determinism](#determinism).
- **Rule modifications** (since `0.2.0`, plugin Phase B), every
  engine takes an optional `rules` object that retunes the math:
  `critOn` / `fumbleOn` (d20 face arrays), `damageFloor` (minimum
  damage on hit), `explodingDamageDice` (max-on-die chain), and
  `xpThresholds` / `proficiencyByLevel` (override progression
  curves). Defaults preserve SRD 5.2 exactly; the merged frozen
  object is exposed on `engine.rules`. See
  [§ Plugins (Phase B: rule modifications)](#plugins-phase-b-rule-modifications).
- **Hooks** (Phase C + Phase D), behavioural and lifecycle events
  fire on attack, damage, condition apply, level up, death, turn
  start/end, rest, cast, hp change. See
  [§ Plugins (Phase C: behavioural hooks)](#plugins-phase-c-behavioural-hooks).

## Out of scope (deferred or host-side)

- **Subclasses** beyond the L3 placeholder. Subclass handler maps
  land in the 1.21 milestone; see [roadmap.md](roadmap.md).
- **Tier 3 and tier 4 class features** (L11 to L20). On roadmap,
  shipping piecewise.
- **General Feats, Fighting Style Feats, Epic Boon Feats**, beyond
  the three Origin Feats already shipped. Deferred.
- **Encumbrance arithmetic, crafting, downtime, mass combat.**
- **Gameplay-toolbox content** (Travel Pace, Curses, Mental Stress,
  Traps, etc.), narrator-side, not engine.
- **Party management.** The engine works on one PC at a time; the
  host composes parties.
- **Any narration, prose, or AI call.** See [boundary.md](boundary.md).

## The beat runtime

See [beat-schema.md](beat-schema.md) for the full story-beat shape and
runtime. Headline: linear walking at v1, branching-ready schema for v2.

## API surface

Two consumption modes, same shape underneath.

### Default singleton (single-engine apps)

```js
import { Dice, Checks, Combat, Conditions, XP, Movesets, Beats, SRD } from '@zeeuw/bag-of-holding';
Combat.attackRoll({ attackBonus: 5, ac: 15 });
SRD.species.dragonborn;
```

| Namespace | Module |
| --- | --- |
| `Dice` | `src/dice.js` |
| `Checks` | `src/checks.js` |
| `Combat` | `src/combat.js` |
| `Conditions` | `src/conditions.js` |
| `XP` | `src/xp.js` |
| `Spellcasting` | `src/spellcasting.js` |
| `Rest` | `src/rest.js` |
| `Mechanics` | `src/mechanics.js` |
| `SceneClock` | `src/scene-clock.js` |
| `MagicItems` | `src/magic-items.js` |
| `Monsters` | `src/monsters.js` |
| `Movement` | `src/movement.js` |
| `Multiclass` | `src/multiclass.js` |
| `Inspiration` | `src/inspiration.js` |
| `EncounterDesign` | `src/encounter-design.js` |
| `Movesets` | `src/movesets.js` |
| `Beats` | `src/beats/index.js` |
| `Character` | `src/character.js` |
| `SRD` | `src/srd/index.js` |

`Classes` is exported as a back-compat alias for `SRD.classes`.

`Character.deriveSheet(record, registries)` is also exposed as
`engine.deriveSheet(record)` for the common single-engine case, same
function, with the engine's registries pre-bound. See
[character-sheet.md](character-sheet.md).

### `createEngine(opts)` (custom rule sets, plugins)

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  extraSpecies: { 'half-elf': { id: 'half-elf', name: 'Half-Elf', size: 'medium', speed: 30, traits: ['Adaptable'] } },
  extraConditions: ['cursed'],
  extraMastery: {
    pin: (weapon, target, result) =>
      result.hit ? { kind: 'pin', condition: 'grappled', duration: '1 turn' } : { kind: 'none' }
  }
});

engine.Combat.applyMastery({ mastery: 'pin' }, target, attackResult);
engine.Conditions.apply(actor, 'cursed');
engine.species['half-elf'];
```

The default singleton is just `createEngine()` with no opts, same surface, same shape. Two engines on the same page have independent registries; the default isn't contaminated by anything a custom engine contributes.

## Plugins (Phase A: content extension)

The engine factory accepts content contributions through `EngineOptions`. Each contribution is validated at construction time so a malformed plugin fails loud, not at first use.

| Option | Shape | What it extends |
| --- | --- | --- |
| `extraSpecies` | `Record<id, Species>` | The species registry |
| `extraClasses` | `Record<id, ClassDef>` | The class registry |
| `extraBackgrounds` | `Record<id, Background>` | The background registry |
| `extraFeats` | `Record<id, Feat>` | The feat registry |
| `extraSpells` | `Record<id, Spell>` | The spell registry |
| `extraItems` | `Record<id, Item>` | The item registry |
| `extraConditions` | `string[]` | The boolean condition vocabulary |
| `extraMastery` | `Record<name, MasteryHandler>` | The weapon mastery handler table |

**Merge semantics.** Last-write-wins on id collision. A plugin that re-declares `species.elf` replaces the SRD entry, which is how "rebalanced" or "themed" packs work (e.g. a grimdark theme might ship harsher versions of the base species).

**Validation.** Each contributed record is checked for required fields (e.g. species need `id`, `name`, `size`, `speed`); each mastery handler is checked to be a function. Errors point at the offending registry and id (`Plugin contribution species.half-elf missing required field: name`).

**Plugin handler shape.** A mastery handler is a pure function `(weapon, target, attackResult, attacker) → MasteryRider`. The rider object describes the consequence (`{ kind: 'pin', ... }`); the game loop turns that into a state delta and a piece of prose. Handlers must be pure, same inputs, same output, so the engine stays replay-deterministic.

## Plugins (Phase B: rule modifications)

Phase B lets a plugin retune the engine's *math*, crit ranges,
damage floors, exploding dice, XP and proficiency curves, without
forking the engine. Every knob has a default that preserves the
SRD 5.2 baseline exactly; opting in is per-knob, no all-or-nothing.

```js
const engine = createEngine({
  rules: {
    critOn: [19, 20],            // Pathfinder-style crit range
    damageFloor: 0,              // negative mods can fully cancel
    explodingDamageDice: true,   // savage-worlds-flavoured damage
    xpThresholds: { 1: 0, 2: 1000, 3: 5000, 4: 15000, 5: 35000 }
  }
});
```

| Knob | Type | Default | Effect |
| --- | --- | --- | --- |
| `critOn` | `number[]` | `[20]` | d20 faces that count as critical hits. |
| `fumbleOn` | `number[]` | `[1]` | d20 faces that count as fumbles. |
| `damageFloor` | `number` | `1` | Minimum damage on a successful hit. |
| `explodingDamageDice` | `boolean` | `false` | If a damage die rolls max, roll again and add. Affects base and crit dice. |
| `xpThresholds` | `Record<number, number>` \| `null` | `null` (SRD) | Override progression curve. |
| `proficiencyByLevel` | `Record<number, number>` \| `null` | `null` (SRD) | Override proficiency-bonus table. |

**Validation** is at construction time: each knob is checked for
shape and range, with errors pointing at the specific offending
field (`rules.critOn must be an array of integers in [1, 20]`). A
malformed `rules` object fails the engine factory immediately, not
silently at first roll.

**Introspection.** The merged, frozen rules object is exposed on
`engine.rules` so hosts can render which pack is loaded
(`engine.rules.critOn` for a Nerd-mode badge, etc.).

**Replay with custom rules.** `verifyLog` accepts an optional
`rules` parameter, same one used by the producing engine. A log
produced under custom rules will diverge when replayed against
the defaults; that's correct behaviour, not a bug.

## Plugins (Phase C: behavioural hooks)

Since `0.3.0`. Plugins react to engine events by registering handlers
on a small, closed set of hook names:

- `beforeAttack`, fires before the d20 is rolled. Handlers receive
  `{ attackBonus, ac, context }` and can return `{ ac, attackBonus }`
  deltas (Shield spell adds 5 to AC, blur halves attack bonus) or
  `{ cancelled: true }` to short-circuit (the attack resolves as a
  miss without rolling).
- `afterDamage`, fires once damage is rolled. Handlers receive the
  `DamageRollResult` plus `context` and can return `{ total }` to
  apply resistance (`Math.floor(total/2)`), vulnerability
  (`total*2`), or any flat absorption (Heavy Armor Master).
- `onLevelUp`, fires from `XP.awardMilestone` when the new XP total
  crosses a threshold. Handlers receive `{ pc, fromLevel, toLevel,
  xpDelta, newTotal }`. Read-only: the host owns the persistent PC
  record and applies the level-up itself.
- `onConditionApplied`, fires after `Conditions.apply` returns the
  new actor. Handlers receive `{ actor, condition, previous }`.
- `onDeath`, fires when `Conditions.exhaustion.gain`/`set` pushes
  the actor to level 6 (the death threshold) for the first time.
  Handlers receive `{ actor, cause, previous }`. The host can also
  fire this hook directly (`engine.hooks.fire('onDeath', payload)`)
  for non-exhaustion deaths it detects.

Handlers run **in registration order**, and each return is
`Object.assign`-merged into the payload before the next handler
sees it. This makes hooks compose: a `beforeAttack` from one
plugin can raise AC, and a second can read the raised AC and
decide whether to add disadvantage on top.

```js
const engine = createEngine({
  hooks: {
    beforeAttack: ({ ac }) => ({ ac: ac + 5 }),   // Shield
    afterDamage: ({ total }) => ({ total: Math.floor(total / 2) }) // resistance
  }
});
```

Handlers must be pure, no async, no mutation of other actors, no
I/O, so the engine stays replay-deterministic. Throwing in a
handler propagates to the caller (the engine doesn't swallow it).

## Types (`index.d.ts`)

Hand-maintained TypeScript declarations ship alongside `index.js`. The `npm run typecheck` script runs `tsc --noEmit` against `index.d.ts` + `tests/types/index.types.ts`. The smoke test imports every public export and exercises the common usage patterns, plus two `@ts-expect-error` negative cases that lock the strictness gate. When you change a public export, update both `index.d.ts` and the smoke test in the same commit.

## Determinism

The engine's stochastic surface is **forensically inspectable** from
0.1.0 onward. Same seed → same sequence of rolls, every roll
captured in an audit log, every operation re-verifiable.

### Seeding the RNG

`Dice.seededRng(seed)` returns a function with the same `() => [0, 1)`
signature as `Math.random`. Pass it to `createEngine` and every
rolling function becomes deterministic:

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({ rng: Dice.seededRng(42) });
engine.Combat.attackRoll({ attackBonus: 5, ac: 14 });
// Two engines with the same seed produce identical results.
```

Default algorithm is **Mulberry32**, small, well-studied, plenty
good for game RNG (not cryptographically secure). Same-seed
sequences are part of the public contract: pinned tests in
`tests/rng.test.js` lock specific outputs so any drift in the
algorithm fails CI loudly.

Each rolling function also accepts an optional `rng` parameter
directly (module-level call), so consumers can use the rolling
math without an engine if they want, e.g., a standalone dice
roller widget.

### The roll log

Every roll the engine produces appends an entry to
`engine.rollLog`:

```js
engine.Dice.rollDie(20);                // → 13
engine.rollLog[0];                      // → { index: 0, op: 'rollDie', sides: 20, value: 13 }
```

One entry per *operation* (not per individual die, `roll('3d6+2')`
is one entry with its three rolls baked in). The `index` field is
monotonic across the full session; entries that fall off the
configurable `rollLogCap` keep their original indexes.

Optional `onRoll(entry)` callback fires immediately after each
entry is appended, useful for live debug overlays, telemetry, or
piping rolls into Spektrum history.

### Context tags for trace-back

Every rolling function on the engine accepts an optional `context`
second argument (string or object) that lands on the entry:

```js
engine.Combat.attackRoll({ attackBonus: 5, ac: 14 }, 'turn 14 vs orc');
engine.Checks.savingThrow({ abilityScore: 14, dc: 12 }, { actor: 'pc.danny', why: 'poison cloud' });
```

The context exists for the human reading the log later. The engine
doesn't introspect it; it just attaches and forgets.

### Replay verification

`verifyLog({ seed, log })` walks a recorded log forward from `seed`
and reports the first divergence. Available as both a top-level
export and an `engine.verifyLog` method (they're the same function).

```js
import { verifyLog } from '@zeeuw/bag-of-holding';

const result = verifyLog({ seed: 42, log: engine.rollLog });
if (!result.ok) {
  console.error(`Log diverged at index ${result.divergedAt}`);
}
```

Returns `{ ok: true }` on clean replay or
`{ ok: false, divergedAt, expected, actual }` on the first
disagreement. Useful for catching regressions, AI hallucinations
claiming the engine rolled something it didn't, and state
corruption across saves. Unknown ops throw loudly, a forwards-
incompatible log shouldn't silently pass verification.
