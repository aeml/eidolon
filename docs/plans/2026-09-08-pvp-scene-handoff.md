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
