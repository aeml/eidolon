# Alpha 1.3.0 — combat feedback work

Candidate from1.2 release999dfbf0, packaged asAlpha1.3.0 with login, runtime and
deployment versions synchronized and seven player-facing patch notes. Publication
and exact live readback are still required; do not infer them from packaging.

## Implemented so far

- Successful local ability presentations have class-specific generated cast
  sounds: Fighter impact, Rogue sweep, Wizard rising energy and Cleric chime.
  Remote actors do not add party-cast noise. Existing mute/volume controls apply,
  and120ms per-class cooldown suppresses immediate duplicate sounds. No missing
  authored asset URLs are added; frequency sweeps use native Web Audio ramps.
- Nearby teammates' decorative combat reactions use compact geometry,70% of the
  usual effect intensity and220ms repeat spacing. Local involvement and hazards
  retain full presentation. Actual projectile/ground boundaries are unchanged.
- The existing target card shows a primary skill's remaining cooldown or mana
  shortage; phone range/safe-zone warnings retain priority. Desktop skill preview
  includes the same readiness detail. Cooldown/mana rejection messages give exact
  remaining time or missing MP. Uses resolved cast costs; no economy/input changes.
- Phone primary skill and hotbar support thumb-relative drag aiming, with a world
  range ring, direction/endpoint preview and numeric range feedback. Release casts
  through AbilityController; sliding back cancels. Taps retain selected-target,
  self and ally behavior; dragging self/ally skills cancels instead of redirecting
  them. Only the owning touch can commit; canceled touches, input reset, death,
  menu interruption and changed skill assignment cancel. Preview tracks current
  player position/camera and preserves realm elevation. No server rules changed.
- Combat camera motion now responds to confirmed direct hits involving the local
  hero, with250ms burst suppression; periodic damage and other players' landings
  do not shake your view. It stays off by default. A saved0–100% strength slider
  defaults to50%, is available in phone Play settings and desktop settings, and
  leaves all hazard warnings intact. Device reduced motion suppresses punches.
- Short attack/cast animations reach full weight in60ms instead of160ms, retaining
  their authored duration and gameplay timing. Fighter and Cleric have a chest
  windup/follow-through, Rogue counterbalances successive cuts, and Wizard leans
  into release instead of away. Existing locomotion blending and boot articulation
  remain; damage, cooldowns, movement speed and class stats are unchanged.
- World hazards and transient boss warnings have a normal-blended dark backing
  inside the authoritative outer radius, retaining contrast on bright terrain at
  either graphics quality. Decoration can reduce without removing the boundary.
- All four classes' personal buffs and caster-centered effects bypass hostile
  target chasing and cursor rotation on phone/desktop. Charge remains directional,
  ally-targeted heals retain their path, and zero-range buffs do not offer a fake
  drag target. This is class-control tuning, not speculative damage/economy buffs.

## Focused checks

- Audio and cast wiring:16 tests pass; earlier AudioManager/procedural casts17
  passed (overlap, not33unique). Actual Chrome OfflineAudioContext renders all
  four cues with finite, nonzero output and peaks.024–.037, below clipping.
- Combat feedback:47 existing/new tests pass, plus one focused compact-geometry
  check. Changed-file ESLint and diff whitespace checks pass.
- No full game playthrough or soak started. Audio render verifies signal output,
  not subjective listening quality; final listening/device/group checks remain.
- Readiness:18 controller/HUD tests pass, followed by6 HUD tests after adding
  warning-priority coverage. Actual390px Chrome card screenshot inspected at
  `/tmp/eidolon-1-3-readiness-phone.png`; no extra panel was introduced.
- Touch aim/world tap/joystick ownership:21 tests pass, plus changed-file lint.
  Actual390px Chrome touch input showed a range-clamped preview with zero casts
  while held and exactly one on release. Screenshot inspected at
  `/tmp/eidolon-1-3-aim-phone.png` (isolated presentation fixture, not live combat).
  No broad playthrough or soak was run for this feature.
- Camera/settings/feedback/phone routes:75focused tests pass. Animation state and
  four-class procedural models:36tests pass. Actual Chrome four-class release
  pose inspected at `/tmp/eidolon-1-3-attack-release.png`; this is a key-pose check,
  not a full equipment/animation matrix or a physical-phone performance claim.
- Camera/jump/settings wiring:44tests pass (overlap with the75 above).
- Warning boundaries and touch aim:35tests pass. Actual390px Chrome shows low/high
  Wind/Fire warnings on pale/dark terrain with exact2.6-unit boundaries; screenshot
  inspected `/tmp/eidolon-1-3-danger-phone.png`. A missing addon import-map alias in
  the temporary fixture was corrected before the successful render (no game fix).
- Class casting/ranges/touch:36tests pass, including eight self-skill examples
  across all four classes and both input modes. Existing cast-cost/range safeguards
  remain. Final release-version/self-cast checks include the cursor-rotation guard.

## Next

Publish this milestone, check its pipeline and exact live identity, then develop
1.4's expanded Chronicle. Physical-device sustained-performance, class balance
under full earned progression, and full equipment/group matrices remain open
final-stabilization work under the user's feature-first instruction; they are not
claimed complete by these focused presentation/control checks.

Predecessor1.2: both live endpoints reportAlpha1.2.0/999dfbf0; backend database
ready. CI34728771304 is terminalSUCCESS, including finalLiveReleaseandCharacterQA.
