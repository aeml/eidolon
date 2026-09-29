# Molten Core entrance — architecture and approach alignment

Local candidate followingabf39684. Full ordered roadmap active; not deployed,
not an earned dungeon clear or final modern-ARPG presentation acceptance.

## Draft patch notes

- Molten Core's visible entrance now faces its actual eastern approach rather
  than south. A carved foregate stands near the reachable edge of its platform.
- Replaced the solid box/roof slab with a constructed barrel vault, individual
  arch courses and forged ribs. Great chains now have interlocking links.
  An irregular, lower foundation replaces the broad rectangular plinth.
- Lowered the visible crown and separated charcoal stone, warmer cut stone and
  iron. Narrow threshold/channel accents replace an overbright floor panel.
- The public gathering/atlas arrival moves from52m to44m east of the center,
  with the same road extended8m to reach it. This makes the portal visible in
  the phone-sized gameplay view without changing the camera or entry radius.

Legacy gameplay Box3 remains76.23759984970093 ×71.23167991638184 ×75.87180137634277,
center(-2400,200), collision/interaction radius34.14231061935425. The bounds mesh
is not rotated/compressed. Only visible architecture turns90° and scalesY.55.
No dungeon entry rules, level gates, encounter scripts, rewards or saves change.
The northern bypass and approach solids stay in place; generated456 scenery
exclusions and8 optional readings still match without regeneration.

## Costs and verification

Visible height64.0013→35.2007m. Nine draw batches remain nine; visible triangles
increase1,048→10,796. Eight additional cached geometry entries across the entrance
kit; material count stays30. No new texture maps, downloads or per-frame work.
This is a construction/readability change, not an FPS improvement claim.

- Initial entrance/canonical-world selection44 PASS22.216s. Final entrance,
  elemental population and atlas selection35 PASS17.693s. New checks verify
  east-facing portal normal, visible crown, raw/batched ray access to the veil,
  a real recessed vault chamber and unchanged legacy dimensions/radius.
- Generator check verifies456 exclusions/8 readings. Scoped lint/diff pass.
- Initial desktop approach passed, but phone-sized arrival failed the existing
  on-screen margin. Moved the public arrival closer and extended its existing
  road; retained the margin and blocked-arrival assertions. Final High desktop
  and Low phone-sized Water/Fire review both passed as part of a four-case45.6s
  batch. Gate raycasts hit the portal surface, not merely an unrelated part of
  the entrance. Both final approach screenshots inspected at
  `/tmp/eidolon-molten-approach-final-0929`.
- That batch's separate High cutaway test failed with its historical hero at
  (-10,-10), inside the radius34.14 blocked volume and furnace foundation.
  Corrected the fixture to the reachable rear-pylon edge(-10,-36), with an
  explicit radius+1.25 clearance assertion, like the existing Bastion fixture.
  No runtime cutaway change or relaxed80% threshold. Final High/Low cutaway2
  PASS13.8s at `/tmp/eidolon-molten-reachable-cutaway-0929`: hero pixels0→77/77
  and0→46/46; architecture outside the reveal remains unchanged.

These are prepared production-renderer/geometry checks, not connected earned
entry, physical-phone play or human art approval. The large landmark still
extends beyond the normal view; the visible portal, not the entire structure,
is the arrival readability target. Broad scenery, actor quality and combat
feel remain unfinished. No release/version increment or gate bypass.
