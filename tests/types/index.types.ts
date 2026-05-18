// Type-check smoke test for index.d.ts. This file is *not* executed
// by `node --test` — it's read by `tsc --noEmit` (via the
// `typecheck` script) to catch drift between index.d.ts and the
// runtime surface. When you change a public export, add or update
// an exercise here so the typecheck would fail on a contract break.

import defaultEngine, {
  createEngine,
  Dice,
  Checks,
  Combat,
  Conditions,
  XP,
  Movesets,
  Beats,
  SRD,
  Classes,
  species,
  classes,
  backgrounds,
  feats,
  spells,
  items,
  type Engine,
  type EngineOptions,
  type Species,
  type ClassDef,
  type Background,
  type Feat,
  type Spell,
  type Item,
  type Actor,
  type ConditionName,
  type MasteryHandler,
  type MasteryRider,
  type AttackRollResult,
  type Beat
} from '../../index.js';

// ============================================================
// Default singleton — every namespace returns the documented shape
// ============================================================

const _initiative: number = defaultEngine.Combat.rollInitiative({ dexterity: 16 });

const _attack: AttackRollResult = Combat.attackRoll({ attackBonus: 5, ac: 15 });
if (_attack.hit) {
  Combat.damageRoll({ damageDice: '1d8', damageMod: 3, critical: _attack.critical });
}

const _check = Checks.abilityCheck({ abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 13 });
const _success: boolean = _check.success;

const _save = Checks.savingThrow({ abilityScore: 14, dc: 12 });
const _saveMod: number = _save.mod;

const _roll = Dice.roll('2d6+3');
const _rolls: number[] = _roll.rolls;

// ============================================================
// Conditions — apply / remove are immutable
// ============================================================

const actor: Actor = { id: 'pc' };
const blinded: Actor = Conditions.apply(actor, 'blinded');
const cleared: Actor = Conditions.remove(blinded, 'blinded');
const present: boolean = Conditions.has(blinded, 'blinded');

const tired: Actor = Conditions.exhaustion.gain(actor, 2);
const _level: number = Conditions.exhaustion.level(tired);
const _dead: boolean = Conditions.exhaustion.isDead(tired);

// Discriminator type narrowing on Combat.MASTERY_PROPERTIES — must
// be readonly (we freeze it at runtime).
const _masteryNames: readonly string[] = Combat.MASTERY_PROPERTIES;

// ============================================================
// Engine factory — typed options surface
// ============================================================

const houseRules: EngineOptions = {
  extraSpecies: {
    'half-elf': { id: 'half-elf', name: 'Half-Elf', size: 'medium', speed: 30, traits: ['Adaptable'] }
  },
  extraConditions: ['cursed'],
  extraMastery: {
    pin: (weapon, _target, result) =>
      result.hit ? { kind: 'pin', condition: 'grappled' } : { kind: 'none' }
  }
};

const customEngine: Engine = createEngine(houseRules);
const _pinRider: MasteryRider = customEngine.Combat.applyMastery(
  { id: 'rope', name: 'Rope', type: 'weapon', mastery: 'pin' },
  {},
  { d20: 15, attackBonus: 5, total: 20, ac: 12, hit: true, critical: false, fumble: false }
);

// ============================================================
// XP, Movesets, Beats — all reachable through the engine
// ============================================================

const _level5: number = XP.levelForXP(7000);
const _next: number | null = XP.nextLevelThreshold(0);

const _chips = Movesets.legal({ pc: { xp: 0, level: 1 }, scene: { mode: 'combat' } });
const _chipId: string = _chips[0].id;

const beat: Beat = Beats.makeEmptyBeat('beat.a');
beat.dramaticPurpose = 'Test';
const _validation = Beats.validateBeat(beat);

// ============================================================
// SRD + Classes legacy aliases stay typed
// ============================================================

const _srdSpecies: Record<string, Species> = SRD.species;
const _legacyClasses: Record<string, ClassDef> = Classes;
const _spreadSpecies: Record<string, Species> = species;
const _spreadClasses: Record<string, ClassDef> = classes;
const _spreadBackgrounds: Record<string, Background> = backgrounds;
const _spreadFeats: Record<string, Feat> = feats;
const _spreadSpells: Record<string, Spell> = spells;
const _spreadItems: Record<string, Item> = items;

// ============================================================
// Negative cases — pin two compile-time errors so a regression in
// strictness loudly breaks the typecheck script.
// ============================================================

// @ts-expect-error — `weight` is not a valid ability score
Checks.abilityCheck({ abilityScore: 14, dc: 12, weight: 200 });

// @ts-expect-error — Species without required fields should be a type error
const _badSpecies: Species = { id: 'broken' };

// Reference every local so tsc doesn't complain about unused.
void _initiative; void _attack; void _success; void _saveMod; void _rolls;
void cleared; void present; void _level; void _dead; void _masteryNames;
void _pinRider; void _level5; void _next; void _chipId; void _validation;
void _srdSpecies; void _legacyClasses; void _spreadSpecies; void _spreadClasses;
void _spreadBackgrounds; void _spreadFeats; void _spreadSpells; void _spreadItems;
void _badSpecies; void customEngine;
