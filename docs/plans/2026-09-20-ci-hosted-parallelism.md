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
