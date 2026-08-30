# Movement Smoothness Architecture and QA

Last refreshed: August 29, 2026

Status: implemented, unit-tested, locally hardware-browser tested, multiplayer tested, and live production tested at code SHA `2d8dc3a16a6ef7d5eef68f46b420ba94b423a1e4` in GitHub Actions run `29766780968`.

## Data flow and ownership

```text
real mouse/keyboard input
  → InputManager screen ray / ground intersection
  → Actor target + fixed 60 Hz local simulation
  → ordered 30 Hz changed-transform commands
  → Go server validation, dungeon clamp, sequence acknowledgement
  → 30 Hz timestamped full/delta snapshots
  → local acknowledgement/reconciliation or remote transform timeline
  → fixed-transform render interpolation
  → rendered actor + camera + attached Spirit Guardians
```

| Value | Owner | Presentation rule |
|---|---|---|
| Pointer and held-button state | `InputManager` | Real DOM/canvas events only |
| Local destination, velocity, arrival, facing, locomotion state | `Actor` | Fixed 60 Hz planar simulation; height does not affect arrival |
| Local logical transform | `Entity.position` / `Entity.rotation` | Collision and network code never read the interpolated mesh transform |
| Prior fixed transform | `Entity.previousPosition` / `previousRotation` | Captured immediately before each entity fixed update |
| Visible transform | `Entity.render()` | Interpolates previous/current fixed transforms using accumulator alpha |
| Camera target | `GameEngine.render()` | Follows the visible player X/Z every display frame; logical Y prevents jump-camera bob |
| Attached Spirit Guardians transform | `Actor.syncPresentationTransform()` | Follows the final visible source mesh after correction/jump presentation |
| Movement ordering | Client `sequence`, server `LastMoveSequence` | Server rejects stale positive sequences and snapshots acknowledge the newest accepted value |
| Local reconciliation | `GameEngine.getLocalPositionCorrectionReason()` | Accepted predictions are retired without pulling the current path backward; real clamps and discontinuities correct |
| Remote transform history | `RemoteTransformBuffer` | Timestamped interpolation with a bounded delay, extrapolation window, and sample count |

There is intentionally no position lerp in `NetworkManager`. It decodes the server timestamp and queues state. Simulation owns logical transforms; render interpolation owns visible fixed-step continuity; local correction visuals are reserved for genuine server adjustments; and the camera follows the final visible result.

## Timing, units, and bounds

- World movement and arrival use world units on the X/Z plane.
- Local simulation is fixed at 60 Hz. Rendering uses `accumulator / fixedTimeStep` in `[0, 1]`.
- The effective local arrival radius is `0.1` units. Destinations within `0.025` units of an active target are equivalent and do not replace or restart it.
- Changed local transforms are sent at no more than 30 Hz. State edges send immediately; stationary clients send one heartbeat per second instead of the former continuous idle stream.
- A server result more than `0.04` units from the exact acknowledged prediction is a real adjustment. A greater-than-3-unit unacknowledged difference remains an authoritative discontinuity. Repeated snapshots carrying the same acknowledgement and server position are duplicate observations, not new discontinuities.
- Local prediction history is capped at 180 samples.
- Remote playback uses a 100 ms interpolation delay, at most 80 ms of extrapolation while the server state is `MOVING`, a 10-unit teleport reset, and at most 32 samples.
- Exponential fallback smoothing uses `1 - exp(-rate * dt)`, so equal elapsed time has the same response at 30, 60, and 120 simulation steps.

## Root causes and before/after evidence

The close-destination symptom had four independent contributors:

1. A held destination inside the 0.1 arrival radius was accepted every fixed tick, changing `IDLE → MOVING → IDLE` repeatedly.
2. `Entity.render(alpha)` ignored `alpha`, exposing 60 Hz logical steps directly at higher display refresh rates.
3. Remote players lerped toward the newest arrival at a frame-dependent rate without authoritative timing.
4. Dynamic collision could move an actor forward and then push it backward using a render transform, creating a feedback loop near actors and obstacles.

The old client also emitted movement every third fixed frame—about 20 packets per second—even while idle, and it had no command identity with which to distinguish an accepted older prediction from a genuine correction.

The August 2026 high-speed report exposed two additional failure modes. A repeated snapshot with an acknowledgement equal to the last processed sequence no longer had a prediction-history entry; once a fast local actor was more than three units ahead, that duplicate could be misclassified as an authoritative discontinuity, snap the actor backward, and clear its destination. Duplicate acknowledgement snapshots are now ignored only when both their sequence and server position match the last processed acknowledgement, so real server-owned movement with an unchanged client sequence still corrects normally. Separately, the main frame loop logged a transient update error but did not schedule another animation frame, allowing one bad entity/effect tick to make the entire scene appear permanently frozen. The frame pump now reschedules in `finally` and discards failed catch-up time.

The regression bounds now prove:

- A held exact-current click is accepted zero times, produces zero locomotion animation transitions, and remains `IDLE`.
- A sub-arrival click moves less than 0.1 units and does not create a path.
- A valid nearby move arrives exactly once without more than 0.02 units of logical or rendered reverse progress.
- An 8-unit real-input move travels more than 6 units during the sample, has no more than 0.02 units of reverse progress, keeps each visible frame step below 1 unit, keeps camera-to-mesh error below 0.05 units, and uses no correction frame.
- The same server-backed move produces zero new server adjustments and zero hard corrections, converges to within two pending acknowledgements, and transitions locomotion at most three times.
- The same real-input trajectory passes after an authoritative waypoint outside the east town gate, with zero correction frames, server adjustments, or hard corrections.
- A deterministic 28.8-unit/second regression keeps a prediction 4.8 units ahead of a repeated acknowledgement without clearing or correcting the path, while an actual changed server position with the same sequence remains authoritative.
- A transient fixed-update exception schedules the next display frame instead of terminating the world loop.
- Stationary transport emits no more than two packets during a 1.25-second browser sample.
- A real second Chrome process observes more than four unique rendered remote positions, more than two new authoritative samples in the same bounded transform buffer, active timestamp interpolation/extrapolation, less than 3 units per rendered step, and less than 0.75 units of render-interpolation error after excluding the intentional visual de-stacking offset.

The focused hardware runs used system Google Chrome with:

```text
WebGL vendor: Google Inc. (AMD)
WebGL renderer: ANGLE (AMD, Vulkan 1.4.318 (AMD Radeon Graphics (RADV RENOIR)), radv)
```

## Regression gates

Deterministic Jest coverage lives in `tests/MovementSmoothing.test.js` and `tests/GameEngineMovementSmoothness.test.js`. It covers planar distance, frame-rate-independent response, angular wrap, exact/near/equivalent targets, monotonic arrival, collision contact, root recovery, render interpolation, jittered and reordered remote samples, stale rejection, teleport reset, extrapolation, command cadence, acknowledgement, resume-counter rebasing, real clamps, and bounded history.

Go coverage in `server/internal/game/movement_sequence_test.go` and `server/movement_protocol_test.go` proves ordered acceptance, stale rejection, dungeon-clamp acknowledgement, and protobuf replication.

The real-input browser route is:

```bash
sg render -c 'EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome EIDOLON_ISOLATED_QA_ROUTE=movement npm run test:e2e:isolated'
```

`tests/e2e/movement-smoothness.spec.js` uses `page.evaluate()` only for read-only transform/metric sampling and Three.js projection; every movement command comes from the real mouse. The default isolated route includes it before the four-class and two-process matrices. `tests/e2e/multiplayer.spec.js` samples the remote visible trajectory and transform-buffer counters while preserving its existing party, Spirit Guardians, jump, attack, ability, and convergence checks. The postdeploy workflow runs the movement route against the dedicated persistent production character.

The matching live frontend and backend both reported `2d8dc3a16a6ef7d5eef68f46b420ba94b423a1e4`; backend readiness reported `status: ok` and `database: ready`. The live hardware-Chrome route passed exact-current/sub-arrival/short/sustained local movement and the persistent two-character remote movement matrix without a Playwright retry. The durable release table and workflow link are in `docs/plans/live-browser-qa-checklist.md`.

## Discontinuities and remaining limits

Jump, teleport, respawn, portal/dungeon transition, and large remote relocation deliberately bypass ordinary interpolation or reset incompatible history. Jump presentation retains its authoritative arc and does not feed vertical height into planar arrival.

The Go server currently receives absolute client transforms. It rejects greater-than-100-unit discontinuities, movement locks, movement during authoritative jump, stale sequences, and points outside dungeon walkable geometry, but it does not yet integrate a directional input stream or enforce a complete per-tick overworld speed/collision simulation. This is an existing authority/anti-cheat limitation and should be addressed as a separate protocol change with load, dungeon, combat, and migration testing—not disguised as visual smoothing.

The automated browser route establishes trajectory and state bounds rather than pixel-perfect foot locking. Source GLB gait differences can still limit exact foot contact. Extreme loss profiles are deterministic at the transform-buffer layer; the release route validates real normal-network WebSockets and two browser processes, while a future network proxy/transport fault harness would be needed for credible WebSocket loss shaping in Chrome.
