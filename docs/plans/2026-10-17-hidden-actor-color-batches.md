# Recover color batches after hidden actor preparation

The color renderer cached an empty group list if an actor's first appearance or
an equipment generation was processed while the actor or an ancestor was hidden.
Revealing the actor kept that empty list. A separate initial-stealth path also
missed the existing `appearancechanged` notification when transparency ended.

The candidate defers group discovery while the registered root is hidden and
listens to the existing appearance event. It retains every source/attribute,
material, rig, binding, camera, visibility, disposal and shader eligibility guard.
It neither freezes live transforms nor selects the rejected skeleton-sharing
experiment. Five added cases cover initially hidden roots/ancestors, hidden
equipment generations and actual stealth material restoration. The original four
failures and later one-case stealth failure are separately preserved; unmatched
cases are not counted as passed. All 126 cases in three relevant suites pass.
Full lint and the final changed browser-fixture lint pass.

## Attribution before correction

A new software-rendered census of the earlier isolated skeleton experiment
identifies its three extra Fighter draws: six eye, pupil and iris surfaces were
submitted separately instead of using three existing paired color batches.
High observes 53 versus 56 calls, Low 26 versus 29; triangle counts match.
Instrumenting `renderBufferDirect` changes no mesh callbacks or eligibility.
Both Idle and Run preserve exact observer/restored pixels and submission totals.

Routing only the color-discovery correction into that same private fixture
restores 53/26 calls in both arms. Each quality's two poses retain identical
source/candidate image hashes and triangle counts. These two software cases are
new attribution evidence, not repeats of the failed native timing experiment.
The original three native failures, mixed CPU windows and four unclassified
textures remain intact. Skeleton reuse remains unselected.

First five-file attribution inventory SHA-256:
`b390a67c417a2f960952f00cf74352a419dcc4f170b60c4d3ee751eb86b69ea2`.
Corrected seven-file attribution inventory SHA-256:
`2060ece10c891800de6b620a738b2fd0ebc5796b7a983ca12ffe4b85af5addda`.
Private census: `/home/aeml/.local/share/eidolon-fitted-skeleton-review-20261017/.qa-skeleton-draw-census`.

## Retained-resource qualification

The existing four-class pooling case now prepares all actors while hidden and
requires all three paired Fighter eye batches after reveal, across both body
qualities. Its first software run fails the exact retained geometry baseline:
125 grows to 126 and then 128, with 90 textures unchanged. All six cycles restore
the required eye batches. The original 15-file failure packet remains frozen,
SHA-256 `72b31530f0b5e1caa049f854d29ab50c5219423e4f08a9d00cb28b14bdc67ebf`.

A new allocation/disposal diagnostic preserves that exact assertion and also
fails. Every allocation count matches the renderer counter. The late surviving
geometry is pooled original Fighter eyes/iris; derived color batches retire.
Outstanding preparation jobs are recorded separately. Its 12-file packet remains
frozen, SHA-256 `ea3e058e41374eda7191629529ef2d41246e6a4cd3aef6590b081497eb3f9fc3`.

The corrected warmup explicitly renders both supported original-buffer and
batched/prepared routes for each quality before establishing the model-pool
baseline. It adds no arbitrary repeated warmups and keeps the exact memory
assertion. Four measured High/Low cycles then release to exactly 128 geometries,
90 textures and zero attached actors. Each restores three Fighter eye batches.
The updated existing case passes once in 36.9 seconds using System Chrome with
GPU disabled and SwiftShader. It adds no browser case. This is software-rendered
ownership evidence; native integration remains pending after exact 74 acceptance.

An independent read-only screen of all 512 current actor/equipment runtime GLBs
finds no repeated-index or same-winding duplicate triangles, and no collinear
triangles with equal skin/morph contributions. It writes no models or runtime.
The three-file screen inventory SHA-256 is
`d2ee9b8f6089db431dd56b40c345ed17eed3e2d200225cb3ad6071e72e3d0982`.
Catalog totals are not scene totals; this rules out a cheap cleanup opportunity,
without qualifying a new LOD or closing original geometry budgets.

Private component evidence:
`/home/aeml/.local/share/eidolon-danger-audio-mix-20261017/.qa-color-visibility`.
Combined with the separately qualified warning mix, the next client expectation
is 802 suites / 12,423 cases: accepted-source 801/12,412 plus six audio cases in
one new suite and five cases in the existing color suite. No browser case is
added. Full original world/art/game/audio/performance/device/operations/owner/
beta/1.99 gates remain active. No frame-time speedup, native completion, beta or
feature-freeze claim. Human campaign/phone feedback and soak/stress stay deferred.
