# Alpha 1.0.38 predeployment chat-focus correction

Original candidate `faf18fd62c60c36cab79ceb565453f3d63d1c3d3`, CI
`34126386286`: client/server/browser smoke pass, but the movement-wall route
fails twice before dungeon entry at `useVerdantQAWaypoint`'s chat-focus assertion.
Neither deployment runs. Retained log: `/tmp/eidolon-release38-ci-failure.log`.
The exact active element was not captured in that CI run; its specific focus
state is not proven retrospectively.

The unchanged game runtime passes the movement route alone (12.5s) and after
the preceding authenticated, beam and ground-spell routes (35.7s + 1.2m).
These passes do not erase the CI failure. New focused browser cases reproduce
three failures in the same helper: Enter submits/blurs an already-focused input,
or activates a focused Game tab rather than opening chat. The close-skills
control passes locally. Log: `/tmp/eidolon-release38-chat-focus-before.log`
(three failures / one pass, 1.0m).

The helper now clicks the ordinary All tab and composer before submitting its
waypoint. It no longer assumes a particular preceding focus state. The four
cases pass in **14.0s**, including an independent Enter-from-gameplay assertion,
`/tmp/eidolon-release38-chat-focus-after.log`. Focus failures still throw and
retain bounded, credential-free active-element diagnostics; no browser errors
or command-result assertions are removed.

Final source `b3b0493` passes **47/47 anonymous checks (3.2m)** and the corrected
authenticated → beam/ground/movement sequence (**three authenticated checks,
then three dungeon checks in 1.3m**). The last movement check passes **15.1s**.
Logs: `/tmp/eidolon-release38-focus-anonymous.log`,
`/tmp/eidolon-release38-focus-final-sequence.log`. Credential scan sanitizes zero
files and disposable cleanup passes. Lint, shell syntax, whitespace and
**212 version/default tests (0.991s)** pass. `src`, `server` and `index.html`
exactly match the original 1.0.38 candidate; only QA and this evidence change.

Preserve the original branch. Publish this descendant as corrected 1.0.38, then
wait for every CI/live job and fresh post-terminal public identity verification
before 1.0.39. Carry the correction into later candidates without changing their
versions or erasing prior notes. This correction is not a full 1.1 sign-off.
