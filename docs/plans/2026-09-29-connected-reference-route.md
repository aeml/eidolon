# Connected reference-route review and dungeon floor hierarchy — September 29

Combined local candidate based on 263d7b75. No new live deployment, version
identity or roadmap gate acceptance.

## Real route evidence

Added opt-in EIDOLON_E2E_ROUTE_REVIEW=1 captures to the existing disposable
Bastion route. Normal runs remain unrecorded. Screenshots occur only after
authentication UI is hidden; the disposable character's 3D account label and
matching DOM text are redacted. The final captures hide only the localhost
performance overlay, not the production HUD. Camera, quality and instance
metadata are attached without account details.

Captured actual town start, Earth road, Bastion arrival and dungeon entry at
390x844 using the production phone camera/HUD. The character walks via touch
input with server-confirmed checkpoints and clicks the real entrance. Level
100 is QA preparation: this is neither earned pacing nor combat/clear proof.

Initial run routereview0929a passed39.0s and exposed:
- Large stretches of repetitive town paving with buildings at screen edges.
- Sparse road composition in the phone viewing corridor.
- Large neon dungeon decoration and long straight root beams dominating entry.

## Implemented correction

Static dungeon wards and boss soul circuits now use narrow inlay geometry;
inner wards/circuits use low-emissive stone/metal instead of bright accent
material. Objective/current-room halos retain their outer radii and states but
use narrow strokes. Combat hazard geometry/timing is untouched.
Verdant's long straight decorative roots are now low tapered curves near the
perimeter. No collision, objective, reward, exit or encounter rules changed.

All five environment kits share these floor hierarchy improvements. Reused the
existing inlay shape and removed unused broad-ring geometry: detail geometry
count stays9, while materials increase5→6 for the quiet inlay.

Initial unit run exposed that expected material count change; updated the
exact resource expectation and added explicit width/emissive/root-height
contracts. Final36 interior checks pass7.31s, retaining lifecycle, batching,
depth and resource checks. Scoped lint and diff whitespace pass.

Final connected run routereview0929b passed39.0s. Credential scans passed and
both run-owned service sets were removed. Inspected final dungeon capture:
floor, actor, objective strokes and exit are visible without broad neon bands.
Authoritative backend build263d7b75-dirty; runtimeAlpha1.38.0.

Archived final snapshots:
 /tmp/eidolon-connected-route-0929-bU8uPC/route

Different procedural room objectives appeared in the two fresh runs; this is
not a pixel-identical room comparison. The artifact is functional phone-sized
Chrome evidence, not physical-phone, FPS, listening or final-art acceptance.

## Remaining visual direction

The coarse dungeon-floor pattern and sparse architectural composition remain.
Town service-court paving and roadside framing also need refinement. Review a
representative desktop HUD view without repeating the long route merely for
another checkmark. Keep the existing collision/route proof for unchanged paths.
This review does not establish the entire game's modern-ARPG quality.

Full roadmap stays active; pending1.39/1.40 owner decision remains unassumed.
No campaign soak, production mutation or deployment.
