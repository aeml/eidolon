# Alpha 1.3.0 — combat feedback work

Local development from the frozen1.2 candidate999dfbf0; not published and still
labelled1.2 until milestone packaging. Full1.3 scope remains in the main roadmap.

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

## Next

Continue casting/aim feedback, anticipation/impact presentation, camera options,
movement transitions and existing class tuning. Retain dungeon ability guards,
touch target selection and dangerous telegraph readability. Consolidate this
milestone with player-facing notes and live smoke after1.2 deploys.

Next concrete work: telegraph readability at low/high effects quality and remaining
class tuning, then milestone packaging. Existing tap-to-select/overlap cycling is
retained. Physical-device sustained-performance and full equipment/group matrices
remain final-stabilization work under the user's feature-first instruction.

Predecessor1.2: both live endpoints now reportAlpha1.2.0/999dfbf0; backend database
ready. CI34728771304 deployed successfully and is in its final Live Release and
Character QA job. Do not claim that final job passed until it actually completes.
