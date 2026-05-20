# Why `bag-of-holding` exists

A short, honest statement of what we're building and why it's worth
building. Re-read when motivation flags, when something in the
landscape changes, or when a roadmap decision tempts a scope creep
that would break what makes this library distinct.

## The one-paragraph version

`bag-of-holding` is a tiny, zero-dependency D&D 5e (SRD 5.2) rules
kernel that ships as a single ESM file you can drop into any page from
a CDN. It runs the math, returns plain data, and stays out of the way
of everything else. Any AI host, any UI, any VTT can wrap it. We
believe the rules engine and the AI loop should be separate things,
and that the math should be small, auditable, and yours.

## What we're building

A rules library with five properties we hold together:

1. **Zero runtime dependencies.** One ESM file, auditable line by
   line, installable from npm or pinned from a CDN.
2. **AI-agnostic by construction.** The engine never makes a network
   call, never touches the DOM, never talks to a model. The host
   wraps it, not the other way around.
3. **Pure functions, plain data.** Every result is serialisable,
   replay-deterministic when seeded, and free of hidden state.
4. **Forensically inspectable randomness.** Every roll lands in an
   append-only `rollLog`, with optional context tags and a
   `verifyLog` replay verifier that flags divergence between recorded
   and re-executed outcomes.
5. **Plugin-extensible at the kernel.** Content, rule knobs,
   behavioural hooks, and turn-lifecycle events all extend the engine
   through `createEngine({ ... })` without forking it.

We hold all five at once. Any one of them is a weekend project. The
combination is what makes the library worth using.

## Why this gap exists

We did the market scan in May 2026. The picture was clear:

- **Stale data packages.** `fivee`, `dnd5-srd`, `dndata-5e`, all 5 to
  7 years old, none implementing rules math.
- **Foundry VTT's `dnd5e` system module.** The strongest "full 5e in
  JS" implementation, but multi-megabyte and tied to Foundry's
  runtime. Lifting the math out is approximately "rewrite it."
- **Python rules engines exist.** `natural_20` in Ruby,
  `dnd-5e-core` on PyPI, `furlat/dnd_engine`. The concept is proven
  in other languages. Nothing in JS.
- **AI-DM projects all bake the LLM into the kernel.** Every project
  in this category that we found marries the rules math to one
  provider. None separate the two the way this library does.
- **Narrative beat runtimes don't combine with rules.** RPGJS,
  inkjs, johnny.mov's text-RPG engine. Generic story tooling exists,
  but nothing combines a story-beat schema with 5e rules in JS.

The niche we target, a zero-dep ESM 5e kernel plus AI-agnostic
discipline plus plugin system plus beat runtime, is genuinely empty
in JavaScript. That's the opening.

## Why now is the moment

Four forces converged in 2024 to 2026:

1. **LLM-driven RPGs are a real category.** Two years ago the
   audience for "a rules engine your AI host can consume" didn't
   exist. Today it does, and the category is still young enough that
   a clean kernel can shape how the rest of the ecosystem integrates.
2. **CDN-pinned, no-build distribution is back in vogue.** Three
   years of bundler complexity is being pushed back on. Libraries
   you can `<script type="module" src="https://unpkg.com/...">`
   without an `npm install` are a real distribution channel again.
3. **SRD 5.2 (2025) shipped under CC-BY-4.0.** Wizards of the Coast
   re-released the SRD under a permissive Creative Commons licence
   in 2025. The licence is irrevocable. That's the legal floor for
   everything below.
4. **AI collapses the cognitive bottleneck for complete rules
   implementations.** D&D 5e is 200+ pages of deeply interlocked
   rules. A solo developer used to have two choices: cut scope hard
   (the route most npm 5e packages took before going stale) or ship
   as a team over years (Foundry's `dnd5e` module). AI agents now
   hold the full SRD in context simultaneously, which shifts the
   bottleneck from cognitive load to curation. That's a job a solo
   developer can do, and it wasn't until ~2024.

## What the moat actually is

AI acceleration cuts both ways. The math becomes faster to write for
us, and faster to copy for any competitor. So the moat is not the
rules math; the moat is the discipline of holding the five properties
above all at once. Zero deps, pure functions, boundary doc, replay-
determinism, plugin system, 100/100/100 coverage, hand-maintained
`.d.ts`, bundle budget. A competitor with the same AI tooling can
match our rules math in a weekend. Matching the constraints
simultaneously is the hard part, and AI doesn't directly help with
constraint-holding. That's a taste-and-judgement problem.

This is why every roadmap milestone protects the constraints first.
A feature that fits cleanly inside them lands. A feature that breaks
one is either redesigned or doesn't ship.

## Why MPL 2.0

The licence is the enforcement mechanism for the moat. MIT would let
a well-funded competitor lift the engine, close-source their
improvements, and ship a "better" fork their users never see the
source of. MPL 2.0 prevents that specific failure mode without
costing us any of the adoption we actually want.

- **What MPL 2.0 lets a consumer do.** Use bag-of-holding in any
  application, closed or open. Ship it in a commercial AI-DM
  product. Bundle it with proprietary content. Combine it with
  other libraries under other licences. No friction for the
  intended adoption shape.
- **What MPL 2.0 doesn't let a consumer do.** Modify the engine's
  files privately. If they touch `combat.js`, their version of
  `combat.js` stays under MPL 2.0 and must be made available in
  source form to anyone they distribute the modified library to.
  The application around the engine can be anything; the engine
  files themselves are sticky.
- **What this enforces.** Improvements to the kernel grow in
  public. A competitor's bloat is also public, which is its own
  discipline-enforcement mechanism. You can audit their fork
  against your boundary, and so can their users.

Two practical implications:

- **Files are the unit, not the project.** Wrapping the engine in
  closed-source code is fine. Modifying any individual engine file
  in a closed fork is not.
- **MPL 2.0 is compatible with GPL/AGPL/LGPL projects** through the
  Secondary Licenses clause, so downstream apps under copyleft
  licences can use the engine without licence-compatibility
  contortions.

## Where we are today (v1.16.0)

Most of what "the differentiated kernel at 1.0" originally promised
has shipped. The current surface:

- **20 namespaces.** Dice, Checks, Combat, Conditions, XP,
  Spellcasting, Rest, Mechanics, SceneClock, MagicItems, Monsters,
  Movement, Multiclass, Inspiration, EncounterDesign, Movesets,
  Beats, Character, plus the SRD content alias.
- **All 12 SRD classes** with class mechanics dispatch, resource
  tracking, and the SRD 5.2 features through tier 2 (L1 to L10).
- **Plugin system across four phases.** Content (A), rule knobs (B),
  behavioural hooks (C), turn-lifecycle and scene events (D).
- **Replay-deterministic from day one.** Seeded RNG, append-only
  `rollLog` with context tags, `verifyLog` replay verifier.
- **100/100/100 line/branch/function coverage** as an ongoing
  contract, gated in CI.
- **Hand-maintained `index.d.ts`** with a `tsc --noEmit` drift gate.
- **Bundle budget gate** at 160 kB min / 40 kB gz, measured on
  every commit.
- **Live SRD coverage worklist** in
  [srd-coverage.md](srd-coverage.md), tracking what's shipped and
  what's planned per section.

The remaining 1.x work is concentrated in tier-3 and tier-4 class
features (L11 to L20), equipment depth, hazards and environment, and
the subclass handler maps. After that the line goes through 2.0.0
Solo mode, the post-SRD content packs (bestiaries, grimoires,
treasury), and three original settings designed to give a host
something playable on day one. See
[roadmap.md](roadmap.md) for the chronological plan.

## What we know vs. what we suspect

**What we know:**

- No JS competitor in this niche exists today.
- The Python competitors prove the concept is viable.
- Static-page plus CDN distribution still works.
- SRD 5.2 is freely usable under CC-BY-4.0.

**What we suspect, worth re-checking annually:**

- AI-driven RPGs will remain a real category for at least 2 to 3
  years. Reasonable but not certain. Could collapse if LLM providers
  ship RPG-specific products that obviate hobbyist engines.
- "Homebrew that ships as a plugin" is a UX people will want. Today
  the homebrew market is character-sheet PDFs and 5etools entries.
  We're betting plugin-as-content becomes a thing; it might not.
- A single-file CDN-loadable library will remain a meaningful
  distribution channel. Plausible but watch for the next bundler
  fashion cycle.

## The decision criterion

We keep going while all four of these hold:

- [ ] No mature JS competitor occupies the niche.
- [ ] At least one real consumer exists or is plausibly about to.
- [ ] The kernel can still be kept under the bundle budget.
- [ ] The boundary discipline (zero deps, no I/O, no AI coupling)
      can be maintained, and we haven't been forced to compromise
      to support a real use case.

If any one of these flips for a sustained period (more than two
quarters), revisit. If two flip, stop and reassess from first
principles.

## The vision, restated

A tiny, AI-agnostic 5e rules kernel that ships as a single
CDN-loadable ESM file, scales from a single quick-play app to a
100-hour persistent campaign, and lets homebrewers and AI agents
alike contribute content and rules without forking the engine.

The kernel is the math. The host owns the prose, the persistence,
and the AI loop. The point of `bag-of-holding` is that the math
should be small, auditable, and yours. Everyone else has either
given the math to a VTT, given it to an LLM, or let it bit-rot in a
package nobody maintains. We're betting there's a real audience for
"the math on its own, treated like a library."

## How to use this document

Re-read when:

- You hit a hard week and the motivation slips. The market gap
  doesn't go away on a bad Tuesday.
- A new competitor shows up. Check it against the decision criterion
  above.
- A roadmap milestone tempts a scope expansion that breaks the
  boundary discipline. The discipline is the moat; protect it.
- You're tempted to "just `npm install` one thing." Re-read the
  five properties at the top.

Update when:

- The competitive landscape meaningfully changes (annually).
- A roadmap phase ships and the "where we are today" section becomes
  out of date.
- One of the "what we suspect" assumptions breaks.
