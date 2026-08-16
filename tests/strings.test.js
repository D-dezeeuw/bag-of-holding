// Localization layer (4.2.0). What must hold: the English table is
// COMPLETE against the live registries (a new condition/class/species/
// rarity fails here, not in a host's UI); the three-step fallback
// works; partial locales are legal with their gap reportable; the
// engine binds the surface through extraLocales; and bad locale tables
// refuse at construction.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, Strings, Conditions, MagicItems } from '../index.js';
import { DEFAULT_STRINGS, makeStrings } from '../src/strings.js';

// A partial Dutch locale — deliberately incomplete, as real locale
// packs will be while in progress.
const NL = {
  'condition.blinded': 'Verblind',
  'condition.poisoned': 'Vergiftigd',
  'condition.unconscious': 'Bewusteloos',
  'class.wizard': 'Tovenaar',
  'ability.str': 'Kracht',
  'action.dodge': 'Ontwijken',
  'rarity.veryRare': 'Zeer zeldzaam',
  'rest.long': 'Lange rust',
};

test('the English table is complete against the live registries', () => {
  const engine = createEngine();
  for (const condition of Conditions.CONDITIONS) {
    assert.ok(DEFAULT_STRINGS[`condition.${condition}`], `condition.${condition} has a label`);
  }
  assert.ok(DEFAULT_STRINGS['condition.exhaustion'], 'exhaustion (the track) has a label');
  for (const classId of Object.keys(engine.classes)) {
    assert.ok(DEFAULT_STRINGS[`class.${classId}`], `class.${classId} has a label`);
  }
  for (const speciesId of Object.keys(engine.species)) {
    assert.ok(DEFAULT_STRINGS[`species.${speciesId}`], `species.${speciesId} has a label`);
  }
  for (const band of MagicItems.RARITY_BANDS) {
    assert.ok(DEFAULT_STRINGS[`rarity.${band}`], `rarity.${band} has a label`);
  }
  for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    assert.ok(DEFAULT_STRINGS[`ability.${ability}`], `ability.${ability} has a label`);
  }
});

test('three-step fallback: locale → English → the key itself', () => {
  const S = makeStrings({ nl: NL });
  assert.equal(S.t('condition.blinded', 'nl'), 'Verblind');
  assert.equal(S.t('condition.prone', 'nl'), 'Prone', 'untranslated key falls back to English');
  assert.equal(S.t('condition.blinded'), 'Blinded', 'no locale means English');
  assert.equal(S.t('made.up.key', 'nl'), 'made.up.key', 'unknown key returns itself — visible, greppable');
  assert.deepEqual(S.locales(), ['nl']);
});

test('partial locales are legal; missingIn reports the gap for locale-pack CI', () => {
  const S = makeStrings({ nl: NL });
  const missing = S.missingIn('nl');
  assert.equal(missing.length, Object.keys(DEFAULT_STRINGS).length - Object.keys(NL).length);
  assert.ok(missing.includes('condition.prone'));
  assert.ok(!missing.includes('condition.blinded'));
  // A locale nobody registered is missing everything.
  assert.equal(S.missingIn('fr').length, Object.keys(DEFAULT_STRINGS).length);
});

test('the engine binds Strings through extraLocales; defaults stay English-only', () => {
  const engine = createEngine({ extraLocales: { nl: NL } });
  assert.equal(engine.Strings.t('class.wizard', 'nl'), 'Tovenaar');
  assert.equal(engine.Strings.t('class.wizard'), 'Wizard');
  assert.deepEqual(engine.Strings.locales(), ['nl']);
  // A bare engine carries the shim with no locales — English passthrough.
  assert.deepEqual(createEngine().Strings.locales(), []);
  assert.equal(createEngine().Strings.t('action.dash'), 'Dash');
  // The module-level export serves engine-less callers.
  assert.equal(Strings.t('rest.long'), 'Long Rest');
  // Bad tables refuse at construction with a pointer.
  assert.throws(() => makeStrings({ nl: { 'condition.blinded': 42 } }), /key 'condition.blinded' must map to a string/);
  assert.throws(() => makeStrings({ nl: ['x'] }), /locale 'nl' must be a map/);
});
