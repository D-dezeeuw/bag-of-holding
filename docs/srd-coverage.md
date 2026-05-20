# SRD 5.2 coverage checklist

A line-by-line worklist of what the engine implements against the
[SRD 5.2](https://www.dndbeyond.com/srd) and adjacent rule text. Use
this file as the **single source of truth for what's left** — when
something ships, check it here and reference the release in the
parenthetical.

Every section also names the release that's *planned* to close it,
linking back into [docs/roadmap.md](roadmap.md). The roadmap is the
chronological plan; this file is the topical reference. The two stay
in sync.

## Legend

- `- [x]` — shipped and tested (100/100/100). Followed by `(vX.Y.Z)`.
- `- [~]` — partial / foundation only. Sub-bullet calls out the gap.
- `- [ ]` — not started.
- *(SRD § X)* — pointer back into the [official SRD 5.2 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf).
- **Planned: vX.Y.Z** — under each section heading, names the
  release that's expected to close the remaining boxes in that
  section. Empty when the section is fully shipped or is parallel
  work.

When a sub-release closes a row, **update the line** rather than
appending a new "done" list — the file's value is that the unchecked
boxes are always the live worklist.

---

## 1. Core math: dice, checks, DCs

*(SRD § Playing the Game — The D20 Test, Difficulty Classes)*

**Planned:** fully shipped through v1.0.1; passive-check helper deferred until a real consumer needs it.

- [x] `Dice.roll('XdY±Z')` with parsed result *(v0.0.0)*
- [x] Single-die and explicit explosion `Dice.rollDie`, `Dice.rollExplosive` *(v0.2.0)*
- [x] Seeded RNG (`Dice.seededRng`, Mulberry32) *(v0.1.0)*
- [x] Advantage / disadvantage roll on full expression *(v0.0.0)*
- [x] Ability modifier formula `floor((score − 10) / 2)` *(v0.0.0)*
- [x] DC clamp `[5, 30]` (Very Easy → Nearly Impossible) *(v1.0.1)*
- [x] Proficiency-bonus table L1–L20 *(v0.9.0)*
- [x] XP-threshold table L1–L20 *(v0.9.0)*
- [x] Auto-success on natural 20 / auto-failure on natural 1 for **attacks** *(v0.0.0)*
- [ ] Auto-success / auto-failure on natural 20 / 1 for **non-attack D20 Tests** is *not* an SRD rule (2024 keeps crits attack-only) — document the deliberate non-implementation
- [ ] Passive checks helper (`passiveCheck(ability, prof, mods)`) — partially derived on the sheet for Perception / Insight / Investigation; no general-purpose helper

## 2. Combat math: attacks, damage, criticals

*(SRD § Playing the Game — Combat; § Equipment — Weapons)*

**Planned:** Surprise + initiative tiebreak land with [v1.7.0](roadmap.md#170--combat-actions-menu); hidden/unseen attacker bookkeeping deferred until a host needs full stealth state.

- [x] `Combat.attackRoll` with stance from conditions *(v0.7.0)*
- [x] `Combat.damageRoll` with crit (double dice, single modifier) *(v0.0.0)*
- [x] Damage floor / exploding-dice rule knobs *(v0.2.0)*
- [x] Configurable crit / fumble faces (`critOn`, `fumbleOn`) *(v0.2.0)*
- [x] Weapon Mastery: cleave, graze, nick, push, sap, slow, topple, vex *(v0.0.0, fixed v1.0.1)*
- [x] Initiative roll *(v0.0.0)*
- [x] Encounter state, turn order, action budgets *(v0.4.0)*
- [x] Opportunity attacks *(v0.4.0)*
- [x] Cover (`effectiveAc`, `COVER_BONUSES`) *(v0.4.0)*
- [x] Range bands (`rangeBand`) *(v0.4.0)*
- [x] Multi-attack count via `attacksPerAction(classDef, level)` *(v0.4.0)*
- [ ] Surprise on initiative *(SRD § Combat — Initiative)* — 2024 rules treat Surprise as "disadvantage on initiative roll"; not modelled
- [ ] Initiative tiebreak chain *(SRD § Combat — Initiative)* — higher DEX, then random
- [ ] Hidden / unseen attacker bookkeeping *(SRD § Combat — Unseen Attackers and Targets)*

## 3. Combat actions menu

*(SRD § Playing the Game — Combat — Actions)*

**Planned:** action verbs shipped in [v1.7.0](roadmap.md#170--combat-actions-menu); Mounted Combat + object-interaction-per-turn tracking deferred until a real consumer surfaces.

- [x] Attack (resolves via `attackRoll`) *(v0.0.0)*
- [x] Cast a Spell (resolves via `Spellcasting` — slot consumption side) *(v0.5.0)*
- [x] Dash — extends movement by base speed *(v1.7.0)*
- [x] Disengage — sets `actor.disengaged`, short-circuits opportunity attacks *(v1.7.0)*
- [x] Dodge — sets `actor.dodging`; `attackStance` returns disadvantage to attackers *(v1.7.0)*
- [x] Help — binds `actor.helping = { targetId }` *(v1.7.0)*
- [x] Hide — spends action, reports Stealth check needed *(v1.7.0)*
- [x] Ready — spends action + reaction, stores `{ trigger, action }` *(v1.7.0)*
- [x] Search / Study / Influence — bundled `ability({ kind })`; spends action, reports check needed *(v1.7.0)*
- [x] Grapple — fixed DC `8 + STR + prof`, reports save + on-fail `grappled` *(v1.7.0)*
- [x] Shove — fixed DC, choice between prone or push 5 ft *(v1.7.0)*
- [x] Two-Weapon Fighting — `offHandAttack` consumes bonus action, signals damage-mod suppression *(v1.7.0)*
- [x] Improvised attacks — `improvisedAttack` helper with d4 default *(v1.7.0)*
- [ ] Mounted Combat *(SRD § Combat — Mounted Combat)* — actor.mountedOn linkage deferred
- [ ] Object interaction (free, one per turn) *(SRD § Combat — Other Activity on Your Turn)* — budget tracking deferred

## 4. Conditions

*(SRD § Playing the Game — Conditions)*

**Planned:** [v1.5.0](roadmap.md#150--condition-system-completion); save-at-end-of-turn binding rides on [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking).

- [x] 14 boolean conditions: blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious *(v0.0.0)*
- [x] Numeric Exhaustion 0–6 (−2/level on D20 Tests, −5 ft/level on Speed, death at 6) *(v0.0.0)*
- [x] Mechanical effect map (`CONDITION_EFFECTS`) folded into attack stance *(v0.7.0)*
- [x] `apply` / `remove` / `has` immutable helpers *(v0.0.0)*
- [x] **Condition immunity** — `actor.conditionImmunities[]` filter on `apply`; `isImmuneTo` predicate *(v1.5.0)*
- [x] **Auto-fail STR/DEX saves** under paralyzed / stunned / petrified / unconscious — engine binding short-circuits via `autoFailed: true` *(v1.5.0)*
- [x] **Auto-crit from within 5 ft** on paralyzed / unconscious / petrified / stunned — `attackRoll` honours the target's `critIfAttackerWithin5` flag *(v1.5.0)*
- [ ] **Per-application metadata** — condition entries stay as strings in 1.5; record-shape `{ name, source?, dc?, saveAbility?, endsOn? }` planned for [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking)
- [ ] **Save-to-end-of-turn** ongoing effects *(SRD: Hold Person, Hideous Laughter, Charm Monster, etc.)* — planned for [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking)

## 5. Damage pipeline

*(SRD § Playing the Game — Damage and Healing)*

**Planned:** complete in [v1.4.0](roadmap.md#140--damage-pipeline); tempHp clearance on Long Rest tightening rides on [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking).

- [x] **Resistance** — `actor.damageResistances` filter, halve (floor) on match *(v1.4.0)*
- [x] **Vulnerability** — `actor.damageVulnerabilities` filter, double on match *(v1.4.0)*
- [x] **Immunity** — `actor.damageImmunities` filter; `applyDamage` outcome `'immune'` *(v1.4.0)*
- [x] **Order of application** — adjustments → Resistance → Vulnerability per SRD wording *(v1.4.0)*
- [~] **Temporary HP** — non-stacking buffer, replace if larger *(v1.4.0)* — Long Rest clearance is deferred to 1.6.0's scene-clock release
- [x] **Damage type surfaced from `damageRoll`** — optional `damageType` arg + propagated on the result *(v1.4.0)*
- [x] `Combat.applyDamage(actor, { amount, type, critical?, source? })` — canonical helper combining modifier pipeline + tempHp + drop-to-zero + massive-damage + damage-while-down *(v1.4.0)*

## 6. Healing & death

*(SRD § Playing the Game — Damage and Healing — Healing / Death Saving Throws)*

**Planned:** generic `Combat.heal` shipped in [v1.4.0](roadmap.md#140--damage-pipeline); stable creatures regaining 1 HP rides on [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking)'s scene clock; `Combat.maximizeHP` for *Heal*-style spells deferred until a real consumer needs it.

- [x] Death save mechanic (`Combat.deathSave`) — DC 10, 3/3 threshold, nat 1 = two failures, nat 20 = revive *(v1.1.0)*
- [x] `Combat.dropToZero` — applies Unconscious + tracker *(v1.1.0)*
- [x] `Combat.applyDamageWhileDown` — damage at 0 = 1 failure (2 on crit), massive damage = instant death *(v1.1.0)*
- [x] `Combat.stabilize`, `Combat.reviveTo` *(v1.1.0)*
- [x] Rule knobs: `deathSaveDC`, `deathSaveSuccessesRequired` *(v1.1.0)*
- [ ] **Stable creatures regain 1 HP after 1d4 hours** *(SRD § Damage and Healing — Stabilizing)*
- [x] `Combat.heal(actor, amount)` — caps at hpMax, removes Unconscious + clears the death-save tracker when HP rises above 0 *(v1.4.0)*
- [ ] `Combat.maximizeHP(actor)` — for *Heal* / *Power Word Heal*-style spells (deferred until a consumer needs it)

## 7. Rest mechanics

*(SRD § Playing the Game — Short Rest, Long Rest)*

**Planned:** core mechanics shipped through v1.3.0; dawn/dusk timers + interrupted-rest semantics ride on [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking) and [v1.18.0](roadmap.md#1180--travel--exploration) respectively.

- [x] `Rest.spendHitDie(actor)` — die + CON mod, min 1, caps at hpMax *(v1.2.0)*
- [x] `Rest.longRest(actor)` — full HP, half hit dice back, exhaustion -1, slot refill, death-save reset *(v1.2.0)*
- [x] `Rest.shortRest(actor)` — warlock pact slots + short-tagged resources *(v1.3.0)*
- [x] Rule knob `longRestHitDiceRecovery: half | all | none` *(v1.2.0)*
- [ ] **Interrupted rest** semantics *(SRD § Long Rest)* — a rest broken by 1+ hour of activity yields no benefits
- [ ] **Dawn / dusk timers** — magic item charges, certain spells *(SRD § Magic Items — Activating a Magic Item)*
- [ ] **Resting in dangerous terrain** *(SRD § Adventuring — Travel Pace)*

## 8. Movement, vision, exploration

*(SRD § Playing the Game — Movement; § Adventuring — Vision and Light)*

**Planned:** movement modes + vision in [v1.11.0](roadmap.md#1110--movement-modes--vision); travel pace + forced march in [v1.18.0](roadmap.md#1180--travel--exploration).

- [x] Single `speed` value derived (post-condition / exhaustion) *(v0.7.0)*
- [ ] **Per-mode speeds** — walk / fly / swim / climb / burrow *(SRD § Adventuring — Special Types of Movement)*
- [ ] **Difficult terrain** — each foot costs 2 feet *(SRD § Adventuring — Movement)*
- [ ] **Falling damage** — 1d6 per 10 ft, max 20d6, prone on landing *(SRD § Adventuring — Falling)*
- [ ] **Long / high jump** — STR-mod ft horizontal, 3 + STR mod ft vertical *(SRD § Adventuring — Movement)*
- [ ] **Crawling** — each foot costs 2 feet *(SRD § Conditions — Prone interaction)*
- [ ] **Travel pace** — slow / normal / fast tables *(SRD § Adventuring — Travel Pace)*
- [ ] **Forced march, starvation, suffocation, drowning** *(SRD § Adventuring — Between Adventures)*
- [ ] **Light levels** — bright / dim / darkness *(SRD § Adventuring — Vision and Light)*
- [ ] **Special senses** — darkvision (range), blindsight, tremorsense, truesight *(SRD § Monsters — Senses)*
- [ ] **Heavily / lightly obscured** *(SRD § Adventuring — Vision and Light)*
- [ ] **Line of sight / line of effect** — separate from cover *(SRD § Spells — Targets)*

## 9. Time and duration tracking

*(cross-cutting; SRD § Adventuring — Time)*

**Planned:** core round/scene-clock surfaces in [v1.6.0](roadmap.md#160--turn-lifecycle-hooks--time-tracking); save-end-of-turn + spell-duration auto-binding ride with 1.6.1 / 1.8.0.

- [x] **Round timer** — `actor.timers[]` + `Combat.tickTimers` / `Combat.turnEnd` *(v1.6.0)*
- [ ] **Save-at-end-of-turn** — applied condition record with `{ saveAbility, saveDC, endsOn: 'turnEnd' }`; deferred to 1.6.1
- [x] **Minute / hour / day clocks** — `SceneClock.{freshScene,advanceTime,formatTimeOfDay}` *(v1.6.0)*
- [ ] **Spell-duration ticker** — auto-register a timer from a spell's `duration` field on cast; rides with 1.8.0 spellcasting completion
- [x] **Dawn / dusk event** — `SceneClock.advanceTime` enumerates `'dawn'` / `'dusk'` crossings chronologically *(v1.6.0)*

## 10. Spellcasting — slots & concentration

*(SRD § Spells — Casting Spells, Components, Concentration)*

**Planned:** concentration auto-drop in [v1.5.0](roadmap.md#150--condition-system-completion); concentration auto-binding + one-leveled-spell-per-turn + upcast deltas in [v1.8.0](roadmap.md#180--spellcasting-completion).

- [x] Full / half / Warlock pact slot tables L1–20 *(v0.5.0)*
- [x] `consumeSlot` with auto-upcasting *(v0.5.0)*
- [x] `refundSlot` *(v0.5.0)*
- [x] `Spellcasting.longRest` / `Spellcasting.shortRest` slot refill *(v0.5.0)*
- [x] Concentration: start / end / save-DC formula `max(10, ⌊dmg/2⌋)` *(v0.5.0)*
- [x] Cantrip scaling tiers (L5/11/17) *(v0.5.0)*
- [x] Prep-caster count + validation *(v0.5.0)*
- [x] **Auto-drop concentration** on incapacitating conditions (incapacitated / stunned / paralyzed / unconscious / petrified) — engine's bound `Conditions.apply` calls `endConcentration` when the condition's `incapacitates` flag is set *(v1.5.0)*
- [x] **`spell.concentration` flag** + auto-`startConcentration` on cast via `castSpell` *(v1.8.0)*
- [x] **One leveled spell per turn rule** — `castSpell({ alreadyCastLeveledThisTurn: true })` refuses leveled spells; cantrips exempt *(v1.8.0)*
- [ ] **Casting from a slot of higher level** — handler receives `castLevel`; spell records carry `upcast` deltas *(SRD § Spells — Casting at a Higher Level)*

## 11. Spellcasting — components & casting modes

*(SRD § Spells — Components, Ritual)*

**Planned:** [v1.8.0](roadmap.md#180--spellcasting-completion); spell scrolls + wands tie into [v1.9.0](roadmap.md#190--magic-items-system) magic-item charges.

- [x] **Verbal component** flag + `actor.silenced` gate via `castSpell` *(v1.8.0)*
- [x] **Somatic component** flag + `actor.somaticBlocked` gate via `castSpell` *(v1.8.0)*
- [x] **Material component** flag with optional `cost` + `consumed`; `actor.materials[spellId]` gate via `castSpell` *(v1.8.0)*
- [ ] **Component pouch / spellcasting focus** substitution — left to host's `materials` map shape until a real consumer needs the detail
- [x] **Ritual casting** — `castAsRitual(actor, spell)`; engine consumes no slot, requires the spell to be prepared *(v1.8.0)*
- [ ] **Casting time variants** — `spell.castingTime` field is host-readable but no engine-side scheduling yet; defer until 1.x consumer
- [ ] **Spell scrolls** — `castFromScroll(spell, caster)` *(SRD § Magic Items — Spell Scrolls)* — rides with [v1.9.0](roadmap.md#190--magic-items-system)
- [ ] **Wands** — charge tracking, recharge at dawn *(SRD § Magic Items — Wands)*

## 12. Spellcasting — targeting & effects

*(SRD § Spells — Targets, Areas of Effect, Saving Throws)*

**Planned:** [v1.8.0](roadmap.md#180--spellcasting-completion).

- [x] **Area-of-effect shapes** — `targetsInArea({ origin, shape, size, direction?, width? })` supports sphere / cube / cylinder / emanation / cone / line *(v1.8.0)*
- [x] **`castSpellSave(results, { halfOnSuccess? })`** — packages per-target outcomes uniformly *(v1.8.0)*
- [x] **`saveForHalf` outcome shape** — exposed as the default `halfOnSuccess: true` in `castSpellSave` *(v1.8.0)*
- [ ] **Evasion / Magic Resistance / Sculpt Spells** modifiers on save outcomes — host applies via existing reroll patterns from [v1.14.0](roadmap.md#1140--saves--edge-mechanics)
- [x] **Higher-level effect deltas** — `spell.upcast(level)` function returns the per-cast-level delta; `castSpell` surfaces it on the result *(v1.8.0)*
- [~] **Reaction-cast canonical wiring** — `onCast` hook fires before slot consumption and can short-circuit via `cancelled: true` (Counterspell intercept) *(v1.8.0)*; per-spell wrappers (Counterspell / Absorb Elements / Hellish Rebuke / Silvery Barbs) wait on host-side spell handlers
- [x] **Counterspell timing** — `onCast` payload carries `{ actor, spell, args }` so a reaction handler can decide before the cast consumes resources *(v1.8.0)*

## 13. Classes — base mechanics

*(SRD § Classes — per class)*

**Planned:** [v1.3.1 → v1.3.10](roadmap.md#13x--per-class-feature-rollout), one class per sub-release.

- [x] **Foundation:** resource shape, `freshResources`, `spendResource`, `refreshResources`, `Mechanics.apply` *(v1.3.0)*
- [x] **Fighter:** Second Wind, Action Surge *(v1.3.0)*
- [x] **Rogue:** Sneak Attack + `endTurn` *(v1.3.0)*
- [x] **Barbarian:** Rage — per-Long-Rest uses (with 1 recovered on Short Rest), Rage Damage by level, BPS resistance flags, 100-round duration cap; STR check/save advantage left to host until `attackStance`-style helper for non-attack D20 Tests lands *(SRD § Barbarian — Rage)* *(v1.3.1)*
- [x] **Bard:** Bardic Inspiration — CHA-mod uses (min 1), die size by level, refresh tag flips to short at L5, plus `fontOfInspiration(slotLevel)` slot-for-use refund *(SRD § Bard — Bardic Inspiration / Font of Inspiration)* *(v1.3.2)*
- [x] **Cleric:** Channel Divinity — uses 2/3/4 at L2/L6/L18, long-rest full / short-rest 1, Divine Spark (heal or damage modes) + Turn Undead handlers, spell-save-DC helper *(SRD § Cleric — Channel Divinity / Divine Spark / Turn Undead)* *(v1.3.3)*
- [x] **Druid:** Wild Shape — 2 uses, long full / short 1; CR cap (1/4 / 1/2 / 1 at L2/L4/L8); swim unlocked L4, fly L8; revert + caps helpers *(SRD § Druid — Wild Shape / Beast Shapes)* *(v1.3.4)*
- [x] **Monk:** Focus Points pool (= level from L2, short refresh), Martial Arts die scaling, Flurry of Blows / Patient Defense / Step of the Wind handlers covering both free and FP-spend modes *(SRD § Monk — Focus Points / Martial Arts)* *(v1.3.5)*
- [x] **Paladin:** Lay on Hands (HP pool = 5 × level), Divine Smite (2024 spell — 2d8 radiant + 1d8/slot-above-1 + 1d8 vs Fiend/Undead, one free cast per Long Rest) *(SRD § Paladin — Lay on Hands / Divine Smite)* *(v1.3.6)*
- [x] **Ranger:** Favored Enemy free-cast pool (scales with PB), Hunter's Mark cast with free-cast preference + slot fallback, target binding on `actor.huntersMark`, 1d6 force damage rider, status helper *(SRD § Ranger — Favored Enemy / Hunter's Mark)* *(v1.3.7)*
- [x] **Sorcerer:** Sorcery Points pool, Font of Magic (slot ↔ points conversion + slot creation table), 10 Metamagic options with cost + effect schema *(SRD § Sorcerer — Font of Magic / Metamagic)* *(v1.3.8)*
- [x] **Warlock:** Eldritch Invocations — 10 canonical invocations with prereq metadata (warlock level, required cantrip, repeatable), count-by-level table, validation + persistence + agonizing-blast bonus lookup *(SRD § Warlock — Eldritch Invocations)* *(v1.3.9)*
- [x] **Wizard:** Arcane Recovery — recover spell-slot levels equal to ⌈½ wizard level⌉ (cap 5, once per Long Rest, on a Short Rest); non-mutating per-slot validation + atomic apply + status helper *(SRD § Wizard — Arcane Recovery)* *(v1.3.10)*

## 14. Classes — subclasses and tier 3/4

*(SRD § Classes — Subclasses; § Classes — Levels 11–20)*

**Planned:** L11–16 features in [v1.19.0](roadmap.md#1190--tier-3-class-features-l11l16); L17–20 + Epic Boons in [v1.20.0](roadmap.md#1200--tier-4-class-features-l17l20--epic-boons); 12 subclass handler maps in [v1.21.0](roadmap.md#1210--subclass-handler-maps).

- [x] Class metadata strings for L1–L10 *(v0.9.0)*
- [ ] **Subclass handler maps** for the 12 base subclasses
  - [ ] Berserker (Barbarian), College of Lore (Bard), Life Domain (Cleric)
  - [ ] Circle of the Land (Druid), Champion (Fighter), Way of the Open Hand (Monk)
  - [ ] Oath of Devotion (Paladin), Hunter (Ranger), Thief (Rogue)
  - [ ] Draconic Sorcery (Sorcerer), Fiend Patron (Warlock), Evoker (Wizard)
- [ ] **Tier 3 features** L11–L16 per class *(SRD per class)*
- [ ] **Tier 4 features** L17–L20 per class *(SRD per class)*

## 15. Character creation pipeline

*(SRD § Character Creation; § Character Origins)*

**Planned:** [v1.12.0](roadmap.md#1120--character-creation-pipeline).

- [x] Hand-built `CharacterRecord` → `DerivedSheet` *(v0.1.5)*
- [x] Ability-score derivation (background bonuses) *(v0.1.5)*
- [x] Skill / save / passive derivation *(v0.1.5)*
- [x] AC breakdown (unarmored / light+med / heavy + shield) *(v0.1.5)*
- [x] Max HP derivation (L1 max die + per-level average) *(v0.1.5)*
- [ ] **Multiclass record shape** — `record.classes: { fighter: 3, rogue: 2 }` *(SRD § Character Creation — Multiclassing)*
- [ ] **Multiclass prerequisites** — STR 13, etc. *(SRD § Character Creation — Multiclassing — Prerequisites)*
- [ ] **Multiclass spell-slot table** *(SRD § Spells — Multiclass Spellcaster)*
- [ ] **Languages** — `record.languages: [...]`, background contributions *(SRD § Character Creation — Languages)*
- [ ] **Tool proficiencies** — `record.tools: [...]`, proficiency-with-tool advantage rule *(SRD § Equipment — Tools)*
- [ ] **Origin feat auto-application** — backgrounds carry `originFeat` but its mechanical effects don't merge into the sheet *(SRD § Character Origins — Backgrounds)*
- [ ] **Starting equipment selection** *(SRD § Character Creation — Starting Equipment)*

## 16. Species, backgrounds, feats

*(SRD § Character Origins)*

**Planned:** species trait *mechanics* in [v1.13.0](roadmap.md#1130--species-traits-as-mechanics); fighting styles ride in with [v1.7.0](roadmap.md#170--combat-actions-menu) or the related class subrelease; Epic Boons in [v1.20.0](roadmap.md#1200--tier-4-class-features-l17l20--epic-boons); registry *depth* tracked under [v1.x.y](roadmap.md#1xy--content-registry-expansion-parallel).

- [x] 9 species, 16 backgrounds (data only), 3 feats *(v0.0.0)*
- [x] Species `speed`, `size`, `traits[]` strings *(v0.0.0)*
- [ ] **Species traits as mechanics** — Darkvision range, Stonecunning, Lucky, Fey Ancestry, etc.
- [ ] **Full SRD background coverage** — *check registry headcount against SRD's 16*
- [ ] **Origin feats** beyond the 3 currently shipped *(SRD § Feats — Origin Feats)*
- [ ] **General feats** — Alert, Lucky, Tough, Mage Slayer, etc. *(SRD § Feats — General Feats)*
- [ ] **Fighting Styles** as feat-like records — Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting *(SRD § Classes — Fighting Style)*
- [ ] **Epic Boons** L19 feat slot *(SRD § Feats — Epic Boons)*

## 17. Equipment & inventory

*(SRD § Equipment)*

**Planned:** [v1.17.0](roadmap.md#1170--equipment-depth); registry depth tracked under [v1.x.y](roadmap.md#1xy--content-registry-expansion-parallel).

- [x] Items registry — 44 entries, weapon mastery linked *(v0.0.0)*
- [x] Carrying capacity (STR × 15 × size multiplier) *(v0.1.5)*
- [ ] **Encumbrance variant** *(SRD § Equipment — Carrying Capacity)*
- [ ] **Armor donning / doffing time** *(SRD § Equipment — Armor)*
- [ ] **Stealth disadvantage on heavy armor** *(SRD § Equipment — Armor)*
- [ ] **STR-requirement speed penalty** for heavy armor below requirement *(SRD § Equipment — Armor)*
- [ ] **Adventuring gear** — full coverage of mundane items *(SRD § Equipment — Adventuring Gear)*
- [ ] **Tools** — artisan's, gaming, musical instruments *(SRD § Equipment — Tools)*
- [ ] **Mounts and vehicles** *(SRD § Equipment — Mounts and Vehicles)*
- [ ] **Services + lifestyle costs** *(SRD § Equipment — Services; § Equipment — Lifestyle Expenses)*
- [ ] **Trade goods** *(SRD § Equipment — Trade Goods)*

## 18. Magic items

*(SRD § Magic Items)*

**Planned:** mechanics in [v1.9.0](roadmap.md#190--magic-items-system); item A–Z catalogue depth in [v1.x.y](roadmap.md#1xy--content-registry-expansion-parallel).

- [x] **Rarity bands** — `RARITY_BANDS` constant; `item.rarity` field is host-readable *(v1.9.0)*
- [x] **Attunement** — `MagicItems.attune` / `unattune` with 3-slot cap and `actor.attunedItems[]` *(v1.9.0)*
- [~] **Attunement Short Rest gate** — engine accepts the host has gated the call behind a Short Rest; no engine-side rest tracking yet
- [x] **Attunement prerequisites** — `requiresAttunement: { classId?, spellcaster?, abilityMin? }` validated by `canAttune` *(v1.9.0)*
- [x] **Charges** — `item.charges = { max, recovers, rechargesOn }`; `actor.itemCharges[id]` state; `spendCharge` + `rechargeItem` (numeric, dice spec, or full refill) *(v1.9.0)*
- [x] **Cursed items** — `item.cursed: true`; `unattune` refuses without `removeCurseApplied: true` *(v1.9.0)*
- [x] **Identify** — `actor.identifiedItems[]` + `identifyItem` / `isIdentified` *(v1.9.0)*
- [x] **Magic item resilience** — `MagicItems.itemSavingThrow(item, dc)` vs `item.savingThrow.bonus` *(v1.9.0)*
- [ ] **Sentient magic items** — alignment + conflict resolution *(SRD § Magic Items — Sentient Magic Items)*
- [ ] **Magic item A–Z** registry — *currently a handful; SRD lists hundreds*

## 19. Monsters

*(SRD § Monsters)*

**Planned:** stat-block mechanics in [v1.10.0](roadmap.md#1100--monster-stat-block-depth); registry depth in [v1.x.y](roadmap.md#1xy--content-registry-expansion-parallel).

- [x] Monster registry — 9 entries *(v0.6.0)*
- [x] CR field on records *(v0.6.0)*
- [ ] **Multiattack** schema (`{ attacks: ['claw', 'claw', 'bite'] }`)
- [ ] **Legendary Actions** — uses per turn, refreshed at start of monster's turn *(SRD § Monsters — Legendary Actions)*
- [ ] **Lair Actions** — initiative-count 20 trigger, `inLair` boolean *(SRD § Monsters — Lair Actions)*
- [ ] **Mythic Actions** *(SRD § Monsters — Mythic Actions)*
- [ ] **Innate Spellcasting** — `{ atWill: [...], 3day: [...], 1day: [...] }` shape *(SRD § Monsters — Innate Spellcasting)*
- [ ] **Senses** — darkvision range, blindsight, tremorsense, truesight *(SRD § Monsters — Senses)*
- [ ] **Damage resistance / vulnerability / immunity** arrays per monster
- [ ] **Condition immunity** array per monster
- [ ] **Saving-throw proficiency table** per monster (`{ str: +6, ... }`)
- [ ] **Languages** per monster
- [ ] **Legendary Resistance** — N uses/day, "convert a failed save to a success" *(SRD § Monsters — Legendary Resistance)*
- [ ] **Monster registry depth** — *SRD ships hundreds; we ship 9*

## 20. Encounter design

*(SRD § Gameplay Toolbox — Combat Encounters)*

**Planned:** [v1.16.0](roadmap.md#1160--encounter-design-tools).

- [ ] **`xpForCR(cr)`** lookup *(SRD § Monsters — CR)*
- [ ] **Encounter budget per party level** — low / moderate / high bands *(SRD § Gameplay Toolbox)*
- [ ] **Treasure tables** — by hoard CR band *(SRD § Gameplay Toolbox — Treasure)*
- [ ] **Random encounter generator scaffolding**

## 21. Saves & edge mechanics

*(SRD § Playing the Game — Saving Throws + per-feature)*

**Planned:** [v1.14.0](roadmap.md#1140--saves--edge-mechanics).

- [x] `Checks.savingThrow` *(v0.0.0)*
- [ ] **Inspiration / Heroic Inspiration** — actor flag + grant / spend helpers *(SRD § Character Creation — Heroic Inspiration)*
- [ ] **Halfling Lucky** reroll on 1 *(SRD § Character Origins — Halfling)*
- [ ] **Indomitable** *(SRD § Classes — Fighter L9)*
- [ ] **Diamond Soul / Stillness of Mind / Magic Resistance** reroll-on-save patterns
- [ ] **Group checks** (half or more succeed → group succeeds) *(SRD § Playing the Game — Ability Checks)*
- [ ] **Working together** advantage (Help variant for skill checks) *(SRD § Playing the Game — Working Together)*

## 22. Diseases, poisons, environmental hazards

*(SRD § Adventuring — Diseases / Poisons / Environment)*

**Planned:** [v1.15.0](roadmap.md#1150--hazards--environment).

- [ ] Disease registry + onset timer + per-stage save DC
- [ ] Poison registry — contact, ingested, inhaled, injury *(SRD § Equipment — Poisons)*
- [ ] Drowning / Suffocation — CON-based hold-breath rounds *(SRD § Adventuring — Suffocation)*
- [ ] Starvation / Thirst — exhaustion accrual *(SRD § Adventuring — Food and Water)*
- [ ] Extreme heat / cold *(SRD § Adventuring — Environment)*

## 23. Audit / replay surface

*(non-SRD; engine-internal)*

**Planned:** [v1.23.0](roadmap.md#1230--audit--replay-surface-completion).

- [x] Append-only `engine.rollLog` *(v0.1.0)*
- [x] `verifyLog` with seed + rules *(v0.1.0)*
- [x] Context tags on every roll *(v0.1.0)*
- [x] `deathSave` op recorded *(v1.1.0)*
- [x] `spendHitDie` recorded as `rollDie` *(v1.2.0)*
- [x] Class-mechanic-internal `rollDie` calls flow into the log *(v1.3.0)*
- [ ] **`mechanicApplied` op** — log the resource transition + result kind, not just the dice
- [ ] **Hook fire log** — optional `hookFired` entries for plugin-stack debugging
- [ ] **Rule-knob fingerprint in the log header** — death-save DC, hit-dice recovery, etc., so cross-pack replays diverge at the boundary not silently
- [ ] **`deathSave` previousFailures / previousSuccesses snapshot** for full reconstructability

## 24. Plugin system

*(non-SRD; engine architecture)*

**Planned:** [v1.22.0](roadmap.md#1220--plugin-surface-expansion). Phase D hook events are emitted as their feature releases land; this milestone consolidates them as a documented contract.

- [x] **Phase A (content)** — extraSpecies / Classes / Backgrounds / Feats / Spells / Items / Conditions / Mastery / Monsters *(v0.0.0 → v0.6.0)*
- [x] **Phase B (rules)** — critOn, fumbleOn, damageFloor, explodingDamageDice, xpThresholds, proficiencyByLevel, deathSaveDC, deathSaveSuccessesRequired, longRestHitDiceRecovery *(v0.2.0 → v1.2.0)*
- [x] **Phase C (hooks)** — beforeAttack, afterDamage, onLevelUp, onConditionApplied, onDeath *(v0.3.0)*
- [ ] **onTurnStart / onTurnEnd** hooks — needed for save-at-end-of-turn effects (§ 9), Sneak Attack reset (§ 13), spell-duration tick (§ 9)
- [ ] **onLongRest / onShortRest** hooks — plugin extension point for rest-based class features
- [x] **onCast** hook — fires before slot consumption; enables Counterspell-style reaction-cast wiring *(v1.6.0 event added, v1.8.0 wired into castSpell / castAsRitual)*
- [ ] **extraResources** plugin contribution — let custom classes register resource shapes generically
- [ ] **extraMechanics** plugin contribution — class-feature handlers contributable without forking the class def

## 25. Documentation & host contracts

*(non-SRD; project hygiene)*

**Planned:** [v1.24.0](roadmap.md#1240--documentation--host-contract-sweep).

- [x] `docs/why.md`, `docs/boundary.md`, `docs/spec.md`, `docs/recipes.md`, `docs/roadmap.md`, `docs/character-sheet.md`, `docs/beat-schema.md`
- [x] `docs/srd-coverage.md` *(this file)*
- [ ] **`character-sheet.md` schema additions** — `hp`, `hpMax`, `hitDie`, `hitDiceTotal`, `hitDiceUsed`, `deathSaves`, `resources`, `concentration`, `spellSlots`, plus per-class flags like `sneakAttackUsedThisTurn`
- [ ] **`recipes.md` additions** — Death Saves flow, Rest flow, Mechanics dispatch, plugin-contribute a class
- [ ] **`spec.md` plugin contract update** — new rule knobs, resource-spec shape, mechanic handler signature
- [ ] **Kernel-boundary checklist** — what the engine claims to enforce vs. what's host-owned, at a glance
- [ ] **TypeDoc-style reference site** *(deferred from 1.0.0)*

---

## How we sequence work from this file

When picking the next branch:

1. **Prefer rows that unlock other rows.** §5 Damage pipeline unlocks §19 monster resistances and §11 components; §9 Time tracking unlocks §11 ritual + §12 spell durations + §15 effects.
2. **Group related rows into a single release.** §3 combat actions ship best as a coherent batch (one PR for Dash/Dodge/Disengage/Help/Hide/Ready/Search) rather than one-per-action.
3. **Match release size to risk.** Foundation-changing sections (§5, §9, §11) deserve their own minor release; data-only sections (§16 magic items A–Z, §19 monster expansion) can chain through multiple patch releases.
4. **Update the checkbox in the same commit** that ships the feature. The checklist drifts the moment "shipped" isn't reflected here.
