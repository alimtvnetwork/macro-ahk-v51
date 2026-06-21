# Marco Chrome Extension v3.103.0

## Added

- Projects Modal Task 14: end-to-end SQLite cache verification. The Projects
  dialog now short-circuits per-workspace `projects.list` network fetches when
  the SQLite-backed projects-cache row is fresh (within TTL). The Refresh
  button still bypasses the cache.
- Cache observability: each workspace logs `Projects: cache hit ws=… —
  skipping projects.list fetch` or `Projects: cache miss ws=… — fetching
  projects.list`, and load completion logs
  `Projects: load complete — cacheHits=X cacheMisses=Y bypass=Z` so the cache
  effect is visible without DevTools.

## Changed

- Advanced `.lovable/plans/projects-modal-15-step-improvement.md` to Task 15 —
  final changelog/version sweep.

## Verification

- `node scripts/check-version-sync.mjs` → ✅ All versions in sync: 3.103.0.
