# Casino table layout and result clarity

Alpha 1.79.86 extends accepted85 at `6d35618229979e24fa9808e242e8200421b71cfa`.
It has not deployed. Original source `ddbd001ca` failed
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
