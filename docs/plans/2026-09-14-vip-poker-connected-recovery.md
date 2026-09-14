# VIP poker: connected EP hand and restart walk-back

Local correction accepted; **not yet published**. Alpha1.9.12 remains in
CI34840066682. Do not supersede that pipeline with this follow-up fix.

The actual connected EP route exposed a restart defect: `tickPoker` protected
absent players during its existing one-minute restart grace, but immediately
withdrew a participant once login created their entity without a chair. VIP
login intentionally restores beside the downstairs guard, so walking upstairs
lost the hand before the player could reclaim their funded seat.

The correction preserves the same original grace deadline for an alive, unseated
participant still inside the casino. It does not extend the clock, freeze turn
timers, alter explicit-leave withdrawal, allow another table to count as recovery,
or let expired membership bypass the guard. New seat tokens remain required.

## Evidence

- Initial actual-socket run80718 failed after65.72s during first post-restart
  re-seat. Both players had entered via the real VIP guard, walked to the table,
  received the ordinary100EP membership allowance and funded a shared hand.
  The source condition explains why login withdrew the returning participant.
- Corrected run69600 **passed62.432s**, zero retries within that invocation.
  Two real WebSocket clients, owned production-server processes, real Mongo,
  random cards and real clocks: guard → walk → sit →20/40EP buy-ins → private
  shared deal → actual disconnect and process restart → guard/walk/re-seat with
  new tokens → unchanged hand/cards/revision → check/call showdown → leave/save.
  Stale action replay was rejected. Both saved Gold balances stayed500, Gold
  receipt counts stayed zero, each had two EP casino receipts and one monthly
  allowance receipt, and total EP remained200. No mid-hand grants or clock edits.
- Focused restart-grace unit passed0.004s; selected poker/VIP test invocation
  passed0.007s. Mongo-dependent tests in that latter invocation skip without an
  explicit disposable database; only the socket invocation above proves the
  new connected EP path. `gofmt` and `git diff --check` passed.
- Evidence: `/tmp/eidolon-vip-poker-sockets-20260914-a142XI/run.log` and
  `run-r2.log`. Server evidence folders for the accepted two processes:
  `/tmp/eidolon-compat-session-3222548522` and
  `/tmp/eidolon-compat-session-1055036973`.
- Both handles terminal; both owned Mongo containers0914a/0914b removed by their
  wrappers, both server processes shut down normally. No production data writes.

The runtime was built from integration baseea1e7c91 plus this local correction;
the helper binary retained basename/build-commit38847b2f to satisfy its health
contract. That embedded label is **not proof of an unmodified release build**.
Tested `server/casino_poker_sessions.go` SHA256:
`6e426409b72c7551415999486a334be834d9260b276e5e8ff308a93c294a36c0`.

This is connected EP poker/restart evidence, not rendered poker, connected EP
blackjack, vendor purchasing, slots, busy-floor performance, physical-phone play,
or full campaign/raid acceptance. Retain earlier public-poker and Gold-blackjack
evidence; do not repeat them solely for this document.
