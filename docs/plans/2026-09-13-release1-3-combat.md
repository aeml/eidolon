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

## Next

Continue casting/aim feedback, anticipation/impact presentation, camera options,
movement transitions and existing class tuning. Retain dungeon ability guards,
touch target selection and dangerous telegraph readability. Consolidate this
milestone with player-facing notes and live smoke after1.2 deploys.

Next concrete feature is the roadmap's drag-to-aim preview and cancellation:
existing mobile tap-to-select/overlap cycling already works (GameEngineMovement),
but AbilityController currently casts toward the selected enemy/facing without
an explicit drag aim. Extend existing thumb buttons, preserving self/ally casts,
real server targeting and cancellation without accidental movement or autoplay.
