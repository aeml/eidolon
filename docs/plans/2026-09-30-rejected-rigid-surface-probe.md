# Rejected cross-surface pivot extension

Do not merge this experiment into the release branch. It extends the accepted
local6faff8d1 common-pivot implementation with nested item meshes and diffuse
color normalization across constructor-compatible materials. The independent
appearance comparison preserves21poses eachquality, all triangles and exact
stealth.301functionalchecks5.339s and twoChrome cases15.1s pass. High maxmean
.000933333/changed.000007937, Low.000525397/.000004762. Idle High calls
468→212/478→200/442→202/478→234; Low227→99/232→93/214→94/232→110.

The original owned-material variant reduces actual busy calls2454→2416High
and1288→1269Low, with equal166327/85546triangles, but frame times regress:
High34.5median/62.1p95ms and repeat39.6/84.3,31/50hitches>50ms;
Low30.1/66.1 and repeat26.6/56.2,26/12hitches. Clear-phase timings vary too;
this does not isolate a precise cause. One changed-code follow-up shares the
white color variants with immutable constructor-source lifetime (WeakMap),
instead of allocating per-actor variants.24ownership/stealth checks2.177s pass.
The follow-up50.4s still does not outperform prior plain common-pivot evidence:
High30.4/55.2 and repeat31.4/49.9,16/9hitches; Low23.9/38.2 and repeat24.1/45.8,
0/5hitches. Calls2416/1269; repeatstable345geos/54textures High and344/40Low.
No direct causal conclusion, universal FPS or High-budget acceptance is earned.

Evidence:/tmp/eidolon-1-48-rigid-surface-appearance-0930,
/tmp/eidolon-1-48-rigid-surface-busy-0930 (56.7s),
/tmp/eidolon-1-48-rigid-surface-shared-busy-0930 (50.4s).
Scoped lint/whitespace pass before the shared-material follow-up. Its full
source and tests are archived locally, not pushed or deployed. Return the
release branch to63168425, which retains6faff8d1 and its bounded45.1s
plain-pivot evidence. No further unchanged workload replay is needed.
