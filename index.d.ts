// Type definitions for bag-of-holding.
//
// Hand-maintained alongside the JS surface. When you add or change
// a public export in `index.js`, `src/engine.js`, or any of the
// rules modules, update this file in the same commit — the
// typecheck script (`npm run typecheck`) is the drift guard.

// ============================================================
// Core scalars and record shapes
// ============================================================

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/**
 * SRD 5.2 boolean condition names. Plugins may extend this set via
 * `createEngine({ extraConditions })`; once added they are first-
 * class strings in the engine's condition vocabulary.
 */
export type ConditionName =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled'
  | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified'
  | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
  | string;

/** The eight SRD 5.2 weapon mastery property names. */
export type MasteryName =
  | 'cleave' | 'graze' | 'nick' | 'push'
  | 'sap' | 'slow' | 'topple' | 'vex'
  | string;

export interface Species {
  id: string;
  name: string;
  size: Size;
  speed: number;
  traits?: string[];
}

export interface ClassDef {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility?: Ability;
  savingThrowProficiencies?: Ability[];
  weaponMasterySlots?: number;
  spellcasting?: { ability: Ability; cantripsKnown?: Record<number, number> };
  features?: Record<number, string[]>;
}

export interface OriginFeatRef {
  id: string;
  variant?: string;
}

export interface Background {
  id: string;
  name: string;
  abilityScores: Ability[];
  skillProficiencies: string[];
  toolProficiency?: string;
  originFeat: OriginFeatRef;
}

export interface Feat {
  id: string;
  name: string;
  category: 'origin' | 'general' | 'fighting-style' | 'epic-boon' | string;
  variants?: string[];
  grants?: Record<string, unknown>;
  repeatable?: boolean;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  // Engine-side helpers — optional, mechanics-specific.
  damage?: string;
  healing?: string;
  save?: Ability;
  reaction?: boolean;
  acBonus?: number;
  autohit?: boolean;
  projectiles?: number;
  sets?: Record<string, string>;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | string;
  // Weapon-only fields.
  damage?: string;
  damageType?: string;
  properties?: string[];
  mastery?: MasteryName;
  // Armor-only fields.
  ac?: number;
  acBonus?: number;
  addsDex?: boolean;
  maxDex?: number;
  // Consumable-only fields.
  heals?: string;
}

// ============================================================
// Dice
// ============================================================

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceRoll {
  spec: string;
  rolls: number[];
  modifier: number;
  total: number;
}

export interface DiceNamespace {
  parse(spec: string): DiceSpec;
  rollDie(sides: number): number;
  roll(spec: string): DiceRoll;
  rollAdvantage(spec: string): DiceRoll;
  rollDisadvantage(spec: string): DiceRoll;
}

// ============================================================
// Checks
// ============================================================

export interface AbilityCheckArgs {
  abilityScore: number;
  proficient?: boolean;
  proficiencyBonus?: number;
  dc: number;
}

export interface AbilityCheckResult {
  d20: number;
  mod: number;
  total: number;
  dc: number;
  success: boolean;
}

export interface ChecksNamespace {
  modFromScore(score: number): number;
  clampDC(dc: number): number;
  abilityCheck(args: AbilityCheckArgs): AbilityCheckResult;
  savingThrow(args: AbilityCheckArgs): AbilityCheckResult;
}

// ============================================================
// Combat (engine-bound)
// ============================================================

export interface AttackRollArgs {
  attackBonus: number;
  ac: number;
}

export interface AttackRollResult {
  d20: number;
  attackBonus: number;
  total: number;
  ac: number;
  hit: boolean;
  critical: boolean;
  fumble: boolean;
}

export interface DamageRollArgs {
  damageDice: string;
  damageMod?: number;
  critical?: boolean;
}

export interface DamageRollResult {
  damageDice: string;
  baseRolls: number[];
  critRolls: number[];
  damageMod: number;
  total: number;
}

export interface InitiativeArgs {
  dexterity: number;
}

/**
 * A mastery rider — what the loop should additionally do after the
 * core attack resolves. `kind: 'none'` means the property didn't
 * fire this attack (e.g. graze on a hit, vex on a miss).
 */
export type MasteryRider =
  | { kind: 'none' }
  | { kind: 'cleave'; range: number }
  | { kind: 'graze'; damage: number }
  | { kind: 'nick'; extraAttack: true }
  | { kind: 'push'; distance: number; sizeCap: Size }
  | { kind: 'sap'; disadvantage: true }
  | { kind: 'slow'; speedReduction: number }
  | { kind: 'topple'; saveDC: number; ability: Ability; onFail: ConditionName }
  | { kind: 'vex'; advantage: true }
  | { kind: string; [extra: string]: unknown };  // plugin-defined

/**
 * Plugin handler signature. Pure — same inputs, same output —
 * because the engine commits to replay-determinism.
 */
export type MasteryHandler = (
  weapon: Item,
  target: unknown,
  attackResult: AttackRollResult,
  attacker?: { proficiencyBonus?: number } & Record<string, unknown>
) => MasteryRider;

export interface CombatNamespace {
  rollInitiative(args: InitiativeArgs): number;
  attackRoll(args: AttackRollArgs): AttackRollResult;
  damageRoll(args: DamageRollArgs): DamageRollResult;
  readonly MASTERY_PROPERTIES: readonly MasteryName[];
  applyMastery(
    weapon: Item,
    target: unknown,
    attackResult: AttackRollResult,
    attacker?: { proficiencyBonus?: number } & Record<string, unknown>
  ): MasteryRider;
}

// ============================================================
// Conditions (engine-bound)
// ============================================================

export interface Actor {
  id?: string;
  conditions?: ConditionName[];
  exhaustion?: number;
  [extra: string]: unknown;
}

export interface ExhaustionNamespace {
  level(actor: Actor): number;
  gain(actor: Actor, amount?: number): Actor;
  reduce(actor: Actor, amount?: number): Actor;
  set(actor: Actor, level: number): Actor;
  modifierToD20Tests(actor: Actor): number;
  speedPenalty(actor: Actor): number;
  isDead(actor: Actor): boolean;
}

export interface ConditionsNamespace {
  readonly CONDITIONS: readonly ConditionName[];
  readonly EXHAUSTION_MAX: number;
  has(actor: Actor, condition: ConditionName): boolean;
  apply(actor: Actor, condition: ConditionName): Actor;
  remove(actor: Actor, condition: ConditionName): Actor;
  exhaustion: ExhaustionNamespace;
}

// ============================================================
// XP
// ============================================================

export interface PC {
  xp: number;
  level: number;
  [extra: string]: unknown;
}

export interface XPNamespace {
  readonly THRESHOLDS: Readonly<Record<number, number>>;
  readonly PROFICIENCY_BY_LEVEL: Readonly<Record<number, number>>;
  levelForXP(xp: number): number;
  nextLevelThreshold(xp: number): number | null;
  awardMilestone(args: { pc: PC; beat?: { targetPlaytimeMinutes?: number } }): {
    xpDelta: number;
    newTotal: number;
    willLevelUp: boolean;
  };
}

// ============================================================
// Movesets
// ============================================================

export type ActionCost = 'free' | 'action' | 'bonus' | 'reaction';

export interface ActionChip {
  id: string;
  label: string;
  cost: ActionCost | string;
}

export interface SceneState {
  mode?: 'combat' | 'exploration' | 'audience' | string;
  [extra: string]: unknown;
}

export interface MovesetsNamespace {
  legal(args: { pc: PC; scene?: SceneState }): ActionChip[];
}

// ============================================================
// Beats
// ============================================================

export interface ArchetypeSlot {
  role: string;
  weight?: number;
}

export interface Beat {
  id: string;
  dramaticPurpose: string;
  targetPlaytimeMinutes: number;
  prerequisites?: string[];
  setRequiredFlags?: string[];
  preferredLocation?: string | null;
  fallbackLocations?: string[];
  requiredArchetypes?: ArchetypeSlot[];
  boundEntities?: Record<string, unknown>;
  successors?: string[];
}

export interface Thread {
  beats: Beat[];
  currentIndex: number;
}

export interface AdvanceResult {
  thread: Thread;
  advanced: boolean;
  finished?: boolean;
  reason?: string;
}

export interface BeatValidation {
  valid: boolean;
  errors: string[];
}

export interface BeatsNamespace {
  readonly ARCHETYPE_ROLES: readonly string[];
  validateBeat(beat: unknown): BeatValidation;
  makeEmptyBeat(id: string): Beat;
  createThread(beats: Beat[]): Thread;
  currentBeat(thread: Thread): Beat | null;
  isReady(beat: Beat | null, state: { flags?: Record<string, boolean> }): boolean;
  isComplete(beat: Beat | null, state: { flags?: Record<string, boolean> }): boolean;
  advance(thread: Thread, state: { flags?: Record<string, boolean> }): AdvanceResult;
  castArchetypes(
    beat: Beat,
    opts: { entityProvider: (slot: ArchetypeSlot) => unknown }
  ): { cast: Record<string, unknown> | null; missing: ArchetypeSlot | null; error: string | null };
}

// ============================================================
// Engine factory
// ============================================================

export interface EngineOptions {
  extraSpecies?: Record<string, Species>;
  extraClasses?: Record<string, ClassDef>;
  extraBackgrounds?: Record<string, Background>;
  extraFeats?: Record<string, Feat>;
  extraSpells?: Record<string, Spell>;
  extraItems?: Record<string, Item>;
  extraConditions?: string[];
  extraMastery?: Record<string, MasteryHandler>;
}

export interface Engine {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
  Dice: DiceNamespace;
  Checks: ChecksNamespace;
  Combat: CombatNamespace;
  Conditions: ConditionsNamespace;
  XP: XPNamespace;
  Movesets: MovesetsNamespace;
  Beats: BeatsNamespace;
}

export function createEngine(opts?: EngineOptions): Engine;

// ============================================================
// Default singleton + spread named exports
// ============================================================

declare const defaultEngine: Engine;
export default defaultEngine;

export const Dice: DiceNamespace;
export const Checks: ChecksNamespace;
export const Combat: CombatNamespace;
export const Conditions: ConditionsNamespace;
export const XP: XPNamespace;
export const Movesets: MovesetsNamespace;
export const Beats: BeatsNamespace;

export const species: Record<string, Species>;
export const classes: Record<string, ClassDef>;
export const backgrounds: Record<string, Background>;
export const feats: Record<string, Feat>;
export const spells: Record<string, Spell>;
export const items: Record<string, Item>;

/** Grouped data registries — convenience alias matching the
 *  pre-Phase-A namespace shape. */
export const SRD: {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
};

/** Legacy alias for the class-definition map. Same content as
 *  `classes`, kept for back-compat with pre-Phase-A consumers. */
export const Classes: Record<string, ClassDef>;
