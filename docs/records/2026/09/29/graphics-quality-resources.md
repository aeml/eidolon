# Graphics quality: correct shadow targets and GPU resource ownership

While reviewing grounding/shadows, found a concrete renderer transition defect.
The installed Three WebGLShadowMap allocates a PCF target when `shadow.map` is
null, not merely when `mapSize` changes. Eidolon changed mapSize without releasing
the existing target. A real Chrome regression reproduced Medium requesting2048
but retaining the4096 High texture; Low also retained unused shadow/composer
allocations. This is not a proposed new ambient-occlusion effect.

Quality transitions now release obsolete shadow targets before changing size;
the next normal render creates the correct target. Repeating the same enabled
quality preserves its target rather than reallocating it. Low releases shadow
targets and postprocessing resources instead of only skipping their draws.
Returning to Medium/High reconstructs the existing pipeline, including bloom,
FXAA and output conversion, with unchanged regional settings.

EffectComposer disposes its own buffers/copy pass but not added passes. Cleanup
now explicitly releases those passes once, including partially constructed
pipeline members, and is used for setup failure/reinitialization and renderer
teardown. Replacing lights releases the previous shadow targets too. Default
phone postprocessing/shadow policy is unchanged; no new visual effect, texture,
shader, gameplay, movement, reward, save or server behavior was introduced.

## Verification

New regression inside the existing terrain-polish browser file failed before
the change with `{quality:medium, requested:2048, allocated:4096}`. It passed
afterwards in5.0s across High→Medium→Low→Medium→High→Low→High plus a repeated High.
Asserts real target dimensions, absent Low buffers, reconstruction, lower Low
texture count, stable counts on repeated cycles and no churn on repeated High.
The existing animation-browser command already includes this file; no new CI
job or long soak. Evidence: `/tmp/eidolon-quality-transitions-before-0929` and
`/tmp/eidolon-quality-transitions-after-0929`.

17 focused graphics-resource, shadow-coverage and frame-stat checks passed
in1.516s. Covers pass de-duplication/partial cleanup, replacement/teardown,
resolution invalidation, repeated quality, and retained phone policy. Scoped
lint/diff passed. This verifies resource/setting behavior, not final visual
acceptance, physical-phone performance or a campaign playthrough. Recreating
effects when leaving Low may incur normal allocation/compilation work; no
unmeasured stutter-free/FPS claim. Runtime version and release gates unchanged.
