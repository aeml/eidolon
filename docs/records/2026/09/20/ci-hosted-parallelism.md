# Hosted CI scheduling — September20

Prepared locally for the next normal publish; do not trigger another full
deployment solely for this scheduling change. Running1.9.20 CI35481615306 uses
its original committed workflow and is unaffected.

The anonymous browser jobs each install their own Node dependencies and use the
local static server. They download no Go/Jest outputs and need neither backend
build nor their coverage artifacts. Previously all three waited for both unit
jobs: in35481615306 Go started01:31:40UTC and finished01:41:08UTC; browser shards
started01:41:11–13UTC. That is roughly9.5minutes of avoidable critical-path wait
on this successful run, not a promise of identical savings on every release.

Remove only that hosted dependency. The scarce native `predeploy-character`
job now explicitly requires Go, Jest and the complete browser matrix (the same
gate previously enforced transitively). `release-inputs` still requires native
QA, and both publication jobs still require all hosted jobs plus release inputs.
No tests, browser stages, race checks, backup checks, artifacts, permissions,
branch conditions, runner labels or concurrency locks are removed or relaxed.
Failing unit jobs may now overlap hosted browser work already underway; that
tradeoff reduces successful-release latency without adding native contention.

41 focused partition/runner/workflow checks pass in4.346seconds, plus lint/diff.
Future CI timing is still unmeasured. No broad local browser replay is necessary
for a scheduling-only change with the existing test list unchanged.

## Balance the existing three browser jobs

Read-only logs from successful1.9.19 CI35474533396 show stage seconds:

| Original partition | Layout | Entrances | Effects | Supplemental |
| --- | ---: | ---: | ---: | ---: |
| 1 | 204.1 | 251.7 | 163.4 | 58.2 |
| 2 | 120.9 | 118.4 | 82.7 | 117.2 |
| 3 | 128.3 | 85.3 | 72.5 | 0 |

Partition1 was consistently heavier, so assigning it to the same job for every
family stacked the longest groups together. Keep layout partitions1/2/3, rotate
entrances2/3/1 and effects3/1/2 across workflow jobs1/2/3. Supplemental checks and
job-specific evidence paths stay unchanged. This predicts roughly453/487/463
seconds of test work instead of677/439/286 from that one run; it is an estimate,
not a measured speedup or a changed timeout. Cloud-host variance still applies.

42 focused tests pass in4.652seconds, with lint/diff passing. Actual Playwright
discovery (`verify-browser-smoke-partition.mjs`, no browsers launched) confirms
the exact129-case baseline union, no omissions or duplicates after rotation.
Every worker remains serial within its own runner. Hold this with the parallel
hosted-start change for the next normal publish, not another deployment now.
