# Beat schema & runtime

A **beat** is one abstract story node, "a confrontation with an authority
figure exposes the conspiracy", not a concrete scene. The runtime walks an
ordered list of beats; the *app* (or its AI) realises each beat into a
concrete scene at the moment the player reaches it, using whoever's still
alive that matches the beat's archetype slots.

This shape supports a **linear v1** and a **branching v2** from the same
schema: only `successors[]` and a new `pickNext` function flip on later.

## Shape

```js
{
  id:                    'beat.07.expose-the-conspiracy', // string, required
  dramaticPurpose:       'Force authority to commit',     // string, required
  targetPlaytimeMinutes: 45,                              // number, required

  prerequisites:    ['flag.proofGathered'],               // flags that must be true to be 'ready'
  setRequiredFlags: ['flag.conspiracyExposed'],           // flags whose all-true means 'complete'

  preferredLocation:    'loc.thornharbor.castle.throne',  // string | null
  fallbackLocations:    ['any.cityHall', 'any.templeOfAuthority'],

  requiredArchetypes: [
    { role: 'authority',  weight: 1.0, notes: 'ruler or high cleric' },
    { role: 'antagonist', weight: 0.7, notes: 'complicit faction member' }
  ],
  boundEntities: {},                                      // v1 leaves empty; v2 may hard-pin

  successors: []                                          // v1 ignores; v2 enables branching
}
```

`makeEmptyBeat(id)` returns a beat with sensible defaults so callers can
fill in only what they care about.

## Validation

`validateBeat(beat) → { valid, errors }` enforces:

- Required fields are present.
- `id` is a string.
- `targetPlaytimeMinutes` is a number.
- Every array-shaped field that's present is actually an array.

The validator is deliberately permissive about contents; it checks shape,
not semantics. The generator agent (in the app) is responsible for
sensible values.

## Archetype vocabulary

`ARCHETYPE_ROLES` is the canonical list the generator should draw from:

```
authority   antagonist   informant   mentor   fixer   muscle   herald
```

This is intentionally short. It can grow in a minor release if the
generator needs more, but every new role expands the casting search space
in the app, so add deliberately.

## Runtime

A thread is `{ beats, currentIndex }`. The runtime is four pure functions:

| Function | Purpose |
| --- | --- |
| `createThread(beats)` | Validates every beat, returns thread at index 0. |
| `currentBeat(thread)` | Returns the current beat or `null` if past the end. |
| `isReady(beat, state)` | All `prerequisites` flags true? |
| `isComplete(beat, state)` | All `setRequiredFlags` flags true? |
| `advance(thread, state)` | If complete, return a new thread at the next index. |

`advance` returns `{ thread, advanced, finished, reason? }`. It never
mutates the thread you pass in.

## Casting

`castArchetypes(beat, { entityProvider }) → { cast, missing, error }` is
where the engine asks the app to fill archetype slots with live entities.
The callback signature is:

```js
entityProvider(slot) → entity | null
```

The engine doesn't know what an entity *is*. A `{ id, name }` is fine for
v1; the app can attach whatever fields its narrator needs.

If any slot can't be filled, `cast` is `null` and `missing` carries the
slot that failed. The app decides what to do: lazily generate a matching
NPC, swap the beat's location, or fall back to a generic NPC.

## Linear today, branching tomorrow

At v1 the runtime walks `beats` by integer index. The schema's
`successors[]` is parsed and stored but ignored. At v2 a `pickNext(beat,
state)` function will:

1. If `successors[]` is empty, linear fall-through (current behaviour).
2. Otherwise, return the first successor whose conditions hold.

No data migration needed. Existing linear threads will keep walking
linearly.
