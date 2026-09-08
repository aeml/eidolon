# PvP needs an actual arena scene

Diagnostic14835 on542870d ended exit1: all four classes received an active duel
and own-entity delta with a PvP instance, but neither participant received any
enter_instance message; both clients remained outside PvP. Credential scan0
completed. Log `/tmp/eidolon-starter-duel-scenes.log`. The earlier cadence probe
was not merely watching the wrong property. PvPStatus updated the menu while
the world scene, local instance and collision stayed in the overworld.

Candidate in work/pvp-scenes-20260908 builds on542870d without changing release
metadata yet. Initial duel/ranked admission now sends an explicit arena scene to
each participant. Ordinary score/elimination updates do not rebuild it. Return
sends the restored authoritative departure position, guarded against a later
dungeon/arena admission. The existing initial-state path can serialize an active
arena's layout/spawn as well; disconnect still follows the existing forfeit rule,
not an invented pause or resource-recovery entitlement.

Only real active match IDs expose an arena layout/type. Each caller receives a
fresh layout. The floor includes the standard1.25 body footprint around existing
center limits +/-24 by +/-16. A code-native low-walled court uses that floor,
team circles and four elemental beacons; no town facade or dungeon room/loot
generator is used. Spawn and return positioning are explicit; other dungeon
entry defaults remain. Damage, rewards, match scoring and server boundaries are
unchanged. Geometry/collision and actual duels still require rendered verification.

50649 reproduced both missing server scene/layout regressions after correcting
a test fixture's nonexistent helper.34564 reproduced both client arena/return
failures (17pass/2fail). Candidate29154 passes21 focused client cases/1.197s and
lint.92326 focused race passes root1.484s/game14.346s. Full6505 Go passes
root1.698s/database0.006s/game61.596s. Full39044 client passes228suites/3304tests/
106.310s. These handles are terminal. Actual four-class arena/combat/forfeit/
departure-position verification and inspected screenshots remain required.

This is not yet a release, ranked/party/disconnect acceptance, physical-phone
sign-off or a broad PvP balance conclusion. Preserve the full1.1–1.10 roadmap;
release46 CI34226360903 remains ahead of this candidate.

59684 on d011b8a was interrupted with SIGINT/exit130 after a confirmed local
setup failure: the new worktree shared node_modules but its untracked vendor
runtime was absent; the served Three.js module returned404. The first two
class cases timed out without reaching the world. This is not combat evidence
or a passing route. Do not infer a screenshot-step failure from its silence.
The exact Playwright PID was verified before interrupting this invalid run;
wait/cleanup completed before preparing dependencies or changing source.

The isolated driver now checks its browser runtime before starting any containers
and gives an actionable prepare:client instruction. The probe records world/
arena milestones without account data and screenshots the actual direct-body
game canvas, excluding nested preview/minimap canvases. A prepared rerun remains
required; full runtime regression above still applies to unchanged game/server.

65494 on clean634c20c PASS4/1.5minutes, normal exit0. Fighter22.0s, Rogue22.2s,
Wizard22.2s, Cleric22.6s. Each side produced5 positive one-damage hits at measured
mean intervals1.913–1.917s versus1.90476s stats, retained mana, lost health,
forfeited normally, returned within1unit of its recorded departure and kept
ranked profile/XP/gold unchanged. Scene roots and instance types were verified.
Scan0 and independent exact-container absence passed. Both Fighter entry/combat
images were inspected and archived at `/tmp/eidolon-pvp-entry-evidence-bG4RCB/`.
The captures include game UI (element screenshots clip, not isolate DOM layers).

Inspection exposed a flat untextured floor and oversized existing combat labels.
The court now reuses Lanternhold's procedural cobbles at a consistent world scale
on its single floor, with no new stacked floor geometry or collision change.
Release47 notes describe the verified practice-duel repair, not ranked/party
sign-off. Later nameplate/action-label polish remains open (queued53 is not in
this branch). A versioned textured-court rerun/capture is required before merge.
