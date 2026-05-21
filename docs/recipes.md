# Recipes

Pragmatic patterns for building clients on top of `@zeeuw/bag-of-holding`.
Each recipe is a self-contained working example: copy, adapt, ship.

[`spec.md`](spec.md) is the reference for *what exists*. This file is
*how to actually do the thing*. When a recipe describes a pattern
that's improving in a future release, a note at the bottom of the
recipe points to the milestone where it gets a first-class helper.

## Recipes index

### Dice as a standalone tool

- [1. Roll dice from a static HTML page](#1-roll-dice-from-a-static-html-page)
- [2. Advantage, disadvantage, drop-lowest](#2-advantage-disadvantage-drop-lowest)
- [3. Tree-shake-friendly dice-only consumer](#3-tree-shake-friendly-dice-only-consumer)

### Basic checks & combat

- [4. Ability check against a DC](#4-ability-check-against-a-dc)
- [5. Single attack → damage flow](#5-single-attack--damage-flow)
- [6. Critical hit handling](#6-critical-hit-handling)

### Compound actions

- [7. Attack from stealth (compound action with context tags)](#7-attack-from-stealth-compound-action-with-context-tags)
- [8. Opposed check (Shove, Grapple, contest pattern)](#8-opposed-check-shove-grapple-contest-pattern)
- [9. Death save tracker](#9-death-save-tracker)

### Conditions

- [10. Apply, remove, query conditions](#10-apply-remove-query-conditions)
- [11. Exhaustion accumulation (forced march)](#11-exhaustion-accumulation-forced-march)

### Custom content (Phase A plugins)

- [12. Homebrew species](#12-homebrew-species)
- [13. Custom weapon mastery property](#13-custom-weapon-mastery-property)
- [14. Custom condition](#14-custom-condition)
- [15. Themed pack as a plugin bundle](#15-themed-pack-as-a-plugin-bundle)

### Custom rules (Phase B knobs)

- [16. Pathfinder-style crit range (19-20)](#16-pathfinder-style-crit-range-1920)
- [17. Exploding damage dice (savage flavour)](#17-exploding-damage-dice-savage-flavour)
- [18. Gritty XP curve (slower progression)](#18-gritty-xp-curve-slower-progression)
- [19. No-damage-floor mode](#19-no-damage-floor-mode)
- [20. Themed pack combining content and rules](#20-themed-pack-combining-content-and-rules)

### Determinism & replay

- [21. Seeded session](#21-seeded-session)
- [22. Live debug overlay via onRoll](#22-live-debug-overlay-via-onroll)
- [23. Save and restore a session](#23-save-and-restore-a-session)
- [24. Trace-back: "why did the boss die in one hit?"](#24-trace-back-why-did-the-boss-die-in-one-hit)

### Multi-engine and host integrations

- [25. Tutorial sandbox alongside the live game](#25-tutorial-sandbox-alongside-the-live-game)
- [26. Wiring into Spektrum history](#26-wiring-into-spektrum-history)
- [27. Minimal AI-loop shape](#27-minimal-ai-loop-shape)

### Lifecycle, mechanics & advanced flows (since 1.x)

- [28. One turn end-to-end (turn lifecycle)](#28-one-turn-end-to-end-turn-lifecycle)
- [29. Combat actions menu (Dash + Disengage + Dodge)](#29-combat-actions-menu-dash--disengage--dodge)
- [30. Grapple → grappled condition](#30-grapple--grappled-condition)
- [31. Two-weapon fighting with Nick mastery](#31-two-weapon-fighting-with-nick-mastery)
- [32. Damage pipeline end-to-end (resistance + tempHp + drop-to-zero)](#32-damage-pipeline-end-to-end-resistance--temphp--drop-to-zero)
- [33. Heal an Unconscious ally](#33-heal-an-unconscious-ally)
- [34. Class mechanic: Barbarian Rage](#34-class-mechanic-barbarian-rage)
- [35. Class mechanic: Rogue Sneak Attack](#35-class-mechanic-rogue-sneak-attack)
- [36. Magic item lifecycle (attune → spend → dawn recharge)](#36-magic-item-lifecycle-attune--spend--dawn-recharge)
- [37. Counterspell intercept via the onCast hook](#37-counterspell-intercept-via-the-oncast-hook)
- [38. Fireball: AoE targeting + save-for-half](#38-fireball-aoe-targeting--save-for-half)
- [39. Monster legendary actions in a round](#39-monster-legendary-actions-in-a-round)

### Solo mode (since 2.0.0)

- [40. Solo mode: oracle + session + share](#40-solo-mode-oracle--session--share-since-200)

---

## 1. Roll dice from a static HTML page

**Use case:** You want a one-file dice roller: no build step, no
bundler, no package manager.

```html
<!DOCTYPE html>
<script type="module">
  import { Dice } from 'https://unpkg.com/@zeeuw/bag-of-holding';

  const result = Dice.roll('2d6+3');
  document.body.textContent = `You rolled ${result.rolls.join(' + ')} + ${result.modifier} = ${result.total}`;
</script>
```

That's the full app. `Dice` is the only namespace you import; no
engine instance needed.

## 2. Advantage, disadvantage, drop-lowest

**Use case:** Common dice rituals beyond the straight roll.

```js
import { Dice } from '@zeeuw/bag-of-holding';

// Advantage / disadvantage compare full-expression totals (not
// die-by-die), per SRD.
Dice.rollAdvantage('1d20+5');         // → { rolls, modifier, total }  the higher of two rolls
Dice.rollDisadvantage('1d20+5');      // → the lower of two rolls

// 4d6 drop lowest (canonical D&D ability-score generation)
const result = Dice.roll('4d6');
const sorted = [...result.rolls].sort((a, b) => a - b);
const droppedLowest = sorted.slice(1).reduce((a, b) => a + b, 0);
```

## 3. Tree-shake-friendly dice-only consumer

**Use case:** You only need dice math. You don't want combat,
conditions, or species data in your bundle.

```js
// Only Dice gets pulled in. The rest of the engine is shaken out
// by any modern bundler (Vite, esbuild, Rollup) thanks to
// `sideEffects: false` in package.json.
import { Dice } from '@zeeuw/bag-of-holding';

Dice.roll('2d6+3');
Dice.rollDie(20);
```

**Gotcha:** if you import `default` (`import boh from '@zeeuw/bag-of-holding'`),
the bundler can't tree-shake the engine, since the default singleton
instantiates everything. Stick to named imports for the smallest
output.

## 4. Ability check against a DC

**Use case:** A skill check (Athletics, Persuasion, etc.) or a
saving throw against a fixed difficulty.

```js
import { Checks } from '@zeeuw/bag-of-holding';

const result = Checks.abilityCheck({
  abilityScore: 14,        // STR 14 → +2 mod
  proficient: true,        // add proficiency bonus on top
  proficiencyBonus: 2,
  dc: 13
});
// → { d20, mod, total, dc: 13, success }

if (result.success) {
  // narrate success
}
```

DCs outside `[5, 25]` are clamped silently. The contract is "this
check resolves cleanly," not "the caller can soft-lock the game by
passing DC 1000."

## 5. Single attack → damage flow

**Use case:** The bread and butter combat sequence: one attack,
damage on hit.

```js
import { Combat, SRD } from '@zeeuw/bag-of-holding';

const longsword = SRD.items.longsword;
const attack = Combat.attackRoll({ attackBonus: 5, ac: 14 });
// → { d20, attackBonus, total, ac, hit, critical, fumble }

if (attack.hit) {
  const damage = Combat.damageRoll({
    damageDice: longsword.damage,   // '1d8'
    damageMod: 3,
    critical: attack.critical       // doubles the dice on a crit
  });
  // → { baseRolls, critRolls, damageMod, total }

  // Apply weapon-mastery rider after the attack resolves.
  const rider = Combat.applyMastery(longsword, target, attack);
  // → { kind: 'sap', disadvantage: true }  (longsword has the Sap mastery)
}
```

Every value the engine produces is structured, so the UI can show
the d20 face, the damage dice, the mastery rider, all without
re-deriving anything.

## 6. Critical hit handling

**Use case:** Nat 20 logic: extra damage dice, narration cue,
optional house rules (max damage on crit, double damage dice).

```js
import { Combat } from '@zeeuw/bag-of-holding';

const attack = Combat.attackRoll({ attackBonus: 5, ac: 14 });

if (attack.critical) {
  // SRD: roll damage dice twice, add the modifier once.
  const damage = Combat.damageRoll({
    damageDice: '1d8',
    damageMod: 3,
    critical: true
  });
  // damage.baseRolls and damage.critRolls are separate arrays so the
  // UI can show "you rolled 6 + 4 + 3 = 13!" rather than blurring them.
}
```

For house rules (Pathfinder-style 19-20 crit ranges, exploding
crit dice, "max damage on crit" packs), see recipes 16-20. The
Phase B `rules` knob system shipped in `0.2.0`.

## 7. Attack from stealth (compound action with context tags)

**Use case:** A Rogue uses Stealth, then attacks: three rolls,
each conditional on the last. The engine doesn't orchestrate
compound actions; the host loop does, tagging every roll with a
shared `context` so the audit log reconstructs the sequence.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({ rng: Dice.seededRng(42) });

const ctx = { action: 'stealth-attack', turn: 14, target: 'orc-leader' };

// 1. Stealth check vs the enemy's passive Perception (say 13)
const stealth = engine.Checks.abilityCheck(
  { abilityScore: 16, proficient: true, proficiencyBonus: 2, dc: 13 },
  { ...ctx, step: 'stealth' }
);

// 2. Attack, advantage if stealth succeeded
const attack = stealth.success
  ? engine.Dice.rollAdvantage('1d20+5', { ...ctx, step: 'attack' })
  : engine.Dice.roll('1d20+5', { ...ctx, step: 'attack' });

// 3. If it hits, damage, plus Sneak Attack dice if we had advantage
if (attack.total >= 14) {
  const baseDmg = engine.Combat.damageRoll(
    { damageDice: '1d6', damageMod: 3 },
    { ...ctx, step: 'damage' }
  );
  if (stealth.success) {
    const sneakDmg = engine.Dice.roll('2d6', { ...ctx, step: 'sneak-attack' });
    // total dealt: baseDmg.total + sneakDmg.total
  }
}

// All four log entries carry the same { action, turn, target }
// context, postmortem trivially reconstructs the sequence.
```

**Coming in `0.4.0`:** an `engine.Actions.stealthAttack({ … })`
helper bundles this chain as one call returning a structured
outcome. Today's pattern is the underlying primitive set; the
recipe will get an update.

## 8. Opposed check (Shove, Grapple, contest pattern)

**Use case:** Two actors roll a check; the higher total wins
(ties go to the defender per SRD).

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const ctx = { contest: 'shove', attacker: 'pc.fighter', defender: 'orc' };

// Both sides roll an Athletics check. DC is irrelevant for a contest
// (we compare totals) but the function requires one. Pass 5 (the
// MIN_DC clamp value) as a sentinel.
const attacker = engine.Checks.abilityCheck(
  { abilityScore: 16, proficient: true, proficiencyBonus: 2, dc: 5 },
  { ...ctx, side: 'attacker' }
);
const defender = engine.Checks.abilityCheck(
  { abilityScore: 14, dc: 5 },
  { ...ctx, side: 'defender' }
);

const attackerWins = attacker.total > defender.total;  // strict > = ties favour defender
```

**Coming in `0.4.0`:** `engine.Checks.contest({ a, b })` returns
`{ winner, marginA, marginB }` directly. The recipe collapses to
two lines.

## 9. Death save tracker

**Use case:** A PC at 0 HP rolls a d20 at the start of each turn:
10+ = success, <10 = failure, nat 1 = two failures, nat 20 =
regain 1 HP. Three failures = dead; three successes = stable.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();

function rollDeathSave(actor) {
  const d20 = engine.Dice.rollDie(20, { actor: actor.id, op: 'death-save' });
  const updated = { ...actor, deathSaves: { ...actor.deathSaves } };

  if (d20 === 20)      updated.hp = 1;                                    // regain consciousness
  else if (d20 === 1)  updated.deathSaves.failures += 2;
  else if (d20 >= 10)  updated.deathSaves.successes += 1;
  else                 updated.deathSaves.failures += 1;

  if (updated.deathSaves.failures >= 3) updated.dead = true;
  if (updated.deathSaves.successes >= 3) updated.stable = true;
  return updated;
}

let pc = { id: 'pc.danny', hp: 0, deathSaves: { successes: 0, failures: 0 } };
pc = rollDeathSave(pc);
```

The engine doesn't model death saves directly; they're a host-side
state machine over `engine.Dice.rollDie(20)`. Reasonable to keep on
the host side because failure consequences (narration, party
reaction) are application-level.

## 10. Apply, remove, query conditions

**Use case:** Track boolean conditions on actors immutably.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
let actor = { id: 'pc' };

actor = engine.Conditions.apply(actor, 'blinded');
actor = engine.Conditions.apply(actor, 'frightened');
engine.Conditions.has(actor, 'blinded');         // true

actor = engine.Conditions.remove(actor, 'blinded');
engine.Conditions.has(actor, 'blinded');         // false

// Apply throws on unknown conditions, the vocabulary is closed.
engine.Conditions.apply(actor, 'phlegmatic');    // Error
```

Every call returns a *new* actor object; the original is untouched.
This matters for Spektrum-style history and `attempt()` rollbacks.

## 11. Exhaustion accumulation (forced march)

**Use case:** A party pushes through a forced march; each PC gains
exhaustion levels with cumulative penalties.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
let actor = { id: 'pc.danny' };

// Forced march for three days, gaining one level per day.
actor = engine.Conditions.exhaustion.gain(actor);  // level 1
actor = engine.Conditions.exhaustion.gain(actor);  // level 2
actor = engine.Conditions.exhaustion.gain(actor);  // level 3

engine.Conditions.exhaustion.level(actor);                     // 3
engine.Conditions.exhaustion.modifierToD20Tests(actor);        // −6
engine.Conditions.exhaustion.speedPenalty(actor);              // 15 ft reduction
engine.Conditions.exhaustion.isDead(actor);                    // false (death at 6)

// One Long Rest removes one level.
actor = engine.Conditions.exhaustion.reduce(actor);            // level 2
```

Combat math doesn't auto-apply the −2/level penalty yet;
that's `0.7.0` (Condition effects). For now, the loop reads the
modifier and adds it to relevant rolls.

## 12. Homebrew species

**Use case:** Add a custom playable species (Half-Elf,
Aarakocra, anything not in SRD 5.2).

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  extraSpecies: {
    'half-elf': {
      id: 'half-elf',
      name: 'Half-Elf',
      size: 'medium',
      speed: 30,
      traits: ['Darkvision 60ft', 'Fey Ancestry', 'Adaptable']
    }
  }
});

engine.species['half-elf'];   // the new record
engine.species.elf;           // SRD entry still present
```

Last-write-wins on id collision, so you can also *replace* an SRD
species (a "grimdark" pack might ship a tougher Dwarf).

**Gotcha:** species records in SRD 5.2 carry no ability bonuses;
those moved to backgrounds. Don't add `abilityBonuses` thinking
it'll be picked up; it won't be read.

## 13. Custom weapon mastery property

**Use case:** A homebrew mastery beyond the eight SRD properties
(Cleave / Graze / Nick / Push / Sap / Slow / Topple / Vex).

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  extraMastery: {
    // "Pin": on a hit, target is grappled until your next turn.
    pin: (weapon, target, attackResult) => {
      if (!attackResult?.hit) return { kind: 'none' };
      return { kind: 'pin', condition: 'grappled', duration: '1 turn' };
    }
  },
  // Tag a weapon to use the new mastery.
  extraItems: {
    'grappling-spear': {
      id: 'grappling-spear', name: 'Grappling Spear',
      type: 'weapon', damage: '1d6', damageType: 'piercing',
      mastery: 'pin'
    }
  }
});

const attack = engine.Combat.attackRoll({ attackBonus: 4, ac: 12 });
const rider = engine.Combat.applyMastery(
  engine.items['grappling-spear'],
  target,
  attack
);
// rider → { kind: 'pin', condition: 'grappled', duration: '1 turn' }
```

A mastery handler must be a pure function (same inputs → same
output). The host interprets the rider; the engine never mutates
target state on its own.

## 14. Custom condition

**Use case:** A "cursed" or "marked" condition outside the SRD
list.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  extraConditions: ['cursed', 'marked']
});

let actor = { id: 'pc' };
actor = engine.Conditions.apply(actor, 'cursed');
engine.Conditions.has(actor, 'cursed');   // true
```

The condition is just a string in the vocabulary; the *effects*
are the host's responsibility. To bake mechanical effects in
(e.g., disadvantage on saving throws while cursed), compose
that yourself today; `0.7.0` adds engine-enforced condition
effects.

## 15. Themed pack as a plugin bundle

**Use case:** Ship a coherent thematic pack (species, classes,
items, monsters) as a single object a host can opt into.

```js
// pirates-of-the-sundered-sea.js
export default {
  extraSpecies: {
    'merfolk': { id: 'merfolk', name: 'Merfolk', size: 'medium', speed: 10, traits: ['Swim Speed 30ft', 'Amphibious'] },
    'sea-witch': { id: 'sea-witch', name: 'Sea-Witch', size: 'medium', speed: 30, traits: ['Stormcall', 'Briny Touch'] }
  },
  extraItems: {
    'cutlass': { id: 'cutlass', name: 'Cutlass', type: 'weapon', damage: '1d8', damageType: 'slashing', mastery: 'sap' },
    'flintlock': { id: 'flintlock', name: 'Flintlock', type: 'weapon', damage: '1d10', damageType: 'piercing', mastery: 'push' }
  },
  extraConditions: ['waterlogged', 'cursed-by-the-sea']
};

// host.js
import { createEngine } from '@zeeuw/bag-of-holding';
import piratesPack from './pirates-of-the-sundered-sea.js';

const engine = createEngine(piratesPack);
```

A pack is just an `EngineOptions` object. Distribute as an npm
package, a JSON file, or a literal: any shape the host can pass
straight into `createEngine`.

## 16. Pathfinder-style crit range (19-20)

**Use case:** Wider crit range, common in Pathfinder, in "this
weapon scores criticals on a 19 or 20" house rules, and as the
mechanical effect of a Champion Fighter's L3 Improved Critical.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  rng: Dice.seededRng(42),
  rules: { critOn: [19, 20] }
});

engine.Combat.attackRoll({ attackBonus: 5, ac: 14 });
// d20 of 19 or 20 → result.critical === true, hit === true
```

Every other rule (fumble on 1, damageFloor of 1, no exploding
dice, SRD XP curve) stays at its default. Opt in per-knob.

## 17. Exploding damage dice (savage flavour)

**Use case:** Every damage die that rolls max rolls again, and
chains can compound, producing rare but spectacular damage.
Borrowed from Savage Worlds; popular in over-the-top action
campaigns.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  rng: Dice.seededRng(42),
  rules: { explodingDamageDice: true }
});

const damage = engine.Combat.damageRoll({
  damageDice: '2d6',
  damageMod: 3,
  critical: true
});
// damage.baseRolls and damage.critRolls may each include more
// than the declared count if any die rolled max and chained.
```

Affects both the base roll and the crit extra dice. Chains
compound: a max → max → max sequence is rare but allowed. For a
one-off "this attack only" exploding mechanic without enabling
the engine rule, call `Dice.rollExplosive(spec, rng)` directly.

## 18. Gritty XP curve (slower progression)

**Use case:** A 100-hour campaign should feel like a slow rise to
heroic stature, not "level 5 in week two." Raise the thresholds.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  rules: {
    xpThresholds: {
      1: 0,
      2: 1500,    // SRD: 300 → 5× longer
      3: 4500,    // SRD: 900
      4: 13500,   // SRD: 2700
      5: 35000    // SRD: 6500
    }
  }
});

engine.XP.levelForXP(1000);            // → 1  (still L1)
engine.XP.nextLevelThreshold(1000);    // → 1500

const result = engine.XP.awardMilestone({
  pc: { xp: 1400, level: 1 },
  beat: { targetPlaytimeMinutes: 30 }
});
result.willLevelUp;                    // → true (1400 + 300 ≥ 1500)
```

Set `proficiencyByLevel` alongside if the bonus curve should also
stretch; otherwise PCs gain proficiency bumps faster than levels.

## 19. No-damage-floor mode

**Use case:** A heavy debuff (Bane, Bestow Curse, Bardic Vicious
Mockery on a weak target) reduces damage below zero. SRD says
"floor at 1." Some packs want "the modifier fully cancels, so the
hit deals 0."

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  rules: { damageFloor: 0 }
});

const damage = engine.Combat.damageRoll({
  damageDice: '1d4',
  damageMod: -10   // Vicious Mockery-style stacked debuffs
});
damage.total;       // can be 0 under this rule (would be 1 under SRD)
```

The floor only affects the *minimum*; positive damage is never
capped. Combine with `explodingDamageDice` for "everything is
swingier" packs.

## 20. Themed pack combining content and rules

**Use case:** Ship a coherent pack (homebrew species, items,
conditions, AND rule modifications) as one object a host can
opt into wholesale.

```js
// pirates-of-the-sundered-sea.js
export default {
  extraSpecies: {
    'merfolk':   { id: 'merfolk',   name: 'Merfolk',   size: 'medium', speed: 10, traits: ['Swim 30ft', 'Amphibious'] },
    'sea-witch': { id: 'sea-witch', name: 'Sea-Witch', size: 'medium', speed: 30, traits: ['Stormcall'] }
  },
  extraItems: {
    'cutlass':   { id: 'cutlass',   name: 'Cutlass',   type: 'weapon', damage: '1d8',  damageType: 'slashing', mastery: 'sap' },
    'flintlock': { id: 'flintlock', name: 'Flintlock', type: 'weapon', damage: '1d10', damageType: 'piercing', mastery: 'push' }
  },
  extraConditions: ['waterlogged', 'cursed-by-the-sea'],

  // High-action piracy: wide crits + exploding dice + slow
  // progression so the campaign earns its level-ups.
  rules: {
    critOn: [19, 20],
    explodingDamageDice: true,
    xpThresholds: { 1: 0, 2: 1000, 3: 3000, 4: 8000, 5: 20000 }
  }
};

// host.js
import { createEngine } from '@zeeuw/bag-of-holding';
import piratesPack from './pirates-of-the-sundered-sea.js';

const engine = createEngine(piratesPack);
engine.rules.critOn;     // → [19, 20]  (host can introspect what's loaded)
```

Phase A content options (`extraSpecies`, `extraItems`, etc.) and
Phase B `rules` overrides live happily in the same `EngineOptions`
object, so a "pack" is just a literal. No registration ceremony,
no plugin lifecycle: the host hands the object to `createEngine`
and gets a pre-configured engine back.

## 21. Seeded session

**Use case:** Reproducible play, so the same seed produces the
same sequence of rolls for any consumer running this exact engine
version.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const seed = 42;
const engine = createEngine({ rng: Dice.seededRng(seed) });

engine.Combat.attackRoll({ attackBonus: 5, ac: 14 });
// → { d20: 13, … }  every time, for seed 42, with this engine version.
```

Two engines with the same seed are functionally indistinguishable
for any sequence of operations. Useful for: unit-testing your loop
without mocks, sharing a "weird crit" for repro, running a
deterministic AI-loop test harness.

## 22. Live debug overlay via onRoll

**Use case:** Stream every roll to a developer-mode panel as it
happens; perfect for the Nerd-mode sidebar of an AI-DM client.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  rng: Dice.seededRng(42),
  onRoll: (entry) => {
    // Fired immediately after each entry lands on engine.rollLog.
    console.log(`#${entry.index}: ${entry.op}`, entry);
    // Or pipe into a UI panel, telemetry, Spektrum state, etc.
  }
});

engine.Combat.attackRoll({ attackBonus: 5, ac: 14 });
// → onRoll fires with the attackRoll entry.
```

The callback is synchronous and runs after the entry is appended
to `rollLog`, so readers see the same shape either way.

## 23. Save and restore a session

**Use case:** Persist a session to disk / save slot, restore it
later, verify the engine still produces the same outcomes.

```js
import { createEngine, verifyLog, Dice } from '@zeeuw/bag-of-holding';

// === Live session ===
const seed = 42;
const engine = createEngine({ rng: Dice.seededRng(seed) });

engine.Combat.attackRoll({ attackBonus: 5, ac: 14 }, 'turn 1');
engine.Combat.damageRoll({ damageDice: '1d8', damageMod: 3 }, 'turn 1');

// === Save ===
const saveData = JSON.stringify({ seed, log: engine.rollLog });
localStorage.setItem('session-2026-05-20', saveData);

// === Restore (later, possibly another tab / device / engine version) ===
const { seed: savedSeed, log: savedLog } = JSON.parse(saveData);
const restoredEngine = createEngine({ rng: Dice.seededRng(savedSeed) });

// Verify the restored engine reproduces every logged roll exactly.
const verification = verifyLog({ seed: savedSeed, log: savedLog });
if (!verification.ok) {
  console.error(`Save corrupted: diverged at op ${verification.divergedAt}`);
}
```

The log is plain JSON; serialise it however your host already
handles persistence (Spektrum's `serialize`, localStorage,
IndexedDB, file download).

## 24. Trace-back: "why did the boss die in one hit?"

**Use case:** Postmortem. A player asks: how did that happen?
Walk the roll log filtered by context.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();

// ... play happens, every roll tagged with { target, turn, action }

// Postmortem: every roll that touched the boss across the session
const bossRolls = engine.rollLog.filter(entry =>
  typeof entry.context === 'object' && entry.context?.target === 'boss'
);

// Or: every roll in the turn the boss died
const turn14Rolls = engine.rollLog.filter(entry =>
  typeof entry.context === 'object' && entry.context?.turn === 14
);

// Or: the specific d20 that caused the killing blow
const finalAttack = engine.rollLog
  .filter(e => e.op === 'attackRoll')
  .at(-1);
```

The richer the context tag (object, not string), the easier the
postmortem. Convention worth adopting: every rolling call gets a
context object with at least `{ action, actor, target }`.

## 25. Tutorial sandbox alongside the live game

**Use case:** Run a tutorial or preview engine that won't
contaminate the live campaign: different rules, different
seed, fully isolated registries.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const liveGame = createEngine({
  rng: Dice.seededRng(playerSeed),
  rollLogCap: 5000
});

const tutorialSandbox = createEngine({
  // Math.random, non-deterministic, just for vibes
  extraSpecies: tutorialOnlySpecies   // homebrew species the live game doesn't have
});

// Two engines, two registries, two roll logs. They share zero state.
liveGame.species['half-elf'];      // undefined (live game doesn't have it)
tutorialSandbox.species['half-elf']; // defined
```

This is the killer use case for the instance-scoped engine design.
A live campaign and a "what would my character look like as a
pirate?" preview can coexist without one leaking into the other.

## 26. Wiring into Spektrum history

**Use case:** Use Spektrum (the sister state-engine library) to
hold canonical game state, with bag-of-holding producing the rolls
and Spektrum's history capturing the timeline.

```js
import spektrum, { setValue, addValue } from 'spektrum';
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

// Seed comes from the saved campaign in Spektrum state.
const engine = createEngine({
  rng: Dice.seededRng(spektrum.appState.session.seed),
  onRoll: (entry) => {
    // Append every roll to Spektrum so it's part of the replayable history.
    setValue(`session.rolls.${entry.index}`, entry);
    addValue('session.rollCount', 1);
  }
});

// On a player action:
const attack = engine.Combat.attackRoll(
  { attackBonus: 5, ac: 14 },
  { turn: spektrum.appState.session.turn, action: 'attack' }
);
setValue('session.lastAttack', attack);
```

Two replay surfaces compose: Spektrum's history rebuilds state
mutations; bag-of-holding's `verifyLog` confirms the rolls
themselves are reproducible. Both use the same seed.

## 27. Minimal AI-loop shape

**Use case:** An LLM proposes an action; the engine resolves the
mechanics; the LLM narrates the outcome. The engine never talks
to the LLM directly; see [boundary.md](boundary.md).

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({ rng: Dice.seededRng(42) });

async function turn(playerInput) {
  // 1. AI classifies the intent into a structured action.
  const intent = await classifyIntent(playerInput);
  // → { type: 'attack', target: 'orc', attackBonus: 5 }

  // 2. Engine resolves the mechanics.
  let result;
  switch (intent.type) {
    case 'attack':
      result = engine.Combat.attackRoll(
        { attackBonus: intent.attackBonus, ac: target.ac },
        { source: 'ai-classifier', target: intent.target }
      );
      if (result.hit) {
        result.damage = engine.Combat.damageRoll(
          { damageDice: '1d8', damageMod: 3, critical: result.critical },
          { source: 'ai-classifier', target: intent.target }
        );
      }
      break;
    // … other intent types
  }

  // 3. AI narrates the outcome.
  const narration = await narrateOutcome(intent, result);

  // 4. Commit state (Spektrum, your store, etc.).
  return { intent, result, narration };
}
```

Three boundaries, three responsibilities: classifier → engine →
narrator. The engine is deterministic, replayable, never makes a
network call. The AI calls happen on either side of it. The roll
log is the auditable trail showing exactly what the engine produced
given what the AI requested, so *"the AI claims it rolled X, did
it?"* becomes a verifiable question.

## 28. One turn end-to-end (turn lifecycle)

**Use case:** Walk one actor through a full combat turn. Turn
start fires the lifecycle hook, the actor takes an action, the
turn ends and round-scoped timers tick.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const log = [];
const engine = createEngine({
  hooks: {
    onTurnStart: (p) => log.push(`start: ${p.actor.id}`),
    onTurnEnd:   (p) => log.push(`end: ${p.actor.id}, expired ${p.expired.length}`)
  }
});

// Carry a 3-round Bless effect on the actor.
let actor = engine.Combat.addTimer(
  { id: 'pc', hp: 18, hpMax: 25 },
  { id: 'bless', kind: 'spell', remainingRounds: 3 }
);

// --- Turn start ---
engine.Combat.turnStart(actor, 'round 1');

// --- Action: attack an orc ---
const attack = engine.Combat.attackRoll({ attackBonus: 5, ac: 13 });
if (attack.hit) {
  const dmg = engine.Combat.damageRoll({
    damageDice: '1d8', damageMod: 3, damageType: 'slashing',
    critical: attack.critical
  });
  // host applies dmg.total to the orc via Combat.applyDamage(orc, ...)
}

// --- Turn end: timers tick by one round; expired entries surface ---
const { actor: next, expired } = engine.Combat.turnEnd(actor);
actor = next;
// log: ['start: pc', 'end: pc, expired 0']
// actor.timers[0].remainingRounds === 2
```

A timer that hits 0 lands in the `expired` array of the
`turnEnd` result and the `onTurnEnd` hook payload, so the host
can remove any state the timer was shadowing (a Bless bonus, a
Sap disadvantage).

## 29. Combat actions menu (Dash + Disengage + Dodge)

**Use case:** The action menu verbs all consume the right budget
slot and stamp an actor flag the rest of the engine reads. Here a
Rogue Dodges, attempts to Disengage out of melee, then Dashes
clear next turn.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();

let state = engine.Combat.startEncounter([
  { id: 'rogue', dexterity: 16, speed: 30 },
  { id: 'ogre',  dexterity: 8,  speed: 40 }
]);

// --- Dodge: sets actor.dodging = true. Attacks against rogue have
//     disadvantage until the rogue's next turn. ---
let rogue = { id: 'rogue', hp: 8, hpMax: 28 };
let r = engine.Combat.dodge(state, rogue);
state = r.state; rogue = r.actor;
// attackStance() now reports 'disadvantage' for attacks vs rogue:
const orcAttack = engine.Combat.attackRoll({
  attackBonus: 6, ac: 16, target: rogue, attackerDistanceFt: 5
});
// orcAttack.stance === 'disadvantage'

// --- Next turn: Disengage as an action, then Dash to pull away ---
r = engine.Combat.disengage(state, rogue);
state = r.state; rogue = r.actor;
// rogue.disengaged === true → opportunityAttack short-circuits

// (Disengage consumed the action; Dash needs an action too, so a
//  realistic Rogue uses Cunning Action's bonus-action Dash via the
//  monk-style helper. With the action available, regular Dash:)
r = engine.Combat.dash(state, 'rogue');
state = r.state;
// state.budgets.rogue.movement === 60   (base 30 + dash 30)
```

Each verb returns `{ allowed, state, actor?, result? }`. A budget
already spent makes the verb refuse with a debuggable reason, so
the host renders that as a disabled chip rather than crashing.

## 30. Grapple → grappled condition

**Use case:** A Fighter shoves an orc, then on the next attempt
grapples. The 2024 SRD made both single-roll saves (DC `8 + STR +
prof`); the engine computes the DC and reports the save block, the
host rolls the target's save, the engine applies the condition on
failure.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const state = engine.Combat.startEncounter([
  { id: 'pc', dexterity: 14, speed: 30 },
  { id: 'orc', dexterity: 10, speed: 30 }
]);

const fighter = {
  id: 'pc', abilityScores: { str: 16 }, proficiencyBonus: 3
};

const attempt = engine.Combat.grapple(state, fighter, { targetId: 'orc' });
// attempt.result.save  → { dc: 14, abilities: ['str', 'dex'] }
// attempt.result.onFail → { condition: 'grappled' }

// Target rolls the save with the better of STR or DEX.
const orc = { id: 'orc', abilityScores: { str: 14, dex: 12 } };
const save = engine.Checks.savingThrow({
  abilityScore: orc.abilityScores.str,     // pick higher
  dc: attempt.result.save.dc,
  actor: orc, ability: 'str'
});

// On a failed save → apply the condition.
const orcAfter = save.success
  ? orc
  : engine.Conditions.apply(orc, attempt.result.onFail.condition);
// orcAfter.conditions.includes('grappled') === !save.success
```

`engine.Combat.shove(state, actor, { choice: 'push' })` follows the
same shape, with `onFail.pushFt = 5` instead of a condition.

## 31. Two-weapon fighting with Nick mastery

**Use case:** A character holds a Light + Nick weapon in the main
hand (say a Scimitar) and another Light weapon in the off-hand
(say a Dagger). Per the 2024 PHB, the **Nick** mastery folds the
off-hand attack into the Attack action itself, so a second
strike doesn't cost a bonus action.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const state = engine.Combat.startEncounter([
  { id: 'pc', dexterity: 18, speed: 30 }
]);

const scimitar = engine.items.scimitar;     // mastery: 'nick'
const dagger   = engine.items.dagger;

// 1. Main-hand attack with the scimitar.
const main = engine.Combat.attackRoll({ attackBonus: 7, ac: 13 });
// 2. Apply the Nick mastery rider.
const rider = engine.Combat.applyMastery(scimitar, target, main);
// rider.kind === 'nick'  →  the engine signals an extra attack
//                            is folded into this Attack action.

// 3. Resolve the dagger swing. With Nick, no bonus-action spend.
//    Without Nick, the host would call:
//       engine.Combat.offHandAttack(state, pc, { weapon: dagger })
//    and consume the bonus-action budget.
const off = engine.Combat.attackRoll({ attackBonus: 7, ac: 13 });
```

`offHandAttack` also returns
`{ result: { suppressPositiveAbilityMod: true } }` so the host
knows to strip the ability mod from the off-hand damage roll (SRD:
"you don't add your ability modifier to the damage … unless that
modifier is negative").

## 32. Damage pipeline end-to-end (resistance + tempHp + drop-to-zero)

**Use case:** A dragon breathes fire on a fire-resistant target
that has tempHp. The 1.4 damage pipeline folds the modifier order
(Immunity → Resistance → Vulnerability), absorbs through tempHp,
subtracts HP, and routes to `dropToZero` if the actor crosses 0.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();

let actor = {
  id: 'pc', hp: 8, hpMax: 30,
  damageResistances: ['fire'],
  tempHp: 5
};

// 1. Damage roll surfaces a damageType.
const dmg = engine.Combat.damageRoll({
  damageDice: '8d6', damageType: 'fire', damageMod: 0
});

// 2. Apply through the pipeline.
const result = engine.Combat.applyDamage(actor, {
  amount: dmg.total, type: dmg.damageType, source: 'dragon-breath'
});

// `result.finalAmount` halved by resistance, then tempHp absorbed.
// Outcome tags:
//   'damaged': HP went down but not to 0
//   'absorbed': tempHp ate it all
//   'downed':   HP just crossed to 0 (Unconscious applied)
//   'dead':     massive-damage instant death
//   'immune':   damageImmunities matched the type
actor = result.actor;

// Hooks fire automatically:
//   onDamageApplied for every outcome
//   onHpChanged only when HP actually moved
//   onConditionApplied when 'downed' adds Unconscious
//   onDeath on 'dead' or three failed death saves
```

`engine.Combat.applyDamageModifiers(actor, { amount, type })` is
the pure modifier layer, handy for previewing damage in a UI
without applying it.

## 33. Heal an Unconscious ally

**Use case:** A Cleric uses Healing Word on a teammate who's
down. `Combat.heal` caps at hpMax, removes the Unconscious
condition when HP rises above 0, and clears the death-save tracker.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({ rng: Dice.seededRng(7) });

// Ally is at 0 HP with 2 failed death saves on the clock.
let ally = engine.Combat.dropToZero({ id: 'fighter', hpMax: 30 });
ally = engine.Combat.applyDamageWhileDown(ally, 4).actor;  // 1 failure
ally = engine.Combat.applyDamageWhileDown(ally, 4).actor;  // 2 failures

// Healing Word: 1d4 + WIS mod (host computes the amount).
const healAmount = engine.Dice.roll('1d4+3').total;
const result = engine.Combat.heal(ally, healAmount);

// result.actor.hp           > 0
// result.actor.conditions   no longer includes 'unconscious'
// result.actor.deathSaves   reset to fresh
// onHpChanged hook fires with cause: 'heal'
```

`engine.Combat.stabilize(actor)` is the Medicine-check / Spare-the-
Dying path, which clears the tracker without restoring HP (actor
stays Unconscious at 0 HP, no longer rolling death saves).

## 34. Class mechanic: Barbarian Rage

**Use case:** Barbarian rages on turn 1, takes BPS damage with
resistance, deals bonus rage damage on a STR weapon attack, then
ends the rage on turn 3.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const barbarian = engine.classes.barbarian;

let actor = {
  id: 'pc', classId: 'barbarian', level: 5,
  hp: 45, hpMax: 50,
  abilityScores: { str: 18 },
  resources: engine.Mechanics.freshResources(barbarian, 5)
};

// --- Activate Rage (bonus action; spends a use) ---
let r = engine.Mechanics.apply(actor, 'rage');
// r.damageBonus → 2 at L5
actor = r.actor;
// actor.rage = { active: true, roundsRemaining: 100,
//                damageBonus: 2,
//                resistances: ['bludgeoning', 'piercing', 'slashing'] }

// --- Take a slashing hit while raging ---
// Host applies the rage flag's resistance to the damage pipeline by
// adding the rage resistances to the actor's damageResistances:
const incoming = engine.Combat.applyDamage(
  { ...actor, damageResistances: actor.rage.resistances },
  { amount: 14, type: 'slashing' }
);
// incoming.finalAmount === 7 (halved by resistance)
actor = incoming.actor;

// --- Attack with rage damage bonus on the damage roll ---
const dmg = engine.Combat.damageRoll({
  damageDice: '1d12', damageMod: 4 + 2,   // STR mod 4 + rage bonus 2
  damageType: 'slashing'
});

// --- End rage as a bonus action when you want ---
r = engine.Mechanics.apply(actor, 'endRage');
actor = r.actor;
// actor.rage is gone

// On a Short Rest, one rage use comes back per the 2024 SRD:
actor = engine.Rest.shortRest(actor);
```

`engine.Mechanics.apply(actor, 'rageDamageBonus')` returns the
current `{ bonus }` for UI tooltips; `isRaging` is a boolean
predicate.

## 35. Class mechanic: Rogue Sneak Attack

**Use case:** A Rogue gets advantage on an attack (an ally is
adjacent to the target), hits, and triggers Sneak Attack. The
mechanic gates on per-turn eligibility and returns the bonus
damage spec.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const rogue = engine.classes.rogue;

let actor = {
  id: 'pc', classId: 'rogue', level: 5,
  abilityScores: { dex: 18 }
};

// 1. Attack roll (with advantage from an adjacent ally).
const attack = engine.Combat.attackRoll({
  attackBonus: 7, ac: 14,
  target: { conditions: [] }, attackerDistanceFt: 5
});

if (attack.hit) {
  // 2. Sneak Attack rider, must meet finesse / ranged + advantage
  //    OR adjacent ally; once per turn.
  const rider = engine.Mechanics.apply(actor, 'sneakAttack', {
    attackHadAdvantage: attack.stance === 'advantage',
    allyAdjacent: true,
    weaponFinesse: true
  });
  // rider.triggers === true
  // rider.damageDice === '3d6'     (⌈5/2⌉ at L5)
  // rider.damageType === 'precision'
  actor = rider.actor;
  // actor.sneakAttackUsedThisTurn === true

  // 3. Roll base + sneak damage as one block.
  const baseDmg = engine.Combat.damageRoll({
    damageDice: '1d8+4',     // dagger + DEX
    damageType: 'piercing', critical: attack.critical
  });
  const sneakDmg = engine.Dice.roll(rider.damageDice);
  // Apply baseDmg.total + sneakDmg.total to the target.
}

// 4. At turn end, clear the once-per-turn flag.
actor = engine.Mechanics.apply(actor, 'endTurn').actor;
```

A second attack in the same turn finds `actor.sneakAttackUsedThis
Turn === true` and `sneakAttack` returns `{ triggers: false,
reason: 'already used this turn' }`.

## 36. Magic item lifecycle (attune → spend → dawn recharge)

**Use case:** A character attunes to a Wand of Magic Missiles
(7 charges, regains `1d6+1` at dawn), spends three charges, then
advances time across the dawn boundary to recharge.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const engine = createEngine({ rng: Dice.seededRng(11) });

const wand = {
  id: 'wand-of-magic-missiles', name: 'Wand of Magic Missiles',
  rarity: 'uncommon',
  charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' }
};

let actor = { id: 'pc' };

// --- Attune (engine accepts the host has gated this on a Short Rest) ---
({ actor } = engine.MagicItems.attune(actor, wand));
// actor.attunedItems === ['wand-of-magic-missiles']
// actor.itemCharges['wand-of-magic-missiles'] === { used: 0, max: 7 }

// --- Spend 3 charges to cast the spell ---
({ actor } = engine.MagicItems.spendCharge(actor, wand.id, 3));
// 4 charges remain

// --- Advance the scene clock across dawn ---
let scene = engine.SceneClock.freshScene({ startMinute: 1080 });   // 18:00
const adv = engine.SceneClock.advanceTime(scene, { hours: 14 });
// adv.events  → ['dawn']     (dawn at 06:00, +12h)
scene = adv.scene;

// --- Dawn fired → host runs the recharge handler ---
if (adv.events.includes('dawn')) {
  const rc = engine.MagicItems.rechargeItem(actor, wand);
  actor = rc.actor;
  // rc.recovered is 1d6+1 (rolled deterministically from the seed)
}
```

`engine.MagicItems.identifyItem(actor, wand.id)` flips the host's
"this is identified" state for the player view; `isIdentified` is
the predicate.

## 37. Counterspell intercept via the onCast hook

**Use case:** A wizard tries to cast Fireball. An enemy spellcaster
in your party has Counterspell ready and intercepts. The `onCast`
hook (Phase D, since 1.6.0) fires before slot consumption, so a
cancelled cast doesn't burn the slot.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  hooks: {
    onCast: ({ spell, args, actor }) => {
      // Host policy: NPC enemy spellcaster always counters a Fireball
      // if the NPC's host-side state says it has a reaction available.
      if (spell.id === 'fireball' && actor.classId !== 'pc-party') {
        return { cancelled: true, reason: 'countered by ally NPC' };
      }
    }
  }
});

const fireball = engine.spells.fireball;
const npc = {
  id: 'evil-mage', classId: 'enemy', spellSlots: [{ level: 3, used: 0, max: 2 }]
};

const result = engine.Spellcasting.castSpell(npc, fireball);
// result.ok === false
// result.cancelled === true
// result.reason === 'countered by ally NPC'
// npc.spellSlots[0].used === 0   ← slot untouched
```

The hook payload is `{ actor, spell, args }`. A handler that
returns nothing or `undefined` lets the cast proceed; returning
`{ cancelled: true, reason? }` short-circuits without consuming
the slot.

## 38. Fireball: AoE targeting + save-for-half

**Use case:** A Wizard casts Fireball at a point in space. The
engine resolves the target list from the area shape, the host
rolls each target's save, and `castSpellSave` packages the
half-damage outcomes uniformly.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();

const wizard = {
  id: 'pc', proficiencyBonus: 3, abilityScores: { int: 18 },
  spellSlots: [{ level: 3, used: 0, max: 2 }]
};
const fireball = engine.spells.fireball;

// --- Cast: consume a slot (the engine handles V/S/M, slot, concentration) ---
let actor = wizard;
({ actor } = engine.Spellcasting.castSpell(actor, fireball));

// --- Resolve the area: a 20-ft sphere at the origin point ---
const candidates = [
  { id: 'orc-1',    position: { x: 5,  y: 0 } },
  { id: 'orc-2',    position: { x: 15, y: 8 } },
  { id: 'goblin-1', position: { x: 25, y: 0 } },    // out of range
  { id: 'ally',     position: { x: -3, y: -2 } }
];
const hits = engine.Spellcasting.targetsInArea({
  origin: { x: 0, y: 0 }, shape: 'sphere', size: 20,
  candidates
});
// hits  → [orc-1, orc-2, ally]    (within 20 ft)

// --- Roll the spell save for each target (DEX vs the spell's DC) ---
const spellDC = 8 + 3 + 4;           // 8 + prof + INT mod
const damageTotal = engine.Dice.roll('8d6').total;

const results = hits.map((target) => ({
  targetId: target.id,
  // Host runs each target's save:
  saved: engine.Checks.savingThrow({
    abilityScore: 12, dc: spellDC, ability: 'dex', actor: target
  }).success,
  damage: damageTotal
}));

// --- Package half-damage-on-success outcomes ---
const outcomes = engine.Spellcasting.castSpellSave(results,
  { halfOnSuccess: true });
// outcomes:
//   [{ targetId: 'orc-1',    saved: false, appliedDamage: 28 },
//    { targetId: 'orc-2',    saved: true,  appliedDamage: 14 },
//    { targetId: 'ally',     saved: false, appliedDamage: 28 }]

// Host then applies each `appliedDamage` via Combat.applyDamage.
```

`AOE_SHAPES = ['sphere', 'cube', 'cone', 'line', 'cylinder',
'emanation']`. Cone and line require a `direction` vector; the
others ignore it.

## 39. Monster legendary actions in a round

**Use case:** An Adult Red Dragon takes its turn, then between the
party's turns spends a legendary action. The host calls
`refreshLegendaryActions` at the dragon's turn start to refresh
the pool; `useLegendaryAction` spends a use; `useLegendaryResistance`
converts a failed save into a success.

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine();
const dragon = engine.monsters['adult-red-dragon'];   // or a host fixture

let actor = {
  id: 'dragon-1',
  legendary: engine.Monsters.freshLegendaryState(dragon),     // { used: 0, max: 3 }
  legendaryResistance: engine.Monsters.freshLegendaryResistance(dragon)
};

// --- Dragon's turn ends; refresh the legendary pool ---
actor = engine.Monsters.refreshLegendaryActions(actor);

// --- Between party turns: spend a Tail Attack ---
let la = engine.Monsters.useLegendaryAction(actor, dragon, 'tail-attack');
// la.option.name === 'Tail Attack'
// la.actor.legendary.used === 1
actor = la.actor;

// --- A spellcaster lands a Hold Monster on the dragon. Spend a
//     Legendary Resistance to convert the failed WIS save to a success. ---
const lr = engine.Monsters.useLegendaryResistance(actor, dragon);
actor = lr.actor;
// lr.ok === true; the dragon shrugs off the Hold Monster.

// --- Lair Actions trigger at initiative count 20 if in the dragon's lair ---
if (engine.Monsters.lairActionAvailable(dragon,
  { initiativeCount: 20, inLair: true })) {
  const lair = engine.Monsters.fireLairAction(dragon, 'magma-eruption');
  // host resolves the eruption's effect on candidates in the lair.
}
```

`engine.Monsters.castInnate(actor, dragon, 'fireball')` decrements
the per-day counter for tracked spells (3/day, 1/day) and reports
at-will spells succeeding without depletion.

## 40. Solo mode: oracle + session + share (since 2.0.0)

**Use case:** Run a solo session with no human DM — engine drives
the dice and the bookkeeping, the oracle drives the rulings, the
session ties it together, and a portable share payload lets you
hand the session to a friend or a CI replay rig.

```js
import {
  createEngine, Dice,
  Solo, Session, Replay,
  STARTER_PARTY
} from '@zeeuw/bag-of-holding';

// 1. Seeded engine for replay-determinism.
const engine = createEngine({ rng: Dice.seededRng(2026) });

// 2. Oracle gets its OWN seeded rng. Sharing the engine's dice
//    rng would silently advance the dice stream and break the
//    rollLog replay; keeping them separate is the whole point of
//    the 2.0 design.
const oracle = engine.Solo.oracle({ rng: Dice.seededRng(7777) });

// 3. One-line session with the starter party + an encounter.
const session = engine.Session.create({
  seed: 2026,
  party: STARTER_PARTY,
  oracle,
  encounter: {
    participants: [
      // Mix party + monsters as the participant list.
      ...STARTER_PARTY.map(r => {
        const s = engine.deriveSheet(r);
        return { id: r.id, dexterity: s.abilityScores.final.dex, speed: s.speed.walk, hp: s.hp.max, hpMax: s.hp.max, ac: s.ac.value };
      }),
      { id: 'goblin-1', dexterity: 14, speed: 30, hp: 7, hpMax: 7, ac: 13 }
    ]
  }
});

// 4. Run a turn. Oracle answers a question. Attack. End turn.
const ruling = oracle.ask('Does the goblin notice us first?', 'unlikely');
session.record('oracle', ruling);          // log the ruling for narrative trace-back

session.attack({
  attackerId: 'thora',
  targetId: 'goblin-1',
  attackBonus: 5,
  damageDice: '1d8',
  damageMod: 3
});

session.endTurn();
session.advanceTime({ minutes: 30 });

// 5. Save / restore / share.
const save = session.serialize();
// → portable JSON the host can persist; restore via
//   engine.Session.restore(save) on the same-fingerprint engine.

const share = engine.Replay.share(session);
const verified = engine.Replay.verify(share);
// verified.ok === true; dice stream reproduces from the seed.
```

The browser sandbox at `examples/solo.html` is the live worked
example — it wires every namespace this recipe touches into
clickable buttons.
