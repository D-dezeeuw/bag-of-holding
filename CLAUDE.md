# bag-of-holding — Claude working notes

## Git workflow (trunk-based, strict)

Keep the repo to a single mainline plus short-lived feature branches.

- **One feature in flight per branch.** No side-branches off feature
  branches; no stacked branches. If a feature reveals a separate
  follow-up, finish the current branch and merge it first, then start
  the next branch from the freshly updated `main`.
- **Branch from `main`, merge to `main`, delete the branch.** The
  loop for every change:
  1. `git fetch origin main && git checkout -b <branch> origin/main`
  2. Implement → tests + typecheck green → commit.
  3. Push, open PR, merge via the GitHub MCP (merge commit style,
     matching the existing `Merge <branch> — <summary>` convention).
  4. `git push origin --delete <branch>` (or via the GitHub UI when
     the sandbox blocks it). Locally: `git branch -d <branch>`.
- **No rollbacks of `main`.** `main` only moves forward via merge
  commits. If something needs reverting, do it with a new commit /
  PR, never with `git reset --hard` on `main` or a force-push that
  rewinds history.
- **Resync before the next branch.** Always `git fetch origin main`
  + checkout the new branch from `origin/main` so each feature
  starts from the latest merged state.

## Versioning

- Kernel API changes → minor/major bump per the
  [roadmap](docs/roadmap.md). The reserved 2.x slots (`2.1.0` =
  Quiet Stair, `2.2.0` = Bestiary I, `2.3.0` = Bestiary II, etc.)
  are committed, do not collide with them when naming branches.
- Examples-only / docs-only / sandbox-only work → **patch bump**
  (`2.0.x`). Bump `package.json` + regenerate `package-lock.json`
  in the same commit as the feature.

## Gates before merging

`npm test` + `npm run typecheck` + `npm run pages:build` (if
`examples/` touched) all green. Coverage tracked in the roadmap
status line; if it drops, write tests in the same PR that caused
the drop.
