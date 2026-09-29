# Body-level periodic combat feedback

Local follow-up to23747c7a, not deployed or full1.43 acceptance.

## Changes

Poison, bleed, environmental-damage receipts and restoration no longer emit
decorative ground seals, halos or large orbiting bursts on each tick. They use
two Low/four High colored symbolic motes near the target's body. Healing rises;
damage falls briefly. Reduced motion holds their positions and orientations,
retaining a short fade. Distinct family colors/shapes and direct-hit feedback
remain. Confirmed receipts do not claim a new gameplay radius.

The event dispatcher supplies body height and a bounded spacing radius so the
small cues remain outside equipment instead of disappearing inside it. It clones
the presentation position; actor transforms, authoritative damage/healing,
floating numbers, camera/recoil policy, cooldowns and filtering are unchanged.
Actual danger, projectile-area and healing-range boundaries are untouched.

Poison plus healing:18→8 meshes High and12→4 Low. Final triangles184/92.
Shared resources and sibling disposal are retained; no maps or downloads added.
These counts are not an FPS benchmark. Remaining persistent auras/large impact
cores still dominate the deliberately crowded fixture; overall combat polish
and human enjoyment remain open.

## Evidence

- Baseline crowded fixture with added poison/healing receipts passed13.6s.
  Final High/Low normal/reduced-motion warning and floor-boundary checks passed;
  the last batch also had one new-test setup failure (missing Actor config).
  Corrected that fixture argument, not production behavior or its visibility
  assertion. The affected body-cue test then passed5.7s across all four equipped
  classes, both qualities, poison and healing. Pixel comparisons render the
  actual actor with/without the cue; this proves visibility, not performance.
- Initial104 contact/recoil/telegraph/feedback units passed3.446s. Final67
  feedback/event checks passed2.162s after spacing changes. Tests enforce exact
  part budgets, no extra area rings, deterministic frame-size behavior, bounded
  travel, reduced motion, unchanged target positions and resource cleanup.
- Updated the existing gallery budget assertion to exact2/4 periodic and4/6
  direct parts. The full catalog gallery was not rerun for this patch.
- Scoped lint and whitespace pass. No campaign/raid soak or live mutation.

Before: /tmp/eidolon-periodic-feedback-before-0929.
Final crowded/floor views: /tmp/eidolon-periodic-feedback-reviewed-0929.
Final body visibility: /tmp/eidolon-periodic-feedback-body-final-0929.
Inspected before/final High and final Low crowded views. Prepared renderer
fixtures are not authenticated party encounters or human art acceptance.
