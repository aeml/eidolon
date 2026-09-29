# Verdant masonry and light separation — September 29

Local reference based on 5700f37b. No release identity change or deployment.

Replaced Verdant floor/wall pixel-pattern generation with a periodic worn-stone
field: variable floor courses and slab widths, soft mortar/bevels, restrained
joint moss, mineral variation and short interrupted fractures. Emissive floor
paint is gone; lamps, wards, objectives and hazards retain their own light.
Wall blocks use the same material language at their existing world scale.

Verdant alone now uses256×256 surface maps; the other four dungeon styles
remain64×64. Eight base maps total2,097,152bytes before mipmaps, versus131,072
previously. Texture count and geometry stay unchanged. One temporary sampled
field per surface feeds all four channels, then its cache is cleared.
Normal/roughness maps follow geometry cues, not green staining.

The main camera is offset(100,100,100), about173 units from its target. Verdant's
old fog started120 units out, placing the immediate play floor within green
fog. Moved the start to210, reduced omnidirectional/bloom wash, and made the key
light neutral with a restrained green-grey fill. Other realm lights unchanged.

Verification:
- Final38 masonry/interior checks pass15.725s, plus five unchanged theme checks
  from the preceding pass. Existing cleanup, normals, roughness, repeat, state,
  batching, floor geometry and resource checks retained.
- Updated the exact expected Verdant map byte bound; no broad memory-threshold
  relaxation. New sampler checks cover wrapping, bounded relief/roughness,
  non-emission, variety and restrained green coloration.
- Scoped lint and whitespace pass.
- All-five-style near-ground depth readback passed in the initial browser batch.
- Final prepared desktop1280×900/High and phone390×844/Low gameplay-scale/HUD
  renders passed7.0s. Normal zoom15, actual renderer/world generator, a saved
  production layout and procedural Fighter; not connected gameplay.
  Artifacts: /tmp/eidolon-verdant-worn-stone-0929.

Inspected both viewport compositions during the pass and final phone image.
Stone is more legible and neutral; this is not final modern-ARPG art approval.
Room architecture still lacks richness, and objective-crown triangles remain
conspicuous. The root/threshold and floor-mark structure still looks procedural.
No new FPS, physical-phone, gameplay pacing or dungeon-clear claim.

Reuse the prior connected route/collision evidence for unchanged navigation;
no new campaign or route run this turn. Continue town paving/roadside framing,
room architecture/objective presentation and the wider ordered roadmap.
Pending1.39/1.40 owner decision remains unassumed.
