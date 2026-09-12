# Teleport Warp presentation — unreleased

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

Based on the offline charge candidate f15e445a in
`/tmp/eidolon-teleport-visuals-20260911` (`work/teleport-warp-visuals`).
This does not change the frozen Alpha 1.0.63 deployment source.

## Repair

Warp already damages departure and arrival, with a trained radius of 5 instead
of 4. Its presentation lacked both damage rings, and the original ability event
lost the departure once an observer received a newer position snapshot. Local
effects also flashed at the aim point before dungeon clipping resolved landing.

Accepted Teleport events now carry a separate departure plus the actual landing
and resolved Warp radius/arc. Non-Warp casts explicitly resolve to no damage
footprint. The real broadcast payload copies departure coordinates, including
zero coordinates, without aliasing mutable event data. Legacy events omit it.

Both clients use the accepted endpoints without needing private rune or talent
replication. Local input still animates immediately; multiplayer location
effects wait for acceptance without replaying the animation. Offline paid casts
show their effects after landing resolution but before moving the source.
The canonical smoke/arrival flash remains, with exactly two rune-only rings.
Teleport preserves floor height at both endpoints, including elevated floors.
This changes no damage, mana, cooldown, equipment bonuses, save IDs or balance.

## Evidence

- Initial client regression: 4 failures and 1 passing control, 0.620s;
  `/tmp/eidolon-teleport-visual-red-20260911.log`.
- Server event probe reproduced missing departure/resolved shape. Its initial
  clipping fixture was corrected to a real `dungeon_` instance ID; this fixture
  correction is not a claimed gameplay repair.
- All focused `TestTeleport` checks passed 1.055s; three repetitions with the
  race detector passed 12.081s (91490/92458).
- Separate actual broadcast-converter regression 95964 failed on missing wire
  departure. Corrected `TestAbilityPayload` checks passed three repetitions with
  the race detector, 1.024s (29031), including zero/nil and immutable-copy cases.
- Final client 21619 passed 9 suites / 136 tests in 1.915s and full lint.
  This includes actual GameEngine local/observer event dispatch and procedural
  High/Low meshes, fixed-radius boundaries during animation, floor height,
  expiry cleanup, actual offline wall-clipped casts, non-Warp and denied casts,
  phase/charges and existing shape/presentation regressions.
- Logs: `/tmp/eidolon-teleport-{event-{red,green,race},wire-{red,green},visual-{final,lint}}-20260911.log`.

## Still required

These are focused runtime/mesh tests, not a real-browser screenshot or gameplay
acceptance. Full client/server integration of this candidate and its parent
charge change remains due. Native earned rune/set purchases, two-client casts
at trained burst boundaries, fresh saves, Phase status presentation and a
versioned release with patch notes remain open. Other utility Masteries and the
full 160-talent acceptance are not closed by this repair.

Alpha 1.0.63 CI 34655698173 remains on its required self-hosted gameplay gate;
keep that source frozen and avoid starting a competing local browser/full run.
The soak stays cancelled. Primary development remains at accepted 85ee5a5b until
this newer candidate passes full integration.
