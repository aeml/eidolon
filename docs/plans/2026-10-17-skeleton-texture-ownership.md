# Skeleton experiment: texture ownership attribution

The earlier skeleton-reuse experiment remains unselected. Its original native
three-case failure, 140 exact pose comparisons, mixed CPU windows and frozen
75-file packet remain unchanged. The original resource assertion reported four
extra active textures but counted only non-retained skeleton bone textures.

A new software diagnostic routes the independently reviewed color-discovery
correction into that isolated experiment. It observes texture registration and
disposal, correlates disposal with the actual geometry and labels retained bone
textures by identity. Hooks run only during rendering or disposal, preserving
asset/equipment preparation. The first broader observer fails the fitted-surface
precondition before producing texture data; its eight-file packet is retained,
SHA-256 `876fd0c0b560653668f18ece5b3b4b51cdfdefdc7e563069865476304f6ea12f`.
That failure does not classify any textures or pass the case.

The scoped diagnostic reaches all six cohorts. At every allocated/released
checkpoint, registered texture counts differ from the actual renderer counter
by the same 16 static textures initialized before observation. Four textures
retire per cohort, each a two-target `DataArrayTexture` disposed by a temporary
Fighter, Rogue, Wizard or Cleric body geometry. These are blink morph textures;
they are not bone textures or an observed leak. The old bone-only counter is
zero, correctly describing bone textures but incompletely describing all
temporary GPU resources.

The four measured cohorts use original covered bodies: each array is
8192 × 6 × 2, with 1,572,864 backing bytes; the cohort total is 6,291,456 bytes.
The two warmups already mix compact prepared Fighter/Wizard geometry with
original Rogue/Cleric geometry, totaling 4,456,448 backing bytes each. These are
exact CPU backing-array sizes, not measured VRAM. An initial read-only classifier
incorrectly assumed all six cohorts used full source dimensions; correcting that
assertion required no browser/test replay. Existing `PreparedGeometry` already
compacts derivative rows; no new compaction implementation is claimed.

The diagnostic case still fails its original exact pooling assertions. Its
geometry warmup is incomplete, and a bone-only texture assertion would also miss
the identified morph textures. This attribution does not turn that case, the
original native cases or the old CPU comparison into passes. The scoped
14-file packet is frozen, SHA-256:
`79dae6e19b6d59379fc01a321416678f6235d6beee216d6759e9aaea60a664b5`.
Private evidence:
`/home/aeml/.local/share/eidolon-fitted-skeleton-review-20261017/.qa-skeleton-texture-census`.

The [hidden-actor color-batch investigation](2026-10-17-hidden-actor-color-batches.md)
separately identifies and corrects the three extra Fighter eye submissions in
the old comparison. Before a new native cost review, both arms must finish their
preparation queue, pooled originals and prepared paths must be warmed explicitly,
and resource accounting must classify morph textures as well as bone textures.
Keep the original pixel, draw, triangle, retirement and predeclared CPU criteria.
A changed-source review is justified by these specific corrections; an unchanged
favorable-timing replay is not. No skeleton-reuse runtime is selected here.

Full game/world/art/audio/performance/device/operations/owner/beta/1.99 work
remains active. Human campaign/phone feedback and soak/stress remain deferred.
