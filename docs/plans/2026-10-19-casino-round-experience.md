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
