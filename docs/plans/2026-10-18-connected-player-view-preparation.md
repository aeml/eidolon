# Connected player view preparation — isolated CPU qualification

The existing first-view warmup runs before connecting to the server. Saved
player equipment and nearby actors arrive afterward, leaving their initial
rendering work on the player's first interaction. The retained assembled671
Fighter route records1502ms against its unchanged1500ms input-to-authoritative-
landing limit. The separate current-source profile attributes most inclusive
CPU time to world rendering; it does not prove a specific cause of that delay.

This component preserves the early static-world warmup and adds preparation
after joining. Entry waits for an applied local full snapshot from the current
instance, the attached local model and its current fitted-equipment promise,
then uses the existing two-real-render-frame preparation. A replaced model or
outfit must prepare its own generation. Optional scenery, remote assets and
geometry-worker jobs remain deferred; supported model fallbacks can still enter.

The wait has an independent30second deadline and releases its frame/timer owner
on cancellation, destruction, replacement or failure. A live interrupted entry
uses the existing startup error path instead of silently reporting Ready.
Loading-time keyboard, pointer, joystick, taps, phone aiming and direct ability
inputs cannot issue actions. Held loading-time keys require release before they
can resume; controls clear stale gestures before they become available.

CPU qualification covers365distinct checks in20suites, using the latest
scoped report for each suite. These are multiple bounded executions, not one
fabricated full-suite run. They include cancellation without browser frames,
current/stale promise outcomes, detached/replaced models, renderer failure,
authority/equipment ordering, input focus, normal touch and keyboard behavior,
respawn/jump authority and direct ability/aim inputs. All13changed JavaScript
files pass lint; the final startup error-path adjustment additionally passes
30checks/two suites and its changed-file lint. An unchanged original InputManager
contrast fails six actual synthetic event/action assertions plus one missing-API
assertion. These contrasts are not native mouse/device or live-server proof.

Private frozen reports and the selected case inventory are under
`.qa-connected-entry/` in the owned connected-entry worktree. The original
failed six-case attempt and both renderer diagnostics remain in their separate
owned worktrees. Original user checkout changes are untouched.

The component is not yet native-qualified, merged, pushed or deployed. The full
73case assembled qualification remains required: six original gameplay/save
cases plus67preview/UI cases, with zero retries and all original limits. No
1500ms limit, content population, art requirement, world performance budget,
owner decision or readiness gate is relaxed. Alpha1.79.82remains the accepted
public milestone. The complete goal, final art/performance, beta and release
readiness remain open; soak/stress testing remains deferred.
