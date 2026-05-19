# Character sheets

`bag-of-holding` is a calculator, not a database. The host
(Dungeons-and-Dans, a homebrew shell, a CLI tool) owns the persistent
character — the thing you save to `.dnd.json`, undo, share. The engine
turns that record into every number you'd draw on a paper sheet.

> The math is the engine. The host owns the prose, the persistence,
> and the AI loop. See [boundary.md](./boundary.md).

This page is the contract for that boundary: the two shapes, the rule
that connects them, and a worked example you can hand-verify.

## The split

```
host owns                              engine owns
───────────                            ───────────
CharacterRecord     ──deriveSheet──▶   DerivedSheet
(inputs, mutable)                      (outputs, frozen)
   .dnd.json                           recomputed on demand
```

**Inputs (CharacterRecord)** are the things the player picks or rolls:
class, level, ability scores, equipped items, applied conditions, XP.
The host persists this. Nothing the engine computes ever lands back on
this record — if the player swaps a sword, the host updates
`equipment.weaponIds` and asks the engine to derive again.

**Outputs (DerivedSheet)** are every number you'd read off a paper
sheet: ability modifiers, AC with its breakdown, attack lines, save
mods, skill mods, passive scores, speed, carrying capacity. The
returned object is `Object.freeze`d so a caller that tries to patch a
field gets a loud error rather than a silently stale sheet.

## Why no mutation API

There is no `engine.setAbilityScore(record, ability, n)`. The host
owns the record; mutating it is a one-line update in the host's save
layer. Putting an engine-side mutation API in the middle would be a
second source of truth — exactly the problem the boundary rule in
[boundary.md](./boundary.md) exists to prevent.

The level-up flow, the equip-an-item flow, the "AI narrated a
level-up" flow — all of those are host concerns. They update the
record, then call `deriveSheet` again to get the new numbers. Same
pattern as a spreadsheet: cells store formulas (the record), and the
sheet view (the derived sheet) is recomputed when anything changes.

## CharacterRecord (host-owned, stored verbatim)

```ts
interface CharacterRecord {
  id: string;
  name: string;

  // Identity — looked up against the engine's registries.
  speciesId: string;
  backgroundId: string;
  classId: string;
  subclassId?: string;           // null until level 3 (SRD 5.2)
  level: number;                 // 1–5 in v0; engine roadmap 0.9 lifts the cap

  // Six ability scores, *base* (rolled or point-buy). Background
  // bumps are NOT folded in here — the engine applies them so that a
  // background swap doesn't double-apply.
  abilityScores: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };

  // The player's distribution of the background's three ability
  // bumps. SRD 5.2 allows either {+2, +1, 0} or {+1, +1, +1}; this
  // field records what they picked. If omitted, the engine applies
  // +1 to each listed ability (the always-valid default).
  abilityScoreBumps?: { str?: number; dex?: number; con?: number;
                        int?: number; wis?: number; cha?: number; };

  // HP per level, in roll order. Optional: if absent or short, the
  // engine averages out the missing levels using the class hit die.
  // hpRolled[0] is L1 (max die, by SRD convention); hpRolled[1] is
  // the L2 roll; etc.
  hpRolled?: number[];

  // What the character has on. References into the engine's items
  // registry — the engine resolves names, damage dice, and AC.
  equipment: {
    armorId?: string;            // single armor slot
    shieldId?: string;           // single shield slot
    weaponIds: string[];         // each becomes an attack line
    otherItemIds?: string[];     // potions, focuses, etc.
  };

  // Explicit proficiencies on top of what class + background grant.
  // Most PCs don't need this — derivation already accumulates the
  // class's save profs and the background's skill profs. Use this
  // field for ASI feats that grant a new skill, multiclass
  // contributions, or homebrew.
  proficiencies?: {
    skills?: string[];           // skill IDs (see SKILLS table below)
    tools?: string[];
    languages?: string[];
    saves?: ('str'|'dex'|'con'|'int'|'wis'|'cha')[];
    expertise?: string[];        // skill IDs that double proficiency
  };

  // Feats the character has taken. The origin feat from the
  // background is implicit (the engine reads background.originFeat),
  // but listing it explicitly is allowed and idempotent.
  feats?: Array<{ id: string; variant?: string }>;

  // Boolean conditions currently applied. Use the engine's
  // Conditions.apply/remove to mutate, not direct array push.
  conditions?: ConditionName[];

  // 0–6 per SRD 5.2.
  exhaustion?: number;

  // Spell loadout for casters. Slot tracking arrives with 0.5.0;
  // until then this is just a hand-off field the host can persist.
  spells?: {
    known?: string[];
    prepared?: string[];
    slots?: Array<{ level: number; used: number; max: number }>;
  };

  // Progression bookkeeping.
  xp?: number;

  // Free-form host state. The engine never reads this.
  notes?: string;
}
```

## DerivedSheet (engine-computed, frozen)

```ts
interface DerivedSheet {
  // Stamped so a serialised sheet declares its origin. Useful for
  // host-side migration when the engine bumps a major version.
  meta: {
    source: 'bag-of-holding/character@1';
    speciesId: string;
    classId: string;
    subclassId?: string;
    level: number;
  };

  // Six ability scores after background bumps + feat grants, plus
  // the corresponding (score - 10) / 2 modifier.
  abilityScores: {
    final:  { str: number; dex: number; con: number;
              int: number; wis: number; cha: number; };
    mod:    { str: number; dex: number; con: number;
              int: number; wis: number; cha: number; };
  };

  proficiencyBonus: number;

  // Max HP from the class hit die, the CON mod per level, and any
  // explicit hpRolled entries. `current` and `temp` are passthrough
  // hooks for the host (the engine doesn't track current state).
  hp: { max: number };

  // AC + breakdown so a UI can render "13 (chain shirt +1 DEX cap +2
  // shield)" without re-deriving. `misc` is for feat / spell bonuses
  // not yet wired in v0.
  ac: {
    value: number;
    breakdown: { armor: number; shield: number; dex: number; misc: number };
  };

  // d20 + initiative modifier. Alert grants proficiency (added in).
  initiative: number;

  // Post-condition. Restrained, Grappled, Paralyzed, Petrified,
  // Stunned, and Unconscious all set speed to 0; Exhaustion subtracts
  // 5 ft per level.
  speed: { walk: number };

  // Per-ability save lines.
  saves: {
    str: { mod: number; proficient: boolean };
    dex: { mod: number; proficient: boolean };
    con: { mod: number; proficient: boolean };
    int: { mod: number; proficient: boolean };
    wis: { mod: number; proficient: boolean };
    cha: { mod: number; proficient: boolean };
  };

  // Per-skill lines. `expertise` doubles the proficiency portion
  // (Rogue's Expertise, Bard's Expertise).
  skills: Record<SkillId, {
    ability: 'str'|'dex'|'con'|'int'|'wis'|'cha';
    mod: number;
    proficient: boolean;
    expertise: boolean;
  }>;

  // One line per equipped weapon. `masteryProperty` is the SRD 5.2
  // mastery name (only meaningful for classes with the feature; the
  // host decides whether to surface it).
  attacks: Array<{
    weaponId: string;
    name: string;
    attackBonus: number;
    damageDice: string;          // 'XdY' as on the weapon record
    damageMod: number;
    damageType?: string;
    masteryProperty?: string;
    properties?: string[];
  }>;

  // Caster classes only. `null` for non-casters so the UI can
  // discriminate without a `hasOwnProperty` check.
  spellcasting: null | {
    ability: 'str'|'dex'|'con'|'int'|'wis'|'cha';
    attackBonus: number;
    saveDC: number;
  };

  // 10 + skill mod, for the three skills the loop reads passively.
  passives: { perception: number; insight: number; investigation: number };

  // SRD 5.2 baseline: 15 lbs per STR, scaled by size.
  carryingCapacity: { capacity: number; push: number; lift: number };

  // What's currently shaping the math above. Useful for the UI's
  // "active effects" rail.
  activeEffects: {
    conditions: ConditionName[];
    exhaustion: number;
  };
}
```

## Skills table

The 18 SRD 5.2 skills and their governing ability. The IDs here are
the canonical strings used in `proficiencies.skills` and
`background.skillProficiencies`.

| Skill | Ability | Skill | Ability |
| --- | --- | --- | --- |
| `acrobatics` | DEX | `medicine` | WIS |
| `animal-handling` | WIS | `nature` | INT |
| `arcana` | INT | `perception` | WIS |
| `athletics` | STR | `performance` | CHA |
| `deception` | CHA | `persuasion` | CHA |
| `history` | INT | `religion` | INT |
| `insight` | WIS | `sleight-of-hand` | DEX |
| `intimidation` | CHA | `stealth` | DEX |
| `investigation` | INT | `survival` | WIS |

## API

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const sheet = engine.deriveSheet(record);

// Or, module-level — engine is passed explicitly:
import { Character } from '@zeeuw/bag-of-holding';
const sheet2 = Character.deriveSheet(record, engine);
```

Validation throws with the same pointer-quality as the engine's
plugin validator:

```
Error: CharacterRecord.classId 'paladin' not registered with engine
Error: CharacterRecord.abilityScores.str missing or non-integer
Error: CharacterRecord.equipment.armorId 'plate' not registered with engine
```

## Worked example

A level-3 human Fighter with the Soldier background, even-bump
distribution, longsword + shield, chain shirt.

**Input:**

```js
const record = {
  id: 'pc-1',
  name: 'Aldwin',
  speciesId: 'human',
  backgroundId: 'soldier',     // grants +1 str/+1 dex/+1 con (even)
  classId: 'fighter',
  level: 3,
  abilityScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  equipment: {
    armorId: 'chain-shirt',
    shieldId: 'shield',
    weaponIds: ['longsword']
  }
};
```

**Derivation, step by step:**

1. **Background bumps.** Soldier grants `['str','dex','con']`. With no
   `abilityScoreBumps`, the engine applies +1 to each:
   STR 15→16, DEX 13→14, CON 14→15.
2. **Modifiers.** STR +3, DEX +2, CON +2, INT +0, WIS +1, CHA −1.
3. **Proficiency bonus.** L3 → +2.
4. **HP.** Fighter hit die d10. L1 = 10 + CON(+2) = 12.
   L2 + L3 default to averaged HP per level (= 6) + CON(+2) each:
   12 + (6+2) + (6+2) = 28.
5. **AC.** Chain shirt 13 + min(DEX +2, max-2) = 15, + shield +2 = **17**.
6. **Initiative.** +DEX = **+2**.
7. **Speed.** Human 30, no exhaustion, no movement-cancelling
   condition → **30**.
8. **Saves.** Fighter has proficiency in STR & CON.
   STR save: +3 (mod) + 2 (prof) = **+5**.
   CON save: +2 (mod) + 2 (prof) = **+4**.
   Other saves: mod only (DEX +2, INT +0, WIS +1, CHA −1).
9. **Skills.** Soldier grants `athletics` (STR) and `intimidation` (CHA).
   Athletics: +3 + 2 = **+5**. Intimidation: −1 + 2 = **+1**.
   All other skills: ability mod only.
10. **Attacks.** Longsword (STR-based, not finesse). Attack: STR(+3) +
    prof(+2) = **+5**. Damage: 1d8 + 3. Mastery: `sap`.
11. **Spellcasting.** Fighter has no class-level spellcasting → **null**.
12. **Passives.** Perception: 10 + WIS(+1) = 11. Insight: 11.
    Investigation: 10 + INT(+0) = 10.
13. **Carrying capacity.** STR 16 × 15 = **240 lbs** (medium creature).

Every number above is mechanically derivable from the input and the
SRD data already shipped in `src/srd/`. The corresponding pinned
fixture lives at `tests/fixtures/character/fighter-l3.expected.json`.

## What `deriveSheet` does *not* do

These belong upstream of the engine (the host) or downstream of v0
(later engine releases). They're listed here so a reader can tell the
difference between "the engine got this wrong" and "the engine
doesn't claim to do this yet."

- **Spell slot tracking.** Records carry `spells.slots`; the engine
  doesn't compute slot tables until 0.5.0
  ([roadmap § 0.5.0](./roadmap.md)).
- **Class skill proficiency choices.** Backgrounds carry their
  skills; the SRD class skill picks ("Fighter chooses two from …")
  aren't in the class records yet. Use `record.proficiencies.skills`
  to express the player's pick.
- **Condition effects on attack/save math.** Restrained sets speed
  to 0 today; baking `Blinded → disadvantage on attacks`, etc., into
  *combat* math arrives with 0.7.0.
- **Encumbrance status.** `carryingCapacity` gives you the numbers;
  comparing them against carried weight is the host's job.
- **Recompute orchestration.** The engine doesn't memoise. Hosts that
  want diffing or memoisation wrap the call themselves.

## When to call it

Cheap. Pure. No I/O. Call it whenever you'd otherwise rebind a sheet
view: after a level-up, after equip/unequip, after a condition lands
or clears, after exhaustion ticks, after a feat is taken. If you're
about to render the sheet panel, derive first.
