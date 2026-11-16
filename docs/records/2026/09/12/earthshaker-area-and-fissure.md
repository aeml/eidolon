# Earthshaker areas and Fissure — 1.1.0 candidate

Parent: `59afd794` damage-training correction. This change connects the
remaining area-training consumer with cast geometry, public impact events and
local/remote presentation. It is not a native or milestone acceptance claim.

## Reproduction

Server actual paid casts: all 24 rune/rank/generic combinations omitted the
accepted radius, 20 trained reach cases missed their edge, and trained Fissure
width cases missed their lateral edge. Untrained hit controls still succeeded.
RED0.923s. Offline RED18 failures, 41 passes in1.192s: trained reach was lost and
even untrained casts lacked an explicit circle/line visual footprint.

## Implementation

- FTR_14 Technique and generic FTR_33/FTR_38 area training are resolved once at
  the cast. Initial circle/Seismic/Fissure length6..8.1; Aftershock3.5..4.725;
  Fissure half-width1.5..2.025, scaled at the same rate. Query the line's padded
  corner coverage too. Target body padding, forward-only line, hostile and
  instance filtering, walls, mana/CDR, damage and stun rules remain intact.
- Aftershock keeps its cast origin, facing, radius, damage and stun snapshot
  after the source moves or changes builds. Its existing death/scene/shutdown
  cancellation still applies. Offline gameplay uses matching dimensions and
  now also explicitly rejects targets carrying another instance ID.
- Accepted JSON ability events add optional `shapeKind` (`circle`/`line`) and
  `phase` (`aftershock` only for the delayed impact), alongside existing
  radius/arc/origin fields. Target minus origin supplies a normalized planar
  heading, including zero-aim casts. Fissure half-width is exactly radius/4.
  A delayed impact has its own accepted event, not an invented client timer.
  No protobuf entity field or private talent replication is needed.
- Both graphics settings show the actual forward strip for Fissure: four fixed
  boundary edges with rising interior fault shards, no circular boundary.
  Circle and Aftershock retain the existing earth-themed circular effect.
  Remove the redundant legacy wave and the misleading cursor impact. The
  accepted cast origin, rather than a newer actor position, anchors the effect.
- Local reconciliation compares shape/radius/origin/heading, replaces only a
  stale same-phase footprint, and does not replay unchanged prediction or the
  cast animation. Delayed remote impacts do not turn an actor, interrupt its
  action presentation or display another cast notification. Malformed accepted
  geometry does not replace valid prediction.

## Verification

Initial client gameplay3suites210PASS1.779s; initial server focusedrace12.225s.
Expanded server race30.972s includes actual trained edges/widths, cast origin and
unit heading, real delayed wave after moving the owner/changing ranks, and
existing damage, wall, charge and Seismic-stun regressions. Wire race1.049s
round-trips both footprint kinds and delayed phase alongside prior payloads.

Initial visual/gameplay2suites66PASS1.398s: real attached High/Low meshes, world
coordinates and stationary line boundaries during animation; owner/observer
agreement despite private ranks/new positions; stale radius/rune/heading
correction, repeated unchanged acceptance, remote network impact without
animation/action replay, expiry and corrupt payload rejection.

Additional actual Technique purchases/zero-aim facing race1.516s, final wire
race1.057s. Full client first run:388 suites/6157 tests pass, one architecture
budget failure in284.039s: GameEngine reached2502 lines against2500. Extract
shape ownership/metadata into `abilityShapeMetadata.js`, retaining the budget
and existing behavior. Final lint passes; the complete client suite is being
rerun on this correction. Record its terminal result before accepting the
candidate. Logs `/tmp/eidolon-earthshaker-area-{server-red,server-green,server-expanded,purchases,wire-final,client-red,client-green,visual-green,client-full,client-full-final,lint-final}-20260912.log`.

Native Chrome purchased upgrades, cast/impact footage in actual dungeon geometry
and full hosted CI are still required. Production QA currently owns the one
GPU; no local native test was launched for this candidate. Deploy matching
server/client event consumers together. Four-role clear, earned progression,
the remaining 160-talent audit and all later roadmap milestones remain open.

Proposed1.1.0 patch note: “Earthshaker's area upgrades now apply to both waves.
Fissure displays its actual forward strip, and nearby players see Aftershock
at the original cast location without a second casting animation.”
