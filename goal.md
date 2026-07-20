# Eidolon Buttery-Smooth Movement and Locomotion Goal

Eliminate player movement rubber-banding, micro-snaps, oscillation, stutter, foot sliding, and unstable locomotion transitions throughout Eidolon. The confirmed symptom is that short click-to-move commands—especially clicks at, or very near, the character’s current location—can feel rubber-bandy. Treat that as the first reproducible defect, not the boundary of the work.

Work autonomously through discovery, instrumentation, reproduction, root-cause analysis, implementation, automated regression coverage, hardware-browser inspection, multiplayer verification, production release, and live testing with dedicated real characters. Do not stop after hiding the symptom with a larger visual lerp, increasing the arrival radius, disabling reconciliation, or making one local test pass.

The desired outcome is responsive, continuous, and authoritative movement. Local input should feel immediate; the rendered character, camera, animation, and server state should converge without visible corrections; remote players should move naturally despite uneven snapshot timing; and arrival at both tiny and long-distance destinations should settle exactly once. Movement and animation must remain correct through combat, casting, jumps, forced movement, latency, frame-rate variation, reconnects, and terrain changes.

## Operating requirements

- Begin by reading the current documentation, movement/input code, camera and pointer projection, character controller, pathing, client prediction, command transport, server movement validation and simulation, snapshot/state replication, reconciliation, remote interpolation, animation state machine, and existing unit/browser tests.
- Reproduce and measure the defect before changing behavior. Record what the client predicted, what the server accepted, what snapshots returned, which corrections were applied, and which animation transitions occurred.
- Preserve server authority, collision rules, speed limits, anti-cheat validation, combat behavior, and normal player data.
- Preserve unrelated user changes and keep commits focused and reviewable.
- Prefer a root-cause fix with explicit invariants over scattered tolerances or filters.
- Use the production release discipline already established in this repository: complete local validation, commit and push to `master`, monitor deployment, confirm matching frontend/backend SHAs, and test the deployed game in real hardware-accelerated Chrome with dedicated persistent QA characters.
- Fix forward when a deployed regression is attributable to this work. Do not leave production on a knowingly broken movement release.
- Do not claim smoothness based only on mocked vectors, code inspection, or a green unit suite. Observe and measure the rendered result through real browser input.

## 1. Map the complete movement pipeline

Create or update durable movement architecture and QA documentation, preferably `docs/MOVEMENT_SMOOTHNESS.md`, with a concise data-flow map covering:

1. Mouse/keyboard input and canvas focus.
2. Screen-to-world raycasting and terrain/collision destination selection.
3. Local movement intent, path/replan state, and sequence/timestamp identity.
4. Client-side prediction and rendered transform ownership.
5. Outbound movement command cadence, coalescing, ordering, and cancellation.
6. Server validation, movement integration, arrival rules, collision, and snapshot cadence.
7. Authoritative state receipt, stale/out-of-order rejection, acknowledgement, and reconciliation.
8. Local render smoothing and camera following.
9. Remote-player interpolation/extrapolation and buffer management.
10. Locomotion animation selection, blending, playback speed, facing, and restoration after higher-priority actions.

Identify every location that can write player position, velocity, facing, destination, movement state, camera target, or locomotion animation. Document which layer owns each value and why. Remove accidental competing writers or ambiguous ownership where they cause instability.

Document the coordinate systems, units, time bases, precision/rounding behavior, tick rates, snapshot rates, and thresholds currently used. Verify that client and server arrival, stopping, collision, and speed semantics agree rather than assuming similarly named constants are equivalent.

## 2. Build deterministic reproduction and telemetry

Add development/QA-only observability that can capture a bounded movement trace without exposing credentials or normal-player data. Each trace should make it possible to correlate:

- Input time and exact requested world destination.
- Distance from the current predicted and authoritative position when the command was issued.
- Movement command ID/sequence, send time, and acknowledgement or supersession.
- Client predicted position, rendered position, velocity, facing, and active path/destination.
- Server-authoritative position, velocity/state, accepted destination, and snapshot time/sequence.
- Reconciliation error before and after correction, correction mode, and correction duration.
- Remote interpolation-buffer depth, selected samples, extrapolation duration, and late/out-of-order snapshots.
- Locomotion state, animation action, blend transition, normalized playback speed, and restart count.
- Frame time, fixed-step accumulator where applicable, and camera-target position.

Instrumentation must be bounded, disabled by default, harmless in production, and cheap when inactive. Do not log credentials, tokens, chat, account details, or unrelated gameplay payloads.

Create deterministic repro coverage for at least:

- Clicking exactly on the character/current destination.
- Clicking inside the current arrival/stopping radius.
- Repeated tiny moves in several directions.
- Rapid alternation between two nearby points.
- Reclicking the same destination before and after arrival.
- Short, medium, and long clicks on flat terrain.
- Short moves on slopes, terrain seams, collision edges, and near obstacles.
- A click whose raycast resolves slightly differently between frames.
- Replanning while already moving, reversing direction, and stopping mid-path.
- Holding/releasing each supported keyboard movement input, including opposite-key transitions if keyboard movement exists.
- Movement immediately before, during, and after attack, cast, channel, jump, dash/charge, knockback, stun/root, death, respawn, teleport, dungeon transition, reconnect, and character replacement.
- 30, 60, 120, and uncapped/render-variable frame-rate conditions.
- Stable low latency, uneven latency/jitter, packet delay, packet loss, duplicated packets, and reordered/stale snapshots using a deterministic test harness.

Produce a baseline report before the substantive fix. Measure correction magnitude, hard-snap count, arrival oscillation, destination churn, movement-command churn, animation restart count, and remote interpolation underruns. Use the baseline to set justified regression bounds; do not invent arbitrary numbers solely to make tests green.

## 3. Fix nearby-destination and arrival behavior

Resolve the confirmed close-movement defect at its source. The completed behavior must satisfy these invariants:

- A click at the current effective location is an idempotent no-op or a clean stop, never a move-stop-move loop.
- A destination within the shared arrival tolerance cannot cause alternating client/server interpretations of “moving” and “arrived.”
- Tiny valid moves happen once in the requested direction and settle once without overshoot, backwards correction, oscillation, or animation thrashing.
- Repeated identical or effectively equivalent destinations do not restart a path, animation, or network command unnecessarily.
- Floating-point noise, terrain-height sampling, coordinate quantization, and packet serialization cannot keep a nearly arrived character alive in a correction loop.
- The client does not keep predicting a destination the server rejected, clamped, replaced, or already acknowledged as complete.
- Superseded movement commands and late snapshots cannot resurrect an older nearby destination.
- Arrival clears or preserves facing deliberately and consistently rather than flipping toward numerical noise.
- Stopping remains responsive and does not introduce a perceptible input lag or excessive dead zone.

Centralize shared semantics or derive them from one authoritative definition where practical. If client prediction requires a deliberately different threshold, document the relationship and prove that its hysteresis cannot create a disagreement loop.

## 4. Repair prediction and reconciliation

Audit the local controlled-player reconciliation algorithm end to end.

- Track enough command/snapshot identity to reject stale authoritative state and reconcile only against the correct prediction history.
- Acknowledge and retire processed inputs/destinations deterministically; keep history and queues bounded.
- Distinguish ordinary prediction error from teleport, respawn, portal, server correction, collision rejection, and other discontinuities.
- Apply a deadband only where measured sub-visual error is truly harmless and cannot accumulate.
- Smooth ordinary corrections over an evidence-based interval without creating a second lagging transform that fights input or the camera.
- Reserve hard snaps for explicit discontinuities or error large enough that smoothing would be dishonest or unsafe.
- Make smoothing frame-rate independent. Clamp interpolation/extrapolation factors and handle long frames, background-tab recovery, clock skew, and zero/negative deltas safely.
- Avoid overshoot, spring ringing, correction direction reversal, NaNs, unbounded catch-up speed, and permanent residual drift.
- Ensure new input composes correctly with a correction already in progress instead of restarting or reversing it.
- Preserve collision and movement-speed authority. Never conceal a genuine invalid move indefinitely.
- Keep the rendered transform, authoritative simulation transform, camera target, selection ring, attached VFX, nameplate, and audio source coherent during correction.

Use one coherent model for position ownership and correction. Do not stack independent lerps in the network layer, entity update, mesh update, and camera follow unless their roles and combined response are explicitly designed and tested.

## 5. Make remote movement smooth and truthful

Audit snapshot production and remote-player presentation separately from local prediction.

- Interpolate using authoritative timestamps/sequences and an intentional render delay rather than raw packet arrival time.
- Keep the interpolation buffer bounded, ordered, and robust to jitter, duplicates, gaps, and stale/out-of-order packets.
- Adapt or recover cleanly when network cadence changes, without permanently increasing latency.
- Use bounded extrapolation only when justified; converge smoothly when the next snapshot arrives.
- Teleports, respawns, portals, dungeon transitions, reconnects, and large authoritative discontinuities must snap intentionally and clear incompatible history.
- Remote actors must not freeze briefly at every snapshot, zig-zag between samples, overshoot corners, cut through obstacles, or slowly trail indefinitely.
- Facing and animation should derive from meaningful motion/intent, not frame-to-frame positional noise.
- A joining or reconnecting observer must reconstruct the current location/state once without replaying old movement.

Verify convergence using two real browser contexts and, where the production QA accounts permit it, two dedicated live characters observing one another.

## 6. Make locomotion animations buttery smooth

Movement is not complete if the transform is smooth but the character looks unstable. Audit the shared actor state machine and all four player models for:

- Idle → walk/run and walk/run → idle crossfades.
- Walk ↔ run threshold hysteresis and playback-speed scaling.
- Short moves that should not flash a full run cycle or restart the same action repeatedly.
- Start, stop, rapid reversal, strafing/diagonal movement where supported, and sharp facing changes.
- Foot sliding caused by mismatched visual playback speed and actual planar velocity.
- Moonwalking or stale facing during client correction.
- Animation restart spam caused by repeated snapshots or equivalent state assignments.
- Run → attack/cast → run restoration; move → jump → land → move; dash/charge/knockback → locomotion; stun/root/death priority; respawn restoration.
- Local and remote actors selecting equivalent locomotion states for equivalent motion.
- Low-speed numerical drift that keeps a walk animation active while visually stationary.
- Camera-relative or terrain-slope artifacts that make velocity classification unstable.

Use stable state transitions, evidence-based hysteresis, and clean crossfades. Preserve higher-priority combat, jump, forced-movement, and death animations. Do not continuously retime or restart an action for imperceptible velocity changes. Where source clips limit perfect foot locking, implement the safest available playback/blend behavior and document the exact asset limitation honestly.

## 7. Smooth camera and attached presentation

Verify that apparent rubber-banding is not introduced or amplified by presentation layers.

- The camera should follow the intended rendered/predicted target without independently oscillating against reconciliation.
- Camera smoothing must be frame-rate independent, bounded, and reset correctly on teleports, respawns, dungeon transitions, reconnects, and character replacement.
- Selection indicators, health bars, nameplates, shadows, sounds, projectiles, persistent effects such as Spirit Guardians, and other attached nodes must follow the same visible character trajectory without one-frame lag or separate snapping.
- Terrain height correction must not introduce vertical buzz on slopes or feed vertical noise into planar arrival and locomotion decisions.
- Pointer/raycast destination markers must remain stable and should accurately communicate clamped, rejected, or already-arrived destinations.

Inspect the rendered canvas and recorded traces together so camera jitter is not mistaken for actor correction, or vice versa.

## 8. Preserve gameplay correctness and security

- The server remains authoritative for position, speed, collision, teleports, crowd control, and zone transitions.
- Do not increase allowed speed, trust arbitrary client coordinates, bypass collision, weaken anti-cheat checks, or accept stale movement to improve apparent smoothness.
- Movement commands and prediction history must remain bounded against spam or malicious input.
- Rapid nearby clicks must not create unbounded server work, packet floods, path queues, timers, allocations, or animation actions.
- Movement during attack/cast/channel/root/stun/death must obey existing gameplay rules.
- Do not change balance, damage, cooldowns, mana, or crowd-control durations except when necessary to correct a proven synchronization defect; document and test any such change.
- QA hooks must be authenticated, allowlisted, narrowly scoped, and incapable of granting normal users production authority.

## 9. Add layered regression coverage

Add focused unit and integration tests for every corrected invariant, including:

- Near-zero input and equivalent-destination deduplication.
- Shared arrival/stopping semantics and hysteresis.
- Command sequencing, acknowledgement, supersession, and bounded history.
- Stale/out-of-order snapshot rejection.
- Correction deadband, smooth correction, hard discontinuity, interruption by new input, and convergence.
- Frame-rate-independent integration and smoothing.
- Long-frame/background recovery and non-finite input protection.
- Terrain-height noise and planar-vs-vertical distance handling.
- Remote interpolation, jitter, gaps, extrapolation bounds, and buffer reset.
- Teleport/respawn/portal/dungeon/reconnect history reset.
- Idle/walk/run selection, hysteresis, crossfade, playback speed, and no restart spam.
- Higher-priority animation interruption and correct locomotion restoration.
- Camera and attached-effect coherence.
- Packet/queue/action/resource bounds during rapid tiny inputs and a movement soak.

Tests should verify trajectories and invariants, not merely final positions. Assert that nearby movement settles, correction magnitude decreases monotonically where designed, velocity/camera continuity stays bounded, state transitions do not oscillate, and no old command reactivates after acknowledgement.

## 10. Build real-browser movement QA

Create or extend Playwright coverage using `/usr/bin/google-chrome` and require a hardware WebGL renderer. Fail if Chrome uses SwiftShader or another software renderer.

Browser testing must exercise normal production pathways:

- Use real mouse and keyboard input against the rendered canvas and visible UI.
- Use the production pointer projection, movement commands, WebSocket transport, server simulation, snapshots, entity update, animation mixer, and camera.
- Do not directly set character transforms, invoke movement methods, inject snapshots, or select animation actions through `page.evaluate()`.
- Read-only instrumentation, bounded trace extraction, and Three.js projection used to position a real mouse click are acceptable.
- Test real server-backed characters in the isolated predeploy environment and dedicated persistent QA characters after deployment.
- Capture sanitized screenshots/video/traces on failure and inspect them. Do not store credentials in artifacts.

The deterministic browser matrix must include:

- Exact-current-position, inside-arrival-radius, tiny, repeated, alternating, short, medium, and long click-to-move cases.
- Flat terrain, slopes, terrain seams, obstacles/collision edges, overworld, and representative dungeon conditions.
- Start, stop, replan, reverse, rapid clicking, and a bounded sustained-movement soak.
- Supported keyboard movement paths and transitions.
- Walk, run, idle, jump/land, attack/cast while moving, dash/charge/teleport, crowd control, death/respawn, dungeon transition, reconnect, and character replacement.
- Fighter, Rogue, Wizard, and Cleric with their real model/animation differences.
- Attached persistent VFX, explicitly including Spirit Guardians while the Cleric moves and reconciles.
- Two-browser remote movement under normal conditions and deterministic latency/jitter/loss/reordering profiles in the isolated environment.
- At least 30, 60, and 120 FPS emulation or deterministic render-step coverage where browser throttling makes that credible.
- Low and High graphics settings where presentation behavior differs.

The browser gate should produce summarized movement metrics without credentials: maximum/percentile ordinary correction, hard-snap count by legitimate reason, arrival oscillation count, animation restart count, remote buffer underruns, and trace assertion failures. Thresholds must be justified from baseline data and tightened enough to catch the original defect without becoming GPU-pixel brittle.

## 11. Performance and soak guardrails

- Measure movement command rate, snapshot rate, queue/history lengths, animation action count, scene/resource count, allocations where practical, and browser frame behavior.
- Rapid nearby clicks must be coalesced or handled without flooding the server while preserving responsive legitimate replanning.
- No movement or reconciliation path may leak timers, listeners, promises, traces, scene nodes, animation actions, or prediction records.
- Run a bounded local/remote movement soak long enough to cross many arrival and reconciliation cycles.
- Investigate material regressions in frame time, input latency, bandwidth, CPU, or memory introduced by smoothing.
- Do not trade responsiveness for a visually smooth but sluggish feel. Record both input-to-visible-motion latency and convergence behavior.

## 12. Documentation, release, and production proof

Update `docs/MOVEMENT_SMOOTHNESS.md`, relevant architecture/testing documentation, and the live browser QA checklist with evidence-based claims. Clearly distinguish:

- Reproduced and measured.
- Implemented.
- Unit/integration tested.
- Locally hardware-browser tested.
- Multiplayer tested.
- Live production tested.
- Still limited by source assets, network conditions, or other explicit constraints.

Before pushing:

- Perform a fresh dependency install and dependency audit.
- Run the complete client suite and lint.
- Run the complete Go suite, race detector, and server build.
- Validate workflow syntax and QA safety tests.
- Run the isolated hardware-browser movement matrix, all four classes, deterministic network profiles, two-browser remote tests, and bounded soak.
- Inspect real rendered evidence and movement traces.
- Sanitize browser artifacts and verify that no credentials are present.

Then:

1. Commit the finished work in focused commits.
2. Push the verified commits directly to `master`.
3. Monitor every GitHub Actions job through completion.
4. Confirm the live frontend release identity and backend health endpoint both report the pushed full SHA and the database is ready.
5. Run the live anonymous browser smoke.
6. Run dedicated persistent Fighter, Rogue, Wizard, and Cleric characters through the nearby-movement and full locomotion matrix using real browser input.
7. Run the live two-character remote-movement matrix, including Cleric Spirit Guardians while moving.
8. Inspect rendered screenshots/video and bounded movement traces, not only pass/fail assertions.
9. Fix forward and repeat deployment/testing for any defect attributable to the work.
10. Record the final SHA, workflow run, renderer, before/after metrics, live character evidence, and honest remaining limitations.

## Production safety constraints

- Use only dedicated QA accounts/characters provided through encrypted secrets or explicitly created for QA.
- Never print credentials or include them in screenshots, videos, traces, HTML reports, command output, or committed files.
- Keep credentialed recording disabled unless a proven sanitizer runs before upload.
- Never alter or delete normal accounts, characters, inventories, builds, parties, auctions, or database records.
- Any QA-only command must be authenticated, explicitly allowlisted server-side, narrowly scoped, privilege-tested, and unavailable to ordinary accounts.
- Do not weaken TLS, browser security, deployment gates, server authority, collision validation, or credential protection to make tests easier.

## Scope discipline

- This goal includes player movement, prediction/reconciliation, server movement processing, remote interpolation, camera following, locomotion animation blending, attached-presentation coherence, instrumentation, tests, and narrowly required deployment/QA changes.
- It includes animation transitions affected by movement, but not a redesign of already validated ability VFX or unrelated combat visuals.
- It does not authorize unrelated progression, balance, economy, content, guild, PvP, art-direction, or broad monolith-refactor work.
- Refactor only where necessary to establish clear movement ownership and testable invariants.
- If production-only conditions cannot be simulated safely, add non-invasive measurement and test with dedicated accounts; never experiment destructively on normal players.

## Definition of done

- The exact-current-location and nearby-destination defect is reproduced in a deterministic regression test and fixed at its root cause.
- Tiny, repeated, alternating, short, medium, and long moves start responsively, follow a continuous path, and settle exactly once without visible rubber-banding.
- Local prediction and authoritative reconciliation converge under normal and impaired deterministic network profiles without stale-command resurrection, correction oscillation, or unjustified hard snaps.
- Remote-player interpolation is smooth, bounded, and truthful under uneven snapshot arrival, and resets correctly for real discontinuities.
- Idle, walk, run, facing, stop, jump/land, combat interruption/restoration, forced movement, death, and respawn transitions are stable and clean for all four classes locally and remotely.
- Animation actions do not restart from equivalent snapshots or numerical speed noise; playback speed and movement velocity remain visually coherent.
- Camera, terrain height, nameplates, selection rings, sounds, and attached VFX—including Spirit Guardians—remain visually attached and do not amplify corrections.
- Movement remains server-authoritative, collision-safe, speed-valid, queue-bounded, and resilient to stale, duplicated, reordered, or malicious input.
- Before/after metrics demonstrate materially reduced correction, oscillation, restart, and interpolation-underrun behavior without materially increasing input latency.
- Complete client/server/lint/audit/build/race gates pass.
- The full isolated movement, all-class, multiplayer, impaired-network, and soak matrices pass in hardware-accelerated system Chrome on the AMD GPU.
- The final commits are pushed to `master`, all deployment jobs pass, and the deployed frontend/backend report the same final SHA.
- Dedicated live QA characters complete the nearby-movement, locomotion, and two-character remote movement tests through real browser input.
- Sanitized documentation and evidence record what was measured and observed, including any genuine source-asset or extreme-network limitation.
- No known reproducible movement rubber-band, micro-snap, arrival oscillation, locomotion-animation thrash, camera correction fight, or remote interpolation stutter remains.
- The final worktree is clean and `origin/master` contains the verified production commit.
