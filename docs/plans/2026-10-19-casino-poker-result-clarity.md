# Casino table layout and result clarity

This isolated follow-up extends accepted Alpha 1.79.85, source
`6d35618229979e24fa9808e242e8200421b71cfa`. Prepared Alpha 1.79.86 has not deployed; it requires its own
complete CI and public verification.

House games arrange six seats around a shared result-and-clock stage. Labels,
funded stakes, reconnect status, Baccarat hands and the timer occupy separate
content areas, with owned scrolling on short screens. Larger proportional cards
keep the ten-rank index and suit within their faces. Short landscape layouts
place seats on side rails. Scroll padding keeps content clear of the table's
beveled clipping boundary. Roulette's actual spin uses the foreground table
viewport, with a larger wheel and a separate timer/skip footer; entering that
phase resets inspected-seat scroll once, without resetting ordinary polls.
The known server result, physical landing math and deadlines retain their rules.

The public release's house layout genuinely failed the new Baccarat overlap and
roulette clock hit-testing probes. These original failures remain retained.
Intermediate corrections exposed an undersized grid row, clipped card indices,
a square desktop card and a landscape scroll boundary. The first combined
43-case run retained 18 passes, one genuine timer clipping failure and 24 unrun
cases. A focused diagnostic reproduced that failure; adding scroll padding
passes the same full-visibility assertion across all three hand phases. No
assertions, timeouts or failure reports were relaxed or overwritten.

A reused house chair now attributes an earlier saved wager to its original
player when the present occupant differs. Both games reproduce the old missing
ownership caption. The new patron's name, connection state and waiting status
remain current; wagers and settlement still belong to their original player.

Poker can return a won side pot while the player loses money over the hand.
The summary now shows the saved return, original buy-in and net result. A win
sound/banner requires a known positive net and a won pot. Missing or zero buy-in
data never invents profit. Four legal all-in baseline cases on pinned Node
24.18.0 reproduce the old unexpected celebrations: C's aces win the main pot,
A's kings beat B's queens in the side pot, with conserved whole 100-Gold/10-EP
buy-ins and no chips left behind. Early simplified/invalid fixtures and a
secondary Node18 baseline remain retained as superseded evidence, not legal
complete-hand qualification. Exact exported old module bytes were restored to
the selected fixed bytes after the primary baseline.

Rules popups save the last visible drag position when native Escape or Enter
closes them while the pointer remains held. Both old behaviors lose 40px of
horizontal placement in real browser reproductions. Explicit user close records
the last visible position; forced teardown discards an active drag. No ghost
pointer movement occurs after reopening. Existing large windows, pointer/touch/
keyboard top-bar movement and remembered normal/compact coordinates remain.

Pinned Node24 qualification passes 48 focused checks across HouseTableUI,
PokerTableUI and CasinoWindowLayout; after adding the shared stage and phase
scroll reset, all 21 HouseTableUI checks pass again. Changed JavaScript lint
passes. The final source browser matrix covers 43 cases with retries disabled:
new roulette clock/foreground checks, six-seat Baccarat geometry/cards/status,
Gold/EP poker losses/even/profit, native popup closure during drag, and existing
history/deal/phone keyboard/placement/positive results. All 43 pass in 1.7 minutes, with zero failed, flaky, skipped or retried
cases. Screenshot review includes both roulette spin sizes and Baccarat desktop/
landscape cards, status and timer. Eighteen corresponding copied-publication checks are prepared against
an actual bundled GameEngine/UIManager with hardware WebGL identity checks;
they have not run yet.

Private original failures, diagnostics, source hashes and terminal reports are
under `.qa-casino-experience/` in the owned casino worktree. Source DOM/browser
projections and copied-engine integration are not earned play, physical-device,
final owner casino assessment, performance or whole-game acceptance. No odds,
currencies, schema/protocol, server settlement or art assets change. Local
compiler/browser/archive work requires all repository workflows idle. Soak and
stress remain deferred until feature completion approaches.
