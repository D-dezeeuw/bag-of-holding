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

/** Spellcasting progression tier. `full` = Wizard/Cleric/Druid/Bard/
 *  Sorcerer; `half` = Paladin/Ranger; `warlock` = Pact Magic (short-
 *  rest refresh); `none` = non-caster classes. */
export type CasterProgression = 'full' | 'half' | 'warlock' | 'none';

export interface ClassDef {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility?: Ability;
  savingThrowProficiencies?: Ability[];
  weaponMasterySlots?: number;
  /** Map of `level → extra attacks per Attack action`. Fighter 5 →
   *  `{ 5: 1 }` (Extra Attack adds one). Read by
   *  `Combat.attacksPerAction`. */
  extraAttacks?: Record<number, number>;
  spellcasting?: {
    ability: Ability;
    cantripsKnown?: Record<number, number>;
    /** Slot progression family. Defaults missing for non-casters. */
    progression?: CasterProgression;
    /** `'prepared'` for prep classes (Cleric/Druid/Paladin/Ranger/
     *  Wizard); `'known'` for known-list classes (Bard/Sorcerer/
     *  Warlock). */
    preparation?: 'prepared' | 'known';
  };
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

/** SRD 5.2 monster stat block. Carries the fields a host needs to
 *  wire a creature into the encounter system: AC, HP, abilities,
 *  speed, attacks, CR. Plugins extend the registry via
 *  `createEngine({ extraMonsters })`. */
export interface Monster {
  id: string;
  name: string;
  cr: number;
  ac: number;
  hp: number;
  size: Size;
  speed: number;
  abilityScores: Record<Ability, number>;
  attacks?: Array<{ name: string; attackBonus: number; damage: string; damageType?: string }>;
  traits?: string[];
  skills?: Record<string, number>;
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
  | { index: number; op: 'savingThrow';      abilityScore: number; proficient: boolean; proficiencyBonus: number; d20: number; mod: number; total: number; dc: number; success: boolean; context?: unknown }
  | { index: number; op: 'deathSave';        d20: number; outcome: DeathSaveOutcome;                                                                 context?: unknown };

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
  /** Attacker actor — optional. If passed along with `target`, the
   *  engine derives advantage/disadvantage from active conditions. */
  attacker?: Actor;
  /** Target actor — optional. See `attacker` for the condition-
   *  aware advantage/disadvantage path. */
  target?: Actor;
  /** Distance attacker → target in feet. Matters only for the
   *  `prone` target rule (within 5 ft → advantage; further →
   *  disadvantage). */
  attackerDistanceFt?: number;
}

export interface AttackRollResult {
  d20: number;
  attackBonus: number;
  total: number;
  ac: number;
  hit: boolean;
  critical: boolean;
  fumble: boolean;
  /** Advantage / disadvantage / normal stance taken by the roll.
   *  Surfaced so a host's UI can label the roll without re-deriving
   *  the conditions. */
  stance: 'normal' | 'advantage' | 'disadvantage';
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

/** A participant in an encounter: at minimum an `id`, `dexterity`,
 *  and `speed`. Hosts can attach any extra fields (hp, faction, etc.);
 *  the encounter tracker preserves them. */
export interface Participant {
  id: string;
  dexterity: number;
  speed: number;
  [extra: string]: unknown;
}

/** Per-actor budget for one turn. `null` means "no budget" — used
 *  for movement on a flying creature standing still, etc. */
export interface ActionBudget {
  action: number;
  bonus: number;
  reaction: number;
  movement: number | null;
}

/** Encounter state. Pure — every mutation returns a new state. */
export interface EncounterState {
  order: (Participant & { initiative: number; initiativeD20: number })[];
  turnIndex: number;
  round: number;
  budgets: Record<string, ActionBudget>;
  log: Array<{ kind: string; [extra: string]: unknown }>;
}

export type CoverName = 'none' | 'half' | 'three-quarters' | 'full';

export interface CombatNamespace {
  /** `context` (engine-bound only) attaches to the corresponding
   *  `RollEntry` for trace-back. */
  rollInitiative(args: InitiativeArgs, context?: unknown): number;
  attackRoll(args: AttackRollArgs, context?: unknown): AttackRollResult & { cancelled?: true };
  damageRoll(args: DamageRollArgs, context?: unknown): DamageRollResult;
  readonly MASTERY_PROPERTIES: readonly MasteryName[];
  applyMastery(
    weapon: Item,
    target: unknown,
    attackResult: AttackRollResult,
    attacker?: { proficiencyBonus?: number } & Record<string, unknown>
  ): MasteryRider;

  // === Encounter system (since 0.4.0) ===
  /** Start an encounter: rolls initiative for every participant and
   *  builds a fresh action-budget table. */
  startEncounter(participants: Participant[]): EncounterState;
  /** Sort participants by initiative without building full state.
   *  Useful for previewing the turn order before committing. */
  rollOrder(participants: Participant[]): EncounterState['order'];
  currentActor(state: EncounterState): Participant | null;
  /** Advance to the next actor and refresh their budget. Returns
   *  `finished: true` only when the encounter has zero participants. */
  endTurn(state: EncounterState): { state: EncounterState; finished: boolean };
  /** Remove a participant (death, fled, withdrew). */
  removeParticipant(state: EncounterState, actorId: string): EncounterState;
  /** Spend a budget slot. `amount` defaults to 1; movement spends feet. */
  spend(
    state: EncounterState,
    actorId: string,
    cost: 'action' | 'bonus' | 'reaction' | 'movement' | 'free' | string,
    amount?: number
  ): { allowed: true; state: EncounterState } | { allowed: false; reason: string };
  /** Fresh budget object for an actor with the given speed. */
  freshBudget(speed: number): ActionBudget;
  /** Number of attacks per Attack action for a class at a level. */
  attacksPerAction(classDef: ClassDef | null | undefined, level: number): number;
  /** Resolve an opportunity attack. Returns the new encounter state
   *  alongside the attack outcome, or `triggered: false` with a reason. */
  opportunityAttack(
    state: EncounterState,
    args: {
      reactorId: string;
      attackerArgs: AttackRollArgs;
      disengaged?: boolean;
      context?: unknown;
    }
  ):
    | { triggered: true; attack: AttackRollResult; state: EncounterState }
    | { triggered: false; reason: string; state: EncounterState };
  /** Effective AC after cover. `null` when cover is `full`. */
  effectiveAc(baseAc: number, cover?: CoverName | string): number | null;
  /** Classify ranged distance against normal/long range. */
  rangeBand(args: { distance: number; normalRange: number; longRange: number }):
    'in-range-normal' | 'in-range-long' | 'out-of-range';
  readonly ACTION_COSTS: readonly string[];
  readonly COVER_BONUSES: Readonly<Record<CoverName, number | null>>;

  // === Death saves (since 1.1.0) ===
  /** Fresh, zeroed death-save tracker. SRD 5.2 § Damage and
   *  Healing — Death Saving Throws. */
  freshDeathSaves(): DeathSaveTracker;
  /** Drop an actor to 0 HP: applies Unconscious, initialises the
   *  death-save tracker. Fires `onConditionApplied`. */
  dropToZero(actor: Actor): Actor;
  /** Roll one death save. Returns the new actor (with the tracker
   *  advanced) and the outcome. Logs the d20 face to `rollLog` and
   *  fires `onDeath` on the third failure. */
  deathSave(actor: Actor, context?: unknown): DeathSaveResult;
  /** Apply damage to an actor already at 0 HP. Counts as one failed
   *  save (two on a critical hit, or instant death if `damageTaken
   *  >= hpMax`). Fires `onDeath` on the killing blow. */
  applyDamageWhileDown(
    actor: Actor,
    damageTaken: number,
    args?: { critical?: boolean; hpMax?: number }
  ): { outcome: DeathSaveOutcome; actor: Actor };
  /** Stabilise the actor (Medicine check, spare-the-dying). Stays
   *  at 0 HP and Unconscious; tracker resets and is flagged stable. */
  stabilize(actor: Actor): Actor;
  /** Revive the actor to a positive HP. Clears the tracker and
   *  removes Unconscious. Throws if `hp < 1`. */
  reviveTo(actor: Actor, hp: number): Actor;
}

/** Tracker stored on the actor while at 0 HP. */
export interface DeathSaveTracker {
  successes: number;
  failures: number;
  stable: boolean;
  dead: boolean;
}

export type DeathSaveOutcome =
  | 'success' | 'failure' | 'stable' | 'dead' | 'revived' | 'noop';

export interface DeathSaveResult {
  d20: number;
  outcome: DeathSaveOutcome;
  actor: Actor;
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

/** Mechanical-effect flags a condition imposes on the math.
 *  Boolean flags OR together when multiple conditions are active. */
export interface ConditionEffect {
  attackerDisadvantage?: boolean;
  ownAttackDisadvantage?: boolean;
  ownAttackAdvantage?: boolean;
  ownCheckDisadvantage?: boolean;
  targetAdvantage?: boolean;
  targetDisadvantage?: boolean;
  autoFailStrDexSaves?: boolean;
  saveDexDisadvantage?: boolean;
  incapacitates?: boolean;
  speedZero?: boolean;
  critIfAttackerWithin5?: boolean;
  cantSpeak?: boolean;
  cantSee?: boolean;
  cantHear?: boolean;
  proneOnTarget?: boolean;
  socialDisadvantageVsCharmer?: boolean;
  resistance?: 'all' | string;
  [extra: string]: unknown;
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
  /** Map of beat id → index, populated by `createThread` for O(1)
   *  successor lookups. */
  byId: Record<string, number>;
  /** Sub-thread stack. Empty = no nested thread; non-empty = the
   *  topmost entry is the currently-active sub-thread. */
  stack: Thread[];
}

/** Successor-picker callback for branching threads. Called with the
 *  candidate successor ids (filtered by their prerequisites against
 *  `state.flags`) plus the current state. Must return one of the
 *  candidate ids; returning anything else causes `advance` to
 *  refuse with a clear reason. */
export type SuccessorChooser = (args: {
  candidates: string[];
  state: { flags?: Record<string, boolean> };
  currentBeat: Beat;
}) => string;

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
  advance(
    thread: Thread,
    state: { flags?: Record<string, boolean> },
    opts?: { chooseSuccessor?: SuccessorChooser }
  ): AdvanceResult;
  /** Push a nested sub-thread (side quest, flashback). The runtime
   *  walks the sub-thread to completion, auto-pops, then returns to
   *  the parent's current beat. */
  pushSubThread(thread: Thread, beats: Beat[]): Thread;
  /** Read-only depth of the sub-thread stack (0 = none active). */
  subThreadDepth(thread: Thread): number;
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
  /** DC of a death saving throw. SRD 5.2 default `10`. Heroic packs
   *  lower it; gritty packs raise it. */
  deathSaveDC?: number;
  /** Successes / failures required to stabilise or die. SRD 5.2
   *  default `3`. */
  deathSaveSuccessesRequired?: number;
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
  deathSaveDC: number;
  deathSaveSuccessesRequired: number;
}

/**
 * Plugin Phase C hook events. The five-name set is closed; plugins
 * register handlers under these keys via `createEngine({ hooks })`.
 */
export type HookEvent =
  | 'beforeAttack'
  | 'afterDamage'
  | 'onLevelUp'
  | 'onConditionApplied'
  | 'onDeath';

/** Frozen canonical list of hook event names. */
export const HOOK_EVENTS: readonly HookEvent[];

/**
 * Hook handler signature. Handlers receive a payload (the args being
 * resolved, plus any merged deltas from earlier handlers) and return
 * either `undefined` (no change) or a partial delta object that's
 * `Object.assign`-merged into the payload before the next handler.
 *
 * Setting `cancelled: true` short-circuits the remaining handlers and
 * surfaces on the final payload — for `beforeAttack` this means the
 * attack resolves as a miss without rolling.
 */
export type HookHandler = (payload: Record<string, unknown>) =>
  Record<string, unknown> | void;

/** Registry exposed on `engine.hooks`. Read-only — handler
 *  registration happens via `createEngine({ hooks })`. */
export interface HookRegistry {
  readonly EVENTS: readonly HookEvent[];
  count(event: HookEvent): number;
  fire(event: HookEvent, payload: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Map of `event → handler` (or `event → handler[]` for multiple
 * handlers). Handlers fire in registration order; later handlers
 * see the merged payload from earlier ones.
 */
export type HooksOption = Partial<Record<HookEvent, HookHandler | HookHandler[]>>;

export interface EngineOptions {
  extraSpecies?: Record<string, Species>;
  extraClasses?: Record<string, ClassDef>;
  extraBackgrounds?: Record<string, Background>;
  extraFeats?: Record<string, Feat>;
  extraSpells?: Record<string, Spell>;
  extraItems?: Record<string, Item>;
  extraMonsters?: Record<string, Monster>;
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
  /** Plugin Phase C behavioural hooks. See `HooksOption`. */
  hooks?: HooksOption;
}

/** One slot record on an actor's character sheet. `source: 'pact'`
 *  marks Warlock pact slots (short-rest refresh). */
export interface SpellSlot {
  level: number;
  used: number;
  max: number;
  source?: 'pact' | string;
}

/** Active concentration: one spell at a time per caster. */
export interface ConcentrationState {
  spellId: string;
  level: number;
}

export interface SpellcastingNamespace {
  fullCasterSlots(casterLevel: number, spellLevel: number): number;
  halfCasterSlots(casterLevel: number, spellLevel: number): number;
  warlockPactSlots(casterLevel: number): { count: number; level: number };
  freshSlots(progression: CasterProgression, casterLevel: number): SpellSlot[];
  consumeSlot(slots: SpellSlot[], level: number):
    | { ok: true; slots: SpellSlot[]; levelCast: number }
    | { ok: false; reason: string };
  refundSlot(slots: SpellSlot[], level: number): SpellSlot[];
  longRest(slots: SpellSlot[]): SpellSlot[];
  shortRest(slots: SpellSlot[]): SpellSlot[];
  startConcentration(
    actor: Actor,
    spell: ConcentrationState
  ): { actor: Actor; dropped: ConcentrationState | null };
  concentrationSaveDC(damageTaken: number): number;
  endConcentration(actor: Actor): Actor;
  cantripTier(casterLevel: number): 1 | 2 | 3 | 4;
  scaledDamageSpec(baseSpec: string, casterLevel: number): string;
  preparedSpellCount(args: {
    casterLevel: number;
    abilityMod: number;
    progression?: CasterProgression;
  }): number;
  validatePreparation(args: {
    known: string[];
    prepared: string[];
    casterLevel: number;
    abilityMod: number;
    progression: CasterProgression;
  }): { valid: true } | { valid: false; reason: string };
}

export interface Engine {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
  monsters: Record<string, Monster>;
  Dice: DiceNamespace;
  Checks: ChecksNamespace;
  Combat: CombatNamespace;
  Conditions: ConditionsNamespace;
  XP: XPNamespace;
  Movesets: MovesetsNamespace;
  Beats: BeatsNamespace;
  Spellcasting: SpellcastingNamespace;
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
  /** Hook registry. Read-only; register handlers at engine
   *  construction via `createEngine({ hooks })`. */
  hooks: HookRegistry;
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
export const Spellcasting: SpellcastingNamespace;
export const Character: CharacterNamespace;

export const species: Record<string, Species>;
export const classes: Record<string, ClassDef>;
export const backgrounds: Record<string, Background>;
export const feats: Record<string, Feat>;
export const spells: Record<string, Spell>;
export const items: Record<string, Item>;
export const monsters: Record<string, Monster>;

/** Grouped data registries — convenience alias matching the
 *  pre-Phase-A namespace shape. */
export const SRD: {
  species: Record<string, Species>;
  classes: Record<string, ClassDef>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
  monsters: Record<string, Monster>;
};

/** Legacy alias for the class-definition map. Same content as
 *  `classes`, kept for back-compat with pre-Phase-A consumers. */
export const Classes: Record<string, ClassDef>;
