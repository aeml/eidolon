# Alpha1.24 — Fire journey review

Separate local prerequisites, excluded from1.23 commit `aa5abeea` and1.22 CI.
Do not publish out of order. No long campaign replay or balance change.

## Concrete corrections

The Fire region center (-2000,200) is the Scorched Wraith sector, not the
Magma Golem grounds required by Fuel for an Unending War. `fireQuestSearch.js`
uses the five authored `spawnFireArea` strips with their five-metre margins;
Magma75+ guidance points to-1600,200, and Cinderheart Ore collection starts in
the first Fire strip. Search areas are not guaranteed spawns or safe routes.
Actual Molten entrance and crystal-raid Guide markers remain distinct. Ready
quests still point to canonical Ilyra; no target counts/rewards/gates change.

Inspected the old normal-scale Kiln Span screenshot in
`/tmp/eidolon-elemental-session116-final/`: two smooth dark tubes, detached
outer feet and a cropped crown. New forged arch webs, edge flanges, small bolts,
cross ties and overhead support capitals replace that shape. Fire stays visually
distinct from Water's stone ribs. Crown stays below13m; original3×8×3 pier
solids remain exact and all new overhangs stay well above hero height. No extra
lights, new safe zones, scene animation loops or changed hazard footprints.

## Retained journey requirements

| Requirement | Source/evidence and boundary |
| --- | --- |
| Variety and narrative order | Hessa's kiln ledger;35 Magma Golems75+; eight Cinderheart Ore; cold ash → combat command anchor → released ember; then Infernax. Stable IDs and saved optional catch-up behavior remain unchanged. |
| Investigation prerequisites | `chronicle-investigations.json` requires cold ash before the anchor and anchor before the freed ember. Existing sparse-mask UI and command-anchor checks retain earned evidence without claiming a repeated kill. |
| Item/pickup/rewards | Dedicated cinderheart-ore procedural bag icon; all five Fire enemy families remain drop sources. Personal world loot/pickup/manual claim and saved quoted rewards unchanged. |
| Molten admission | `dungeon_progression.go` requires70 for Molten; current Chronicle objective prepends the real family requirement. The physical entrance remains-2400,200; a quest offer does not bypass admission. |
| Crystal road | Infernax's furnace-key opens the separate Crucible road. The later Ember Crown raid and Maelin's three waves restore the crystal, not the dungeon kill or collected Ore alone. |
| Hazards and scenery | Existing authoritative-radius High/Low hazard boundaries, server synchronization and foliage hazard exclusions retained. Search waypoints are explicitly not safe paths. No new ornamental fire masquerades as damage. |

Initial39 navigation/hazard/synchronization/command-anchor checks pass3.429s.
Nine final geometry/elemental population cases pass10.38s, covering finite arch
geometry, unchanged generated solids and approach/hazard clearances.

## Browser review — initial desktop failure

The bounded four-case run completed: desktop and390px atlas interactions passed
20.8s/19.2s, including actual Magma hunt selection,75+ copy and waypoint-1600,200.
Low Water/Fire rendering passed39.6s. Desktop rendering failed its existing
frame-time assertion; it is not accepted. Evidence is retained in
`/tmp/eidolon-124-fire-review/`. The timed route now includes Kiln Span.
Final High/Low Kiln Span and portrait atlas captures were inspected: crown fits,
supports are visible and the central approach remains clear.

High stopped assertions at flood-shelter p95=33.400000000001455 versus33.4ms.
This is not merely a floating-point issue: its retained profile also records
50ms p95 at unchanged communal-kiln. Changed Kiln Span had16.7ms median,
33.4ms p95,172 calls and124194 triangles. All High resource counts returned
exactly to304 geometries/41 textures/35 programs after repeat travel. Low
Kiln Span had16.7ms median,33.4ms p95,73 calls and19987 triangles; all Low
resource counts returned to283/27/21. Other Low views met their existing budgets.
Desktop-GPU portrait emulation is not an actual-phone performance certification.

A read-only host check immediately afterward found load averages52.04/49.12/
40.37 on16 logical CPUs, with existing soak/browser and unrelated service work.
Slower unchanged control landmarks suggest shared-host contention, but do not
prove the cause. No processes were stopped, thresholds changed or failure filters
added. Defer one affected desktop check until contention eases; do not repeatedly
run the same profile under the same load or claim passing performance meanwhile.

Follow-up copy review makes the lava/unsafe-waypoint warning consistent for
Magma hunts and Ore collection as well as generic Fire hunts. All three Fire
navigation tests pass again1.072s; scoped ESLint passes. This is a text-only
follow-up after the retained browser captures, not another rendered check.

## Desktop check resolved on the exact Fire candidate

After the earlier competing Chrome processes ended, one bounded recheck used
detached commitb1a3ae674993bdc3d673426338a10de647dc1db9 in
`/tmp/eidolon-fire124-performance-ao6YRQ`, separate from all Air work. The first
setup attempt stopped before rendering because a fresh checkout lacked vendor
dependencies; retained at`/tmp/eidolon-124-isolated-desktop-recheck/`. After the
normal `npm run prepare:client` step, the actual desktop check passed34.1s
(35.7s total), with no tracked changes in that worktree. Evidence:
`/tmp/eidolon-124-isolated-desktop-prepared/`. Final Kiln Span capture inspected.

On AMD RADV hardware, all six views met the unchanged budgets: Kiln Span
median16.7ms/p9533.3ms,172 calls/124194 triangles; other p95s16.7–16.8ms.
Before/after repeat resources were exactly304 geometries/41 textures/35 programs.
This resolves the desktop candidate check without deleting the earlier failed
evidence, weakening a threshold or stopping any other service. It does not prove
the initial failure's cause or guarantee performance under arbitrary contention.
Together with the retained passing Low case, the local graphics gate is met.

Human pacing/difficulty and final modern-art approval remain open. Retain the
accepted encounter receipts at their original earned/prepared scopes; do not
rerun full Molten merely to attach a new version label.
