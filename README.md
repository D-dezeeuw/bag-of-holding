# bag-of-holding

[![npm version](https://img.shields.io/npm/v/@zeeuw/bag-of-holding.svg?style=flat-square)](https://www.npmjs.com/package/@zeeuw/bag-of-holding)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@zeeuw/bag-of-holding?style=flat-square&label=min%2Bgzip)](https://bundlephobia.com/package/@zeeuw/bag-of-holding)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](./package.json)
[![types: built-in](https://img.shields.io/badge/types-built--in-blue.svg?style=flat-square)](./index.d.ts)
[![coverage 100%](https://img.shields.io/badge/coverage-100%25-brightgreen.svg?style=flat-square)](#development)
[![SRD 5.2 (2025)](https://img.shields.io/badge/SRD-5.2%20(2025)-orange.svg?style=flat-square)](https://www.dndbeyond.com/srd)
[![license: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg?style=flat-square)](./LICENSE)

A tiny, AI-agnostic D&D 5e (**SRD 5.2**) rules kernel. **Zero runtime
dependencies, single ESM file, CDN-loadable.** Designed to plug into
any AI-driven RPG host, or any host, without locking you to a model,
a framework, or a virtual tabletop.

> The math is the engine. The host owns the prose, the persistence,
> and the AI loop. See [docs/why.md](docs/why.md) for the case behind
> the design.

## Highlights

- **Zero runtime dependencies.** One ESM file, auditable line by line.
- **AI-agnostic by construction.** No network calls, no DOM, never
  talks to a model. See [docs/boundary.md](docs/boundary.md).
- **Pure functions, plain data.** Every result is serialisable,
  replay-deterministic when seeded with `Dice.seededRng(seed)`.
- **Forensically inspectable randomness.** Append-only `rollLog`,
  optional `context` tags per roll, and a `verifyLog` replay
  verifier that flags any divergence between recorded and
  re-executed outcomes.
- **Plugin-extensible at the kernel.** Phase A (content), Phase B
  (rule knobs), Phase C (behavioural hooks), and Phase D (turn-
  lifecycle and scene events) all via `createEngine({ ... })`. See
  [docs/spec.md § Plugins](docs/spec.md).
- **Character sheets.** `Character.deriveSheet(record, engine)`
  turns a host-owned record into a frozen sheet (AC, HP, saves,
  skills, attacks, spellcasting). Host owns the record; engine
  derives.
- **TypeScript types included.** Hand-maintained `index.d.ts` with a
  `tsc --noEmit` drift gate. No `@types/` install needed.
- **SRD 5.2 (2025).** Weapon Mastery, numeric Exhaustion,
  Backgrounds-as-ability-source, the current rules, not a 5.1
  carry-over.
- **100% line / branch / function coverage** as an ongoing contract.
- **SRD-completeness tracked transparently.** See
  [docs/srd-coverage.md](docs/srd-coverage.md) for the live
  per-section worklist.

## Install

```bash
npm install @zeeuw/bag-of-holding
```

Or drop it straight into a static page from a CDN, no build step:

```html
<script type="module">
  import { Combat, SRD } from 'https://unpkg.com/@zeeuw/bag-of-holding';

  const result = Combat.attackRoll({ attackBonus: 5, ac: 14 });
  console.log(result);
</script>
```

## Use

```js
import { Dice, Combat, Conditions, XP, SRD } from '@zeeuw/bag-of-holding';

// Roll dice with the standard XdY±Z grammar.
Dice.roll('2d6+3');
// → { spec: '2d6+3', rolls: [4, 5], modifier: 3, total: 12 }

// Resolve an attack → damage → applied HP, with resistance + tempHp
// folded in automatically.
const attack = Combat.attackRoll({ attackBonus: 5, ac: 14 });
if (attack.hit) {
  const dmg = Combat.damageRoll({
    damageDice: '1d8', damageMod: 3,
    damageType: 'slashing', critical: attack.critical
  });
  Combat.applyDamage(target, { amount: dmg.total, type: dmg.damageType });
}

// SRD 5.2 Weapon Mastery, riders resolve declaratively.
const longsword = SRD.items.longsword;       // mastery: 'sap'
Combat.applyMastery(longsword, target, attack);
// → { kind: 'sap', disadvantage: true }     (target's next attack)

// Conditions are immutable, apply / remove returns a new actor.
const blinded = Conditions.apply(actor, 'blinded');
const tired   = Conditions.exhaustion.gain(actor);   // 0..6, SRD 5.2

// XP and level math.
XP.levelForXP(2700);          // → 4
XP.nextLevelThreshold(2700);  // → 6500
```

The engine ships ~20 namespaces: `Dice`, `Checks`, `Combat`,
`Conditions`, `XP`, `Spellcasting`, `Rest`, `Mechanics`, `SceneClock`,
`MagicItems`, `Monsters`, `Movement`, `Multiclass`, `Inspiration`,
`EncounterDesign`, `Movesets`, `Beats`, `Character`, plus the `SRD`
content alias. See [docs/recipes.md](docs/recipes.md) for worked
examples of how they combine.

## Custom rules (plugins)

For homebrew content, extra species, alternate conditions, custom
weapon-mastery properties, instantiate a custom engine:

```js
import { createEngine } from '@zeeuw/bag-of-holding';

const engine = createEngine({
  extraSpecies: {
    'half-elf': {
      id: 'half-elf', name: 'Half-Elf',
      size: 'medium', speed: 30, traits: ['Adaptable']
    }
  },
  extraConditions: ['cursed'],
  extraMastery: {
    pin: (weapon, target, result) =>
      result.hit
        ? { kind: 'pin', condition: 'grappled', duration: '1 turn' }
        : { kind: 'none' }
  }
});

engine.Combat.applyMastery({ mastery: 'pin' }, target, attackResult);
engine.Conditions.apply(actor, 'cursed');
engine.species['half-elf'];
```

The default singleton (the `Combat`, `Conditions`, ... you import
directly) is just `createEngine()` with no opts. Two engines on the
same page have fully independent registries; nothing leaks.

See [docs/spec.md § Plugins](docs/spec.md) for the full contract,
validation behaviour, and merge semantics.

## Documentation

- [docs/recipes.md](docs/recipes.md), pragmatic patterns and
  compound flows (combat actions menu, damage pipeline, class
  mechanics, magic-item lifecycle, ritual casting, AoE spells, ...).
  The "how do I actually do X?" reference.
- [docs/why.md](docs/why.md), the case for the library: market gap,
  niche, moat, the conditions under which this would be a waste of
  time. Read first.
- [docs/spec.md](docs/spec.md), what the engine implements (and what
  it doesn't); plugin contract; types.
- [docs/srd-coverage.md](docs/srd-coverage.md), line-by-line
  checklist against the SRD 5.2. The live SRD-compliance worklist.
- [docs/character-sheet.md](docs/character-sheet.md), the
  `CharacterRecord` (host-owned) ↔ `DerivedSheet` (engine-derived)
  contract with a worked example.
- [docs/roadmap.md](docs/roadmap.md), versioned milestones and the
  vision behind them.
- [docs/boundary.md](docs/boundary.md), what the engine **won't** do.
- [docs/beat-schema.md](docs/beat-schema.md), the story-beat shape
  and runtime.
- [docs/legal.md](docs/legal.md), what we can and can't reference
  from D&D / Wizards of the Coast; SRD 5.2 vs Product Identity.

## Requirements

- Any **ESM-capable runtime** for consumption (Node ≥ 18, every modern
  browser, Deno, Bun).
- **Node ≥ 22** for development (the test suite uses `node --test`
  with `--experimental-test-coverage`).

## Development

```bash
npm test                  # node --test
npm run test:coverage     # 100 / 100 / 100 line / branch / function
npm run typecheck         # tsc --noEmit against the hand-maintained .d.ts
npm run bundle-size       # measure min + gzip against the budget
```

The coverage and typecheck scripts are the quality gates; the library
maintains 100 / 100 / 100 as an ongoing contract, not a one-time
achievement.

## License

[MPL 2.0](LICENSE), file-level copyleft. Use the engine in any
application, closed or open. If you modify any of the engine's
**files**, those modifications stay under MPL 2.0 and remain
available in source form; everything *around* the engine in your
application is unaffected. See
[docs/why.md § Why MPL 2.0](docs/why.md) for the reasoning.

Built on the [SRD 5.2](https://www.dndbeyond.com/srd) by Wizards of
the Coast, licensed [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
