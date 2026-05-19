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

/**
 * A pseudo-random number generator. Signature matches `Math.random`
 * (zero-arg function returning a float in [0, 1)). Pass
 * `Dice.seededRng(seed)` for deterministic replay.
 */
export type RNG = () => number;

export interface DiceNamespace {
  parse(spec: string): DiceSpec;
  /** Module-level: optional `rng` for determinism.
   *  Engine-bound: optional `context` second arg for trace-back. */
  rollDie(sides: number, rngOrContext?: RNG | unknown): number;
  roll(spec: string, rngOrContext?: RNG | unknown): DiceRoll;
  rollAdvantage(spec: string, rngOrContext?: RNG | unknown): DiceRoll;
  rollDisadvantage(spec: string, rngOrContext?: RNG | unknown): DiceRoll;
  /** Exploding-dice roll: every die that hits max rolls again.
   *  Used by `rules.explodingDamageDice`; also callable directly. */
  rollExplosive(spec: string, rng?: RNG): DiceRoll;
  seededRng(seed: number): RNG;
}

/**
 * The shape of one entry in `engine.rollLog`. Every entry has an
 * `index` (monotonic across the session) and an `op` discriminator;
 * additional fields depend on the operation. Optional `context`
 * carries whatever the caller passed for trace-back.
 */
export type RollEntry =
  | { index: number; op: 'rollDie';          sides: number; value: number;                                                                        context?: unknown }
  | { index: number; op: 'roll';             spec: string;  rolls: number[]; modifier: number; total: number;                                     context?: unknown }
  | { index: number; op: 'rollAdvantage';    spec: string;  rolls: number[]; modifier: number; total: number;                                     context?: unknown }
  | { index: number; op: 'rollDisadvantage'; spec: string;  rolls: number[]; modifier: number; total: number;                                     context?: unknown }
  | { index: number; op: 'rollInitiative';   dexterity: number; value: number;                                                                    context?: unknown }
  | { index: number; op: 'attackRoll';       d20: number; attackBonus: number; total: number; ac: number; hit: boolean; critical: boolean; fumble: boolean; context?: unknown }
  | { index: number; op: 'damageRoll';       damageDice: string; baseRolls: number[]; critRolls: number[]; damageMod: number; total: number;     context?: unknown }
  | { index: number; op: 'abilityCheck';     abilityScore: number; proficient: boolean; proficiencyBonus: number; d20: number; mod: number; total: number; dc: number; success: boolean; context?: unknown }
  | { index: number; op: 'savingThrow';      abilityScore: number; proficient: boolean; proficiencyBonus: number; d20: number; mod: number; total: number; dc: number; success: boolean; context?: unknown };

export interface VerifyLogArgs {
  seed: number;
  log: RollEntry[];
  /** Optional rules object. Must match the rules under which the
   *  log was originally produced — verifying with the wrong rules
   *  diverges at the first crit/damage-floor-affected roll. */
  rules?: EngineRules;
}

export type VerifyLogResult =
  | { ok: true }
  | { ok: false; divergedAt: number; expected: unknown; actual: unknown };

/** Replay a roll log forward from `seed` and verify each operation
 *  reproduces the logged outcome. See `src/replay.js` for the full
 *  contract. */
export function verifyLog(args: VerifyLogArgs): VerifyLogResult;

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
  /** Engine-bound version optionally takes a `context` second arg
   *  that's attached to the corresponding `RollEntry`. Module-level
   *  version takes an optional `rng` instead. */
  abilityCheck(args: AbilityCheckArgs, context?: unknown): AbilityCheckResult;
  savingThrow(args: AbilityCheckArgs, context?: unknown): AbilityCheckResult;
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
  /** `context` (engine-bound only) attaches to the corresponding
   *  `RollEntry` for trace-back. */
  rollInitiative(args: InitiativeArgs, context?: unknown): number;
  attackRoll(args: AttackRollArgs, context?: unknown): AttackRollResult;
  damageRoll(args: DamageRollArgs, context?: unknown): DamageRollResult;
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
// Character sheet (derivation)
// ============================================================

/**
 * SRD 5.2 skill identifiers. Hosts use these strings in
 * `proficiencies.skills` / `background.skillProficiencies`. Each one
 * is governed by exactly one ability score (see SKILL_ABILITY in
 * `src/character.js`).
 */
export type SkillId =
  | 'acrobatics' | 'animal-handling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight-of-hand'
  | 'stealth' | 'survival'
  | string;

/**
 * The persistent character record. The host owns this — saves it to
 * `.dnd.json`, mutates it on level-up / equip / condition events,
 * and asks the engine to derive a sheet from it. See
 * docs/character-sheet.md for the field-by-field contract.
 */
export interface CharacterRecord {
  id: string;
  name: string;
  speciesId: string;
  backgroundId: string;
  classId: string;
  subclassId?: string;
  level: number;
  abilityScores: Record<Ability, number>;
  /** Player's distribution of the background's three ability bumps.
   *  Defaults to +1 to each listed ability (the always-valid even
   *  split per SRD 5.2). */
  abilityScoreBumps?: Partial<Record<Ability, number>>;
  /** Per-level HP rolls, in roll order (index 0 = L1). Missing
   *  entries are averaged from the class hit die. */
  hpRolled?: number[];
  equipment: {
    armorId?: string;
    shieldId?: string;
    weaponIds: string[];
    otherItemIds?: string[];
  };
  proficiencies?: {
    skills?: SkillId[];
    tools?: string[];
    languages?: string[];
    saves?: Ability[];
    expertise?: SkillId[];
  };
  feats?: OriginFeatRef[];
  conditions?: ConditionName[];
  exhaustion?: number;
  spells?: {
    known?: string[];
    prepared?: string[];
    slots?: Array<{ level: number; used: number; max: number }>;
  };
  xp?: number;
  notes?: string;
}

/** One attack line in a derived sheet — one entry per equipped
 *  weapon. The host renders these as the "attacks" row of the sheet. */
export interface DerivedAttack {
  weaponId: string;
  name: string;
  attackBonus: number;
  damageDice: string;
  damageMod: number;
  damageType?: string;
  masteryProperty?: MasteryName;
  properties?: string[];
}

/** One save line. `proficient` is true when the class grants the
 *  ability (or `record.proficiencies.saves` adds it). */
export interface DerivedSave {
  mod: number;
  proficient: boolean;
}

/** One skill line. `expertise` doubles the proficiency portion
 *  (Rogue's Expertise, Bard's Expertise, etc.). */
export interface DerivedSkill {
  ability: Ability;
  mod: number;
  proficient: boolean;
  expertise: boolean;
}

/**
 * The frozen output of `deriveSheet`. Every numeric field that would
 * appear on a paper sheet is precomputed; AC and HP additionally
 * carry breakdowns so the UI can render "13 + 2 (shield)" without
 * re-deriving.
 */
export interface DerivedSheet {
  meta: {
    /** Versioned source tag so a serialised sheet declares its origin.
     *  Bumped when the schema breaks compatibility. */
    source: 'bag-of-holding/character@1';
    speciesId: string;
    classId: string;
    subclassId?: string;
    level: number;
  };
  abilityScores: {
    final: Record<Ability, number>;
    mod: Record<Ability, number>;
  };
  proficiencyBonus: number;
  hp: { max: number };
  ac: {
    value: number;
    breakdown: { armor: number; shield: number; dex: number; misc: number };
  };
  initiative: number;
  speed: { walk: number };
  saves: Record<Ability, DerivedSave>;
  skills: Record<SkillId, DerivedSkill>;
  attacks: DerivedAttack[];
  /** `null` for non-casters so the UI can discriminate without a
   *  `hasOwnProperty` check. */
  spellcasting: null | {
    ability: Ability;
    attackBonus: number;
    saveDC: number;
  };
  passives: { perception: number; insight: number; investigation: number };
  carryingCapacity: { capacity: number; push: number; lift: number };
  activeEffects: {
    conditions: ConditionName[];
    exhaustion: number;
  };
}

/**
 * The subset of an engine that `deriveSheet` consults — content
 * registries plus the resolved XP table for proficiency-by-level
 * lookups. Passing this view (rather than the whole engine) keeps
 * the module-level `Character.deriveSheet` testable without
 * constructing a full engine and avoids the circular dependency
 * `engine → character → engine` would otherwise create.
 */
export interface CharacterRegistries {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  items: Record<string, Item>;
  XP: XPNamespace;
}

export interface CharacterNamespace {
  deriveSheet(record: CharacterRecord, registries: CharacterRegistries): DerivedSheet;
  /** The 18 SRD 5.2 skills with their governing abilities. Exported
   *  so hosts can render skill UIs without duplicating the table. */
  readonly SKILL_ABILITY: Readonly<Record<SkillId, Ability>>;
}

// ============================================================
// Engine factory
// ============================================================

/**
 * Plugin Phase B knobs. Every field is optional; defaults preserve
 * SRD 5.2 behaviour exactly. The merged frozen result lives on
 * `engine.rules`.
 */
export interface EngineRules {
  /** d20 faces that count as critical hits. Default `[20]`.
   *  Pathfinder-style: `[19, 20]`. Champion's Improved Critical
   *  (Fighter L3 subclass feature): `[19, 20]` for that engine. */
  critOn?: number[];
  /** d20 faces that count as fumbles. Default `[1]`. */
  fumbleOn?: number[];
  /** Minimum damage on a successful hit. Default `1`. Set to `0`
   *  in packs where negative modifiers can fully cancel a hit. */
  damageFloor?: number;
  /** When true, every damage die that rolls max triggers another
   *  roll of the same die. Default `false`. */
  explodingDamageDice?: boolean;
  /** Override map of `level → XP threshold`. `null` (or omitted)
   *  uses the SRD 5.2 table. */
  xpThresholds?: Record<number, number> | null;
  /** Override map of `level → proficiency bonus`. `null` (or
   *  omitted) uses the SRD 5.2 table. */
  proficiencyByLevel?: Record<number, number> | null;
}

/** Resolved (frozen, defaults-merged) rules surface exposed on an
 *  engine instance. Same shape as `EngineRules` but every field is
 *  guaranteed present. */
export interface ResolvedRules {
  critOn: readonly number[];
  fumbleOn: readonly number[];
  damageFloor: number;
  explodingDamageDice: boolean;
  xpThresholds: Readonly<Record<number, number>> | null;
  proficiencyByLevel: Readonly<Record<number, number>> | null;
}

export interface EngineOptions {
  extraSpecies?: Record<string, Species>;
  extraClasses?: Record<string, ClassDef>;
  extraBackgrounds?: Record<string, Background>;
  extraFeats?: Record<string, Feat>;
  extraSpells?: Record<string, Spell>;
  extraItems?: Record<string, Item>;
  extraConditions?: string[];
  extraMastery?: Record<string, MasteryHandler>;
  /** Custom RNG. Default `Math.random`. Pass `Dice.seededRng(seed)`
   *  for replay-deterministic play. */
  rng?: RNG;
  /** Called with every roll entry immediately after it lands on
   *  `engine.rollLog`. Use for telemetry, live debug overlays, or
   *  piping rolls into Spektrum history. */
  onRoll?: (entry: RollEntry) => void;
  /** Drop-oldest cap on `engine.rollLog`. Default `Infinity`. The
   *  per-entry `index` is monotonic across the full session, so
   *  dropped-then-kept entries don't shift logical positions. */
  rollLogCap?: number;
  /** Plugin Phase B rule modifications. See `EngineRules`. */
  rules?: EngineRules;
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
  /** Compute a frozen derived sheet from a host-owned character
   *  record. Pure — call as often as state changes. See
   *  docs/character-sheet.md. */
  deriveSheet(record: CharacterRecord): DerivedSheet;
  /** Append-only log of every roll the engine has produced this
   *  session. Plain JSON — serialise it, attach it to bug reports,
   *  feed it to `verifyLog` to confirm reproducibility. */
  rollLog: RollEntry[];
  /** Replay-verify a roll log. Equivalent to the module-level
   *  `verifyLog` export; lives on the engine for ergonomics. */
  verifyLog(args: VerifyLogArgs): VerifyLogResult;
  /** Frozen, defaults-merged rules object for this engine. Exposed
   *  so hosts can introspect "which pack is loaded?" (UI badge,
   *  debug overlay, telemetry). */
  rules: ResolvedRules;
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
export const Character: CharacterNamespace;

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
