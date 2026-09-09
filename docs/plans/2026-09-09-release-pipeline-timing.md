# Release pipeline timing baseline

## Latest completed release — September9, Alpha1.0.53

Rechecked [run34312290353](https://github.com/aeml/eidolon/actions/runs/34312290353),
exactce330b3e2a576d07d159b964563f12f031dff3d5: all ten jobs succeeded.
GitHub timestamps show first job04:46:47UTC through final live completion
06:08:15UTC, **81m28s** (creation to final run update81m32s).

| Stage | Observed elapsed time |
|---|---:|
| Client/server tests, parallel | Server6m35s critical path; client1m35s |
| Browser stage, three required shards | 13m17s span; individual13m16s,2m38s,8m19s |
| Predeploy character QA | 48m25s |
| Backend/Pages deployment, parallel | 32s / 36s |
| Final live release/character QA | 12m17s |

The persistent long stage is the full gameplay gate, not artifact publication.
The browser shards are also uneven in this run; the job-level durations alone
do not identify which individual specs dominate or prove a safe new partition.
This second successful baseline is consistent with51's roughly79-minute gate,
but is not an SLA for recovery58 or the larger expanded campaign. Corrected54
is running under34320477081; its failed predecessor34317808528 is not a timing
baseline for a successful deployment. Existing gates remain intact.

## Earlier baseline — Alpha1.0.51

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

**04:35 update:** the user explicitly approved cancelling the blocking soak.
Revalidated34307306192/head a36d1e7, requested cancellation and confirmed
GitHub TERMINAL CANCELLED. This is not a successful24h soak. No runner,
schedule or workflow modification was made. The formerly queued52finalLiveQA
is now IN_PROGRESS and its matching-release step passed; all remaining final
live stages must pass before53 may be pushed.

Fighter ended successfully, so the primary candidate now wires35 safe timing
stages into the unchanged full required command chain (8b6b1d3). Shell harness
tests cover all35 failure points and retained command arguments/order, scanning
and EXIT-hook behavior. Focused80tests, final37test rerun/lint pass; fullclient
95095 is active. Actual per-route duration measurements still remain required;
the new instrumentation is unpublished and does not alter the current52gate.

**04:19 queue diagnosis:**52 completed both deployments and both public endpoints
reported exacta36d1e7/Alpha1.0.52 with a healthy database. Final live QA is queued.
The repository runner API reports the sole `eidolon-codex-chrome` runner online
and busy. The active [nightly soak](https://github.com/aeml/eidolon/actions/runs/34307306192)
started04:15:52 and is running the100-client soak on the same required
`eidolon-live-browser` label. The workflow's scheduled default is24h. This is
concrete runner contention, separate from the earlier50-minute predeploy stage.
Asked the player asynchronously for permission to cancel this just-started soak
and prevent future scheduling conflicts. No cancellation or scheduling mutation
has been performed; local gameplay work can continue while approval is pending.

An inactive per-stage timing helper with12passing tests has now been developed
separately in the primary candidate. Integration waits for its currently running
Fighter playthrough to finish; see candidate `2026-09-09-qa-stage-timing.md`.

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
