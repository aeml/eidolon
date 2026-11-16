# Alpha 1.0.63 — Guardian Roar native purchase gate

Normal CI34658209958 on0a871da0 ended in failure at23:59 UTC September11.
Hosted client/server and all104 anonymous browser cases passed. Native gallery,
Well Rested rendering and the opening dungeon batch passed; Guardian Roar's
FTR_38 rank5 purchase remained at4. The generic retry reused the saved branch
and failed trying to select it again. Neither deployment ran. Independent public
checks on September12 still found both domains healthy on62/0231c948.

Original sanitized artifact: `/tmp/eidolon-release63-roar-failure-Z9hLzj`.
Instrumentation-only2d2fba75 reproduced the original error in native System
Chrome run50229 (24.3s): ranks FTR_10=5/FTR_33=5/FTR_38=4,6 points remaining,
pending=null, feedback="message rate limit exceeded". The retained screenshot
was inspected. This is a rejected purchase, not lost accepted training.
Archive: `/tmp/eidolon-release63-roar-repro-evidence-a86wop`.

Correctionfafd2434 waits for the resolved purchase before checking its rank.
An unchanged rank can be retried only after proving unchanged points, visible
rate-limit feedback and enabled controls, followed by1.1s and a new deliberate
tap. Maximum three attempts. Accepted purchases must spend exactly one point.
No automatic game retry, security-policy change, fixture grant or relaxed final
rank/cast/geometry/login assertion is included.

Native run68939 passed in13.4s (14.6s total) on cleanfafd2434: all fifteen normal
phone purchases, authoritative/attached radii15/16.5/18.75/20.25, trained Low and
High after fresh login. This run needed no rejection retry; the earlier failed
run proves the original rejection, not execution of the new retry branch.
Credential scan passed with zero sanitizations; temporary services were removed.
Archive: `/tmp/eidolon-release63-roar-accepted-NHbL4k`.
Logs: `/tmp/eidolon-release63-roar-{repro,green}-20260912.log`.
Full lint passed (44665); exact browser partition104 cases passed (66851).

Only the Guardian Roar native test and this document differ from0a871da0.
Existing63 patch notes, versions and gameplay source remain unchanged. Full
normal CI and independent live identity checks remain required; this focused
pass is not deployment acceptance. Later protection/Focus/Teleport development
is not in this correction. Soak remains cancelled; full1.1–1.10 remains open.
