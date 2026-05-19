# Rules spec

What `bag-of-holding` covers, intentionally narrow. Targets the
**SRD 5.2** (Wizards of the Coast, 2025, [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/));
ships paraphrased mechanics, no copyrighted text. The full SRD is
freely available at [dndbeyond.com/srd](https://www.dndbeyond.com/srd).

## In scope

- **Six ability scores** (STR, DEX, CON, INT, WIS, CHA). `Checks.modFromScore`
  computes the `(score − 10) / 2` modifier.
- **Proficiency bonus** by level (`XP.PROFICIENCY_BY_LEVEL`). Tier 1: +2 at
  levels 1–4, +3 at level 5.
- **d20 checks, saves, attack rolls**. `Checks.abilityCheck`,
  `Checks.savingThrow`, `Combat.attackRoll`. DCs are clamped to `[5, 25]` so
  callers can't gate progress with absurd values.
- **Crit / fumble** on attack rolls only (natural 20 always hits, natural 1
  always misses). Checks have no crit semantics.
- **Damage dice** parsing (`Dice.parse`, `Dice.roll`) for `'XdY±Z'` specs.
  Crit doubles the dice (`Combat.damageRoll` with `critical: true`).
- **Advantage / disadvantage** (`Dice.rollAdvantage`, `Dice.rollDisadvantage`).
- **Conditions** — the SRD 5.2 condition list (`Conditions.CONDITIONS`)
  plus immutable apply / remove / has helpers. **Exhaustion** is
  modelled separately as a 0–6 numeric scale per SRD 5.2 (−2 per level
  on D20 Tests, −5 ft Speed per level, death at 6); see
  `Conditions.exhaustion`.
- **Initiative** (`Combat.rollInitiative`) — d20 + DEX mod.
- **Weapon Mastery** — every weapon carries one of eight mastery
  properties (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex).
  `Combat.applyMastery(weapon, target, attackResult)` returns the
  property-specific rider effect. Usable only by characters with a
  feature that unlocks it (Fighter L1, etc.).
- **Classes** — Fighter, Rogue, Cleric, Wizard at levels 1–5. Fighter
  carries the SRD 5.2 L1 Weapon Mastery (3 weapons), L2 Tactical Mind,
  and L5 Tactical Shift in addition to its older features.
- **Backgrounds** — the four SRD 5.2 backgrounds (Acolyte, Criminal,
  Sage, Soldier), each granting skill proficiencies, a tool proficiency,
  three ability bumps, and a specified Origin Feat. Backgrounds, not
  species, are where ability score increases come from in 5.2.
- **Origin Feats** — Magic Initiate, Alert, Savage Attacker
  (the three feats used by the four shipped backgrounds). Magic
  Initiate carries a `variant` of `cleric` / `wizard` / `druid` chosen
  at selection.
- **Milestone XP** (`XP.awardMilestone`) keyed off a beat's
  `targetPlaytimeMinutes`. Level thresholds match the basic rules.
- **Movesets** (`Movesets.legal`) — placeholder shape: returns the legal
  action chips for a `(pc, scene)` pair. Will grow per-class as needed.
- **SRD data** — small starter sets of species, spells, items, and
  backgrounds in `src/srd/*`. The `species` schema follows SRD 5.2:
  size + speed + traits, no ability score bonuses (those are on
  backgrounds).

## Out of scope

- The 8 classes not yet implemented (Barbarian, Bard, Druid, Monk,
  Paladin, Ranger, Sorcerer, Warlock) and all subclasses past the L3
  placeholder.
- Multiclassing.
- Levels 6+.
- Feats beyond the three Origin Feats above — General Feats, Fighting
  Style Feats, Epic Boon Feats are deferred.
- Encumbrance arithmetic, crafting, downtime, mass combat.
- Detailed spell economy beyond the starter set in `src/srd/spells.js`.
- Monster stat blocks (world-gen invents creatures; engine doesn't ship
  the SRD bestiary).
- Gameplay-toolbox content (Travel Pace, Curses, Mental Stress, Traps,
  etc.) — Narrator-side, not engine.
- Party management (the engine works on one PC at a time; the app
  composes parties).
- Any narration, prose, or AI call. See [boundary.md](boundary.md).

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
| `Movesets` | `src/movesets.js` |
| `Beats` | `src/beats/index.js` |
| `SRD` | `src/srd/index.js` |

`Classes` is exported as a back-compat alias for `SRD.classes`.

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

The default singleton is just `createEngine()` with no opts — same surface, same shape. Two engines on the same page have independent registries; the default isn't contaminated by anything a custom engine contributes.

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

**Plugin handler shape.** A mastery handler is a pure function `(weapon, target, attackResult, attacker) → MasteryRider`. The rider object describes the consequence (`{ kind: 'pin', ... }`); the game loop turns that into a state delta and a piece of prose. Handlers must be pure — same inputs, same output — so the engine stays replay-deterministic.

**What's _not_ in Phase A.** Custom crit thresholds, exploding dice, alternate XP curves, and other rule modifications belong to Phase B (deferred). Behavioural hooks (`beforeAttack`, `afterDamage`, `onLevelUp`) belong to Phase C (also deferred). Both phases will land when a real consumer demands them; speculative API design here would lock in shapes that turn out wrong.

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

Default algorithm is **Mulberry32** — small, well-studied, plenty
good for game RNG (not cryptographically secure). Same-seed
sequences are part of the public contract: pinned tests in
`tests/rng.test.js` lock specific outputs so any drift in the
algorithm fails CI loudly.

Each rolling function also accepts an optional `rng` parameter
directly (module-level call), so consumers can use the rolling
math without an engine if they want — e.g., a standalone dice
roller widget.

### The roll log

Every roll the engine produces appends an entry to
`engine.rollLog`:

```js
engine.Dice.rollDie(20);                // → 13
engine.rollLog[0];                      // → { index: 0, op: 'rollDie', sides: 20, value: 13 }
```

One entry per _operation_ (not per individual die — `roll('3d6+2')`
is one entry with its three rolls baked in). The `index` field is
monotonic across the full session; entries that fall off the
configurable `rollLogCap` keep their original indexes.

Optional `onRoll(entry)` callback fires immediately after each
entry is appended — useful for live debug overlays, telemetry, or
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
corruption across saves. Unknown ops throw loudly — a forwards-
incompatible log shouldn't silently pass verification.
