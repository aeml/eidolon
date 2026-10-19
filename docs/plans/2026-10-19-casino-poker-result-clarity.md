# Poker side-pot result clarity

This isolated follow-up extends source `6d3561822`; it is not part of pending
Alpha 1.79.85 and has not deployed. No release version has been selected for it.

A player can win a small side pot while losing money across the hand. The old
presentation celebrates every won pot with a win sound and YOU WON banner,
including break-even or losing cash-outs. The completed-hand summary omits the
relationship between the return and the buy-in. The final four-case probe uses
three legal all-in buy-ins, whole 100-Gold / 10-EP increments, and actual card
rank order: C's aces win the main pot, A's kings beat B's queens in the side pot.
Old source `6d3561822` produces four unexpected celebrations; corrected code
passes all 24 focused checks. The exported old module is restored to the exact
fixed bytes after the baseline. Baseline4 source/test hashes are retained.

The first simplified two-player fixture and the next conserved-funds fixtures
remain retained. The latter left unspent chips behind a smaller commitment and
used EP values below the legal increment. They do not establish a legal complete
hand and are superseded by the explicit all-in counterexample. Their assertions
and failures are not erased or relabeled as gameplay evidence.

The candidate adds the saved return, original buy-in and net profit/loss to the
completed-hand summary. It plays the win celebration only for a known positive
net with a won pot. Missing buy-in data never implies a zero buy-in or invented
profit. Settling, saving, currency ownership, cards and server payouts retain
their rules. Existing profitable-hand feedback remains covered.

The focused suite passes 24 checks in one pinned Node worker; changed JavaScript
lint passes. Eight browser cases are prepared for Gold/EP at 320px, 390px and
844px with 125% phone text, plus 1440px desktop. Each checks losing, even and
profitable outcomes, readable complete summaries, no horizontal clipping and
correct celebration/cue behavior. A newly observed Baccarat screenshot overlap
also has prepared spacing/card-face regressions, with its CSS redesign still
unapplied pending the original browser baseline. The combined planned source
qualification has 23 cases, including existing deal/history, phone keyboard/
placement and positive card-result checks. Twelve actual compiled-engine cases
are prepared separately. Browser and copied-publication qualification have not
run: local compiler/browser/archive work waits for all repository
workflows to be idle. No next release precedes accepted 85 deployment.

Private reports and continuation are under `.qa-casino-experience/poker-net-*`
in the owned casino worktree. These prepared projections do not establish earned
play, physical-device, final owner casino assessment or whole-game readiness.
Soak/stress remains deferred.
