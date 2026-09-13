# Casino hand feedback, celebrations and stakes — Alpha 1.9.3

Packaged at the user's request as Alpha1.9.3, following deployed Alpha1.9.2
(`3651c4c9`). Login, runtime defaults and cumulative patch notes are aligned.
Verified live September13 21:18UTC: exact commit
**03373b0f3df9d03e0bca76d3f3b95b6b8d142423** on client release/login/runtime
and backend health, database ready. Origin/master matches; public casino modules
and cumulative patch notes verified. This is not full1.10 or EP implementation.

## Deployment evidence and CI caveat

CI **34781528097** completed with nine successful jobs, including all predeploy
gates and both deployments. Predeploy4PASS1.4m; live gameplay8PASS6.9m; town
recovery/expiry/reconnect2PASS1.3m. The final two-player aura test completed its
gameplay assertions but failed its console-error assertion on two Chrome
`ERR_NETWORK_CHANGED` messages. The workflow therefore remains **FAILURE**;
do not describe this as an all-green CI run or restart the completed pipeline.

Host network logs show unrelated Docker veth links created at21:15:02 during
the21:14:59–21:15:55 failed test, consistent with a runner network interruption.
No network/service change or assertion suppression was made. One targeted
rerun of the unchanged `well-rested-party-gameplay.spec.js` against the exact
live release, fresh ordinary registrations, system Chrome/hardware WebGL and
`--retries=0` passed **1test1.1m**, including empty console-error lists, High/Low/
High aura budgets, phone layouts, joystick movement and reconnect. Artifact
credential scan passed. Output: `test-results/live-rest-party-release193`.
This separate passing recheck does not change the original GitHub conclusion.
No additional broad suite, redeploy or soak was started; no owned QA remains.

## Player-facing patch notes

- Blackjack displays each visible hand's current total, adjusts Aces correctly,
  and identifies soft totals and busts. The dealer's label counts only exposed
  cards until reveal. All players' blackjack cards remain visible to the table.
- Poker displays your current best hand, including ranks such as “Pair of 2s”
  and “Full house — 2s full of 3s.” The server supplies this label from its
  existing evaluator; opponents' hidden cards and hand strength remain private.
- Settled blackjack/poker wins show a large YOU WON panel with the hand, Gold
  returned and net profit. Blackjack 3:2 naturals remain unchanged:100Gold
  returns250, profit150. Refunds/pushes are not counted as blackjack profit;
  poker uncalled returns alone do not trigger a win popup.
- Slots pause between reels/results and the next wager for WIN, BIG WIN (10×),
  HUGE WIN (50×) or GIGANTIC WIN (100×) panels, based on return/stake ratio.
  They explicitly label total return, not net profit. Pause2.5s, or4s for≥50×;
  both manual and auto-spin actions remain blocked during the presentation.
- Bonuses appear over the reels with the machine's story title, free-spin count,
  mechanic description, animated reveal and the actual saved reward choices.
  Choices wait for reel/win presentation; free spins retain the original stake.
  Auto-spin still stops for a bonus choice. Leaving clears timers without
  discarding a saved bonus or resuming a queue. Reduced-motion removes motion.
- Public slot/blackjack opening stakes and poker buy-ins now support up to
  **100,000 Gold**, server validated and advertised. Existing minimums/increments
  remain20/20 for slots/blackjack and100/100 for poker. Poker blinds stay5/10.

## Timeout and EP clarification

A decision timeout does **not** eject the seated player: blackjack stands,
poker checks if possible or folds. Disconnect seats release after60seconds.
This was a user question, not an explicit request to change chair ownership;
no new auto-ejection policy was implemented. Shared rounds and30s decisions remain.

The user clarified that EP casino wagers ARE allowed, capped at100EP, paying
**only EP**. EP can otherwise buy only cosmetic appearance unlocks, never Gold,
combat/progression benefits or indirectly tradable power. This supersedes the
earlier over-restrictive interpretation that prohibited EP wagers.100EP/month
VIP allowance and1,000,000Gold→1EP one-way exchange remain approved; future
real-money EP purchases are intended but payment integration remains excluded.

**EP runtime is not implemented here:** no EP wallet, exchange, allowance,
payments or EP tables.100EP is the recorded VIP wager cap for that follow-on
stage. Existing Gold games never accept EP and the VIP guard remains locked.
See the authoritative [EP policy](2026-09-09-town-casino-roadmap.md#ep-economy--approved-direction-not-implemented).

## Settlement and rollback boundaries

Receipt bounds cover the increased actual liabilities: slot return≤20,000,000
Gold (Fire200×jackpot), blackjack return≤1,600,000 per player (four doubled
hands), poker return≤600,000 (six buy-ins); any debit≤100,000. A blackjack player
can commit up to800,000 across all splits/doubles; this is disclosed as8×opening
stake. Payout formulas, odds, bankroll conservation and currency isolation are
unchanged; absolute exposure is intentionally higher. EP remains rejected by
the Gold ledger. Displayed wins wait for authoritative settlement and repeated
polls do not replay a finished celebration.

**Rollback must retain expanded limits/decoders:** older1.9.2 cannot resume saved
high-stake hands or receipts. Do not restore the old binary after accepting these
wagers without retaining compatible decoding/settlement. Never erase saved wagers.

## Focused evidence

- Client50tests across five casino UI/controller suites pass. Covers hand totals,
  profit/return labels, duplicate popup suppression, high bets, saved settlement,
  timed auto/manual locks, bonus ordering, leave cleanup and rejected requests.
- Game/database focused tests pass: high-stake3:2natural and poker save roundtrips,
  maximum slot jackpot, valid/invalid bounds, scoped receipt caps, hand labels
  and opponent privacy. Focused server casino tests compile/pass. Mongo-gated
  cases were not enabled; no database/soak started or production data changed.
- Browser4tests passed25.5s (newdesktop/phone hand/win panels, existing poker and
  slot flows). Screenshot refinement and newGIGANTIC/disabled-spin assertion:
  affected3tests passed28.4s. Reviewed desktop win, phone poker and phone bonus
  images; no horizontal overflow and Leave remains accessible in header fixtures.
  Subsequent pending-settlement deferral is covered by a focused unit regression.
- Changed JavaScript lint and git diff whitespace checks pass. Static modules
  served by browser fixtures; no separate frontend bundle build exists.

These are controlled fixture results, not live multiplayer/deployment evidence.
Temporary visual evidence: `/tmp/eidolon-slot-gigantic-win.png`,
`/tmp/eidolon-poker-win-390.png`, `/tmp/eidolon-blackjack-win-1440.png` and
`/tmp/eidolon-slot-phone-20260913.png`.
