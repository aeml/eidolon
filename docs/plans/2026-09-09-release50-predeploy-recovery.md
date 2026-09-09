# Alpha 1.0.50 predeployment recovery

CI34290705218 on b7b86f51bf7a9ce64a426861846095d3e91aedb4 failed its
predeploy character QA. Go, Jest and all three browser shards passed; deployment
and live QA were skipped. Public frontend/backend remain49/0c6d0cc at00:19UTC.
No successor may publish before the complete50 gate succeeds.

The first opening attempt failed movement near(105.42,148.09). The collision
planner selected(-0.784,8.966), but the movement helper substituted(7.186,9.663)
when the selected screen point was covered. This substitute was never collision
checked. Add an explicit no-alternate-path option for checked Wizard retreats.
Unavailable input still permits fighting; any issued click that fails to move
still fails QA. Default travel and its existing jump alternatives are unchanged.
This fixes a proven helper contract mismatch, not a proven production collider.

Red/green unit proof:3 failures before the change; afterward5 suites/37 tests
pass1.177s, lint and diff checks pass. No gameplay requirements, drops, encounter
deadlines, death bounds or grants changed.

Retry1 finished the opening but failed collection at4/8 seeds with "No visible
Skeleton after bounded ordinary travel". The screenshot actually shows skeleton
models and a jumping player. It does not establish whether they were alive,
hostile, attached and raycastable at selection time. Added bounded read-only
failure diagnostics for those state distinctions. Root cause remains open.
Original artifacts retained at `/tmp/eidolon-release50-predeploy-failure-0019`,
log `/tmp/eidolon-release50-failure.log`. Actual fresh collection rerun is required
before deciding whether this candidate can return to CI. Nothing is published.

## Actual movement reproduction and candidate repair — September9 00:28UTC

Exact6c5059e collection run31536 FAILED: even the sole collision-checked path
failed to move at(170.562,289.334), destination(174.522,297.418), zero measured
displacement, finalIDLE with target still set. No acquisition failure reproduced
in this run. Credential scan and disposable cleanup passed. Log
`/tmp/eidolon-release50-fresh-collection-0023.log` preserves the failure.

Controlled full/delta state replay reproduces the matching client defect:
MOVING with a ground destination -> lateATTACKING -> IDLE strands that target.
The existing prediction guard protected only IDLE and ability-animation attacks,
not ordinary basic attacks. Preserve a manual path once interaction/ability chase
is canceled; retain authoritative chase attacks and use the current snapshot's
Charge flag to override prediction. Death/jump remain authoritative.

Four new full/delta regressions fail before the repair; afterward4 suites/121
tests pass1.831s, including Charge and jump coverage. This is a controlled client
reproduction consistent with the live-input failure, not yet proof of the full
earned route. Added the gameplay fix to50's patch notes. Full client/lint and a
new exact-version fresh collection run remain required. No publication yet.
