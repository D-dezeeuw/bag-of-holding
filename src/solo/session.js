// === Session orchestrator (since 2.0.0) ===
//
// A thin wrapper that ties together what hosts always do anyway:
// derive sheets from records, advance a scene clock, run an
// encounter, apply rests, and save/load the whole bundle.
//
// The host still owns the persistent shape (CharacterRecord). The
// session holds the volatile bits (current encounter state, scene
// clock, working actor map) plus a high-level event log that
// rides alongside the engine's roll log for narrative trace-back.
//
// Why a session object (not pure state + free functions): the
// recipes already show the pure-state primitives. A session is the
// one-line wrapper that ties them and is the natural surface for a
// solo player, a CLI runner, or a browser sandbox. Internally it
// holds a reference to the engine; serialise() produces the
// portable JSON, restore() rebuilds an equivalent session against
// a freshly-constructed engine.

const SESSION_VERSION = 'bag-of-holding/session@1';

function actorFromRecord(record, engine) {
  const sheet = engine.deriveSheet(record);
  const conMod = sheet.abilityScores.mod.con;
  const hpMax = sheet.hp.max;
  // Hit Dice pool: total = level (one per class level), CON-modified
  // value is the spent die rolled per SRD § Short Rest. The session
  // tracks remaining slots; spending happens via engine.Rest.
  const hitDiceTotal = record.level;
  return {
    id: record.id,
    name: record.name,
    classId: record.classId,
    subclassId: record.subclassId,
    speciesId: record.speciesId,
    level: record.level,
    abilityScores: sheet.abilityScores.final,
    proficiencyBonus: sheet.proficiencyBonus,
    hp: hpMax,
    hpMax,
    hitDie: engine.classes[record.classId]?.hitDie ?? 8,
    hitDiceTotal,
    hitDiceUsed: 0,
    ac: sheet.ac.value,
    speed: sheet.speed.walk,
    dexterity: sheet.abilityScores.final.dex,
    conMod,
    conditions: [],
    resources: engine.Mechanics.freshResources(engine.classes[record.classId], record.level),
    sheet
  };
}

function freshActorMap(party, engine) {
  const map = new Map();
  for (const record of party) map.set(record.id, actorFromRecord(record, engine));
  return map;
}

function ensureSlotBar(actor, record, engine) {
  if (actor.spellSlots) return actor;
  const classDef = engine.classes[record.classId];
  const progression = classDef?.spellcasting?.progression;
  if (!progression || progression === 'none') return actor;
  actor.spellSlots = engine.Spellcasting.freshSlots(progression, record.level);
  return actor;
}

/**
 * Create a solo session. The arguments mirror the milestone
 * description: party (host-owned records), an optional initial
 * encounter, and an optional scene clock (defaults to a fresh dawn).
 *
 * @param {object}   opts
 * @param {object}   opts.engine                Engine instance from createEngine().
 * @param {Array}    opts.party                 Array of CharacterRecord.
 * @param {object}   [opts.encounter]           { participants: [...] } — passed to Combat.startEncounter.
 * @param {object}   [opts.scene]               Scene shape (SceneClock.freshScene()); engine derives one if omitted.
 * @param {number}   [opts.seed]                Seed associated with the session for share/restore.
 * @param {Array}    [opts.log]                 Restore-time only: prior high-level events.
 * @param {object}   [opts.oracle]              Optional Solo.oracle instance the session will surface as session.oracle.
 */
export function create({ engine, party, encounter, scene, seed, log: priorLog, oracle } = {}) {
  if (!engine) throw new Error('Session.create: engine is required');
  if (!Array.isArray(party) || party.length === 0) {
    throw new Error('Session.create: party must be a non-empty array of character records');
  }

  const actors = freshActorMap(party, engine);
  // Wire spell slot bars for any caster in the party. Records may
  // pre-declare slot state; if they do, honour it.
  for (const record of party) {
    const actor = actors.get(record.id);
    if (record.spells?.slots) actor.spellSlots = record.spells.slots.map(s => ({ ...s }));
    else ensureSlotBar(actor, record, engine);
  }

  let sceneState = scene ?? engine.SceneClock.freshScene();
  let encounterState = null;

  function adoptParticipant(p) {
    // Anyone in the initiative order who isn't a party member gets a
    // minimal actor entry so attack/applyDamage/applyCondition can
    // look them up by id. Hosts that want richer foe state can pass
    // their own monster actors via the participant object.
    if (actors.has(p.id)) return;
    const a = {
      id: p.id,
      name: p.name ?? p.id,
      hp: p.hp ?? 0,
      hpMax: p.hpMax ?? p.hp ?? 0,
      ac: p.ac ?? 10,
      dexterity: p.dexterity ?? 10,
      speed: p.speed ?? 30,
      conditions: p.conditions ?? [],
      ...p
    };
    actors.set(p.id, a);
  }

  if (encounter) {
    if (Array.isArray(encounter.participants) && !encounter.order) {
      // Fresh encounter from participants. `Combat.startEncounter`
      // rolls initiative and builds budgets.
      for (const p of encounter.participants) adoptParticipant(p);
      encounterState = engine.Combat.startEncounter(encounter.participants);
    } else if (Array.isArray(encounter.order)) {
      // Restore-time path: a previously-serialised encounter state.
      for (const p of encounter.order) adoptParticipant(p);
      encounterState = encounter;
    }
  }

  const log = Array.isArray(priorLog) ? [...priorLog] : [];
  let logSeq = log.length;

  function record(kind, payload = {}) {
    const entry = { seq: logSeq++, ts: Date.now(), kind, ...payload };
    log.push(entry);
    return entry;
  }

  function partyRecords() {
    return party;
  }

  function actor(id) {
    const a = actors.get(id);
    if (!a) throw new Error(`Session: no actor with id '${id}' in the party`);
    return a;
  }

  function currentActor() {
    if (!encounterState) return null;
    const p = engine.Combat.currentActor(encounterState);
    return p ? actors.get(p.id) ?? null : null;
  }

  function endTurn() {
    if (!encounterState) throw new Error('Session.endTurn: no encounter running. Call startEncounter first.');
    const current = engine.Combat.currentActor(encounterState);
    if (current) {
      const a = actors.get(current.id);
      if (a) {
        const { actor: ticked, expired } = engine.Combat.tickTimers(a);
        actors.set(current.id, ticked);
        if (expired.length > 0) record('timersExpired', { actorId: current.id, expired });
      }
    }
    const { state: nextState, finished } = engine.Combat.endTurn(encounterState);
    encounterState = nextState;
    record('endTurn', { round: encounterState.round, turnIndex: encounterState.turnIndex, finished });
    return { finished };
  }

  function startEncounter(participants) {
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new Error('Session.startEncounter: participants must be a non-empty array');
    }
    for (const p of participants) adoptParticipant(p);
    encounterState = engine.Combat.startEncounter(participants);
    record('startEncounter', { participants: participants.map(p => p.id) });
    return encounterState;
  }

  function endEncounter() {
    encounterState = null;
    record('endEncounter');
  }

  function shortRest() {
    for (const [id, a] of actors) {
      actors.set(id, engine.Rest.shortRest(a));
    }
    record('shortRest');
  }

  function longRest() {
    for (const [id, a] of actors) {
      actors.set(id, engine.Rest.longRest(a));
    }
    // Long rest takes 8 hours per SRD; reflect it in the scene clock.
    const advanced = engine.SceneClock.advanceTime(sceneState, { hours: 8 });
    sceneState = advanced.scene;
    record('longRest', { events: advanced.events });
  }

  function advanceTime(delta) {
    const { scene: next, events } = engine.SceneClock.advanceTime(sceneState, delta);
    sceneState = next;
    if (events.length > 0) record('sceneEvents', { events });
    return { scene: sceneState, events };
  }

  function applyDamage(targetId, args) {
    const target = actor(targetId);
    const result = engine.Combat.applyDamage(target, args);
    actors.set(targetId, result.actor);
    record('applyDamage', { targetId, amount: args.amount, type: args.type, outcome: result.outcome, hpAfter: result.hpAfter });
    return result;
  }

  function heal(targetId, amount) {
    const target = actor(targetId);
    const result = engine.Combat.heal(target, amount);
    actors.set(targetId, result.actor);
    record('heal', { targetId, healed: result.healed, hpAfter: result.hpAfter });
    return result;
  }

  function applyCondition(targetId, condition) {
    const target = actor(targetId);
    const updated = engine.Conditions.apply(target, condition);
    actors.set(targetId, updated);
    record('applyCondition', { targetId, condition });
    return updated;
  }

  function removeCondition(targetId, condition) {
    const target = actor(targetId);
    const updated = engine.Conditions.remove(target, condition);
    actors.set(targetId, updated);
    record('removeCondition', { targetId, condition });
    return updated;
  }

  function attack({ attackerId, targetId, attackBonus, damageDice, damageMod = 0, damageType, ac }) {
    const attacker = actor(attackerId);
    const target = targetId ? actor(targetId) : null;
    const targetAc = ac ?? target?.ac;
    if (typeof targetAc !== 'number') {
      throw new Error('Session.attack: target must have an `ac` or args must include `ac`');
    }
    const attackResult = engine.Combat.attackRoll({
      attackBonus, ac: targetAc,
      attacker, target,
      context: { kind: 'attack', attackerId, targetId }
    });
    let damageResult = null;
    if (attackResult.hit && damageDice) {
      const dmg = engine.Combat.damageRoll({
        damageDice, damageMod, damageType,
        critical: attackResult.critical,
        context: { kind: 'attack-damage', attackerId, targetId }
      });
      if (target) {
        damageResult = applyDamage(targetId, { amount: dmg.total, type: damageType, critical: attackResult.critical, source: attackerId });
      } else {
        damageResult = { amount: dmg.total, type: damageType };
      }
    }
    record('attack', { attackerId, targetId, hit: attackResult.hit, critical: attackResult.critical, fumble: attackResult.fumble, d20: attackResult.d20, total: attackResult.total, damage: damageResult?.finalAmount ?? damageResult?.amount ?? 0 });
    return { attack: attackResult, damage: damageResult };
  }

  function snapshot() {
    const partyState = Array.from(actors, ([id, a]) => ({
      id,
      hp: a.hp,
      hpMax: a.hpMax,
      tempHp: a.tempHp ?? 0,
      ac: a.ac,
      conditions: a.conditions,
      hitDiceUsed: a.hitDiceUsed,
      hitDiceTotal: a.hitDiceTotal,
      exhaustion: a.exhaustion ?? 0,
      resources: a.resources,
      spellSlots: a.spellSlots,
      deathSaves: a.deathSaves
    }));
    return {
      party: partyState,
      scene: sceneState,
      encounter: encounterState,
      log: [...log]
    };
  }

  function serialize() {
    return {
      version: SESSION_VERSION,
      seed: seed ?? null,
      rulesFingerprint: engine.rulesFingerprint,
      partyRecords: party,
      partyState: snapshot().party,
      scene: sceneState,
      encounter: encounterState,
      log: [...log],
      rollLog: [...engine.rollLog]
    };
  }

  return Object.freeze({
    engine,
    seed: seed ?? null,
    oracle: oracle ?? null,
    get scene() { return sceneState; },
    get encounter() { return encounterState; },
    get log() { return log; },
    party: partyRecords,
    actor,
    currentActor,
    startEncounter,
    endTurn,
    endEncounter,
    shortRest,
    longRest,
    advanceTime,
    attack,
    applyDamage,
    heal,
    applyCondition,
    removeCondition,
    record,
    snapshot,
    serialize
  });
}

/**
 * Recreate a session from a serialise() payload + a matching
 * engine. The engine MUST be constructed with the same seed and
 * rules; this is the host's responsibility (we surface
 * `rulesFingerprint` on the payload so the host can compare).
 *
 * Use this for "load my save and keep playing" (state matters,
 * dice draws after the load draw fresh from the engine's rng).
 * For replay-verification, use `Replay.share` + `verifyLog` —
 * those are the audit path.
 */
export function restore(payload, engine) {
  if (!payload || payload.version !== SESSION_VERSION) {
    throw new Error(`Session.restore: unknown payload version '${payload?.version}'`);
  }
  if (payload.rulesFingerprint && engine.rulesFingerprint !== payload.rulesFingerprint) {
    throw new Error(`Session.restore: engine rules fingerprint '${engine.rulesFingerprint}' does not match recorded '${payload.rulesFingerprint}'`);
  }
  const session = create({
    engine,
    party: payload.partyRecords,
    scene: payload.scene,
    encounter: payload.encounter ?? undefined,
    seed: payload.seed ?? undefined,
    log: payload.log
  });
  // Patch live state back onto the session's actor map. snapshot()
  // serialises everything that drifts during play; copying it back
  // lets the host pick up at the saved HP / slot / condition state.
  if (Array.isArray(payload.partyState)) {
    for (const state of payload.partyState) {
      const a = session.actor(state.id);
      Object.assign(a, state);
    }
  }
  return session;
}
