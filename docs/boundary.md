# Boundary contract

`bag-of-holding` is reusable because it does *less* than a rules engine
usually does. Three things it will **never** do, plus one rule the
consuming app must follow.

## The three nevers

### 1. Never makes a network call

No `fetch`, no `XMLHttpRequest`, no `import`s of any HTTP library. The
import graph stays free of network code so the engine can be audited,
sandboxed, and run in environments without networking (CI, offline tools,
test rigs).

### 2. Never touches the DOM or browser-only globals

The engine must run under plain `node --test` with no shims. No
`document`, no `window`, no `localStorage`, no `requestAnimationFrame`.
Anything the engine needs from the host environment must be passed in.

### 3. Never calls an AI

The engine has no idea OpenAI, Anthropic, OpenRouter, or any LLM exists.
When the *game* needs prose ("describe how the orc swings"), the engine
returns the *structured facts* (hit, damage, status changes) and the app's
narrator turns those into prose. When the engine needs a decision the AI
should make ("which alive NPC should fill the authority slot in this
beat?"), the app provides a callback (`entityProvider` on
`castArchetypes`).

## The one mirror rule (for the app)

The app **never bypasses the engine for anything rules-shaped.** If the AI
narrates "you hit for 12 damage," the app discards the number and asks the
engine. If the AI claims a check succeeded, the app discards the verdict
and asks the engine.

The engine is the source of truth for D&D math. The AI is the source of
truth for prose. They don't overlap.

## Why this matters

- **Trust.** The player can trust dice rolls are real. AI hallucinations
  about damage numbers can't change the world.
- **Testability.** Engine tests have no AI cost, no flakiness, no API key.
- **Reusability.** Anyone can build a non-AI front-end (scripted, terminal,
  pen-and-paper aid) on the same engine.
- **Migration.** The AI providers will churn over the years. The rules
  engine doesn't.

## Enforcement

A grep over `src/` for forbidden tokens is part of the verification
checklist:

```bash
grep -rE "fetch\(|XMLHttpRequest|document\.|window\." src/   # must return nothing
```

Treat any future hit as a regression — find another design.
