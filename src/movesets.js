/**
 * Return the set of legal action chips for a (pc, scene) pair. The
 * engine produces structured chips; the app's UI decides whether to
 * render them, hide them in favour of free-text, or surface them
 * inline as part of Nerd mode.
 *
 * The cost vocabulary (`free | action | bonus | reaction`) matches
 * SRD action types — "free" covers both speak-as-free and
 * look-around-as-free, which the SRD treats as the same category.
 *
 * Placeholder shape at v0: returns a sensible base set keyed off
 * `scene.mode`. Per-class moveset rules (a barbarian's Reckless
 * Attack, a rogue's Cunning Action) will replace this body as
 * classes graduate from "feature lists" to "behaving classes" —
 * the call signature stays.
 */
export function legal({ pc, scene }) {
  const actions = [];

  actions.push({ id: 'talk', label: 'Free-form dialogue', cost: 'free' });
  actions.push({ id: 'look', label: 'Look around', cost: 'free' });

  if (scene?.mode === 'combat') {
    actions.push({ id: 'attack.melee', label: 'Melee attack', cost: 'action' });
    actions.push({ id: 'move.disengage', label: 'Disengage', cost: 'action' });
    actions.push({ id: 'move.dash', label: 'Dash', cost: 'action' });
  } else {
    actions.push({ id: 'move', label: 'Move to another location', cost: 'free' });
  }

  return actions;
}
