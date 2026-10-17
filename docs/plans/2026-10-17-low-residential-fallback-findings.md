# Low residential fallback — October 17

Private implementation: `76bed42fdd4a60dc99d5b84da2d7d9d054d7c797`, based on
the combined court/elemental candidate `92241ff1fd5fdd3e91bae08b6af26784c1cfcc1a`.
This candidate is isolated; it has not been merged, pushed or deployed. The
original populated wide-view performance failure remains unresolved.

WorldGenerator previously selected residential per-instance clipping only when
its caller reported native WEBGL_multi_draw. Low browsers without that extension
submitted every home in each visible material bucket. The candidate also enables
stock Three.js BatchedMesh clipping for Low. Three's existing renderer uses an
ordinary draw loop when the extension is unavailable. High/Medium retain their
existing capability policy. Initial town loading and returned worlds share this
WorldGenerator owner; no duplicate GameEngine policy or custom renderer is added.
All fifteen homes, six buckets, source geometry/materials, transforms, collisions,
vegetation and supplied actor/equipment assets remain present.

66 focused checks in four suites pass, covering the actual world policy across
High/Low/Medium and native/missing capability, matching collisions and existing
neighborhood/canonical geometry/instance-return behavior. Scoped and full lint
pass. Three copied-publication native cases pass in 37.2 seconds: High, Low and
Low with getExtension deliberately denying WEBGL_multi_draw before renderer
construction. Each uses the actual bundled GameEngine, supplied fourteen-slot
Fighter, HUD and 24 mixer-pose comparisons. All 72 comparisons preserve exact
source RGB and restored RGB; the six batches and their geometry/matrix/indirection
owners retire exactly once. The same copied engine hash is
`63b013efa62e52f22f59ff3a00866fca9f0e8e46c23b61fb66003a49eb529d39`.
After execution, the final test guard additionally preserves the original High
relative-draw assertion on non-native browsers. Its predicate is identical in
all three observed native cases and was rechecked against their retained payloads;
runtime/bundle bytes did not change and that suite was not replayed.

Two separate populated-town diagnostics deliberately deny multi-draw on native
AMD/RADV. The first compares a private stock batch against the unchanged original
owner. The second exercises the new production Low owner against a source-identical
whole-field reference. Both collect all 24 views × four poses before assertions:
four court views, all fifteen homes, wide/close/edges and a distant origin.
All 96 RGB/restoration comparisons in each are exact. Each also records four
replacement/disposal cycles returning geometry/texture counts to baseline, actual
delivered Ilyra, all fourteen equipment slots without fallback and retired canvas.
These are controlled mixer poses, not continuous movement or frame-time evidence.

The production diagnostic passes original Low limits in all 23 non-wide views.
The four court views peak at 125 calls and 80,106 triangles. At the widest
supported projection it still reaches **191 calls / 94,465 triangles**, above
the unchanged **200 calls / 85,000 triangles** limits. Its same-pose whole-field
reference reaches 173 calls / 115,937 triangles. The requested zoom 60 is clamped
by the existing renderer to its supported maximum 30. Both diagnostics therefore
terminate with a failed triangle assertion; neither is a complete performance
pass. Added visible-instance calls are an explicit fallback tradeoff, not a
measured frame-time improvement. Nothing was hidden and no limit was relaxed.

Closed component evidence: 39 files in the owned tree's
`.qa-low-town-fallback/component-evidence-inventory.json`, SHA256
`98dcd99eca626f5ca57ea48e27b58fab558608a0f88e82d7664553670f82a93e`.
The initial failed eleven-file diagnostic packet is independently frozen with
inventory SHA256 `63f3a91f3d787fe9ddeb620cafc4123f642530ecfdc9866b3aa3ee7dd2a8c291`.
Both manifests exclude processor stdout and unexecuted follow-up files.

At the time this closed component packet was created, a separate initial/settled
diagnostic was prepared, **not executed**. It observes
the existing actor geometry preparation queue and preserves the original limits;
unfinished preparation is only a hypothesis for part of the remaining cost.
Do not overwrite these closed packets, claim that hypothesis as a cause, or call
whole-game performance accepted. Finish that investigation before selecting this
candidate. Exact72 deployment acceptance remains the prerequisite for another
release; the full feature/art/device/operations/owner/beta/1.99 goal stays active,
with human campaign/physical-phone feedback and soak/stress deferred.

## Follow-up software census

The separate initial/settled diagnostic subsequently passes once in 23.4 seconds
on source `c4035ef992937947e1ae7d256b4f3e785f2c5065`, with identical runtime
bytes to76bed42fd. Chrome explicitly disables GPU acceleration and reports
SwiftShader; the native release job keeps exclusive GPU use. This is software
submission evidence, not native/device/frame-time acceptance.

Five initial and five settled court/wide observations compare the production
clipped housing against a source-identical whole-field reference, restoring it
within each observation. All ten source/restoration RGB comparisons are exact;
the equipped actor, delivered Ilyra, scene and content remain present. The initial
gathering view records28pending preparation jobs; the initial wide view records25.
After the existing queue reaches0, it records23installed derivatives and6normal
fallbacks, with no failures or rejected jobs. All five settled views fit the
unchanged200draw/85,000triangle Low limits. Wide records191draws/78,881triangles,
versus its same-observation whole-field reference173draws/100,353triangles.

The initial wide observation records86,345triangles, not the separate native
diagnostics'94,465. Preparation progresses between initial observations; they
are not a fixed entirely unprepared baseline. These are separate mixer resets
and static observation phases, not a paired frame-time benchmark or attribution
of every cross-phase triangle to a single cause. The queue/installed-index
evidence supports investigating preparation cost rather than removing scenery.
Original cold limits and failures remain retained; no runtime preparation change
has been made and no deferred gate is cleared.

Closed software packet: nine files in
`.qa-low-town-fallback/settled-software-inventory.json`, SHA256
`ff255bb6d419c801b79190d652f9079defcd9036b98d0688fa8131b823f4eb20`.
The earlier39/11closed packets remain byte-exact. Native execution of this same
diagnostic is still pending release GPU availability; do not replay software or
change its closed payloads. Candidate selection remains pending that review and
the ordered exact72 deployment prerequisite.
