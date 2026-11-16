# Release 40 — Forge QA pointer readiness

CI `34156520169` for `e7a07b6` passes client/server/browser smoke and the
preceding predeploy gameplay routes, including the corrected Lunge. Forge QA
then fails to open: the player has walked to (-33.245,229.402), outside the
six-unit range of the Forge at (-28,218), with no pending interaction. The
helper clicks a projected coordinate without waiting for camera settlement or
verifying the actual hover target. Its retry independently fails by attempting
to register the first attempt's already-created account. All deployments skip.
Failed log: `/tmp/eidolon-release40-e7-failed-ci.log`.

The correction changes only this QA test: wait for the actual idle player and
settled follow camera, project the Forge, move the pointer and verify production
hover before clicking. No direct UI opening, movement grant, larger interaction
range or removed gameplay assertion is used. A retry uses a new account suffix,
preserving the disposable fixture's empty-account-only safety check.

Lint passes. The actual isolated Forge route passes **1 / 14.2s** (test 13.0s),
log `/tmp/eidolon-release40-forge-hit.log`: +1/+10 purchases, both potency ranks,
live costs and selection, saved item and dungeon family choices all pass.
Credential scan reports zero sanitized files and owned cleanup succeeds.
The player runtime is byte-for-byte unchanged from `e7a07b6`; its full local
client/server/anonymous validation remains documented in the Lunge correction.

Fresh public checks after this run return HTTP 200 and exact
`7ddf776ef18caa0763eedeb8d5a0d7f25afdcd4d` / Alpha 1.0.39 in manifest, login,
versioned main and healthy/ready backend. Publish the new 40 test correction,
then wait for all CI/deployment/live checks and fresh exact identity before 41.
No version bump: Alpha 1.0.40 has not deployed successfully.
