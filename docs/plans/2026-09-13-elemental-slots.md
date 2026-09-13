# Elemental slots — implementation handoff

Part of full1.9/1.10 casino scope. Connected public Gold slots and seated UI are
implemented in the local1.9 candidate, NOT deployed or economically approved yet.
Keep runtime1.8 until the whole1.9 is ready.

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

## Implemented: durable owner-bound sessions and seated game UI

Owner/theme-bound records reuse the existing private casino JSON, signed Gold
receipts, save journal and account locks. Pending debits/payouts fence only their
owner; startup/background recovery includes the gap between settled debit and
creation of payout intent. Saved free spins and sealed bonuses survive leaving
the physical machine. Actual seat/session and revision checks gate every action.
Four physical cabinets now expose slot_spin/slot_bonus through casino messages.

The seated UI uses 32 procedural symbol icons, winning-line highlights, cascades,
bonus choices, saved free spins, jackpot feedback and generated audio. Paid spins
require Review/Confirm; free spins retain their original stake. Public rules show
weights/paytables/paylines and feature rules. Reduced motion, duplicate-click
locking and cleanup reuse the existing chair/camera/leave lifecycle.

Focused evidence (reuse unless changed): build-all PASS; Mongo recovery/account
tests PASS0.711s and bonus/free entitlement test PASS0.204s. Real authenticated
socket spin/replay rejection/resume/leave/server restart PASS1.108s. Prepared
winning states isolate interruption recovery, not earned spins or payout odds.
Changed JS suites20tests PASS2.951s. One390px rendered component check PASS8.3s;
/tmp/eidolon-slot-phone-20260913.png inspected. It tests the actual UI with
controlled responses, NOT the connected physical machine/camera scene.

Opt-in payout sampling completed in4s (not part of normal CI). Only the final Air
sample was retained after output loss: 50,000 paid cycles including free features,
sampled return0.9995, approximate95% interval[0.9810,1.0181]. This is not exact RTP
or economic approval; all themes still need a recorded tuning decision before
release. No broad matrix/soak required here. Connected full-town machine/camera
check, payout review, real-player poker and approved-currency VIP remain.

## Persistence design constraints retained

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

Broad final integration stays in1.10; do not repeat the passing connected session
and recovery checks without a relevant change.
