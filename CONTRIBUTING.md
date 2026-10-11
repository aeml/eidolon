# Contributing to Eidolon

Eidolon is open alpha. Preserve existing accounts, story/instance IDs, inventories,
Gold/EP ownership and the server's authority. A working asset export or green
unit test is not final art, gameplay, capacity or release approval. Changes ship
through the [versioned roadmap](docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md)
with cumulative notes and exact frontend/backend deployment checks.

## Before editing

Fetch and reconcile current `master`; do not overwrite another contributor's
work or use a force push. Use a clean branch/worktree for your own changes.
Merge completed, validated work into `master` before declaring it done. Keep
unfinished experiments isolated until reviewed and selected.
Install the pinned dependencies with Node24 and `npm ci`. Do not copy production
`.env`, credentials, player exports or logs into fixtures, commits or screenshots.
Blender source files use Git LFS; fetch the relevant sources before editing.

## Content sources and checks

Edit canonical inputs, not generated client projections. Keep IDs and object
positions stable for text-only changes. Titles/dialogue are display text; they
must not become account identifiers, item ownership, quest eligibility or save
keys. Keep text separate from layout and use the existing text-only rendering
paths. Do not introduce a localization framework just to edit English copy;
translation support still needs its own actual coverage.

| Content | Canonical input | Existing projection/check |
| --- | --- | --- |
| Elemental investigations | [story text](docs/plans/2026-09-07-investigation-story-content.md) and [sites](src/data/chronicleInvestigationSites.json) | `node scripts/generate-chronicle-investigations.mjs --check` |
| Preparation hunts | [chronicle-hunts.json](server/internal/game/content/chronicle-hunts.json) | `node scripts/generate-chronicle-hunts.mjs --check` |
| Dark Realm chapters | [dark-realm-chronicle.json](server/internal/game/content/dark-realm-chronicle.json) | `node scripts/generate-dark-realm-chronicle.mjs --check` |
| Essential locations | [world-locations.json](server/internal/game/content/world-locations.json) | `node scripts/generate-world-locations.mjs --check` |
| Region geography | [world-geography.json](server/internal/game/content/world-geography.json) | `node scripts/generate-world-geography.mjs --check` |
| Scenery/optional readings | [worldPopulation.js](src/data/worldPopulation.js), [elementalPopulation.js](src/data/elementalPopulation.js) and their actual builders | `node scripts/generate-world-population.mjs --check` verifies shared spawn exclusions/reading anchors; it does not prove navigation or scenery quality |
| Wearable assets | [delivery manifest](assets/equipment/authored/manifest.json), class runtime manifests, motion profiles and grips | `node scripts/generate-authored-equipment.mjs --check` |
| Cosmetics | [vendor catalog](server/internal/game/content/cosmetics.json) and [earned catalog](server/internal/game/content/season-cosmetics.json) | Existing `generate-cosmetics.mjs` writes the projection; run it deliberately, review its diff and use `AuthoredAssetCatalog.test.js`/`CosmeticVendor.test.js` |

For generators supporting `--check`, omission of the flag deliberately writes
their projection. Review generated changes with the source change. Asset check
mode never repairs stale output or rewrites delivered GLBs; malformed hashes,
paths, coverage, tiers, grips and weapon-profile declarations fail. Preserved
`gameIntegration: false` in the export manifest describes the delivery stage,
not today's runtime integration.

Public event scheduling lives in [public_events.go](server/internal/game/public_events.go).
Earned season appearance mapping lives in [season_cosmetics.go](server/internal/game/season_cosmetics.go)
and its catalog. Review changes with their existing authoritative tests; editing
a client label cannot schedule an event or grant a reward. No live event,
season, payment or economy change is implied by this guide.

## Actor and item art

Use the delivered four bodies, fitted items and motion banks. Follow
[the equipment binding/coverage contract](docs/art/EQUIPMENT_ASSETS.md); retain
source models, calibrated socket grips and matching skeletons. Class equipment
restrictions and dual-wield cadence are server rules, not art metadata.

Record provenance and supplied notices alongside each asset; do not assume an
asset generator or a MakeHuman notice licenses all project-specific additions.
See the [current supplied-notice inventory](docs/art/CONTENT_PROVENANCE.md).
The owner chooses the project license and approves unresolved rights. This
guide neither grants a license nor accepts an unknown asset for publication.

Validate changed GLBs with the existing asset-delivery tools, regenerate their
recorded hashes/projection deliberately, and inspect actual fitted motion.
Run only affected catalog/fit/native checks; do not rebuild all252 models or
replay the whole campaign for a material, copy or generator-only change.
Equipment must stay recognizable at gameplay zoom, not just in a close-up.

## Verify and hand off

Start with focused Jest/Go checks for the changed behavior and scoped lint. For
copy/UI changes, inspect the affected desktop/touch layouts. For shader/art
changes, compare actual populated High/Low views with the HUD/equipment and
preserve the original performance/collision/resource requirements. Use only
explicitly disposable local accounts/databases for reward/recovery tests.

Keep patch notes, login/package/server version and release identity synchronized
when preparing an actual milestone. Fetch/reconcile again before publishing.
Existing CI gates remain mandatory; a push is not a successful deployment.
Preserve failures/skips and verify the exact public frontend,
backend readiness and affected behavior before claiming the release live.
