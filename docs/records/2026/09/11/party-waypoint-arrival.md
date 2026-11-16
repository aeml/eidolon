# Party detour arrival — native QA correction, unreleased

Four-role run93038 on51da6fb1 failed after8.6minutes, not during combat.
Archive `/tmp/eidolon-four-role-shield-failure-aZ6iAp` retains the complete log,
raw results and HTML report. All four were alive; two town recovery/resume loops
passed. Seed-5385752534429762084, generator2, Normal Verdant, no fallback.
No boss, final quest credit, manual turn-in or saved completion is implied.

The healer's visibility-graph detour requested1.092units and walked0.9742units,
ending0.1306units from its requested waypoint. It had no collision stops or
remaining movement target. The input helper required either one full unit of
movement or arrival within five units of the leader, still14.94units away.
Thus a completed intermediate waypoint incorrectly failed the whole expedition.

The formation driver now supplies the actual issued segment's endpoint as its
arrival witness, using the same quarter-unit tolerance as strict ground-point
validation. This is not final formation: the unchanged gathering loop continues
reading every character until all are within its original five-unit boundary.
No direct movement, teleport, alternate-path fallback, death suppression, relaxed
formation spacing, added gear or extra time is introduced.

Three focused suites82tests passed0.753s; ESLint passed, session39989 exit0.
Exact recorded coordinates reproduce the old one-unit/final-formation rejection
and verify the new waypoint witness. Guards cover dead/zeroHP/other-instance/
no-movement/invalid points. A separate test proves that reaching an intermediate
waypoint cannot itself complete formation. Existing concurrency/path-collision/
deadline checks remain. Log `/tmp/eidolon-party-waypoint-focused-20260911.log`.

No runtime game/server source changed. Full integration regression and the
unchanged native four-role clear remain required; this is not a dungeon pass.
