# Eidolon Animation, Ability VFX, and Movement Quality Goal

Audit, repair, polish, and comprehensively verify every player-facing animation and visual effect in Eidolon. This includes every active ability and its variants, all core character locomotion and combat states, persistent buffs and summons, local and remote-player presentation, and the shipped enemy/boss/NPC animation states.

Spirit Guardians is a confirmed defect and a priority, but it is not the boundary of the work. Do not stop after fixing that one ability or after making unit tests pass. Work autonomously through discovery, implementation, automated coverage, real-browser visual inspection, multiplayer verification, production release, and live testing.

The desired outcome is not merely “an effect object was created.” Every animation must be visible, readable, correctly timed, correctly positioned, synchronized with authoritative gameplay, smooth through state transitions, safe across reconnects, and free of known visual or lifecycle bugs.

## Operating requirements

- Begin by reading the current documentation, active plans, class implementations, skill/talent/rune data, server ability configuration, actor animation state machine, effect systems, model-loading paths, network replication, and existing tests.
- Preserve unrelated user changes and normal player data.
- Make focused, reviewable commits and keep the worktree clean.
- Use the existing production release discipline: full local validation, push the completed work to the configured production branch (currently `master`), monitor deployment, confirm matching frontend/backend SHAs, and test the deployed game in real hardware-accelerated Chrome.
- Fix forward when a release regression is attributable to this work. Do not leave production on a knowingly broken animation release.
- Do not declare that everything works based only on code inspection, mocked Three.js objects, or an effect registry entry. Observe the real rendered result.

## 1. Build a canonical animation and ability-visual inventory

Create a durable coverage matrix, preferably `docs/ANIMATION_COVERAGE.md` plus a machine-readable source of truth where appropriate.

Derive the inventory from all relevant sources rather than manually trusting one file:

- `server/internal/game/ability_config.go` and all server ability handlers.
- `src/entities/Fighter.js`, `Rogue.js`, `Wizard.js`, and `Cleric.js`.
- Skill tree, specialization, talent, rune, equipment-granted, transformed, summon, and alias data.
- `src/skills/skillVisuals.js`, `TransientEffects.js`, `AreaOfEffect.js`, `Projectile.js`, and other local/remote VFX routes.
- Actor/model animation clips and every shipped player, enemy, boss, summon, and NPC class.
- Network events and replicated state used to present other players’ casts, movement, jumps, attacks, deaths, buffs, summons, channels, and teleports.

For each ability or actor state, record:

- Owning class/entity and exact canonical name.
- Whether it is active, passive, channeled, persistent, movement-based, projectile, area, buff/debuff, summon, or transformation.
- Local skeletal animation or procedural pose.
- Cast, travel/channel, impact, persistent, expiration, and recovery VFX where applicable.
- Sound hook if one exists; missing audio is not the main scope unless it causes animation timing defects.
- Remote-player/enemy presentation.
- Rune/talent/equipment variants that materially change timing, count, range, shape, duration, targeting, or appearance.
- Intended graphics-quality behavior.
- Automated coverage and real-browser evidence.
- An explicit and justified “no animation required” classification for true passives. Never let a generic fallback silently conceal missing work.

Add a regression check that fails when a new configured active ability or replicated visual state has no explicit local and remote presentation classification.

## 2. Repair the shared actor animation state machine

Audit and correct `Actor.js` and every caller that can change animation state. Establish clear, testable priority and transition rules for at least:

- Spawn/initialization.
- Idle.
- Walk.
- Run.
- Start moving, stop moving, rapid direction changes, and click-to-move replanning.
- Basic attack, cast, channel, impact recovery, and repeated attacks at different attack/cast speeds.
- Jump anticipation, airborne progression, landing, and restoration to the correct idle/walk/run state.
- Charge, lunge, dash, blink, teleport, knockback, stun, root, pull, and other forced movement.
- Hit reaction if the shipped models support it.
- Death, corpse state, resurrection, and respawn.
- Summon/transformation entry and exit.
- Disconnect, session resume, fresh login, dungeon transition, and join-in-progress reconstruction.

Eliminate known classes of animation bugs:

- T-poses, bind-pose flashes, frozen mixers, missing clips, and invalid clip-name assumptions.
- Moonwalking, foot sliding, incorrect facing, movement with an idle pose, or running while stationary.
- Animation restart spam on repeated snapshots.
- Casts that instantly snap back to idle, loop forever, or get overwritten by ordinary movement.
- Attacks whose visual impact timing does not match the authoritative hit.
- Jump animations that restart every frame, use an obviously broken walk fallback, land twice, or restore the wrong state.
- Death being overwritten by movement, attacks, buffs, or late network packets.
- Incorrect speed scaling at high attack speed, cast speed, haste, slow, or frame-rate variation.
- Local and remote actors resolving the same state differently without a deliberate design reason.

Use clean crossfades and stable mixer/action lifecycle management where supported by the assets. If an imported model lacks a required clip, provide an intentional procedural or best-fit fallback and document it; do not silently pretend the missing clip exists.

## 3. Fix and polish every player ability

Exercise every configured and selectable active ability for Fighter, Rogue, Wizard, and Cleric, including alternate specialization skills, aliases, runes, talents, equipment modifiers, and transformed/summoned abilities.

For every ability, verify and fix:

- A readable anticipation/cast cue.
- Correct origin, target, direction, facing, range, height, and terrain anchoring.
- Travel or channel behavior when applicable.
- Impact timing and location matching server-authoritative damage, healing, movement, buffs, debuffs, summons, or crowd control.
- Persistent visuals for the full authoritative duration.
- Clean refresh, stacking, replacement, cancellation, expiration, death, zone-change, and reconnect behavior.
- No duplicate effects from local prediction plus server echo.
- Correct local, remote-player, party-member, enemy, and target presentation.
- Distinct enough visual identity to understand what happened during combat.
- No clipping below terrain, detached effects, z-fighting, giant full-screen geometry, invisible particles, stale world-space effects, or camera-dependent disappearance.
- Acceptable behavior at both Low and High graphics settings.
- Stable behavior at common frame rates and under rapid repeated casting.
- Complete disposal of geometries, materials, textures, particles, timers, listeners, animation actions, summons, and scene nodes.

Do not broadly replace missing ability identity with the same generic ring, wave, buff flash, or Attack clip. Shared primitives are acceptable, but their composition, duration, scale, color, motion, and timing must communicate the actual ability.

## 4. Spirit Guardians acceptance criteria

Treat Cleric Spirit Guardians, Guardian Spirits, Spirit Guardians Boost, and materially related rune/talent/equipment variants as a dedicated defect cluster.

The finished Spirit Guardians presentation must:

- Show clearly visible guardian spirits orbiting the Cleric rather than only a momentary cast flash.
- Remain attached to and smoothly follow the correct Cleric while preserving stable orbit motion.
- Run for the full server-authoritative active duration.
- Communicate activation, periodic pulses/damage, and expiration without excessive screen noise.
- Scale or vary correctly for Guardian Spirits, Spirit Guardians Boost, and relevant modifiers.
- Appear for the casting player and other connected players.
- Reconstruct correctly for join-in-progress, reconnect/session resume, and dungeon/overworld transitions when the effect remains active.
- Refresh or replace cleanly without duplicate orbit sets, accelerated animation, leaked timers, or orphaned scene nodes.
- Disappear exactly once on expiration, cancellation, death, character replacement, or logout.
- Keep damage/healing authoritative; visual fixes must not introduce client-side combat authority.
- Pass repeated-cast and long-duration lifecycle tests with stable scene/effect counts.

## 5. Cover enemies, bosses, summons, and NPCs

Audit every shipped actor archetype, not only the four playable classes.

Verify the states each archetype actually uses: idle, movement, basic attack, special attack/cast, hit/control state where available, phase transition, summon behavior, death, and despawn. Prioritize enemies and bosses reachable in current overworld and dungeon content, but leave no shipped actor unclassified in the coverage matrix.

Fix animation/event mismatches that affect combat readability, including telegraphs that do not lead to the represented attack, attacks that damage before their impact frame without intentional warning, dead actors continuing to animate, and phase/summon effects that remain after cleanup.

## 6. Make local and multiplayer presentation converge

Animation correctness must hold for both the controlled character and replicated actors.

- Ensure network messages carry or derive the canonical ability/state identity, timing, target, and duration needed for presentation.
- Avoid relying on a generic remote fallback when the local player receives a bespoke effect.
- Prevent prediction/server-echo duplication.
- Verify late packets cannot resurrect expired VFX or overwrite death/newer state.
- Verify a second browser observes movement speed, walk/run, jump arc/progress, facing, basic attacks, every tested ability category, persistent buffs, summons, teleports/charges, death, and recovery.
- Verify state converges after latency, reconnect, dungeon transitions, and joining while a persistent effect is active.
- Preserve server authority and bounded client queues; do not solve visual smoothness by hiding real state divergence.

## 7. Add deterministic automated and visual QA

Add focused unit/integration tests for:

- Canonical ability-to-visual coverage and alias resolution.
- Animation priority, crossfade, completion, interruption, and restoration.
- Walk/run/idle selection and speed scaling.
- Jump start/progress/landing/restoration.
- Death and resurrection priority.
- Persistent effect creation, refresh, snapshot reconstruction, expiration, and disposal.
- Spirit Guardians orbit count, following, duration, pulse cadence, remote reconstruction, and cleanup.
- Prediction/server-echo deduplication.
- Scene/resource counts after repeated casts and character/dungeon replacement.
- Every fixed regression.

Create or extend a deterministic animation/VFX gallery or repro route that can render every inventory entry at known camera positions and controlled timing. It must use production rendering code and assets, be unavailable or harmless in normal production play, and support:

- Captures at anticipation, cast, travel/channel, impact, persistent midpoint, and cleanup.
- Local and remote actor views.
- Low and High graphics settings.
- Repeatable screenshot/video evidence without embedding credentials.
- A clear failure when an effect is invisible, missing, non-finite, detached, never expires, or unexpectedly falls through to a generic visual.

Use image comparisons selectively with sensible tolerances. Prefer behavioral assertions for timing/lifecycle and human-readable screenshot/video contact sheets for aesthetic judgment; do not create brittle pixel tests that fail on harmless GPU rasterization differences.

## 8. Test through real hardware-accelerated Chrome

Use `/usr/bin/google-chrome` on the repository runner and require a hardware WebGL renderer. Fail if Chrome uses SwiftShader or another software renderer.

Browser testing must use the actual rendered canvas and normal game pathways:

- Use real keyboard, mouse, wheel, and visible DOM controls.
- Select skills/runes/builds through normal UI where practical.
- Cast and move through real gameplay input; do not call character ability, movement, jump, attack, or effect-construction methods directly from `page.evaluate()`.
- Read-only inspection and Three.js projection for positioning real mouse input remain acceptable.
- A securely allowlisted QA setup command may accelerate levels/resources/build changes for dedicated QA characters, but must never work for ordinary accounts and must not directly fabricate the visual being tested.
- Capture console errors, page errors, failed assets/requests, WebSocket state, final animation/effect state, and sanitized failure evidence.

Run at minimum:

- All four playable classes through idle, walk, run, jump, basic attack, death/recovery, and every ability/variant in the canonical inventory.
- Rapid transition sequences such as run → cast → move, jump → cast/land, attack → movement, channel → interrupt, death during an effect, and repeated casts.
- A two-browser pass for remote locomotion, jumps, attacks, short effects, projectiles, ground effects, persistent buffs, summons, transformations, charges/teleports, death, and reconnect.
- Representative overworld and dungeon terrain/camera conditions.
- Low and High graphics passes.
- Repeated-cast/cleanup and a bounded soak that detects growing scene nodes, active effects, timers, animation actions, or memory.

The exhaustive predeploy route may use disposable isolated characters. Production verification must use only dedicated persistent QA characters/accounts and must never delete or overwrite normal player characters.

## 9. Performance and accessibility guardrails

- Keep effects readable without making combat illegible when several players cast simultaneously.
- Avoid excessive flashes, opaque full-screen effects, or rapid strobing.
- Respect graphics-quality reductions while retaining essential telegraphs and ability identity.
- Do not regress input responsiveness, authoritative movement, or network-state handling.
- Establish bounded performance/resource measurements for the gallery, repeated casts, and multiplayer scene.
- Investigate material frame-time, draw-call, allocation, or scene-node regressions introduced by the fixes.

## 10. Documentation, release, and production proof

Update the animation coverage matrix and relevant architecture/QA/status documentation with evidence-based claims. Distinguish:

- Inventoried.
- Implemented.
- Unit/integration tested.
- Locally hardware-browser tested.
- Multiplayer tested.
- Live production tested.
- Still limited by missing source assets or other explicit constraints.

Before pushing:

- Run a fresh dependency install and audit.
- Run the complete client test suite and lint.
- Run the complete Go test suite with the race detector and build the server.
- Validate GitHub Actions syntax.
- Run the full isolated hardware-browser animation route and multiplayer route.
- Sanitize all browser artifacts and verify no credentials are present.

Then:

1. Commit the finished work in focused commits.
2. Push to `master`.
3. Monitor every GitHub Actions job through completion.
4. Confirm the deployed client and backend both report the pushed full commit SHA and the database is ready.
5. Run the live anonymous smoke.
6. Run all four dedicated production QA characters through the locomotion/state matrix and exhaustive ability matrix.
7. Run the live two-character remote-animation matrix, explicitly including Spirit Guardians lifecycle and reconnect reconstruction.
8. Inspect the real rendered evidence, not only Playwright assertions.
9. Fix forward and repeat deployment/testing for any defect found.
10. Record the final run, SHA, renderer, coverage matrix, evidence, and honest remaining limitations.

## Production safety constraints

- Use only dedicated QA accounts and characters supplied through secrets or explicitly created for QA.
- Never print credentials or include them in screenshots, video, traces, HTML reports, command output, or committed files.
- Keep credentialed recordings disabled unless a proven sanitizer operates before any upload.
- Do not alter or delete normal accounts, characters, inventories, skill builds, parties, auctions, or Mongo data.
- Any QA-only command must be authenticated, explicitly allowlisted server-side, narrowly scoped, tested against privilege bypass, and incapable of granting normal users production powers.
- Do not weaken TLS, browser security, deployment gates, server authority, or credential protections to make visual tests easier.

## Scope discipline

- This goal includes animation state, ability VFX, visual replication, and narrowly necessary rendering/network/test-harness changes.
- It does not authorize unrelated progression, balance, content, economy, guild, PvP, or general monolith-refactor work.
- Do not change ability damage, cooldown, mana cost, or gameplay behavior unless necessary to correct a proven animation synchronization bug; document and test any such change.
- Reuse the existing art direction and assets where they are sound. If a missing source animation prevents a truly clean result, implement the best safe procedural fallback, document the limitation precisely, and identify the exact asset needed rather than hiding the gap.

## Definition of done

- Every configured active ability and material variant is present in the canonical coverage matrix with explicit local and remote presentation.
- Every shipped actor archetype and used animation state is classified and checked.
- Spirit Guardians visibly orbits, pulses, follows, replicates, reconstructs, expires, and cleans up correctly.
- Idle, walk, run, jump, basic attack/cast, forced movement, death, resurrection/respawn, and state restoration are smooth and correct for all four player classes locally and remotely.
- No known missing, invisible, generic-fallback, duplicated, stuck, detached, mistimed, or leaking ability effect remains.
- No known T-pose, frozen mixer, moonwalk, foot-slide regression, animation restart storm, incorrect restore, or death-priority bug remains.
- Automated coverage fails on future unclassified active abilities or replicated visual states.
- Repeated-cast and bounded-soak checks show stable effect/resource lifecycle.
- Full client/server/lint/audit/build/race gates pass.
- The exhaustive isolated and multiplayer routes pass in hardware-accelerated system Chrome.
- The deployed frontend and backend report the same pushed SHA.
- Dedicated persistent QA characters complete the live four-class and multiplayer animation matrices through real browser input.
- Sanitized evidence and documentation record what was actually observed.
- The final worktree is clean and `origin/master` contains the verified production commit.
