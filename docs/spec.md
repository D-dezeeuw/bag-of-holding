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

Dice use `Math.random` at v0. The engine does **not** ship a seedable RNG
yet — when the app needs reproducibility (world generation, replay) it
should provide its own seedable RNG and pass it through. A seedable
backend is a probable v0.1 addition.
