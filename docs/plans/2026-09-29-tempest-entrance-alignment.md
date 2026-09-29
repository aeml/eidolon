# Tempest Spire — west-facing approach and constructed threshold

Local candidate following ab978fbf; not deployed or final art acceptance.

## Changes

The old 76.5m tower filled the right of the normal approach view while the
south-facing portal was hidden. The visible architecture now faces the western
road and is 42.075m tall. Its open lancet gate uses individual beveled courses,
metal conductors and divided stone steps; a chamfered foundation replaces the
box shelf. The central needle has fourteen tapered masonry courses.

The arrival/atlas marker moves from45m to30m west, with its existing road
extended15m. Dungeon position, exact legacy gameplay box, radius19.98205268,
admission, level gates, bypass and scenery solids remain unchanged.

Removed roof-like slate tiling from the stone tower/foundation. Lightning is
thinner, dimmer and recessed behind the foregate rather than crossing it as a
large glowing rod. No downloaded assets, new texture maps or per-frame work.
Visible triangles952→2196; material batches9→8. Three cached geometry entries
added to the kit; total38 geometries/30 materials after all four entrances build.
These are resource counts, not a frame-rate claim.

## Verification

- Initial baseline failed before rendering: dynamic RenderSystem import failed,
  although its trace records HTTP200. Cause remains unconfirmed. One retry after
  terminal failure passed16.9s; baseline screenshot inspected.
- Entrance/population/atlas39 checks passed18.164s. After material/needle
  refinement, final entrance25 checks passed1.361s. Raw and batched westward
  portal rays, true open arch, finite normals, visible height, shared resources
  and all four exact legacy bounds remain covered.
- Final four browser cases passed37.2s: High desktop and Low390px Air route,
  plus High/Low Tempest player cutaway. Portal center is on screen, ray hits the
  actual portal, and arrival is collision-free. Existing Air projectile/input
  and inspection checks remain in that route.
- The historical cutaway hero(-10,-10) was inside the solid. Moved that fixture
  to the reachable western edge(-22,-10), enforcing radius+1.25 clearance.
  Player pixels0→77/77 High and0→46/46 Low; unchanged80% requirement and
  no-change-outside-reveal checks. No runtime cutaway change.
- Generated456 scenery exclusions/eight readings, scoped lint and diff checks
  pass. No generated manifest rewrite required.

Baseline: /tmp/eidolon-tempest-baseline-retry-0929.
Final: /tmp/eidolon-tempest-final-0929. Both final approach images inspected.

This improves doorway readability and construction, not the entire Air realm.
The ground remains broad and visually sparse, flags/floaters are simplistic,
the landmark still extends off-screen and actors remain procedural. These
prepared renderer checks are not earned dungeon entry, phone performance,
human enjoyment or modern-ARPG art approval. No release/version increment.
