# Reduce release latency without dropping browser checks

The completed release46 baseline CI34215073108 ran76 anonymous browser tests
in18.6minutes. Its largest file, entrance-visibility.spec.js, took8.6minutes.
Dependency/browser setup was26seconds, so reinstalling dependencies is not the
main cause. Evidence: job102026158713 and the downloaded log
`/tmp/eidolon-release46-browser-baseline.log`.

Use three GitHub-hosted jobs with the existing anonymous npm command and
`--shard=1/3`, `2/3`, `3/3`. Keep one browser worker per job and existing
file-level ordering. Do not move pull-request code to the self-hosted runner,
omit tests, loosen deadlines or relax assertions. Set fail-fast:false so one
failure does not cancel useful evidence from other shards. Artifacts have
distinct shard names. The existing predeploy job still needs browser-smoke,
which means the complete matrix must succeed before character QA/deployment.

The installed Playwright runner's actual CI-mode --list JSON inventories show
28/23/25 cases. Their union is exactly the original76, with no duplicate IDs or
test files split across jobs. Handles9980/55472/1262/86540 completed normally.
An experimental entrance-only parallel declaration did not improve distribution
(all ten cases still landed in shard1), so it was removed; production tests and
their ordering remain unchanged. That second inventory also had exact coverage.

Redistributing the last successful run's observed intervals gives approximate
shard durations10.92/1.99/5.67minutes. This suggests a shorter critical path than
18.6minutes but is not a measured sharded CI result or a promise of threefold
speedup. The longest file remains the floor. Additional hosted-job startup has
a small cost; capture actual runtimes after this reaches a release.

41023 passed13 focused tests in1.145s plus full lint/diff. The additional mode
experiment checks46082 passed2tests/1.237s; its ineffective declaration was
then removed. Final93547 passed13tests/1.151s plus full lint/diff; the entrance
test file is byte-for-byte unchanged. Inheritance into the release47 candidate
and actual sharded CI measurement remain due. No current CI run was canceled
or changed, and nothing is deployed
from this isolated CI-only branch.

The approach follows [Playwright's sharding guidance](https://playwright.dev/docs/test-sharding),
including the difference between file-level and individual-test distribution.
