Bump the MAJOR version (MAJOR.MINOR.PATCH → MAJOR+1, MINOR=0, PATCH=0) across all unified-version sites (manifest.json, version.json, src/shared/constants.ts, standalone-scripts/macro-controller/src/shared-state.ts, standalone-scripts/payment-banner-hider/src/index.ts, and every standalone-scripts/*/src/instruction.ts), then:

1. Add a changelog entry in root `changelog.md` (new `## [vX.0.0] — YYYY-MM-DD ...` heading, grouped Added / Changed / Fixed / Removed / Breaking as applicable).
2. Pin the new version in root `readme.md` everywhere the old pinned tag appears (badge / version line / install snippets / release branch example).
3. Update root `version.json` with the same version and release date.
4. If the release changes default prompt behavior, update the prompt source files under `standalone-scripts/prompts/` and any fallback copies before claiming the release is complete.
5. Run `node scripts/check-version-sync.mjs` — must exit 0.

Release trigger rule: the user phrase “bump version + add changelog + pin that version to root readme” (including typo variants like “abump version ...”) means RELEASE. Do all release artifacts together; never bump without changelog + root readme pin + version.json. Sequential fail-fast; no retries.
