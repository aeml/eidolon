# Connected VIP blackjack: shared hand, EP settlement and restart

Native69903 **passed40.535s**, `TestVIPBlackjackActualSocketsWagersRoundAndPayout`,
against exact f2fdea9b / Alpha1.9.13 runtime. Two real WebSocket clients and an
owned loopback Mongo; real cards, clocks and actual server processes. No retry,
forced outcome, shortened timer or game-source change.

The disposable accounts were prepared before first login with level1 Fighters,
1000Gold and a current administrative VIP entitlement, but zero seeded EP. The
normal membership refresh awarded100EP each. Both used the guard, walked with
ordinary movement messages and physically occupied distinct upstairs seats.

The table advertised EP currency,100EP maximum stake and the correct balance.
Both wagered100EP; Gold stayed1000. Replaying an accepted wager did not debit
again. Both clients saw identical public player cards and dealer cards; the
hole card stayed hidden while playing and no private shoe was exposed. Players
stood on their own turns, and the shared round settled with the dealer revealed.

Both random hands lost: each saved **0EP/1000Gold**. The check retained the
existing physical exit-position assertions. An actual server restart and fresh
logins retained those balances, zero Gold-credit receipts and exactly one VIP
allowance receipt per player. No second monthly allowance or settlement occurred.

This run is **not a positive EP-win receipt**. Retain the existing VIP Mongo
settlement/currency tests and actual public3:2 natural-blackjack receipt; do not
reroll the connected route until it happens to win or force a winning shoe.

The established Gold route was reused with a VIP parameter; its accepted public
run was not repeated. The poker approach helper now delegates to the same card-
table movement helper with its original poker table ID. Neither game logic nor
production timing changed. `gofmt` and `git diff --check` passed.

Artifacts: `/tmp/eidolon-group-sockets-20260914-WJG4y2/vip-blackjack.log`.
Server logs: `/tmp/eidolon-compat-session-2244288857/server.log` and
`/tmp/eidolon-compat-session-253819127/server.log`.
Both processes shut down normally; wrapper removed `eidolon-vip-blackjack-0914a`.
No local GPU run competed with CI. This QA-only addition rides the next suitable
publication; do not supersede active1.9.13 CI or repeat it for labels/docs.

Not rendered VIP-table UI, mid-hand restart, slot-machine bonus interaction,
busy-floor rendering, payment integration or physical-phone acceptance.
