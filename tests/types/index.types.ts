// Type-check smoke test for index.d.ts. This file is *not* executed
// by `node --test` — it's read by `tsc --noEmit` (via the
// `typecheck` script) to catch drift between index.d.ts and the
// runtime surface. When you change a public export, add or update
// an exercise here so the typecheck would fail on a contract break.

import defaultEngine, {
  createEngine,
  verifyLog,
  Dice,
  Checks,
  Combat,
  Conditions,
  XP,
  Movesets,
  Beats,
  Character,
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
  type Beat,
  type RNG,
  type RollEntry,
  type VerifyLogResult,
  type EngineRules,
  type ResolvedRules,
  type CharacterRecord,
  type DerivedSheet,
  type DerivedAttack,
  type DerivedSave,
  type DerivedSkill,
  type SkillId,
  type DeathSaveTracker,
  type DeathSaveResult,
  type DeathSaveOutcome,
  type Resource,
  type RefreshKind,
  type DamageOutcome,
  type DamageResult,
  Mechanics
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
  { d20: 15, attackBonus: 5, total: 20, ac: 12, hit: true, critical: false, fumble: false, stance: 'normal' }
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

// === RNG / roll log / verify ===

const seeded: RNG = Dice.seededRng(42);
const _floatInUnitInterval: number = seeded();

const seededEngine: Engine = createEngine({
  rng: Dice.seededRng(1234),
  onRoll: (entry: RollEntry) => { void entry.index; void entry.op; },
  rollLogCap: 1000
});

seededEngine.Combat.attackRoll({ attackBonus: 5, ac: 14 }, 'turn 14 vs orc');
seededEngine.Dice.rollDie(20, 'spot check');
seededEngine.Checks.savingThrow({ abilityScore: 14, dc: 12 }, { actor: 'pc' });

const _log: RollEntry[] = seededEngine.rollLog;

// Both call shapes resolve.
const _viaEngine: VerifyLogResult = seededEngine.verifyLog({ seed: 1234, log: _log });
const _viaModule: VerifyLogResult = verifyLog({ seed: 1234, log: _log });

// Discriminated-union narrowing.
if (!_viaModule.ok) {
  const _idx: number = _viaModule.divergedAt;
  void _idx;
}

// === Rule modifications (Phase B) ===

const houseRulesPack: EngineRules = {
  critOn: [19, 20],
  fumbleOn: [1, 2],
  damageFloor: 0,
  explodingDamageDice: true,
  xpThresholds: { 1: 0, 2: 1000 },
  proficiencyByLevel: { 1: 2, 2: 2 }
};

const grittyEngine: Engine = createEngine({
  rng: Dice.seededRng(99),
  rules: houseRulesPack
});

// Resolved rules exposed for inspection.
const _resolved: ResolvedRules = grittyEngine.rules;
const _critFaces: readonly number[] = _resolved.critOn;

// Rolling functions still typed correctly.
grittyEngine.Combat.attackRoll({ attackBonus: 5, ac: 14 });

// Exploding dice helper is in the Dice namespace.
const _explosiveRoll = Dice.rollExplosive('2d6', Dice.seededRng(42));
void _explosiveRoll.total;

// verifyLog with custom rules.
const _replayWithRules: VerifyLogResult = verifyLog({
  seed: 99,
  log: grittyEngine.rollLog,
  rules: houseRulesPack
});

// XP namespace respects override table.
const _grittyLevel: number = grittyEngine.XP.levelForXP(2000);
void _grittyLevel;

// === Death saves (since 1.1.0) ===

const _deathSaveDC: number = grittyEngine.rules.deathSaveDC;
const _deathThreshold: number = grittyEngine.rules.deathSaveSuccessesRequired;
void _deathSaveDC; void _deathThreshold;

const tracker: DeathSaveTracker = defaultEngine.Combat.freshDeathSaves();
void tracker.successes; void tracker.failures; void tracker.stable; void tracker.dead;

const downedActor: Actor = defaultEngine.Combat.dropToZero({ id: 'pc' });
const _saveResult: DeathSaveResult = defaultEngine.Combat.deathSave(downedActor, 'turn 1');
const _outcome: DeathSaveOutcome = _saveResult.outcome;
void _outcome;

const _damageResult: { outcome: DeathSaveOutcome; actor: Actor } =
  defaultEngine.Combat.applyDamageWhileDown(downedActor, 5, { critical: true });
void _damageResult;

const _stabilised: Actor = defaultEngine.Combat.stabilize(downedActor);
const _revived: Actor = defaultEngine.Combat.reviveTo(downedActor, 8);
void _stabilised; void _revived;

// Custom DC + threshold via rules.
const _heroicEngine: Engine = createEngine({
  rules: { deathSaveDC: 5, deathSaveSuccessesRequired: 1 }
});
void _heroicEngine;

// === Rest mechanics (since 1.2.0) ===

const restingActor: Actor = {
  id: 'pc',
  hitDie: 8, hitDiceTotal: 5, hitDiceUsed: 2,
  abilityScores: { con: 14 }, hp: 12, hpMax: 35
};
const _shortRestResult = defaultEngine.Rest.spendHitDie(restingActor, 'short rest');
const _hpAfter: number = _shortRestResult.hpAfter;
const _restedActor: Actor = _shortRestResult.actor;
void _hpAfter; void _restedActor;

const _longRested: Actor = defaultEngine.Rest.longRest(restingActor);
void _longRested;

const _grittyEngine: Engine = createEngine({
  rules: { longRestHitDiceRecovery: 'none' }
});
const _grittyMode: 'half' | 'all' | 'none' = _grittyEngine.rules.longRestHitDiceRecovery;
void _grittyMode;

const _shortRested: Actor = defaultEngine.Rest.shortRest(restingActor);
void _shortRested;

// === Class mechanics (since 1.3.0) ===

const _refreshKinds: readonly RefreshKind[] = Mechanics.REFRESH_KINDS;
void _refreshKinds;

const _secondWindResource: Resource = Mechanics.freshResource({ max: 1, refreshes: 'short' });
const _fighterResources: Record<string, Resource> = Mechanics.freshResources(
  defaultEngine.classes.fighter,
  3
);
void _secondWindResource; void _fighterResources;

const _classedActor: Actor = {
  id: 'pc', classId: 'fighter', level: 3,
  resources: _fighterResources
};
const _swResult = defaultEngine.Mechanics.apply(_classedActor, 'secondWind', {}, 'tag');
void _swResult;

// Module-level Mechanics surface is the same shape.
const _spendResult = Mechanics.spendResource(_classedActor, 'secondWind');
void _spendResult;

const _refreshed: Actor = Mechanics.refreshResources(_classedActor, 'long');
void _refreshed;

// === Damage pipeline (since 1.4.0) ===

const _resistedDamage: number = defaultEngine.Combat.applyDamageModifiers(
  { damageResistances: ['fire'] },
  { amount: 8, type: 'fire' }
);
void _resistedDamage;

const _withTempHp: Actor = defaultEngine.Combat.grantTempHp({ id: 'pc' }, 5);
void _withTempHp;

const _appliedDamage: DamageResult = defaultEngine.Combat.applyDamage(
  { id: 'pc', hp: 20, hpMax: 30, damageResistances: ['fire'] },
  { amount: 10, type: 'fire', source: 'dragon-breath' }
);
const _damageOutcome: DamageOutcome = _appliedDamage.outcome;
void _damageOutcome;

const _healed = defaultEngine.Combat.heal({ id: 'pc', hp: 5, hpMax: 20 }, 8);
const _healedDelta: number = _healed.healed;
void _healedDelta;

// Damage roll now optionally carries a damageType through.
const _typedDamage = Combat.damageRoll({
  damageDice: '1d6', damageMod: 2, damageType: 'cold'
});
const _maybeType: string | undefined = _typedDamage.damageType;
void _maybeType;

// === Character sheet derivation ===

const fighterRecord: CharacterRecord = {
  id: 'pc-1',
  name: 'Aldwin',
  speciesId: 'human',
  backgroundId: 'soldier',
  classId: 'fighter',
  level: 3,
  abilityScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  equipment: {
    armorId: 'chain-shirt',
    shieldId: 'shield',
    weaponIds: ['longsword']
  }
};

// Engine-bound form — common case.
const sheetA: DerivedSheet = defaultEngine.deriveSheet(fighterRecord);
const _ac: number = sheetA.ac.value;
const _acBreakdown: { armor: number; shield: number; dex: number; misc: number } = sheetA.ac.breakdown;

// Module-level form — engine satisfies CharacterRegistries structurally.
const sheetB: DerivedSheet = Character.deriveSheet(fighterRecord, defaultEngine);
const _attacks: DerivedAttack[] = sheetB.attacks;
const _firstAttackBonus: number = _attacks[0].attackBonus;

// Save / skill shapes round-trip from the per-ability records.
const _strSave: DerivedSave = sheetA.saves.str;
const _athletics: DerivedSkill = sheetA.skills.athletics;
const _athleticsAbility: 'str'|'dex'|'con'|'int'|'wis'|'cha' = _athletics.ability;

// Spellcasting is `null | { … }` — narrowed by the runtime branch.
if (sheetA.spellcasting !== null) {
  const _dc: number = sheetA.spellcasting.saveDC;
  void _dc;
}

// Skill table for UI rendering.
const _skillTable: Readonly<Record<SkillId, 'str'|'dex'|'con'|'int'|'wis'|'cha'>> = Character.SKILL_ABILITY;
void _skillTable;

// @ts-expect-error — level must be a number
const _badRecord: CharacterRecord = { ...fighterRecord, level: 'three' };

// Reference every local so tsc doesn't complain about unused.
void _initiative; void _attack; void _success; void _saveMod; void _rolls;
void cleared; void present; void _level; void _dead; void _masteryNames;
void _pinRider; void _level5; void _next; void _chipId; void _validation;
void _srdSpecies; void _legacyClasses; void _spreadSpecies; void _spreadClasses;
void _spreadBackgrounds; void _spreadFeats; void _spreadSpells; void _spreadItems;
void _badSpecies; void customEngine;
void seeded; void _floatInUnitInterval; void seededEngine;
void _log; void _viaEngine; void _viaModule;
void sheetA; void sheetB; void _ac; void _acBreakdown; void _attacks;
void _firstAttackBonus; void _strSave; void _athletics; void _athleticsAbility;
void _badRecord;
void houseRulesPack; void grittyEngine; void _resolved; void _critFaces;
void _explosiveRoll; void _replayWithRules;
