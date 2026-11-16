# Connected Earth slots: Gold and EP, resume and restart

Native66171 **passed46.913s** against exact f2fdea9b / Alpha1.9.13 runtime.
The existing Gold route was paired with its new VIP parameter; both used real
WebSockets, random spins, real clocks, owned Mongo and actual server processes.
No game-source change, failed invocation, automatic retry or forced outcome.

- Gold route passed1.30s: prepared500Gold, wager20, random payout72, saved552Gold.
- VIP route passed45.60s: prepared500Gold and administrative membership, zero
  seededEP; ordinary refresh awarded100EP. Guard entry and normal movement went
  along the back balcony and side gallery to the upstairs Earth machine. Wager20
  lost, leaving80EP with500Gold unchanged. Max stake100EP was reported correctly.

Each route occupied the machine, received the correct currency/balance, spun,
rejected an old-revision duplicate, and saved its settlement. A real token resume
kept the seat/session and revision2. Explicit leave freed the machine. Following
actual server restart and fresh login/re-seat (including another VIP guard/walk),
the balance and revision remained unchanged. The VIP account still had one monthly
allowance receipt and no Gold-credit receipts. Hidden bonus offers never appeared
in network payloads. Both runs had zero free spins and no pending bonus; **this
does not prove connected bonus-choice/free-spin interaction**. Retain earlier
game/handler recovery and inspected browser bonus fixtures with their own scope.

## Prepared bonus and free-spin follow-up

Native74186 **passed47.000s** against the same exact f2fdea9b runtime:
Gold1.39s and EP45.60s. Before server startup, each owned fixture received one
validated unresolved bonus (20/40/100 offers) and five free spins at a20 stake.
This proves prepared entitlement recovery, not naturally earning the trigger.
Through real sockets, choice1 paid40 once; repeating the old request was rejected.
The next spin consumed one free spin without a wallet debit. Gold randomly paid44
and finished584Gold/0EP; EP paid0 and finished140EP/500Gold. Both retained four
free spins and revision4 across token resume, leave, actual process restart and
re-seat. EP retained exactly one monthly allowance and no Gold-credit receipts;
hidden bonus offers never appeared in client payloads. No runtime RNG changes.

Log: `/tmp/eidolon-group-sockets-20260914-WJG4y2/slot-features-r2.log`.
Server evidence directories: `/tmp/eidolon-compat-session-2512153089`,2820376942,
540659832 and3595953748. Native51793 stopped before tests because an explicit
vendor flag was inappropriate for this non-vendored tree; retry used readonly
modules. Both owned Mongo containers were removed; native74186 exited0.

These are prepared interaction tests, not earned currency, rendered reels,
auto-spin timing, all four machine themes, payment integration or phone evidence.

Log: `/tmp/eidolon-group-sockets-20260914-WJG4y2/slots.log`.
Gold server evidence: `/tmp/eidolon-compat-session-2330353844` and2373727477;
EP server evidence: `/tmp/eidolon-compat-session-4111927831` and2073156458.
All four server processes shut down normally; wrapper removed the owned
`eidolon-slots-sockets-0914a` Mongo. No native GPU activity. `gofmt` and diff
checks passed. Retain results rather than rerolling until a bonus or repeating
for labels/docs. QA changes should accompany a later appropriate publication,
not supersede the active1.9.13 pipeline.
