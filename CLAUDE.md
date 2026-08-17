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
  [roadmap](docs/roadmap.md). The numbered roadmap is fully shipped
  (every row through `5.3.0`; current line is `3.10.x`), so new
  work simply takes the next free minor; content-only registry
  additions are minors too (precedent: 2.6.0 and 3.10.0 gap
  blocks). Historical note kept because it explains the npm state:
  `2.1.0` was never an intentional release — the merge resolution
  in `c4654c7` wrote `2.1.0` into `package.json` while reconciling
  a 1.16.0 branch with 2.0.9, and that build was published to npm
  on 2026-06-01. A published version is immutable.
- **A published version is immutable.** Before `npm publish`, run
  `git fetch origin main` and confirm the working tree matches it;
  `npm view @zeeuw/bag-of-holding versions` shows what is already
  taken. Publishing from a stale checkout is what burned `2.1.0`.
- Examples-only / docs-only / sandbox-only work → **patch bump**.
  Bump `package.json` + regenerate `package-lock.json` in the same
  commit as the feature, then regenerate the stamped pages
  (`node scripts/build-docs.mjs && node scripts/build-content-index.mjs`)
  AFTER the bump — their tests compare against `package.json`.

## Gates before merging

`npm test` + `npm run typecheck` + `npm run pages:build` (if
`examples/` touched) all green. Coverage tracked in the roadmap
status line; if it drops, write tests in the same PR that caused
the drop.
