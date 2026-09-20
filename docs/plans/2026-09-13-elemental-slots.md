# Elemental slots — implementation handoff

## Current status and exposure — September20 reconciliation

Slots are delivered, including separate Gold/EP wallets and
[connected paid-spin, prepared-feature and restart evidence](2026-09-14-connected-slots-acceptance.md).
The original implementation record below is historical: the20/40-Gold-only
stakes,8,000-Gold transfer ceiling and “not deployed” labels are superseded.
Current public stakes are20–100,000 Gold in steps of20; VIP stakes are10–100 EP
in steps of10. Payment integration remains excluded.

At those maximum stakes, current conservative per-spin payout bounds are:

| Theme | Payout multiple | Gold | EP |
| --- | ---: | ---: | ---: |
| Earth |100×|10,000,000|10,000|
| Fire, doubled free-spin jackpot |200×|20,000,000|20,000|
| Water, two line stages plus final jackpot |174×|17,400,000|17,400|
| Air |100×|10,000,000|10,000|

Water's bound is `37 + 37 + 100` times stake: each stage pays at most ten
37-line-stake wins, and a jackpot ends further cascades. This is a conservative
bound, not a proof that all three maxima can occur in one legal cascade.
A bonus choice pays separately, at most5×stake (500,000 Gold or500 EP).
These are **not whole paid-cycle ceilings**: earned free spins can retrigger,
and the12-spin bank cap bounds the outstanding bank, not the total spins that
can be earned over a feature. Do not clip owed payouts to a per-cycle budget.

Source review: `casino_slots.go` supplies explicit paytables, ten paylines,
`bet/10` line stakes, jackpot replacement and multiplier rules;
`casino_currency.go` supplies legal denominations. The existing saved-result
and `BlackjackTransfer.Validate` bounds admit the20-million-Gold/20,000-EP
result. Existing maximum-stake, saved-jackpot and EP-feature tests cover these
boundaries. No new sampling, payout change or rerun was needed for this review.

Payouts scale linearly at every legal denomination; changing stake does not
change the symbol weights or per-stake return. Retain the earlier full-cycle
sample below with its uncertainty, rather than treating it as exact RTP or a
fresh high-stakes observation. Actual casino sources/sinks versus earned
campaign income and busy-floor/phone acceptance remain open.

## Original implementation record

Part of full1.9/1.10 casino scope. Connected public Gold slots and seated UI are
implemented in the local1.9 candidate, NOT deployed. Initial payout tuning is
recorded below; this is not an exact RTP certification or a player return promise.
Now packaged asAlpha1.9.0; its own deployment/live verification remains required.

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
Every theme now uses its own explicit public paytable, tuned for its mechanics.
Keep those published values consistent with saved-result validation and the UI.

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

The following describes the original 1.9 UI; the local
[1.10 quick-play revision](2026-09-13-casino-quick-play.md) supersedes its
Review/Confirm and manual-only spin flow without changing payouts or entitlements.

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

Initial sampling was repeated once because three themes' terminal output was
lost, revealing an inflationary Earth candidate. Final tuning/evidence follows.
Connected full-town machine/camera and approved-currency VIP remain. Real-player
poker is implemented locally; see the separate poker handoff for remaining checks.

## Initial release economy decision — September13

Keep all bonus mechanics, secure symbol weights, manual free spins and fixed
jackpots. Tune only explicit line paytables: reduce the Earth/Fire/Air return and
improve Water's relatively harsh return. These are unshipped slot rules; no live
player entitlements are repriced. Existing payout/debit bounds remain unchanged.

Opt-in deterministic samples use50,000 COMPLETE paid cycles per theme, including
all free-spin retriggers and bonus payouts. Each theme has its own fixed seed.
Production continues crypto/rand; no forced test outcomes or win-rate adjustment.

| Theme | Original sampled return | Tuned sampled return | Approximate95% interval |
|---|---:|---:|---:|
| Earth |105.72%|96.16%|94.06–98.25%|
| Fire |101.36%|96.85%|94.91–98.79%|
| Water |85.20%|91.77%|90.26–93.28%|
| Air |99.95%|96.89%|95.07–98.71%|

Accepted as initial non-inflationary public-casino tuning, with meaningful theme
variation. These are sample estimates, NOT exact theoretical RTP or guarantees;
rare jackpots limit tail precision. Future live economy observations can motivate
further tuning, but no extra repeated broad simulation is a release requirement.
20Gold cycles cover40Gold too: same draws/features, all line/bonus/jackpot returns
scale exactly2×. Per-result Gold bounds: Earth<=4000, Fire<=8000, Air<=4000,
Water<=6960 (two1480-bound line stages plus a4000 jackpot), within existing8000
credit validation. A bonus pays at most200 separately. No progressive liabilities.

Original full sample PASS3.557s; initial tuned full sample finished3.21s, exposing
an obsolete exact Earth unit expectation (560→520; best three-wild payout36→34).
Updated those payout assertions to the chosen table, without weakening checks.
Final changed-Water-only sample plus all slot rules PASS0.803s. The review accepts
EIDOLON_SLOT_ECONOMY_THEME to rerun only a changed theme; opt-in remains off in CI.

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
