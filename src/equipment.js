// Equipment depth (SRD 5.2 § Equipment): encumbrance, armor
// don/doff time, tool proficiency. Pure helpers the host calls
// alongside Character.deriveSheet.

const ENCUMBRANCE_MULT = Object.freeze({
  none: 1,
  encumbered: 5,
  heavilyEncumbered: 10
});

// Encumbrance variant per SRD § Lifting and Carrying. Capacity is
// 15 lb per point of Strength; heavily-encumbered at 10× STR. The
// host passes the actor's STR score and the carried weight.
export function encumbranceLevel({ strength, carriedWeight }) {
  if (!Number.isFinite(strength) || strength < 0) {
    throw new Error('encumbranceLevel: strength must be a non-negative number');
  }
  if (!Number.isFinite(carriedWeight) || carriedWeight < 0) {
    throw new Error('encumbranceLevel: carriedWeight must be a non-negative number');
  }
  if (carriedWeight > strength * ENCUMBRANCE_MULT.heavilyEncumbered) {
    return 'heavily-encumbered';
  }
  if (carriedWeight > strength * ENCUMBRANCE_MULT.encumbered) {
    return 'encumbered';
  }
  return 'none';
}

// Speed penalty for the encumbrance variant per SRD: encumbered
// reduces speed by 10 ft, heavily-encumbered reduces by 20 ft.
export function encumbranceSpeedPenalty(level) {
  if (level === 'encumbered') return 10;
  if (level === 'heavily-encumbered') return 20;
  return 0;
}

// Heavy armor without meeting strRequired reduces speed by 10 ft per
// SRD § Armor. Returns the penalty (0 or 10).
export function armorStrengthPenalty(armor, strength) {
  if (!armor || !armor.strRequired) return 0;
  return strength < armor.strRequired ? 10 : 0;
}

// Total carried weight given an inventory and the items registry.
// Items without a `weight` field count as 0 (consumables, focuses).
export function carriedWeight(itemIds, items) {
  if (!Array.isArray(itemIds)) return 0;
  let total = 0;
  for (const id of itemIds) {
    const item = items[id];
    if (item && Number.isFinite(item.weight)) total += item.weight;
  }
  return total;
}

// Donning / doffing time in minutes for the equipped armor. Returns
// null for an unknown or shieldless slot.
export function donTime(armorId, items) {
  const armor = items[armorId];
  return armor && Number.isFinite(armor.donTime) ? armor.donTime : null;
}

export function doffTime(armorId, items) {
  const armor = items[armorId];
  return armor && Number.isFinite(armor.doffTime) ? armor.doffTime : null;
}

// Tool proficiency: a simple ability check with the actor's tool
// proficiency adding the engine's proficiency bonus when the
// `record.proficiencies.tools` list includes the tool id.
import { abilityCheck } from './checks.js';

export function toolCheck({ actor, toolId, abilityScore, dc, proficiencyBonus = 2 }, rng = Math.random) {
  if (!toolId) throw new Error('toolCheck: toolId is required');
  const tools = actor?.proficiencies?.tools ?? actor?.tools ?? [];
  const proficient = tools.includes(toolId);
  return abilityCheck({
    abilityScore: abilityScore ?? 10,
    proficient,
    proficiencyBonus,
    dc
  }, rng);
}

// Default adventuring-gear registry. Pure data: id, name, weight (lb).
// Hosts can extend through `extraItems` on createEngine.
export const ADVENTURING_GEAR = Object.freeze({
  'backpack':        Object.freeze({ id: 'backpack',        name: 'Backpack',         type: 'gear', weight: 5 }),
  'bedroll':         Object.freeze({ id: 'bedroll',         name: 'Bedroll',          type: 'gear', weight: 7 }),
  'rope-hempen-50':  Object.freeze({ id: 'rope-hempen-50',  name: 'Rope, Hempen (50 ft)', type: 'gear', weight: 10 }),
  'torch':           Object.freeze({ id: 'torch',           name: 'Torch',            type: 'gear', weight: 1 }),
  'rations-1-day':   Object.freeze({ id: 'rations-1-day',   name: 'Rations (1 day)',  type: 'gear', weight: 2 }),
  'waterskin':       Object.freeze({ id: 'waterskin',       name: 'Waterskin',        type: 'gear', weight: 5 }),
  'lantern-hooded':  Object.freeze({ id: 'lantern-hooded',  name: 'Hooded Lantern',   type: 'gear', weight: 2 }),
  'oil-flask':       Object.freeze({ id: 'oil-flask',       name: 'Oil (flask)',      type: 'gear', weight: 1 }),
  'crowbar':         Object.freeze({ id: 'crowbar',         name: 'Crowbar',          type: 'gear', weight: 5 }),
  'grappling-hook':  Object.freeze({ id: 'grappling-hook',  name: 'Grappling Hook',   type: 'gear', weight: 4 })
});

// Tool ids matching the SRD § Tool list. Hosts use these strings on
// record.proficiencies.tools.
export const TOOLS = Object.freeze({
  'alchemists-supplies': 'Alchemist\'s Supplies',
  'brewers-supplies':    'Brewer\'s Supplies',
  'carpenters-tools':    'Carpenter\'s Tools',
  'cartographers-tools': 'Cartographer\'s Tools',
  'cooks-utensils':      'Cook\'s Utensils',
  'disguise-kit':        'Disguise Kit',
  'forgery-kit':         'Forgery Kit',
  'herbalism-kit':       'Herbalism Kit',
  'masons-tools':        'Mason\'s Tools',
  'navigators-tools':    'Navigator\'s Tools',
  'painters-supplies':   'Painter\'s Supplies',
  'poisoners-kit':       'Poisoner\'s Kit',
  'smiths-tools':        'Smith\'s Tools',
  'thieves-tools':       'Thieves\' Tools',
  'tinkers-tools':       'Tinker\'s Tools',
  'weavers-tools':       'Weaver\'s Tools'
});

// Lifestyle expenses per SRD § Lifestyle Expenses (gp/day).
export const LIFESTYLES = Object.freeze({
  squalid:       0,
  poor:          0.2,
  modest:        1,
  comfortable:   2,
  wealthy:       4,
  aristocratic: 10
});

// Services per SRD § Services (gp).
export const SERVICES = Object.freeze({
  'coach-cab':         Object.freeze({ name: 'Coach Cab (between towns)', cost: 0.03 }),
  'hireling-skilled':  Object.freeze({ name: 'Hireling, skilled (per day)', cost: 2 }),
  'hireling-untrained':Object.freeze({ name: 'Hireling, untrained (per day)', cost: 0.2 }),
  'messenger':         Object.freeze({ name: 'Messenger (per mile)', cost: 0.02 }),
  'roadside-tax':      Object.freeze({ name: 'Roadside Tax', cost: 0.01 }),
  'ship-passage':      Object.freeze({ name: 'Ship\'s Passage (per mile)', cost: 0.1 })
});

export const Equipment = Object.freeze({
  ENCUMBRANCE_MULT,
  ADVENTURING_GEAR,
  TOOLS,
  LIFESTYLES,
  SERVICES,
  encumbranceLevel,
  encumbranceSpeedPenalty,
  armorStrengthPenalty,
  carriedWeight,
  donTime,
  doffTime,
  toolCheck
});

export default Equipment;
