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
