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
