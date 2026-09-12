# Alpha 1.0.63 — native Spin purchase gate recovery

Normal deployment 34655698173 on 89d9e145 failed its required predeploy gameplay
step. Hosted client/server and all three browser shards passed, as did the
native High/Low animation gallery and Well Rested rendering/lifecycle checks.
Deployment did not proceed; the public client/backend remained healthy on
Alpha 1.0.62 / 0231c948. The soak remains cancelled.

Executioner Spin's native test reached ranks 5/5/4 before timing out waiting for
the final FTR_38 rank. Its generic test retry then hit the already-selected
branch on the same saved fixture. That second error did not explain the first.
Original artifact: `/tmp/eidolon-release63-predeploy-failure-KG87B3`;
log: `/tmp/eidolon-release63-predeploy-failure-20260911.log`.

Instrumentation-only 5cec7780 retained the failed purchase receipt and screenshot.
Fresh isolated System Chrome run 33930 reproduced the first failure: FTR_38=4,
6 points remaining, pending=null, feedback="message rate limit exceeded".
The screenshot was inspected. This was a legitimate rejection with unlocked
controls, not missing talent training or an accepted purchase lost by the UI.
Reproduction archive: `/tmp/eidolon-release63-spin-repro-evidence-Xfnku1`.

Test correction 5d58dbd5 now awaits the purchase response. If a rank has not
advanced, it requires the unchanged rank and point balance, visible rate-limit
feedback and enabled button before another deliberate tap after 1.1 seconds.
It allows at most three attempts and retains the original final-rank, cast,
radius, quality and fresh-login gates. Failures retain their receipt/screenshot.
There is no automatic game retry, raised admission limit, resource grant,
weakened rank expectation or gameplay/server change.

Own native run 93676 passed in 15.4 seconds on clean 5d58dbd5. It actually took
the FTR_38 fifth-rank rejection/recovery path, then verified all five ranks,
accepted radius 8.1 and attached ring in Low and in High after a fresh login.
The untrained and intermediate 6 / 6.6 / 7.5 radii remained checked. Artifact
credential scan passed with zero sanitizations; the isolated services were
removed. Full lint passed. Logs:
`/tmp/eidolon-release63-spin-{native-repro,native-green,lint,partition}-20260911.log`.

Only this native test and this evidence document differ from the already
full-regression-tested 89d9e145 release source. Existing 1.0.63 player patch notes
and version identities are preserved. Normal CI must rerun all required stages;
this focused pass is not full-predeploy or live acceptance. Later development
Teleport/party/other roadmap changes are not included in this correction.
