# Elemental slots — implementation handoff

Part of full1.9/1.10 casino scope, NOT playable/enabled or economically approved
yet. Core rules/proposals exist in server/internal/game/casino_slots.go. No Gold
mutations or client outcome claims. Keep runtime1.8 until the whole1.9 is ready.

## Implemented rules

Four lore-specific catalogs use existing Eidolons/crystals: Orun/Rootheart,
Pyralis/Ember Crown, Neris/Tidestar, Aeral/Skyglass. Five reels×three rows;
ten fixed paylines exported by SlotPaylines. Bets20 or40 normalGold, equally split
across10 lines. Each landed cell independently draws from eight symbols with
public weights24/20/16/12/10/8/5/5. Last two are wild/scatter. Each line pays only
its highest-value three/four/five left-to-right match, with wild substitution.
Three leading wilds still pay when the following symbol is a scatter.

Five natural Eidolon symbols on the center line give100×total stake, replacing
that stage's line wins; wilds do not substitute for this jackpot. No progressive
liability is introduced. Current per-result bounds fit existing8000Gold casino
transfer validation; no clipped payouts. Fire free-spin jackpot reaches8000 at40.

- Earth: middle-reel wilds remain sticky during a free-spin feature; five free
  spins per trigger. Sticky state clears only when starting a new paid feature.
- Fire: three free spins per trigger, each doubles line/jackpot wins.
- Water: up to two additional gravity/refill cascades; only winning positions
  disappear. No cascade after zero payout/jackpot. Three free spins per trigger.
- Air: two landed wilds expand the leftmost wild-bearing reel; one is enough
  during free spins. Four free spins per trigger.

Three+scatters in the original landed grid trigger the theme's narrative pick-one
bonus and free spins. The hidden rewards1×/2×/5×stake are securely shuffled BEFORE
selection. Only the chosen offer pays. Retriggers bank at most12 free spins,
retaining the original stake; free spins cannot silently become paid spins.
Water/Air use their own public paytables (three-quarter integer multiples of the
base table) because their mechanics add wins. These are candidate values; no
overall RTP/house-edge claim or economy sign-off yet. Review before enabling.

SlotSession includes revision, original bet, free bank, sticky rows, sealed offers
and last result. Validate re-evaluates saved line/stage/jackpot payouts and totals,
checks grids/features and keeps offers out of SlotView. Spin/bonus APIs return
uncommitted copied proposals; RNG failure does not consume an entitlement.
Core tests PASS0.006s and Go build-all PASS: distinct mechanics, jackpot/wild rules,
bonus JSON save/reopen/redaction, stale choice rejection and corrupt payout checks.
This is NOT an actual database/server-restart/wager/UI session.

## Next: durable owner-bound sessions, then seated game UI

Use existing casino seat/session authority, account-work locks and Gold receipts.
Relevant current paths: server/casino_handlers.go, casino_blackjack_sessions.go,
casino_gold.go and internal/database/casino_blackjack.go. Existing database record
stores opaque private JSON + version + pending signed transfer; existing transfer
validator permits debit<=500 / credit<=8000 and Gold only. Do not add another wallet
or relax unrelated blackjack rules. A slot entitlement must belong to the player
and machine theme, not block a physical machine forever after its owner leaves.

Commit outcome+intent BEFORE debit; then exactly-once payout before next action.
Free-spin proposals still require durable advancement before acknowledging them.
Persist/recover the gap after debit resolution but before payout intent creation.
Validate saved core state before replaying money. Bind requests to actual seat,
opaque session and expected revision. No client-selected currency or outcome.
Account admission must fence its own unresolved transfer without querying the DB
on every unrelated movement. Recovery locks recipient account before any game lock.

Only after integration, add the fourth Air cabinet and catalog-appropriate physical
machine positions, full reel/payline/bonus/free-spin/jackpot UI, animations/audio,
clear stakes/rules and explicit paid-spin confirmation. Reuse CasinoController
camera/leave/seat lifecycle. Preserve entitlements through leave/reconnect/restart.
Finish a focused connected session and economics review before release; broad
final integration stays in1.10. Poker and approved-currency VIP are still required.
