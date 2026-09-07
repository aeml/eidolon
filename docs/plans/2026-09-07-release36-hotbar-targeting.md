# Alpha 1.0.36 predeployment failure — hotbar target identity

Original candidate: `90e157973178fcd9907a756d8729248b49c312df`.
CI `34110323348` attempt 1 passes server, client and browser-smoke jobs but fails
Predeploy Character QA. Both deployments and final live QA are skipped. Do not
advance 1.0.37 or describe 1.0.36 as live. The last fully verified live release
remains 1.0.35 until new public evidence says otherwise.

The Rogue route accepts Shadow Lunge and moves the player, but its accepted event
and attributed bleed ticks refer to a different enemy than the one deliberately
hovered. The retained CI diagnostic shows `targetMatches: false`, a successful
cast and 69-damage bleed events from the correct player. The retry then expects
Quick Draw rank 1 although the reused disposable save already contains rank 5.
Log: `/tmp/eidolon-release36-ci-failure.log`. This is not an observed network error.

## Reproduction and correction

`performHotbarAbility` supplied only the hovered position to `performAbility`.
That vector-override branch always emitted an empty `targetId`. The server then
used its legal nearby-target fallback; the cast was not bound to the actor the
player had chosen. The corrected desktop hotbar carries both position and entity
identity. Buffered inputs retain the original actor and refresh its position;
an unavailable actor cannot silently become a ground retarget. Self-centered
Spirit Guardians remains independent of a hovered actor's life state. Ground
casts and mobile targeting keep their existing paths.

The first test draft called the wrong buffer method; its failure is retained in
`/tmp/eidolon-release36-hotbar-before.log` and is not a game diagnosis. Corrected
regressions reproduce **3 failures / 1 passing ground control in 1.343s**, log
`/tmp/eidolon-release36-hotbar-before-corrected.log`. After the fix, the initial
target-identity and existing pending-target suites pass **11 tests in 1.794s**.
With the self-cast regression included, the complete local client suite passes
**191 suites / 2,802 tests in 104.11s**. Lint and whitespace checks pass. Logs:
`/tmp/eidolon-release36-hotbar-{after,full-client,lint}.log`. No server source
changes are included. Actual browser/predeployment/live checks remain required;
the ongoing earned Fighter run uses its original root checkout and does not
verify this separate correction.

The actual browser route now checks outgoing target identity, accepted target
identity and attributed bleed on that same target. Its observer records whether
the intended actor was hovered at dispatch. Quick Draw purchases start after the
already-saved rank on retry, still requiring authoritative rank 5 and saved range.
The existing 1.0.36 patch notes gain the hotbar correction; version defaults stay
1.0.36. This corrective branch is based only on the failed 1.0.36 source, not the
later 1.0.37–1.0.40 candidates or the separate critical-talent work.

## Publication constraints

Finish local checks and preserve the correction as a descendant of the published
1.0.36 commit. Its complete CI/predeployment/live gate must pass before 1.0.37.
Preserve the old candidates, then carry the same correction forward into each
queued version while checking ancestry and exact release metadata. Do not push
the root 1.0.40 working HEAD or skip versions to get around this failed gate.
