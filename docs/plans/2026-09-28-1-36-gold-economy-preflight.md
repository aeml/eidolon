# Alpha 1.36 — Gold economy review (in progress)

Local work only; no release claim or currency rebalance. Existing balances,
items, prices and the Gold/EP boundary remain unchanged.

## Confirmed defects

- An empty vendor item ID matched an empty inventory slot and awarded Gold.
  The direct message-dispatch regression failed before the fix. This safety
  guard was backported into 1.31, commit `6cd4fafa`, and is already delivered.
  Ordinary sales and replay accounting passed.
- Buyback appended recovered equipment beyond a full bag's visible capacity.
  `TestBuybackUsesBagCapacityWithoutChargingOnFullBag` reproduced the defect.
  Buyback now finds a visible empty slot or permits an append only below
  capacity, before deducting Gold. A full bag preserves the recovery item,
  currency and ledger. A successful recovery keeps all equipment metadata;
  repeating it cannot charge twice. Empty IDs are rejected. Player state is
  locked during settlement and reply snapshots.

## Scoped local evidence

- Before: full-bag regression failed with “full bag accepted buyback beyond
  its visible capacity.”
- After: buyback and existing sale checks passed (game, 0.349s).
- Buyback, hourly/daily telemetry and 4,000 ordinary gambling/resale receipt
  checks passed (game, 0.412s); direct vendor dispatch passed (main, 0.107s).
  This checks accounting, not player earning rates or a healthy live economy.
- Whitespace check passed. No long campaign, raid, soak or production-account
  mutation was used for this review.
- Legacy overflow repro failed for cancellation and buyout, both using Y
  instead of Z and losing the instance. After correction, those cases plus
  direct-trade, guild escrow, seller payout, weekly rewards and concurrent
  buyout checks passed (game, 0.863s). The selected actual-database integration
  command returned successfully but its three cases were **skipped**: the
  disposable-database opt-in was absent. No new durable integration claim.
- Shutdown flush/disabled writer/JSONL checks passed with the race detector
  (main, 1.081s). No hour-long wait or repeated campaign run was needed.

## Review scope

The source/sink breakdown below covers quests, combat, vendors, Forge,
auctions, direct trade and guild flows using current implementation and scoped
receipts. Transfers are distinguished from creation/destruction. Inflation
and hoarding still need real population observations, not prepared accounts.

Legacy auction cancellation and buyout overflow both reproduced wrong placement:
player `(X=60000, Y=200, Z=60010)` inside a dungeon produced overworld loot at
`(60000, 200)`. Both helpers now use X/Z and preserve the instance, as does the
no-database collection fallback. This is separate from durable production
auction delivery, which uses bag/stash capacity and rejects a full destination;
do not describe the legacy repro as a lost durable purchase.

## Current source/sink map

| Flow | Accounting and current policy |
| --- | --- |
| Enemy/room rewards | `combat_rewards` and `dungeon_room_rewards`; party, difficulty and reward modifiers apply before recording the actual grant. Room base is `max(25, runLevel*3)` before modifiers. |
| Manual quests | `quest_rewards` records the actual nonnegative accepted Gold quote. Existing contracts retain their reward quotes; do not reprice old quests. |
| Weekly raid | `weekly_raid`: 15,000 Gold, plus 5,000 if its item cannot fit. Grant is claim-gated. |
| Vendors | `vendor_sales` creates the item's value times stack; `buyback` consumes the corresponding amount. Empty sale requests cannot mint Gold. Equipment gambling costs 35 Gold per character level and records `gambling`; sales back to the vendor are a separate source. |
| Forge/respec | Forge consumes Shards/Hearts/gems, **not Gold**; do not invent a Forge Gold sink. Respec records `respec`, with server level-band costs and both-tree multiplier. |
| Auctions | Bid/buyout principal and refunded listing deposit are transfers/escrow, not income. Final sale fee is 5% (integer truncation); sold deposits return, reclaimed unsold deposits are consumed. Durable completion records `trading_house_fee` / `trading_house_deposit`. |
| Direct trade/guild bank | Escrow/deposit/withdrawal transfers existing player Gold; neither belongs in creation/destruction totals. Direct-trade cap remains 100,000 Gold. |
| Casino | Gross `casino_wagers` and `casino_returns` must be considered together, not interpreted as combat income. Durable receipt replay is separate from in-memory telemetry. |
| Gold → EP | One-way `ep_exchange` sink at 1,000,000 Gold per EP. EP remains separate and cannot be converted back into Gold or power. No payment method added. |

## Available observation, not a balance verdict

Read-only inspection of the last 24 existing host JSONL records at
`/home/aeml/eidolon/server/logs/economy_metrics.jsonl` covered timestamps
2026-09-27 11:40 UTC through 2026-09-28 15:00 UTC: combat 2,950 Gold,
rooms 1,213, vendor sales 160; total sources 4,323 and no recorded sinks.
These are historical records, not proof that the sample represents ordinary players. The
timestamps are not a continuous 24-hour cohort. No account identities were read.

There is no defensible inflation/hoarding conclusion from that small sample.
The active `eidolon-api-1` container was inspected read-only: its log bind mount
is this exact host directory, and it started at 2026-09-28 22:28:57 UTC. The
deployed Compose command uses the default metrics path. The old writer never
flushed its partial hour on shutdown, so frequent normal deployments could
discard the only activity observed between them.

Local correction returns an idempotent stop function from the writer; main
defers it until normal gameplay/HTTP shutdown completes. It stops the ticker,
flushes the final partial hour once and waits for the writer. Eight concurrent
stop calls are covered without an hour-long timer or sleep. Disabled metrics
still safely return a no-op stop function. Normal prices and rewards do not
change. Abrupt exits, failed writes and unflushed events remain limitations;
this process-local monitor is not the durable currency ledger. Collect
representative activity before recommending price changes. Do not confiscate
balances or change rewards to force this sample toward zero.

The 1.36 changes in `economy_actions.go` and `client_dispatch.go` overlap the
preceding 1.35 Forge work. Package only the intended milestone hunks in order.

## Exact candidate packaging

Isolated `/tmp/eidolon-1-36-package-ffyDqT` builds on the tested local 1.35
snapshot `9d2b69b7`, not a claim that 1.35 is deployed. It excludes weekly
delivery/schema15 and the party-presence changes. Runtime/package/deploy/CI
identities, login and cumulative notes are aligned to 1.36.0.

Scoped metrics, buyback, legacy overflow, vendor/trade/guild checks passed with
race detection (main 1.315s, game 2.903s). All 309 version/history checks passed
in 1.904s; scoped lint and whitespace passed. Unchanged source/sink and
generator observations above are reused. No new production-database check,
long campaign run or broad economic rebalance was performed.

Remaining: publish only after 1.34 and 1.35 are accepted live, then complete
this release's CI and public verification. Population-based inflation,
hoarding and pacing conclusions remain explicitly unproven.
