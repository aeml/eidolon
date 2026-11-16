# Release65 movement input calibration

Production CI34679633154 at0e1068a5 failed twice at the sub-arrival movement
assertion, accepting14 movement targets where the test expected zero. Earlier
hosted client/server/browser gates and predeploy gameplay through direct-target
classes passed; movement failed and subsequent deployment/live jobs skipped.
Failure log `/tmp/eidolon-release65-production-native-34679633154.log`, sanitized
artifact `/tmp/eidolon-release65-movement-failure-365qLn`. Original failure
artifacts do not include the intended/actual ground rays, so their exact input
direction cannot be recovered.

## Reproduction evidence

5d6acdf8 adds read-only per-frame ground/pointer/camera samples and attaches
sub-arrival evidence before its assertions, preserving all movement thresholds.
Initial verification accidentally requested nonexistent `ActorMovement.test.js`;
that is not acceptance. Corrected three suites/47 tests pass1.947s, changed lint
and client preparation pass. No runtime movement code is changed.

Two scoped Chrome runs at5d6acdf8 pass: explicit max-level37068 (19.2s test,
21.2s total), then separate normal fresh-character95049 (18.4s/20.2s).
Both use native ANGLE/Vulkan/RADV RENOIR, without retries. Archives
`/tmp/eidolon-release65-movement-max-accepted-qir5zJ` and
`/tmp/eidolon-release65-movement-base-accepted-gQy5lT`, credential scans0.
Their requested screen offset640.208/360.682 becomes actual mouse640/360,
exactly the current ground point, so these passing runs do not reproduce the
failure. Both full movement routes retain near/short/sustained/outside checks.

An independent Three.js calculation at the same camera and viewport finds
six directions140..165 degrees where an intended0.05-unit target truncates to
pixel638/359, actually0.11023963796103939 units away. That exceeds the unchanged
0.1 arrival dead zone. 53320bbc adds an opt-in150-degree reproduction selector
(`EIDOLON_E2E_MOVEMENT_PIXEL_PROBE=1`) while preserving ordinary ray/clearance
checks and every assertion. Native20272 fails the same zero-accepted assertion:
25 accepted targets,2.75599 units moved. Its raw aimed ray confirms0.110239637961,
with the held pointer following the moving camera normally. Scan0; archive
`/tmp/eidolon-release65-movement-pixel-failure-ansCzB`. Services removed and
18185/18186/41875 independently checked free after each terminal run.

This establishes a reproducible test-input defect, not broken arrival handling.
It matches the production assertion, but the missing original ray means the
original CI direction itself is unproven. Do not erase that distinction.

## Correction and remaining verification

Project test movement targets to the nearest integer CSS pixel explicitly,
instead of letting MouseEvent truncate fractional coordinates. At the reproduced
angle the actual click is now639/360,0.0416667 units away: a nonzero genuine
sub-arrival input. Add an explicit actual-ray <0.1 assertion, plus >0.01 in the
forced reproduction. Preserve zero accepted moves, animation/no-travel checks,
short/sustained/outside movement, speed-sensitive simulation/frame budgets,
hardware renderer validation and retry policy. No game input/runtime, server,
movement thresholds or release version changes.

Four suites/55 tests pass1.467s, including the old truncation reproduction and
all72 directions at min/default/max zoom on1280x720 and1920x1080. Changed lint
and whitespace checks pass. Corrected native71511 at967015d9 passes20.7s test,
22.9s total, including the forced150-degree physical input and the entire normal
movement route. Raw input639/360 is0.0416666666666938 units away; zero accepted
moves, zero travel and unchanged Idle animation. Native renderer remains
RADV RENOIR, sustained/outside simulation budgets pass, scan0. Archive
`/tmp/eidolon-release65-movement-pixel-accepted-xsCn4d`; all temporary services
removed and18185/18186/41875 independently free. Full production CI/live identity
checks remain required before a live release claim.

Logs `/tmp/eidolon-release65-movement-{diagnostics-focused-final,ray-gameplay,ray-base-gameplay,pixel-gameplay,pixel-focused}-20260912.log`.
Read-only temporary report reader `/tmp/eidolon-read-movement-report-20260912.cjs`
extracts the embedded raw attachment and prints only relevant movement evidence.
