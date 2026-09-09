# Release pipeline timing baseline

Measured September9 from the completed successful
[Alpha1.0.51 run](https://github.com/aeml/eidolon/actions/runs/34300606161),
exact55712b9c747056041b05fa4e475c4aee094028bc. Source: GitHub job start/end
timestamps, inspected with `gh run view --json jobs`. This is one release's
observed duration, not an SLA or a forecast for all later builds.

| Stage | Observed elapsed time | Scope |
|---|---:|---|
| Client/server tests | 6m08s critical path | Parallel jobs: client1m53s, server6m08s |
| Browser smoke | 9m35s stage span | Three required shards; not three serial full runs |
| Predeploy character QA | 49m41s | Gallery and disposable full-character gameplay |
| Deployment | Under1m per deployment job | Backend36s and Pages49s, in parallel after input validation |
| Final live QA | 12m20s | Exact release identity and live character checks |

From the first job start01:47:36UTC to final live completion03:06:29UTC:
**78m53s**. Small job transitions/input validation account for the remaining
time outside the grouped spans. Deployment itself was not the long stage.

The active1.0.52 run was in predeploy gameplay when rechecked04:08. Its elapsed
time alone is therefore not evidence of a hang. Keep checking the exact active
job; do not restart it, remove a check or publish a successor solely because it
has taken several tens of minutes.

## Next performance work

Before changing concurrency, collect per-route timings within disposable QA,
including success/failure and cleanup. The job-level baseline cannot identify
which character route dominates. The attempted filtered job-log read provided
no sub-route timing evidence, so no internal bottleneck is asserted here.

Any instrumentation must preserve the original command's exit status and every
required route. Only consider grouping independent routes after proving that
accounts, API/database ports and test artifacts are isolated and that concurrent
Chrome sessions do not break rendering or gameplay deadlines. Retain the final
exact-live gate and ordered per-version publication. Do not rewrite the current
52–57 queue or interrupt its running release to apply an unverified optimization.

The longer expanded-campaign candidate needs its own timing measurements once
its actual earned routes pass; this older release is not a duration estimate for
that new content.
