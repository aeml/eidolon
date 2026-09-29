# Water/Fire ground and lighting refinement

Local candidate follow-up to b025ae2b's Cold Communal Kiln. Not deployed, not
final realm/modern-ARPG acceptance. Full ordered roadmap remains active.

## Draft patch notes

- Water and Fire ground now combine irregular mineral fragments with broader
  frost/ash deposits, with matching color, surface relief and roughness. Strong
  uninterrupted fracture outlines were softened after gameplay-scale review.
- Regional lighting uses less omnidirectional wash and stronger directional
  light. Fire has a warmer key and cooler fill instead of orange/red light on
  every surface; Water retains its cool identity and readable shadow fill.
- No ground displacement, collision, roads, hazards, encounter rules or gameplay
  timings changed. Ground is non-emissive; genuine hazards retain their effects.

## Implementation

`ElementalTerrainSurface.js` samples one deterministic, periodic canonical field
for both regions' existing albedo/normal/roughness maps. Warped, anisotropic
cellular fragments supply quiet mineral variation; coherent deposits soften
fractures and increase roughness. Fine grain is subordinate to those shapes.
High and Low sample identical coordinates, including finite-difference normals.
No new texture slots, shader hooks, lights, geometry, animation work or draw calls.

Existing three RGBA maps per region retain 786,432 High /196,608 Low base bytes
before mipmaps. Native Node High material-generation spot checks measured146ms
Water/123ms Fire on the initial field (not browser startup or FPS evidence).
Material-owned surface-map disposal is retained; shared albedo is not disposed
by the material. Earth, town, Air and dungeon presentation remain unchanged.

Lighting: Water ambient1.1/key3.0/fill.42/exposure1.24; Fire ambient1.05/key3.0/
fill.42/exposure1.22. Fog distances and bloom are unchanged. Existing render
preset interpolation and environment intensity consume the same manifest.

## Evidence and limits

- Initial full terrain/theme suites29 PASS87.971s. This exposed the cost of
  regenerating unrelated Earth/town test maps; final rerun was scoped to changed
  regions, not repeated wholesale.
- Final elemental-field/theme suites9 PASS7.831s. Checks periodicity, finite
  muted values, deposit/roughness relationship, exact High/Low registration,
  unchanged three-map footprint and once-only surface-map disposal.
- Final existing Water/Fire terrain regressions8 PASS20.438s: deterministic
  maps, normalized normals, cross-quality registration, non-emissive muted
  ground and original wrapping-discontinuity limits. Scoped lint/diff pass.
- Initial Water/Fire production-renderer review2 PASS23.0s. Inspection showed
  too much paving-like polygon outline; reduced continuous edge contrast and
  removed per-fragment height steps. Final High review1 PASS13.8s at
  `/tmp/eidolon-elemental-surfaces-refined-0929`; final phone-sized Low1
  PASS10.2s at `/tmp/eidolon-elemental-surfaces-final-low-0929`. Final kiln and
  wreck views inspected at both sizes. Baseline is the previous kiln record.

The fixtures include real world geometry/materials, normal camera and a prepared
hero, plus reading interactions. They are not connected party fights, physical
phone testing or human art/feel acceptance. No new FPS claim. The terrain is
still flat in these realms, broad deposits can read softly/repetitively, and
large areas remain sparse. Better regional landforms, contextual scenery,
actor art and combat presentation remain necessary. This pass is not a claim
that shader detail alone can deliver the requested final quality.
