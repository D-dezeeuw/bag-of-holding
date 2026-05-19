# Recipes

Pragmatic patterns for building clients on top of `@zeeuw/bag-of-holding`.
Each recipe is a self-contained working example: copy, adapt, ship.

[`spec.md`](spec.md) is the reference — *what exists*. This file is
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

- [16. Pathfinder-style crit range (19–20)](#16-pathfinder-style-crit-range-1920)
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

---

## 1. Roll dice from a static HTML page

**Use case:** You want a one-file dice roller — no build step, no
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
the bundler can't tree-shake the engine — the default singleton
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

**Use case:** The bread and butter combat sequence — one attack,
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

Every value the engine produces is structured — the UI can show
the d20 face, the damage dice, the mastery rider, all without
re-deriving anything.

## 6. Critical hit handling

**Use case:** Nat 20 logic — extra damage dice, narration cue,
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

For house rules (Pathfinder-style 19–20 crit ranges, exploding
crit dice, "max damage on crit" packs), see recipes 16–20 — the
Phase B `rules` knob system shipped in `0.2.0`.

## 7. Attack from stealth (compound action with context tags)

**Use case:** A Rogue uses Stealth, then attacks — three rolls,
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

// 2. Attack — advantage if stealth succeeded
const attack = stealth.success
  ? engine.Dice.rollAdvantage('1d20+5', { ...ctx, step: 'attack' })
  : engine.Dice.roll('1d20+5', { ...ctx, step: 'attack' });

// 3. If it hits, damage — plus Sneak Attack dice if we had advantage
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
// context — postmortem trivially reconstructs the sequence.
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
// — we compare totals — but the function requires one. Pass 5 (the
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

// Apply throws on unknown conditions — the vocabulary is closed.
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

Combat math doesn't auto-apply the −2/level penalty yet —
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

**Gotcha:** species records in SRD 5.2 carry no ability bonuses —
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

The condition is just a string in the vocabulary — the *effects*
are the host's responsibility. To bake mechanical effects in
(e.g., disadvantage on saving throws while cursed), you'd compose
that yourself today; `0.7.0` adds engine-enforced condition
effects.

## 15. Themed pack as a plugin bundle

**Use case:** Ship a coherent thematic pack — species, classes,
items, monsters — as a single object a host can opt into.

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
package, a JSON file, a literal — any shape the host can pass
straight into `createEngine`.

## 16. Pathfinder-style crit range (19–20)

**Use case:** Wider crit range — common in Pathfinder, in "this
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

**Use case:** Every damage die that rolls max rolls again — chains
can compound, producing rare but spectacular damage. Borrowed from
Savage Worlds; popular in over-the-top action campaigns.

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
stretch — otherwise PCs gain proficiency bumps faster than levels.

## 19. No-damage-floor mode

**Use case:** A heavy debuff (Bane, Bestow Curse, Bardic Vicious
Mockery on a weak target) reduces damage below zero. SRD says
"floor at 1." Some packs want "the modifier fully cancels — the
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

**Use case:** Ship a coherent pack — homebrew species, items,
conditions, AND rule modifications — as one object a host can
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
engine.rules.critOn;     // → [19, 20]  — host can introspect what's loaded
```

Phase A content options (`extraSpecies`, `extraItems`, etc.) and
Phase B `rules` overrides live in the same `EngineOptions`
object, so a "pack" is just a literal. No registration ceremony,
no plugin lifecycle — the host hands the object to `createEngine`
and gets a pre-configured engine back.

## 21. Seeded session

**Use case:** Reproducible play — same seed produces the same
sequence of rolls for any consumer running this exact engine
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
happens — the Nerd-mode sidebar of an AI-DM client.

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
to `rollLog` — readers see the same shape either way.

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

**Use case:** Run a tutorial / preview engine that doesn't
contaminate the live campaign — different rules, different
seed, fully isolated registries.

```js
import { createEngine, Dice } from '@zeeuw/bag-of-holding';

const liveGame = createEngine({
  rng: Dice.seededRng(playerSeed),
  rollLogCap: 5000
});

const tutorialSandbox = createEngine({
  // Math.random — non-deterministic, just for vibes
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
mechanics; the LLM narrates the outcome. Engine never talks to
the LLM directly — see [boundary.md](boundary.md).

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
given what the AI requested — *"the AI claims it rolled X, did it?"*
becomes a verifiable question.
