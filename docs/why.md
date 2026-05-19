# Why `bag-of-holding` exists

This document captures the case for building this library at all — the
gap it fills, the conviction behind it, and the conditions under which
that conviction would no longer hold. Written 2026-05-18, after a
market scan of the JS 5e ecosystem. Re-read when motivation flags or
when something in the landscape changes.

## TL;DR

The JavaScript ecosystem has no maintained, zero-dep, CDN-loadable D&D
5e rules kernel. The packages that exist are either stale data dumps,
locked inside Foundry VTT, or Python-only. Meanwhile, the AI-driven
RPG category is brand new (post-2024) and every project in it bakes
its LLM into the rules engine, making rule logic untestable and tied
to one provider.

That gap is the niche. The kernel doesn't have to be revolutionary —
it has to be small, clean, AI-agnostic, and *exist*. By the time
`1.0.0` ships, the moat is the **discipline** (zero deps, pure
functions, replay-determinism, plugin system) rather than the math.
Anyone can copy the math; few competitors will copy the constraints.

## The gap, as of May 2026

A focused scan across npm, GitHub Topics, and the AI-DM ecosystem
turned up:

- **Stale data packages.** `fivee` (5 years old), `dnd5-srd` (6),
  `dndata-5e` (7). None implement rules math; all are data fetchers
  or dumps.
- **`Open5e`** — a REST API and database. Serves SRD content; not a
  rules engine.
- **Foundry VTT's `dnd5e` system module** — the strongest "full 5e in
  JS" implementation, but multi-megabyte, tied to Foundry's runtime,
  not a CDN-loadable library. Lifting the math out is
  approximately "rewrite it."
- **Python rules engines exist** (`natural_20` in Ruby, `dnd-5e-core`
  on PyPI, `furlat/dnd_engine`) — proving the *concept* has been
  built in other languages, but none in JS.
- **AI-DM projects are all Python or bot-shaped.** `NeverEndingQuest`,
  `GameMasterAI`, `ITMO-Agentic-AI/ai-dungeon-master`,
  `gpt-dungeon-master`, `samvoisin/ai-dungeon-master`. Every one of
  them bakes a specific LLM provider into the kernel. None separate
  the rules math from the AI loop the way this library does.
- **Narrative beat runtimes don't combine with rules.** RPGJS has an
  event builder, `inkjs` is a generic narrative DSL, `johnny.mov`'s
  text-RPG engine is ~50 kB but knows nothing of D&D. No library in
  JS combines a story-beat schema with rules math.

**Net:** the niche this library targets — *zero-dep ESM 5e kernel +
AI-agnostic by construction + plugin system + beat runtime* — is
genuinely empty in JavaScript today.

## Why this gap exists now (and why now is the moment)

Four forces converged in 2024–2026 to open the niche:

1. **LLM-driven RPGs became a real category.** Two years ago there
   was no audience for "a rules engine your AI host can consume."
   Today there is, but every project that's stood up so far bakes its
   provider in. The category is still young enough that a clean
   kernel-shaped player can define how the rest of the ecosystem
   integrates.
2. **The static-page, no-build, CDN-pinned model is back in vogue.**
   Three years of bundler-induced complexity is being pushed back on
   (the "vanilla JS revival"). Libraries that you can `<script
   type="module" src="https://unpkg.com/...">` without an `npm
   install` step are a real distribution channel again.
3. **SRD 5.2 (2025) shipped under CC-BY-4.0.** Wizards of the Coast
   re-released the SRD under a permissive Creative Commons licence in
   2025. That's the legal floor for everything below. Older 5.1-based
   libraries are technically OK but starting to feel dated as the new
   mechanics (Weapon Mastery, numeric Exhaustion, Backgrounds as
   ability-bump source) become expected.
4. **AI collapses the cognitive bottleneck for complete rules
   implementations.** D&D 5e is 200+ pages of deeply interlocked rules
   — a Sleep spell interacts with the Frightened condition, which
   interacts with concentration saves, which interact with proficiency
   bonus, which interacts with class features at specific levels. A
   single developer trying to hold the full surface in their head has
   historically had two choices: cut scope hard (the route most npm 5e
   packages took before going stale) or ship as a team over years
   (Foundry's `dnd5e` module). AI agents now hold the entire SRD plus
   the cross-references plus the edge cases in context simultaneously,
   which moves the bottleneck from *cognitive load* to *curation*.
   The developer's job shifts from "remember every rule" to "decide
   what stays, what's tested to what standard, what fits in the
   bundle, where the boundary holds." That's a job a solo developer
   can do for a 200-page surface. It wasn't, until ~2024.

None of these are durable for ten years. **The window is now.**

A note on the fourth force, because it changes the moat argument:
AI acceleration cuts both ways. The math becomes faster to *write*
for us, but also faster to *copy* for any competitor. That makes the
discipline (zero deps, pure functions, boundary doc, replay-
determinism, plugin system, 100/100/100 coverage, hand-maintained
`.d.ts`) the *only* moat that survives. A competitor with the same
AI tooling can match our rules math in a weekend; matching our
constraints simultaneously is the hard part, and AI doesn't directly
help with constraint-holding — that's a taste-and-judgement problem.

## Why MPL 2.0

The licence is the enforcement mechanism for the moat. MIT would let
a well-funded competitor lift the engine, close-source their
improvements, and ship a "better" fork their users never see the
source of. MPL 2.0 prevents that specific failure mode without
costing us any of the adoption we actually want:

- **What MPL 2.0 lets a consumer do.** Use bag-of-holding in any
  application, closed or open. Ship it in a commercial AI-DM
  product. Bundle it with proprietary content. Combine it with
  other libraries under other licences. No friction for the
  intended adoption shape.
- **What MPL 2.0 doesn't let a consumer do.** Modify the engine's
  files privately. If they touch `combat.js`, their version of
  `combat.js` stays under MPL 2.0 and must be made available in
  source form to anyone they distribute the modified library to.
  The application *around* the engine can be anything; the engine
  files themselves are sticky.
- **What this enforces.** Improvements to the kernel grow in
  public. A competitor's bloat is also public, which is its own
  discipline-enforcement mechanism — you can audit their fork
  against your boundary, and so can their users.

MIT was an honest first choice and it still would be defensible
(the discipline is largely self-protecting — copying the math
without the constraints produces an inferior fork). MPL 2.0 is the
more internally consistent choice given the explicit claim that the
discipline is the only moat that survives AI acceleration. We chose
the slightly less permissive option in exchange for a contribution
flow back to the kernel.

Two practical implications worth noting:

- **Files are the unit, not the project.** Wrapping the engine in
  closed-source code is fine. Modifying any individual engine file
  in a closed fork is not.
- **MPL 2.0 is compatible with GPL/AGPL/LGPL projects** (the
  Secondary Licenses clause), so downstream apps under copyleft
  licences can use the engine without licence-compatibility
  contortions.

## What we'd be if we get there

Stripped of marketing, the differentiated kernel — *at `1.0`, not
today* — would be:

1. **The only CDN-loadable 5e rules kernel.** Single file, zero
   runtime dependencies, < 25 kB minified. Drop into any static HTML
   page in one `<script>` tag. Foundry can't compete here without a
   full rewrite of its module loader.
2. **AI-agnostic by construction, not by accident.** The boundary doc
   is the contract: the engine never makes a network call, never
   touches the DOM, never talks to a model. AI hosts wrap the engine;
   the engine doesn't know they exist. No competitor in the AI-DM
   space has this discipline today.
3. **Replay-deterministic.** Same inputs, same outputs. Combined with
   Spektrum-style history, this makes undo, redo, chapter-rewind,
   "what if I had rolled different" branching, and reproducible AI
   testing genuinely cheap. Most rules engines never plan for this
   and end up with hidden state.
4. **A three-tier plugin system as a first-class API.** Content (A),
   rules (B), behaviour (C) are separate dials. A homebrew theme
   plugin adds species, classes, and items; a gritty-rest plugin
   adjusts the rules; a "narrate every crit dramatically" plugin
   hooks the math. Foundry approximates this with class extension,
   which is far more fragile.
5. **A beat runtime built into the rules library.** Narrative
   structure (Inkle's Ink, but rules-aware) lives in the same package
   as the rules math. The host orchestrates a story by walking a
   thread of beats with prerequisites and outcomes; the rules engine
   resolves the mechanics inside them.

The combination is the moat. Any one of those (zero deps, AI-agnostic,
plugin system, beat runtime) on its own is buildable as a weekend
project. The *discipline of holding all five together* in one auditable
file is what's hard to copy.

## Selling points, marked 0–10

Each row scored against the May 2026 landscape: how distinctive is
this property versus the actual competitive set? "Being new" is
excluded — every new library is new; that's not a selling point.

| # | Selling point | Mark at `1.0` | Why this mark |
| --- | --- | --- | --- |
| 1 | Zero runtime dependencies, single ESM file | **9** | Competitors are either multi-MB (Foundry) or stale data dumps. Genuinely rare. |
| 2 | CDN-loadable via `unpkg` with SRI pinning | **9** | No maintained JS rules kernel ships this way. |
| 3 | AI-agnostic by construction (`boundary.md` discipline) | **9** | Every AI-DM project bakes a provider into the kernel; this one explicitly refuses. |
| 4 | Pure functions + replay-deterministic | **8** | Other engines drift into hidden state; this is Spektrum-tier discipline. Seedable RNG + replay verifier shipped in `0.1.0`. |
| 5 | Three-tier plugin system (content / rules / behaviour) | **7** | Phase A (content) **and** Phase B (rule knobs) shipped in `0.1.x`/`0.2.0`; Phase C (hooks) on roadmap. Genuinely novel surface; reaches 9 when C lands. |
| 6 | Hand-maintained `.d.ts` with `tsc --noEmit` drift gate | **7** | Uncommon discipline; quality signal more than a marketing line. |
| 7 | Beat runtime alongside rules math in one library | **8** | The only "rules + narrative-structure together" library in JS. Ink-adjacent but with 5e built in. |
| 8 | SRD 5.2 (2025) compliance | **6** | NeverEndingQuest claims 5.2.1 too; nice to be current, not unique. |
| 9 | Sub-25 kB minified target | **7** | Ambitious; Foundry is multi-MB. Real differentiator for static-page apps if delivered. |
| 10 | Designed-for-AI-loops output shape (structured riders, chip-based movesets, classifier-friendly returns) | **8** | Competitors that serve AI loops bake the LLM in; this one is purpose-built for an external AI loop without coupling to one. |
| 11 | 100 / 100 / 100 coverage gate as ongoing contract | **7** | Uncommon for a hobby-tier library; valuable for downstream consumers; not flashy. |
| 12 | Active maintenance in a graveyard ecosystem | **7** | Most JS 5e packages are 5–7 years dead. Being alive is itself differentiating. |

**Headline (the strongest combinations):**

1. **"The only zero-dep, CDN-loadable 5e kernel"** — rows 1 + 2 + 9.
   This trio defines a niche nothing else occupies.
2. **"AI-loop-ready, AI-agnostic"** — rows 3 + 10. Every AI-DM project
   is married to one model; this one is married to none.
3. **"Plugin system at the kernel"** — rows 5 + 7. Phases A and B
   have shipped (`0.1.x` / `0.2.0`); once Phase C lands the combined
   homebrew + theme story is something Foundry can only approximate
   via class extension.

**Today's marks if scored against only what's shipped, not the
roadmap target:**

| Row | At 1.0 | Today | Gap closed by |
| --- | --- | --- | --- |
| 4  Replay-deterministic | 8 | **8** | ✅ Seedable RNG + roll log + replay verifier shipped in `0.1.0` |
| 5  Plugin system | 7 | **7** | ✅ Phases A and B shipped; Phase C (`0.3.0`) closes the last gap |
| 9  Sub-25 kB | 7 | 6 | CI bundle budget + tree-shaking polish (`1.0.0`) |
| 10 AI-loop output shape | 8 | 8 | Already shipped — kept honest as "today" |

The honest read: replay-determinism and plugin extensibility have
both landed; the remaining distinctiveness is mostly polish.
"Sub-25 kB" is the only major selling point still in deficit, and
it's a CI/tree-shaking story rather than a missing feature. The
decision criterion below is what stops us from coasting on
potential.

## What we know vs. what we suspect

**What we know (confirmed by the scan):**

- No JS competitor in this niche exists today.
- The Python competitors prove the concept is viable.
- Static-page + CDN distribution still works.
- SRD 5.2 is freely usable under CC-BY-4.0.

**What we suspect (assumptions worth re-checking annually):**

- AI-driven RPGs will remain a real category for at least 2–3 years.
  Reasonable but not certain — could collapse if LLM providers ship
  RPG-specific products that obviate hobbyist engines.
- "Homebrew that ships as a plugin" is a UX people will want.
  Today the homebrew market is character-sheet PDFs and 5etools entries.
  We're betting plugin-as-content becomes a thing; it might not.
- A single-file CDN-loadable library will remain a meaningful
  distribution channel. Plausible but watch for the next bundler
  fashion cycle.

## What would make this a waste of time

Three scenarios where the conviction should collapse and the project
should stop:

1. **WotC (or a Foundry spin-out) ships an official, permissively-
   licensed, CDN-loadable 5e SDK.** Low probability — WotC has shown
   zero interest in offering a developer SDK and Foundry's commercial
   model relies on Foundry — but if it happened, the entire premise
   evaporates within a release cycle.
2. **LLMs become reliable enough to run rules-free narrative RPGs at
   scale.** Plausible on a 5+ year horizon. If the AI can be trusted
   to enforce HP, AC, action economy, and spell slots correctly
   without a deterministic engine underneath, the rules kernel becomes
   a curiosity. The current capabilities (Claude 4.x, GPT-5 era) are
   not there; this might never get there because of the cost/latency
   trade-off, but the trajectory is worth watching.
3. **A maintained `bag-of-holding`-shaped competitor lands first.**
   Most likely vector: a Foundry community member extracts the dnd5e
   module's math into a standalone npm package and beats us to a
   maintained 1.0. Watchable; check npm + GitHub Topics every few
   months. If it happens, decide whether to contribute upstream or
   keep going on differentiation.

## The decision criterion (when to keep going vs. stop)

We keep going while **all four** of these hold:

- [ ] No mature JS competitor occupies the niche.
- [ ] At least one real consumer exists or is plausibly about to (today
      that's Dungeons-and-Dans).
- [ ] The kernel can still be kept under the bundle budget (< 25 kB
      minified at `1.0`).
- [ ] The boundary discipline (zero deps, no I/O, no AI coupling) can
      be maintained — we haven't been forced to compromise to support
      a real use case.

If any one of these flips for a sustained period (more than two
quarters), revisit. If two flip, stop and reassess from first
principles.

## The vision, restated as motivation

A tiny, AI-agnostic 5e rules kernel that ships as a single
CDN-loadable ESM file, scales from a single quick-play app to a
100-hour persistent campaign, and lets homebrewers and AI agents alike
contribute content and rules without forking the engine.

The kernel is the math. The host owns the prose, the persistence, and
the AI loop. The point of `bag-of-holding` is that **the math should
be small, audit-able, and yours.** Everyone else has either given the
math to a VTT, given it to an LLM, or let it bit-rot in a package
nobody maintains. We're betting there's a real audience for "the math
on its own, treated like a library."

## How to use this document

Re-read when:

- You hit a hard week and the motivation slips. The market gap doesn't
  go away on a bad Tuesday.
- A new competitor shows up. Check it against the "would make this a
  waste of time" criteria above.
- A roadmap milestone tempts a scope expansion that breaks the
  boundary discipline. The discipline is the moat; protect it.
- You're tempted to "just `npm install` one thing." Re-read § 1.

Update when:

- The competitive landscape meaningfully changes (annually).
- A roadmap phase ships and the "what we'd be" section becomes
  partially "what we are."
- One of the "what we suspect" assumptions breaks.
