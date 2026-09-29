# Bastion woodland edges and Low foliage detail

Connected travel and desktop captures showed that most woodland stood outside
the road's normal camera corridor. Added61 authored trees in staggered small
stands along both sides, retaining junctions, clear road shoulders and combat
space. The first22-tree layout still read as isolated props and was expanded
with outer companions. All330 established tree positions, rotations, scales
and trunk IDs remain byte-for-byte unchanged; a regression hash checks that.
The shared forest-floor mask follows the added canopy automatically.

New trunks use the existing local walking collision, server spawn-exclusion
and administrator-landing contracts. Generated exports contain exactly61 added
trunks and no removed geometry. Existing inside-trunk movement recovery was
checked for all391 trunks/four directions, plus server movement acknowledgments.
No save rewrite or town teleport. This does not introduce a new authoritative
overworld tree navigation/line-of-sight system; those policies are unchanged.

Low keeps every tree and leaf location but simplifies each small leaf/needle
surface, approximately halving crown triangles. High/Medium geometry remains
unchanged. Shared geometry switches in place on quality changes, retaining
instance transforms/materials and recalculating bounds.32m tree cells replace
64m cells to reduce the enlarged stands' off-screen rendering work. This costs
more draw batches/buffers; spatial appearance comparisons retain the same image.

Integration inspection also found that the world builder was constructed before
saved graphics preferences were applied. The settings binding now synchronizes
current/future world builders with initial and later quality choices, avoiding
High foliage construction when the renderer has already selected Low.

## Verification

31 focused final client checks passed across two selections (5.926s/29.093s).
They cover original placements, paths/hazards, generated parity, all1564 saved
position escapes, High surface identity, Low silhouettes/cost and live quality
switches. Selected server population/landing/movement tests passed0.454s.
Both generators' check modes, scoped lint and whitespace passed.

Final High/Low populated-world captures plus the spatial-batch appearance test
passed47.3s. Inspected desktop road framing and Low turn. Actual disposable
touch travel and Bastion entry passed about1.1minutes; inspected its road view.
The route uses QA level100, not earned campaign pacing or a dungeon clear.
Credential scan passed; owned containers/data were cleaned up. No campaign soak.

Sample scene counters vs prior road captures (draws / triangles):

| View | High before → final | Low before → final |
| --- | --- | --- |
| Woodland |199 /186270 →277 /288034|96 /93101 →111 /81501|
| Junction |176 /137817 →245 /236597|88 /54419 →96 /59957|
| Turn |196 /172805 →219 /209457|95 /80074 →100 /75338|
| Grove |223 /273362 →227 /251414|98 /86914 →100 /71388|

The first dense64m woodland view submitted338176 High triangles; tighter cells
reduced that to288034 without removing trees. High woodland/grove still exceed
the250k triangle target; budgets are not relaxed and there is no FPS claim.
The landscape remains too flat/uniform for final modern-ARPG acceptance.

Evidence:`/tmp/eidolon-roadside-stands-final-0929` and
`/tmp/eidolon-roadside-route-0929-t3eA29/route`. Earlier visual iterations are
in `/tmp/eidolon-roadside-woodland-0929` and `/tmp/eidolon-roadside-stands-0929`.
No runtime bump, deployment, earlier gate waiver or final art sign-off.
