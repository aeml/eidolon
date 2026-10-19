# Casino table layout and result clarity

Alpha 1.79.86 extends accepted85 at `6d35618229979e24fa9808e242e8200421b71cfa`.
The corrected UI deployed at `4beea1f26d1ae9fab846b6eddaf43fa9ebec0e46`,
but its release is not accepted. Original source `ddbd001ca` failed
[CI39253417949](https://github.com/aeml/eidolon/actions/runs/39253417949): six
existing house-table cases correctly rejected the hidden House dealer label.
That run ends with four successful jobs, one failed job and five skipped jobs;
client 823 suites / 12,815 checks and server/Go/race pass. Hosted reports retain
419 passes, seven existing exclusions, six failures and 144 unrun cases. Both
initial and configured retry attempts fail; these are not flaky passes. No
manual retry or cancellation occurs. Complete new own CI/public verification
remains required.

House games arrange six seats around a shared result-and-clock stage. Labels,
funded stakes, reconnect status, Baccarat hands and the timer occupy separate
content areas, with owned scrolling on short screens. Larger proportional cards
keep the ten-rank index and suit within their faces. Short landscape layouts
place seats on side rails. Scroll padding clears the beveled clipping boundary.
The dealer label stays visible in the controls. Roulette's actual spin uses a
larger foreground wheel and separate clock/skip footer; entering it resets
inspected-seat scroll once, without resetting ordinary polls.

House win messages now occupy the controls, keeping the wheel and Baccarat cards
visible. Roulette's saved positive result celebrates after the known ball's
landing finishes. Skipping/reduced motion exposes a known result immediately;
leaving, unavailable state and a new round suppress stale deferred feedback.
Repeated polls produce one win cue. Maximum straight-up stakes and small wins
remain readable; narrow controls stack the heading, amount and detail. No odds,
server settlement, landing math, animation duration or game deadlines change.

An earlier saved wager is attributed to its original player when the present
chair occupant differs. Both house games reproduce the old missing ownership
caption. The new patron's identity and connection state stay current; wagering
and settlement retain their original owner.

Poker can return a won side pot while the player loses money over the hand.
The summary shows the saved return, original buy-in and net result. A win sound/
banner requires known positive net and a won pot. Missing or zero buy-in never
invents profit. Four legal all-in baseline cases on Node24.18.0 reproduce the old
unexpected celebrations: C's aces win the main pot, A's kings beat B's queens
in the side pot, with conserved whole 100-Gold/10-EP buy-ins and no chips left
behind. Earlier simplified/invalid fixtures and a secondary Node18 baseline
remain superseded evidence, not legal complete-hand qualification. Exact old
exported module bytes were restored to the selected fixed bytes afterward.

Rules popups save their last visible drag position when native Escape or Enter
closes them while the pointer stays held. Both real browser baselines lose 40px
of horizontal placement. User close records the visible position; forced
teardown discards the active drag. No ghost movement occurs after reopening.
Large windows and pointer/touch/keyboard top-bar movement retain remembered
normal/compact coordinates.

The final source matrix passes all 49 cases in 2.2 minutes with zero retries,
failed/flaky outcomes or skips. It includes every original failing house case,
roulette foreground/clock/win timing and maximum-stake labels, Baccarat six-seat
geometry, visible winning cards, reconnect status, Gold/EP poker losing/even/
profitable returns, popup closure during drag, existing deal/history, phone
keyboard/placement and positive results. Screenshot review covers portrait and
landscape roulette wins, plus phone/desktop winning Baccarat hands. Node24
qualification passes 57 checks / three suites, including nine new deferred-win,
skip, reduced-motion and lifecycle cases. Changed JavaScript lint passes.
All 520 prior raw note strings remain identical in 521 entries and 52 lazy pages.
Final release/history/workflow qualification passes 455 checks / seven suites;
six patch-history checks also pass separately after the latest note. The final
exact-commit copied publication at `8bb3340d4c9202866b9d87bbb1eb7f84fbfc5524`
passes exactly 18 current cases in 67 seconds, with zero failures, flakes, skips
or retries. System Chrome153 reports hardware AMD Radeon RADV RENOIR through
ANGLE/Vulkan in all 18 engine checks. Its 530-module bundle is 4,968,872 bytes;
worker, precomputed-index and analytics hashes stay unchanged. Private hashes
and scope are in `release86-corrected-prepush-qualification.json`. New complete
own CI and exact public deployment verification remain required.

Retained failures include the original Baccarat overlap and roulette clock
hit-testing, intermediate grid/card/scroll clipping, native popup position loss,
both wager attribution cases, the four legal poker cases, and two legal Gold/EP
roulette cases where a saved win obscures the still-landing ball. A later narrow
maximum-profit banner genuinely clips; stacking its text fixes the unchanged
full-visibility assertion. No assertion, deadline or prior report is relaxed or
overwritten. The original 43/18 passing sets missed the six anonymous house
checks; they retain their original source and limited coverage. Dealer-only
source `78675ad87` then passes 49 cases. Its copied check accidentally discovers
18 archived fixtures alongside the 18 current cases: all 36 pass, while the
18-count inventory assertion fails as a setup audit. Final discovery explicitly
excludes that archive and lists exactly 18 current cases.

Private hashes, exact old sources and reports remain under
`.qa-casino-experience/` in the owned casino worktree; original failed CI logs
remain in the owned master's `.qa-release86-house/`. Source DOM/browser checks
and copied-engine projections do not establish earned play, physical-device,
final owner casino assessment, performance or whole-game acceptance. No
currency, schema/protocol, server authority or art assets change. Compiler/
browser/archive work requires all repository workflows idle. Soak/stress stays
deferred until feature completion approaches.


## Delivery correction after the deployed run

[CI39260318063](https://github.com/aeml/eidolon/actions/runs/39260318063)
ends with nine successful jobs and a failed live job. Client823/12824 and native
184/2 existing exclusions pass. Hosted reports retain561 passes,14 exclusions
and one flaky privacy fixture: its initial loopback asset GET resets, while its
configured retry passes. Live reports retain nine passes, one exclusion and one
failure; the later party check never runs. Town-rest expiry and reentry gameplay
assertions pass, but a geometry shard GET aborts after1515ms without recovering.
The worker stays alive. Static-delivery evidence retains the exact failed path,
request timing and subsequent successful different-shard requests. Neither this
failure nor the privacy flake is waived; accepted85 remains the baseline.

The selected correction gives geometry shard GETs one recovery attempt for a
transport TypeError or the lookup's own abort. Each attempt retains its1500ms
limit, serialized queue and shared in-flight cache. The unchanged delivery owner
still retires work at30seconds. HTTP status errors, length/hash/decoding errors
and exhausted transport failures remain cached unavailable. Metadata validation,
exact index output, dynamic fallback, algorithm and model data remain unchanged.

The privacy fixture now permits one Playwright ECONNRESET retry for asset GETs
only. HTTP503 stays visible and POST is never retried. A real socket-reset
baseline reproduces the old failure. All five corrected privacy checks pass
without test retries. All eight privacy/static-delivery browser checks then pass
without retries, including a real dedicated worker using the product lookup and
committed shard data: the first request exceeds1500ms, the second returns exact
verified indices to concurrent callers, and the cancellation remains recorded.
The existing browser failure collector reconciles only the successful same URL;
no collection rule or ignore policy changes. Focused unit qualification passes
52 checks/two suites. One intermediate fake-clock test still advances only the
old single attempt; it fails and is retained, then explicitly advances both
1500ms attempts with two abort assertions. No Jest/test timeout is enlarged.

New copied-publication qualification, complete own CI and exact public proof
are required before acceptance. This correction changes the generated worker's
content hash; the older unchanged-worker statement above applies only to8bb.

The exact copied source `dd50b6f935db50108d0829a580e6dfd8dfe6a5ee` now passes all18 current
bundled-engine checks without retries, failures, flakes or exclusions. All18
report hardware AMD RADV RENOIR. The530-module engine remains4,968,872bytes;
its rebuilt worker is `5b1cb28ca70ae0f89f1a65bd6a45173df443d56dd5a781a7f63aabb031fe08a9`.
Precomputed data and analytics remain byte-identical. All455 release/history/
workflow checks pass and all520 prior raw notes remain identical. An initial
unpublished copied build had a wrong source argument; it was rejected before
any browser qualification, and the fresh copied tree above pins the actual
commit. Its setup classification is retained separately from product failures.
New complete own CI and exact deployment proof remain required.


## Reader-cleanup follow-up under qualification

Review while source5c5540fed runs its original CI finds a real stream edge case:
when a native ReadableStream read rejects, reader.cancel() rejects with the same
stored error. Cleanup replaces the transient-error wrapper, preventing the one
bounded recovery attempt during body delivery. A native-stream unit baseline
fails once against the selected source and is retained. The isolated correction
preserves the read error through best-effort cleanup; all53 focused unit checks/
two suites pass. Exact length/hash/index checks and request/owner limits remain.

The browser regression now separately delays response headers and response body.
The body case flushes HTTP200 headers, stalls the payload past1500ms and requires
exact verified output and exactly two requests, retaining the canceled request.
Browser execution and a fresh exact copied publication remain pending while the
original CI uses the shared host. Current5c is not accepted even if its CI passes;
its complete original result and deployment identities will be retained before
publishing a new corrected source. No workflow is retried or cancelled, and no
local browser/build/archive work starts while any repository workflow is live.


## Live route-planner correction and final local checks

Source5c5540fed ends CI39275253270 with nine successful jobs and a failed live
job. Client823/12829, hosted564/14 exclusions and native184/2 exclusions pass
without failed/flaky browser outcomes. Live reports7 passes,1 exclusion and1
failure; later live steps never run. The failure occurs before pointer input:
for the requested(30,-8) town-exit vector, the coarse projector chooses a visible
quarter-step of7.762 units, below the unchanged8-unit planning minimum. The
failed route's static-delivery evidence has zero failures and zero active loads.
Its digest-verified original live artifact and terminal logs remain retained.

A native Three projection baseline reproduces the gap with visible ground up
to8.1 units: the old planner still selects7.762. Minimum-aware planning now
samples the valid interval down to the requested minimum and rejects anything
shorter. Ordinary coarse projections retain their existing behavior. The jump
executor still rechecks the complete destination and requires real Ctrl-click,
directional authoritative movement and landing. No8-unit minimum, arrival,
collision rule or observation deadline is lowered. A real browser HUD/canvas
fixture verifies the same narrow gap and strict full-destination projection;
it is planning evidence, not earned server movement proof.

All80 focused unit checks/four suites and changed-file lint pass. All five
browser checks pass with zero failures, retries, flakes or exclusions, including
the planner and actual header/body timeout recovery. Both delivery cases return
exact verified committed indices to concurrent callers, make exactly two
application fetches and two server requests, and retain the canceled request.

The first body probe returns correct indices but observes three server requests;
that failed report is retained. Its exact extra-request cause was not captured
because the owned attachment originally followed the assertion. Diagnostic
accounting now runs in finally and records application fetches and connections;
a separate native body run passes with two fetches/two requests. The disposable
server now closes connections to keep this timeout probe independent of pooled
socket reuse. The original two-request assertion remains, alongside the new
two-application-fetch assertion; neither the provider limit nor test assertions
are relaxed. The final five-case report passes with that controlled fixture.

The reader-cleanup correction preserves the original failed read through
best-effort cancel(), keeping the1500ms per-attempt and30s owner limits and all
content/index checks. New exact copied-source qualification, complete own CI,
both deployed identities and exact public proof remain required. No game input,
melee/camera rules, server settlement, schema/protocol, models or odds change.

The exact copied source `9d34764040b8f690a9ae2a58e564c4249672aaab` passes all 18 current engine
checks in 1.3 minutes, with hardware AMD RADV RENOIR reported in every case.
Its 530-module engine is 4,968,872 bytes. The rebuilt worker is
`835578df97d6ade3683f781b95caf5aa4fd9b71d047fa5353f7a83798ce0d04a` (179,747 bytes);
precomputed data and analytics remain unchanged. All 455 release/history/
workflow checks pass, and all 520 prior raw note strings remain identical in
521 entries and 52 lazy pages. Both public identities of the unaccepted 5c
source match over normal TLS with the database ready. The qualified correction
now requires its own original CI and exact public verification.


## Trace response capture before worker retirement

Source `eaacf1d0bea2df347d7a204216259f2b620361f6` ends original
[CI39290576738](https://github.com/aeml/eidolon/actions/runs/39290576738)
with four successful jobs, one failed browser shard and five skipped downstream
jobs. It does not deploy. Client823/12833, server checks and the other two
browser shards pass. The body-timeout fixture fails both its initial execution
and configured retry: exact indices and two application fetches pass, but the
HTTP server sees three requests. Original logs and the digest-verified raw
Browser3 artifact are retained, including inline owned delivery attachments.

One local original-source probe reproduces that same failure with SDK-default
Chromium Headless Shell149 and CI trace/video recording settings, with no test
retry. Playwright1.61.1 can use Network.loadNetworkResource when the inspector
returns an empty body for a response with positive Content-Length. The probe
previously terminated its worker immediately upon receiving its result. The
fixture now keeps the worker alive, captures and verifies the complete response
bytes, then terminates it during cleanup. All five focused browser cases pass
with the same headless browser and recording settings, without retries, failed/
flaky outcomes or exclusions. Both recovery cases retain exactly two application
fetches, two HTTP requests, exact concurrent output and the canceled-request
evidence. No assertion or timeout is relaxed and recording remains enabled.

This correction changes only the test fixture. Product/runtime/build inputs
remain identical to qualified9d, whose80 focused checks/four suites,455 release
checks/seven suites and18 exact copied-engine hardware cases remain applicable.
New original full CI, both deployments, live checks and exact public proof still
gate release acceptance. The owner reports that the current casino presentation
“all looks much better now”; full-game/beta and other readiness gates remain
open. Soak/stress remains deferred.


## Match public cache behavior for trace resource retrieval

The lifetime-only correction `d5624ace7858447d6fea786223e6889c0d363b62`
also fails original [CI39295983719](https://github.com/aeml/eidolon/actions/runs/39295983719):
four jobs pass, Browser3 fails and five downstream jobs are skipped. It does
not deploy. Both failed body attempts return exact indices in two application
fetches, but the server still sees three requests. Captured raw-body equality
passes as well. Original terminal logs, the digest-verified raw archive and
inline attachments are retained. The earlier five-case local pass did not
establish hosted reliability; worker lifetime alone was insufficient.

A fresh normal-TLS HEAD of the public committed shard returns max-age=600.
The disposable fixture had no freshness header. A controlled two-case private
CDP experiment explicitly invokes Playwright's Network.loadNetworkResource
fallback command. With no-store it makes a third physical GET; with the public
max-age=600 it returns the same exact bytes from cache while server requests
stay at two. Both cases retain two application fetches, two observed browser
requests and the original canceled-request evidence. Automatic recording is off
only in this controlled diagnostic, so the explicit command is isolated. The
original hosted inspector-empty-body trigger was not recorded directly.

The selected correction adds only the public cache header to the fixture's
shard responses. Full qualification keeps CI trace/video settings enabled,
SDK-default Headless Shell149, exact byte/index checks and strict two-application/
two-server-request assertions. All five focused cases pass, followed by all34
cases in the exact Browser3 layout file group/shard sequence, without retries,
failures, flakes or exclusions. The latter takes4.6minutes in the private
two-CPU namespace; it is local functional evidence, not the hosted runner or a
world-performance result. These browser scopes overlap and are not summed.

Runtime/build inputs remain identical to qualified9d; its80 focused checks/
four suites and18 copied-engine hardware cases remain valid after input-byte
comparison. New original full CI, both deployments, live checks and exact
public proof still gate release acceptance. No request/test/owner timeout,
observer policy or assertion is relaxed. Full-game/beta gates remain open and
soak/stress remains deferred.

All455 release/history/workflow checks in seven suites pass freshly after this
fixture/documentation correction; changed-file lint is clean.
