# Alpha 1.0.40 — transient combo observation repair

CI `34150633216` passed client/server tests but failed its anonymous browser job;
all deployment jobs were skipped. The public release remains verified 1.0.39.
The 390×844 composition test, including its retry, obtained an empty computed
`pointerEvents` value between measuring the combo label and inspecting its style.

The production notification explicitly uses `pointer-events: none` and removes
itself after 1.8 seconds. The old test performed separate browser round trips
against that short-lived element. The corrected test creates the actual label
and captures connected state, geometry and computed hit policy in one browser
task. It also requires positive height. Normal expiry, subsequent party/chat
taps, camera invariance and all existing layout assertions remain intact.
There is no runtime style, timeout, production behavior or patch-note change.

Three repeated passes across all three phone sizes complete **9 checks / 1.6m**,
log `/tmp/eidolon-release40-combo-observation.log`. The final portrait combo image
is inspected: the actual Mass Revival label remains readable below the encounter
and above the touch actions, with permanent chat visible. This is browser-emulated
phone evidence, not a physical-device sign-off. Version/default/fresh-route
contracts pass **222 / 2.458s**, log
`/tmp/eidolon-release40-combo-contracts.log`. Both owned handles are closed.

Retain the failed source branch. The correction is a fast-forward from published
40 on `release/40-with-combo-observation`, not root/master. Its new full CI and
exact live checks must succeed before publishing 41. Carry the same test-only
correction forward into each later queued version without releasing them early.
