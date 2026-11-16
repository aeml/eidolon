# Alpha 1.79.63: updated Bastion moving integration review

Accepted runtime `dc9e686b8215f11b507d8b90d203f529d407be3e`; documentation source `c42d2c2be15a8ba171c87fb929e0df9b6989c0d7`.
The delivered 61/62 doorway, masonry, cap courses and roots postdate the original 59
moving review. This observation checks their current moving integration; it is
not a repeated attempt to clear the earlier route FPS failures.

The existing actual native fixture passes on the production-compatible **flat-v1**
profile: one prepared level 30 Fighter, fourteen real equipment slots, normal
ground-click movement and the actual HUD. The town → gate → Earth road → woodland
→ Bastion approach route takes 48.93 seconds and records 458 frames
and 49 grounded/alive/fourteen-slot observations. Route frame-budget profiling is
explicitly off. Instantaneous debug overlay readings are not performance proof.

Bastion/woodland endpoint PNGs and three consecutive final movement frames were
inspected. The current stone courses, bevels, supplied equipped Fighter and entry
hint remain readable in motion. The broad foundation still reads as a single
rounded slab, consistent with its single extruded polygon in
`src/art/BastionArchitectureGeometry.js`. Site-specific bonded foundation blocks
are the next concrete construction question. Preserve the shared Abyssal default,
original collider/entry bounds, materials/draw counts and original profile budgets.
Root silhouettes, terrain composition, repeated plants and broader final world
art remain unfinished. This review is not final owner art approval.

After travel, the unchanged four-class socket-party fixture continues through
normal invitations, three authenticated socket peers and its explicit private QA
encounter waypoint. Independent supplied rigs and preserved fourteen-slot saves
pass under Go race checking. This is one renderer; the alternate four-renderer
case is skipped. It does not establish independent peer input, an earned trip,
intentional combat, a dungeon entry or a campaign clear.

Its ancillary ordinary 180-frame party sample is restored and fully visible:
median / p95 16.7/33.3 ms, peak 256 draws /
201021 triangles, stable 96 entities and zero character-preview frames.
Preparation jobs decline from 33 to 0.
These fresh scoped observations do not erase original 59 cold/route failures or
prove a paired improvement, whole-world or physical-device readiness.

The Go-race invocation completes in 75.98 seconds; browser evidence records one pass/one
alternative skip with zero retries. Actual Chrome 153.0.8010.36 uses AMD RADV
Vulkan. No soak, production account change, terrain activation or beta declaration.

Private evidence root: `/home/aeml/.local/share/eidolon-master-20261011/.qa-world-art63`.
`review.json` records exact scope/findings; `sanitized.json` records the four-account
credential scan. Automatic trace/video were off; synthetic labels in HUD image
pixels are not claimed redacted. Frozen 477-entry inventory
`evidence-inventory.json`, SHA-256 `6d8b5d4fedbabad341ceba216907ca95bd05c4a1a583feb34e9525a57c8efa6b`. The disposable compiled ELF is
excluded. Full original scope and budgets remain active; human pacing,
physical-phone feedback and soak/stress remain deferred.
