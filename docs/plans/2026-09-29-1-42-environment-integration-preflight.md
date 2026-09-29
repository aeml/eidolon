# Alpha 1.42 — environment integration, local work

Partial, unversioned work; not deployed and not full milestone acceptance.
Earlier candidates still require ordered publication and live verification.

## Town masonry report

The reported well/building paving disappearing behind terrain was reproduced
and corrected in the prepared 1.35 candidate. Positive polygon offset in the
shared shadow helper and town material factory caused the depth error. The fix
retains normal depth testing, front-face shadows, elevations and colliders.
Hardware-Chrome pixel comparisons at zoom 10/30 and before/after screenshots
are recorded in [the 1.35 notes](2026-09-28-release1-35.md).
This fix is local, not live; do not redo it or raise buildings to hide the bug.

## Dungeon entrances

High/Low gallery review showed flat-colored entrance masonry compared with
town's existing surface detail. Reused the world-space stone/weathering shader:
stone at Verdant/Abyss, fieldstone at Molten, slate at Tempest, and fieldstone
on pale accents. Portal voids and emissive surfaces are unchanged. Shared
materials, geometry, batching, draw counts and exact collision/interaction
footprints are preserved. No new texture downloads or per-frame geometry.

42 entrance, interior and world-surface unit checks passed (3.112s). The new
checks cover all four entrances, shared source/batched materials, opaque
depth behavior and exclusion of portal materials. Scoped lint/whitespace passed.
The updated four-entrance High/Low browser gallery passed (7.4s); both images
were inspected at `/tmp/eidolon-142-entrance-surfaces/`.

## Dungeon floor depth regression

Tested all five dungeon floor materials at canonical Y=0.1, with the production
camera at zoom 10/30, comparing pixels with/without a contrasting underlay.
All floors occlude the underlay correctly; no equivalent dungeon depth failure
was reproduced. Existing dungeon polygon offset has therefore not been changed.
The probe uses a visible red control, not an arbitrary brightness threshold:
linear readback of authored dark stone can legitimately be near black.

Baseline browser review passed three cases (16.5s): floor depth, all four
entrances High/Low, and five interior themes/eight room identities and states
High/Low. Evidence is in `/tmp/eidolon-142-environment-baseline/`.
The depth regression is registered in the existing animation-browser stage.
After registration, the targeted unit/version selection passed 351 checks
(5.296s), scoped lint and whitespace passed, and the depth browser probe passed
again (7.4s; `/tmp/eidolon-142-depth-registered/`). No long soak was run.

## Interior lighting response

Added generated tangent-normal and roughness maps to the floors/walls of all
five dungeon themes. Physical relief follows mortar, roots and fractures,
not albedo brightness; the Abyss tide stripe remains paint, not a raised ridge.
Gloss variation distinguishes obsidian, slate conductors and damp basalt from
rough joints. Existing colors, emission, UV scale, geometry, transparency and
canonical walk surfaces are unchanged. The relief is deliberately shallow.

Each kit now has eight base maps instead of four: four additional 64x64 RGBA
maps add 64 KiB of base-level image data, plus mipmaps/GPU allocations for used
variants. No new downloads, triangles or draw calls. Maps share image data
within a kit and follow the existing material cache; production scene cleanup
releases maps from shared materials once. This is not a zero-memory-cost change.

An initial slope-bound check caught steep root/mortar transitions. Reduced the
normal gradient strength and retained the bound rather than relaxing the test.
Final 56 focused unit checks passed (11.9s): surface response, cleanup, entrances,
scene groups and canonical floor-union coverage. Scoped lint/whitespace passed.
Final browser gallery plus depth probe passed (15.3s), with all five themes,
eight room identities/states and High/Low quality. Both captures were inspected:
`/tmp/eidolon-142-interior-materials-final/`. Masonry now catches light along
its joints while the encounter markers remain distinct. This is an incremental
material improvement, not a finished-art or frame-performance claim.

## Remaining milestone work

- Remaining full-world presentation limitations, including landmark composition
  with foliage/actors present and owner art acceptance.
- Final milestone integration and ordered release/live verification. The local
  preview described below is not a published 1.42 or full visual acceptance.

Existing checks are reused where geometry is unchanged. These incremental
procedural improvements are not a claim of AAA visual quality or complete
environment acceptance. Public DNS still resolved to the previously identified
wrong IPv4 (174.230.70.64) on this continuation; no deployment was attempted.

## Integrated routes and realm gateway correction

The production dungeon/raid fixture browser passed (36.7s): 30 fixtures across
10 dungeon/raid types, including fallback layouts. Each sampled route remains
clear for a radius-1.25 actor and has exactly one floor, at real instance
coordinates. High/Low captures were produced; the Molten join was inspected.
Evidence: `/tmp/eidolon-142-integrated-dungeons/`. Fixed fixture scene cleanup
to release materials/textures as well as geometry between layouts. This is
rendering/traversal evidence, not another earned encounter-clear claim.

Found and reproduced exposed water through the open Earth/Water, Earth/Fire
and Earth/Air crossings: both ground planes stopped 0.75 units short of their
shared boundary. The new browser probe failed before the fix, with the blue
water stripe visible in the inspected Water capture.

`RealmGroundGeometry` keeps the rectangular shoreline inset but extends ground
to the boundary at canonical wall openings. Shared walls are sometimes defined
only by the neighboring realm, so both sides consult the same geography catalog.
The same applies to town gate edges. Patches meet, rather than overlap, the
main plane and preserve its UV origin/scale for every material channel. They
are merged into the existing mesh: two triangles per gate/realm side, no extra
materials or draw calls. Collision, movement, safe-zone rules and region bounds
are unchanged; closed shoreline sections retain their inset.

45 targeted geometry, terrain, scene-group and town-collision checks passed
(36.228s). New tests cover finite bounds, upward faces, matching UVs, single
surface coverage on both sides and retained closed-edge gaps. Browser crossing
coverage passed at High/Low (11.7s); Water High and Fire Low after-captures were
inspected against the before image. These are ground-only diagnostic views,
not a claim to have revalidated every landmark or fence. Evidence:
`/tmp/eidolon-142-gateways-before/` and `/tmp/eidolon-142-gateways-after/`.
Scoped lint/whitespace passed. The crossing browser is registered in the
existing animation-browser stage. No long soak or deployment was run.

## Town and landmark review; isolated preview

Town/browser clearance passed 326 approach and event-spawn samples (7.3s), and
35 courtyard, entrance-hint and CasinoController checks passed (3.244s). Reviewed
the town capture, including the stash clear of the casino entrance, single roof
and visible Casino sign. Door hover uses its isolated material and retains the
click prompt. No service was moved or collision changed during this pass.

The capture showed flat casino walls/roof against detailed neighboring buildings.
Applied existing world-space stone/slate detail to the shell's own two material
buckets. Room interiors, furniture, door material and draw counts are unchanged.
21 focused casino/surface checks passed (2.004s); the town browser passed again
(7.2s), and the after-image was inspected. Scoped lint/whitespace passed.

Extended the elemental composition gallery to Air, which it previously omitted.
Earth/Water/Fire/Air High/Low gallery passed eight cases (28.2s), eight sites per
realm; all four High sheets were inspected. Evidence:
`/tmp/eidolon-142-overworld-review/`. These show authored sites, paths and story
props, not the whole live world with foliage, enemies and players. Do not claim
this proves final world density or player readability. Also inspected Verdant
Low, Abyss High, Tempest Low and Umbral High integrated dungeon join captures;
the themed floors meet without restarted patterns or crossing interior walls.

An isolated preview is collected at
`/tmp/eidolon-142-environment-candidate-w4Qoin` on
`work/environment-1-42-candidate-20260929`, based on the clean 1.41 art preview
`d56fcf23`. Runtime version stays at its inherited 1.38 until earlier milestones
and this milestone are ready for ordered publication. Draft player-facing notes
are in [the candidate notes](2026-09-29-release1-42-candidate.md).

## Dark Realm review

The integrated Dark Realm browser passed (15.9s), exercising the authoritative
layout at real coordinates, camp, 38 story-site models, witnesses and all four
courts on desktop and phone-sized Low views. Inspected inhabited camp desktop/
phone, Archive court and the city-wide view in `/tmp/eidolon-142-dark-review/`.
Court arrivals remain clear. The camp/site views preserve actor and record
readability; the city-wide view remains deliberately sparse and is not final
world-density or art approval. No extra decorative blockers were added.

The Dark Realm and transient-warning unit selection passed 23 checks (2.646s).
Environment geometry is unchanged by this review. Full inhabited-world visual
acceptance and ordered publication remain open; the next independent effects
work is tracked separately under 1.43, not included in this preview.
