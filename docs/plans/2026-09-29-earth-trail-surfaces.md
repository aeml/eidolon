# Earth trail surface integration

Local continuation after b3993c40. Full ordered roadmap active; no release,
version bump or readiness-gate waiver. This is a bounded material improvement,
not completion of the connected modern-ARPG quality reference.

## Change

The old road texture used mostly independent texel noise and faint straight
ruts. Minification averaged it into a smooth translucent brown strip. Earth
roads now share coherent compacted soil, wandering worn tracks, embedded gravel
concentrated toward shoulders and irregular feathered edges. Registered normal
and roughness maps give those features a lighting response without extra meshes,
displacement, blockers, lights or changes to the authored road network.

The six-metre longitudinal texture wraps across all channels, including gravel
crossing the seam. Low samples the same canonical field at half resolution;
WorldGenerator forwards its actual graphics quality. Other realms retain their
own existing path surfaces. No collision, rewards, skills or terrain-profile
activation changes. Existing scene disposal visits and deduplicates all three
material texture slots; no global texture cache or additional disposal callback.

Initial normal-zoom review showed gravel too bright and edges too regular.
Reduced gravel density/contrast and road opacity, and increased edge variation.
Final desktop gate/grove and phone gate views were inspected. Roads have more
surface definition, but broad surrounding ground remains flat and sparse, the
procedural trees/actors still limit the scene, and texture work alone cannot
meet the final quality target. Next work should address larger scene depth and
composition, not endlessly retune this road's gravel colors.

## Evidence and cost

- Final 23 focused trail, world-population and raised-ground ribbon checks pass
  (11.772s). Includes material feature registration across quality, exact
  longitudinal wrap, edge transparency and unchanged path geometry/clearances.
- Final two production-renderer Earth/town browser cases pass (36.2s), at
  1280px High and 390px Low. Captures: `/tmp/eidolon-earth-trails-final-0929`.
  Baseline: `/tmp/eidolon-perimeter-first-0929`. These are prepared scenes, not
  connected multiplayer or campaign acceptance.
- Scoped ESLint and whitespace checks pass. No new browser cases or soak.
- One shared material remains. Two extra textures: three 256-square RGBA maps
  on High (786,432 base-level bytes), three 128-square maps on Low (196,608
  base-level bytes), versus one 128-square map before (65,536 bytes). Mip chains
  add about one third; these are not total process/GPU memory measurements.
  No FPS or device-capacity claim. No geometry/draw additions from this change.

Alpha 1.39/1.40 human acceptance policy remains unresolved as recorded in the
progression preflight. Do not silently skip the ordered release gates.
