# Casino round experience candidate

This isolated candidate implements the October19 casino requirements across
roulette, baccarat, blackjack, poker and all four elemental slot themes. It is
not a deployed release or final acceptance of the owner's quality target.
Alpha1.79.82 remains the last publicly verified release; the reader-key
correction to prepared83 must pass and deploy before another release is sent.

Roulette now has one persistent European wheel, coloured pockets, a visible
orbiting ball, a close-up during the spin, and a decelerating bounce into the
server-confirmed pocket. Repeated polls do not restart the animation. Reopening
a finished round shows the saved outcome directly. Skip and reduced motion
stop the presentation without guessing a result or changing the shared clock.
Leaving, changing the table/currency/reader/seat or disposal retires motion.

Baccarat has a wider two-hand stage, visible scores, shared card faces and
individual public card reveals. The server exposes only already-dealt cards
through a separate public projection, without revealing the winner or future
cards. The saved complete result and payout projection retain their original
settlement boundary. The slow floor poll would group cards together, so the
one-second house timer now sends only changed public presentations to currently
seated house-table players. It never holds the house/session locks while
looking up recipients or sending their views. Each card needs no database write
and causes no additional draw, wager or settlement.

Recent house history contains up to40 completed shared rounds, including zero,
ties and losses. It is saved in the existing durable table record when the next
lobby replaces the completed round. Both the completed view and the next lobby
show the same result exactly once; process-cache loss cannot erase it. History
is specific to the physical table and its currency, not manufactured per-player
wins. Baccarat uses a six-row bead display with readable accessible scores.
Past results are descriptive; no odds or prediction is implied.

House controls add chip denominations, visible amounts on selected spots, undo
for unconfirmed chips and manual slip reuse. Reuse only copies a draft; explicit
confirmation is still required to spend. Currency/table/reader/seat changes
clear reuse custody. Existing single-click betting, pending fences, limits,
rejection acknowledgements and durable transfer validation remain in place.

The whole suite shares original brass/ink/felt styling, focus states, card
faces, clear round phases and existing sound cues through the game's audio
settings. Blackjack/poker turns, private cards, costs, split/side-pot rules and
settlement are unchanged. Phone/landscape spacing keeps win panels, hand totals
and clocks apart. Slots have realm-coloured stages, staggered existing reel
stops, an optional skip for a known saved result, and per-stage paying-line
inspection. Inspecting a line only changes presentation. Saved bonuses and
free spins, stop/auto limits, manual paid play, result net amounts and voluntary
play controls retain their authority and behavior.

Private qualification is retained under `.qa-casino-experience/` in the owned
casino worktree. The current evidence includes257checks/13client suites,
23browser cases with no retries/flakes/skips in Chromium149.0.7827.55, and
focused server/Mongo history, privacy and payout tests. Browser setup uses
prepared UI/public projections rather than earned money or a connected venue;
the separate real-socket/restart qualification also passes for shared Gold
roulette and EP baccarat. It exercises two guests, duplicate bets, departed-player
settlement and fresh-process wallet recovery; the completed public view must
include the same saved round in recent history. All house tests pass against
the disposable database with zero skips in that final run (134.1seconds).
A final three-size roulette pass covers the smooth close-up/launch refinement.

Retained failures include a first local browser setup that failed to preserve
the selected browser for per-file launch overrides; the helper now honors the
explicit browser. Early phone blackjack and landscape hand/clock overlaps were
fixed in product CSS, without changing assertions. The initial real-socket
fixture used a binary whose health identity did not match its filename; its
server started normally but the readiness helper correctly refused that build.
The corrected fixture supplies the required build identity. No gameplay clock,
performance budget, money rule, failure recording or successful count was
relaxed to pass these checks.

Further work includes reviewing motion and audio in connected play, checking the
final public artifact/deployment, and assessing the complete casino experience
against the owner's higher quality target. These tests do not establish human
listening, physical-phone review, casino art/performance acceptance, or the full
beta-readiness goal. Soak/stress remains deferred.

## Further refinements awaiting browser review

The working follow-up keeps roulette history at its newest result on opening
and follows appended results only while the reader is already at the end.
Scrolling back remains under the reader's control; leaving cancels its queued
layout work. Blackjack and poker decorate newly visible cards with a short deal
animation, while same-hand polls, hidden cards, reduced motion and reopened
hands remain still. A bounded pot area keeps multiple side pots from spilling
into the shared clock. These refinements still require browser review.

A separate slot regression shows that an older ready snapshot can rewind a
newer saved spin, including after unavailable/saving feedback. Three new cases
fail before the correction. A machine/currency/seat-scoped highest saved revision
now keeps the newer result while allowing current saving/unavailable feedback;
only a matching/newer ready snapshot restores paid play. It does not change a
server revision, wager or result. The slot/play-integration group passes56checks.
Real-controller phone/landscape and final animation browser reviews are prepared
but intentionally deferred while the prior release's CI is using this runner.

## Large movable windows and reference popups

The additional owner requests remove disclosure/triangle sections from all
casino game windows. Rules move into the real controller's top bar; rules,
inside roulette bets, spin breakdown, auto settings and visit options use
separate contained native-dialog popups with close/Escape/focus handling.
Opening rules or spin details stops unstarted slot auto-spins. Reading never
changes a funded round's server clock. Slot references no longer push the
primary stake and Spin action down the control panel.

The game window occupies most of the viewport. Its top bar supports pointer
dragging and keyboard movement, remembers positions through UIManager's shared
presentation preferences, clamps after resize and participates in the existing
reset command. Popup top bars are also movable and remember their placement
for their UI lifetime. Closed popups are created off-document until opened;
leaving or disposing closes them and releases all owned resize/drag listeners.

The updated popup/layout group passes280checks/16client suites, including
window clamping, keyboard position memory without erasing bag coordinates,
popup focus restoration and teardown, table ordering and all game controls.
Changed JavaScript lint passes. The new sizes, contained slot stage and actual
controller/header/Rules/drag/phone behavior still need fresh browser review.
The earlier23browser cases qualify the prior prepared layout, not these new
window dimensions. The eight controller/phone cases and revised game/browser
checks are prepared but not run while release83CI is live.


The final review fixture now covers all five actual controller windows at
320×740,390×844,844×390 and1440×900 (20cases), including majority-screen bounds,
Rules/reference containment, no disclosure sections, Escape without a leave
request, desktop top-bar drag and remembered position on reopening. These cases
remain prepared, not passed, while release83CI is live. The current master
reader correction has been ordinarily merged into this isolated candidate.

A small follow-up keeps poker Rules available during synchronization while all
funded controls remain disabled, and refreshes roulette's selected chip/cost
hint after stake shortcuts. Its focused house/poker/browser-plan group passes
58checks/three suites with lint. The first invocation included a nonexistent
suite path and an old assertion that also disabled Rules; that failure is
retained. The corrected assertion still requires every funded button to remain
disabled. Resetting a retired history view also clears its reader-follow scope,
so reopening starts at the newest saved results.


Prepared84now has synchronized client/server/container/deployment defaults and
519cumulative notes; all518prior entries compare byte-for-byte equal to master
d2. Version/history qualification passes392checks/two suites. An initial check
correctly caught the deployment workflow's old version string; its retained
failure is corrected in the isolated candidate. This preparation is not a push,
deployment or acceptance, and83must be verified first.

The roulette board now groups dozens, outside choices and columns, with familiar
1–18/19–36 and1st/2nd/3rd12labels. Red/black outside spots retain distinct colours.
All choices still use the supplied server catalog identities. House/round
qualification passes28checks/two suites with lint after that display-only change.


Outside world clicks now dismiss a seated game through the existing leave
request, preserving its seat token and blocking movement until the server's
release arrives. Confirmed wagers still settle normally. The controller/play
integration group passes62checks/two suites with lint. Phone and landscape
windows retain the92%size as well, leaving actual room to drag rather than
clamping a full-viewport window to a single immovable position. The pending
20-case browser review now requires vertical drag at compact sizes too.

The world-dismissal guard also accepts the existing mobile touch callback,
which supplies coordinates without a mouse-button field. Both mouse and touch
keep movement locked until seat release; the focused group passes63checks.
All changed JavaScript passes lint after the final control/compact-layout edits.
