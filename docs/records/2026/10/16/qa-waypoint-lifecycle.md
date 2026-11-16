# QA waypoint lifecycle and post-route preparation

Native qualification **passes**. This is a QA lifecycle/preparation correction,
not a performance correction. Publication remains part of the next coherent
milestone; the currently accepted public runtime is Alpha 1.79.65.

An owned Water-route CPU-attribution attempt completed normal movement alive:
123.055 seconds, 1,172 frames and 155 grounded, equipped observations. The
subsequent party setup encountered a dead leader and stopped before phase or CPU
profiling. The exact lethal damage cause is not established. No performance
result was obtained, and the earlier 33.3/49.9 ms post-route frame failure
against retained 20/33.4 ms High targets remains open.

Source review found a separate deterministic defect: `MovePlayerToQAWaypoint`
could accept a dead or zero-health character, move it and change its state to
`IDLE` without restoring health. The candidate rejects those characters before
any mutation; ordinary resurrection remains the required recovery path.

Nine counter-cases expose the old behavior across combat, encounter and Verdant
waypoints, including inconsistent positive-health/dead and zero-health/idle
states. Focused race tests verify unchanged rejected position, targets, health,
state, movement locks and protection. A healthy-character case preserves health,
level, Gold and EP. Existing QA command race tests pass. The first new test
incorrectly assumed `AddEntity` retained a raw height; that fixture failure is
retained alongside the correction to snapshot the normalized starting state.

The browser fixture now requests its existing bounded encounter preparation
immediately after ordinary travel, before leaving the leader idle while three
socket peers log in and join. It records real health/state at route completion,
preparation and party join. The normal route still uses ordinary ground input
without route teleportation or protection. No new healing, revival, progression
grant, performance allowance or test deadline is introduced.

The deferred, manual-only soak workflow also uses the repository's Go 1.27.2
toolchain. Its schedule remains disabled; no soak or stress run was started.

Private evidence root:
`/home/aeml/.local/share/eidolon-frame-attribution65-20261016/.qa-frame-attribution65`.
The first failed attempt has a verified 1,200-file closed inventory,
`first-evidence-inventory.json`, SHA-256
`a00abb0872a75baf00b062f7c7e09ba1b8f7ae179ceee4c1ff1f84f58f6e8166`.
Four synthetic accounts were sanitized in logs and embedded report records;
image pixels are not claimed redacted. Owned database/server ports retired.

The changed native scenario passes once without retries, alongside the complete
Go race/save fixture. Normal Water travel takes 118.682 seconds with 1,046 frames
and 155 observations. The leader retains 1,095 health and all fourteen equipped
slots at route completion, preparation and four-member party join. One browser
case passes; the alternative four-renderer case is skipped. Owned database and
server ports retire. This run starts after release CI's GPU work completes.

The ordinary 180-frame sample reports 16.7/33.3 ms frame median/p95 and
18.2/24.1 ms CPU-loop median/p95, with 117 stable entities and no preview frames.
This fresh sample changes preparation and natural population; it does not erase
the original failure or establish a paired speedup, cold/device or whole-world
acceptance. A separate instrumented sample attributes 19.8/27.1 ms median/p95 to
world rendering and 2.3/4.7 ms to updates. These are synchronous CPU clocks,
including instrumentation overhead, not GPU timings. Wrappers restore correctly.

Three-second CPU attribution identifies scene projection/traversal, matrix work,
shader-program selection and shadow submission. No optimization is selected
from that attribution alone. The changed attempt's 1,079-file closed inventory,
`protected-evidence-inventory.json`, has SHA-256
`48b4034d8f1985f6fe3f4c14e1abb6fb63bece467f69c1d666ef961631b16743`.
Both inventories preserve their original files; mutable continuation is excluded.
Four synthetic accounts are sanitized in the changed run's logs/reports as well.
