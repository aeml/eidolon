# Connected route review — actor contact shadows

Revalidated the candidate after2d7ea30b and ran the existing ordinary touch
route from Lanternhold to Verdant Bastion, with four intermediate road views.
Initial route passed46.9s. This uses a QA level100 character for travel and
entrance coverage, not earned pacing, combat balance or a dungeon clear.
Review still shows uniform terrain, sparse framing and intermediate actors.
One systemic presentation gap: phones/Low disable directional shadows, leaving
actors visually disconnected from the ground throughout the journey.

Added a texture-free instanced contact-shadow fallback for active Actor
entities only when ordinary shadows are off. It follows interpolated bodies,
uses authored model radius/scale, fades with jump height and follows the local
terrain tangent. Instance-owned floor Y is retained. It cannot receive clicks,
write depth, cast shadows or reveal inactive/hidden/stealthed/dead/seated actors.
Quality and scene transitions clear it; growth and teardown release owned
geometry, material and instance buffers. No actor transforms, movement, combat
rules, collision or shadow-quality settings change. These are soft grounding
cues, not directional shadows, AO, scenery shadows or final art acceptance.

Nine focused unit/resource checks passed1.262s. Scoped lint/whitespace passed.
The real connected route with runtime contact assertions passed44.2s including
dungeon entry. Disposable containers/data were cleaned up; credential scans
passed. Its captures exposed an important gap in the state-only assertion:
the .045 contact lift sat under the actual .1 town/dungeon floor overlays.
Corrected the lift to .12. A bounded rendered-pixel test failed on the .1 floor
before that correction (zero changed pixels), then passed4.7s on both ground
heights. It verifies visible darkening, no brightening, one additional draw and
two triangles for one actor. Inspected the final contact image. No FPS claim.
The route was not repeated after this height-only fix; final visual proof is
the raised-floor comparison, not a new full-route capture.

Evidence:
- `/tmp/eidolon-contact-route-before-0929-TC4b4e/route`
- `/tmp/eidolon-contact-route-first-0929-2Oe1p8/route`
- `/tmp/eidolon-contact-pixels-before-0929`
- `/tmp/eidolon-contact-pixels-final-0929`

No campaign soak, runtime/version bump, deployment or release-gate waiver.
Continue improving the connected route's large-scale terrain/forest composition
and desktop combat feel; this contact cue does not resolve those larger gaps.
