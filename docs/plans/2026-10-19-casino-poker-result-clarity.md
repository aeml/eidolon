# Poker side-pot result clarity

This isolated follow-up extends source `6d3561822`; it is not part of pending
Alpha 1.79.85 and has not deployed. No release version has been selected for it.

A player can win a small side pot while losing money across the hand. The old
presentation celebrates every won pot with a win sound and YOU WON banner,
including break-even or losing cash-outs. The completed-hand summary omits the
relationship between the return and the buy-in. Three-player, conserved-funds
public-projection probes reproduce both issues for Gold and EP. The first
simplified two-player fixture is retained separately; it does not establish a
valid side-pot example. The revised four-case baseline demonstrates missing net
summaries, then the same fixtures with celebration assertions first demonstrate
four actual unexpected celebrations. Production code remains unchanged through
all three baselines.

The candidate adds the saved return, original buy-in and net profit/loss to the
completed-hand summary. It plays the win celebration only for a known positive
net with a won pot. Missing buy-in data never implies a zero buy-in or invented
profit. Settling, saving, currency ownership, cards and server payouts retain
their rules. Existing profitable-hand feedback remains covered.

The focused suite passes 22 checks in one pinned Node worker; changed JavaScript
lint passes. Eight browser cases are prepared for Gold/EP at 320px, 390px and
844px with 125% phone text, plus 1440px desktop. Each checks losing, even and
profitable outcomes, readable complete summaries, no horizontal clipping and
correct celebration/cue behavior. Browser and copied-publication qualification
have not run: local compiler/browser/archive work waits for all repository
workflows to be idle. No next release precedes accepted 85 deployment.

Private reports and continuation are under `.qa-casino-experience/poker-net-*`
in the owned casino worktree. These prepared projections do not establish earned
play, physical-device, final owner casino assessment or whole-game readiness.
Soak/stress remains deferred.
