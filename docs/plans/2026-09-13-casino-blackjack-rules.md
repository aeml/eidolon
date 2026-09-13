# Lanternhold Blackjack — round and integration rules

Implementation candidate with connected local wagering, NOT deployed. Rules version `lanternhold-s17-v1`.
This is the first concrete consumer of casino round/session infrastructure, not
a replacement for required slots, real-player poker, both floors or VIP content.

## Public table rules

- One to six real players versus the dealer, acting in physical seat order.
- Six freshly and securely shuffled decks per round. No client-selected seed or
  outcome. The public view never includes the shoe or the dealer's hole card.
- Opening wager: 20–500 normal Gold, in increments of20. This is a bounded
  initial public-floor tuning candidate, not a VIP currency decision.
- Dealer peeks for blackjack and stands on all17, including soft17. Naturals pay
  3:2 profit; other wins pay1:1; pushes return the stake. Payout fields include
  the stake returned. Split21 is an ordinary21, not a natural blackjack.
- Hit, stand, double on any initial two cards (including after splitting), and
  split equal-value pairs into at most four hands. Split aces receive one card
  per hand, then stand; no resplitting aces. No insurance or surrender.
- Each decision has30seconds. Timeout stands the current hand. Disconnect and
  leaving never erase committed wagers, change the shoe or restart the timer.
  Returning players resume the same round. This does not create a bot opponent.
- Additional split/double stakes require separate durable acceptance before the
  resulting card/state is shown. Insufficient funds leave the prior round intact.

## Implemented in this batch

Concrete server round engine with immutable action proposals, extra-debit amounts,
shared turn/deadline/revision, dealer resolution and exact integer return amounts.
Explicit detached public views redact private cards/shoe. The persistable round
retains the original shoe and deadline; serializing/restoring it does not redeal.
This is rules code, NOT an integrated durable money transaction or network game.

Focused rule checks cover naturals/peek/push, soft17, bust, split/double funding
proposals, split aces/max hands, real shared turn order, wrong-player/stale/late
actions, timeout after serialization, public-view redaction, stake bounds and
six-deck card conservation. No claim of mathematically measured house advantage
or real-player wagering follows from those checks.

## Economy release review — September 13

The [Wizard of Odds rules calculator](https://wizardofodds.com/games/blackjack/calculator/)
was evaluated with six decks, S17, double any two including after split, four
hands, no resplit/hit split aces, original wager only against dealer blackjack,
no surrender and3:2 naturals. It reports0.40312% composition-dependent optimal,
0.42622% basic strategy with a cut card, and0.40622% basic strategy with reshuffling
each hand. Our fresh-shoe rule matches the last model, so the UI publishes an
approximate0.41% rule-based estimate, NOT a measured house edge from our server or
a guarantee about any round. Poor choices, insufficient funds for recommended
doubles/splits and timeouts can increase player losses. This is a source-backed
rules comparison, not an independently enumerated engine proof.

Exposure arithmetic: opening stake<=500, at most4hands and one double per hand
means<=4,000 Gold committed per player and<=8,000 inclusive return. Six seats bound
the table's inclusive return at48,000 and net house loss at24,000 per round. These
are conservative ceilings, not probabilities or promises of attainable payouts.
At500 opening Gold, the source-based basic-strategy expected loss is about2.03
Gold; six500-Gold openings about12.19. No jackpot, uncapped bonus or new currency
is introduced. The 15-second betting and12-second results windows bound cadence;
the final1.10 economy pass still reviews observed sources/sinks and playability.

Existing economy telemetry now records `casino_wagers` separately from
`casino_returns` (inclusive of returned stakes), on first receipt application only.
Live and offline transfers use the same categories; retries/conflicts/insufficient
funds cannot count another wager. Like the existing combat telemetry these are
operational counters, not a crash-proof financial ledger: durable character
receipts/table records remain authoritative. No generic wallet framework added.

## Connected integration checkpoint

`casino_blackjack_sessions.go` now binds actual physical seats to a durable15-second
betting lobby, real multi-player/solo dealer rounds, legal actions,30-second turn
timeouts and per-player saved settlement. Confirmed bets continue after leaving;
timeouts stand and receipts preserve payouts. A completed table shows results for
12seconds, then opens a new round. The shutdown-aware server loop advances/retries
once per second; startup replays pending funds before accepting logins. Loaded
production rounds validate card conservation, turn shape and settled return math.

Network requests use current seat session, round identity and round revision.
Public payloads expose only the explicit redacted game view; the private shoe is
never serialized to clients. The cached table view avoids per-observer database
reads. Pending-account admission recovery fences commands/login/resume for that
recipient only; ordinary movement has no table database query.

The [local 1.10 quick-play revision](2026-09-13-casino-quick-play.md) supersedes
the review/confirm flow below with direct cost-labelled actions and pending locks.

The seated UI displays both players' hands, dealer upcard/hole-card back, current
turn, balance, stakes, outcomes and saved-return state. Bet/split/double each
require explicit confirmation of Gold cost. New round/turn updates invalidate
stale confirmations. Rules explain the payout convention, extra wagers and the
leave/timeout behavior. Existing physical chairs, poses, camera, controls and
explicit Leave are retained. Other casino games remain future content.

Focused evidence: actual two authenticated sockets with real15-second betting
window, shared turns, normal Gold, saved payouts and post-settlement server restart
PASS29.562s. Logs `/tmp/eidolon-compat-session-2450009085/server.log` and
`/tmp/eidolon-compat-session-4072011933/server.log`. This is NOT an actual mid-hand
process-restart test; prior persistable-shoe and transfer-recovery checks cover
those lower-level boundaries. Owned loopback Mongo32919 stopped afterward.

Rendered chair/card/stake/split-cancel/390px/Leave fixture PASS27.6s total; screenshot
`/tmp/eidolon-casino-seat-view-20260913.png` inspected. This is a rendering fixture,
not the authenticated socket route or an actual phone. BlackjackUI+CasinoController
6testsPASS2.953s, persisted shoe validationPASS0.044s, changedJS lint/client prep/
Go build-all/diffPASS. The pending-account admission gate has its focused test.

Initial network attempts exposed fixture issues, not changed game rules: inactive
socket world updates were not continuously drained, then the reused login helper's
10-second read deadline outlived its purpose. Both readers now drain continuously
with that deadline cleared. Browser fixture's prior last-message assertion raced
the ordinary get refresh; it now asserts the exact emitted Leave request instead.
No server assertion was weakened and no broad campaign/soak was run.

Before1.8 publication: finish casino source/sink telemetry and review/publish house
advantage/exposure, then synchronize login/server/package versions and cumulative
1.8 notes. Full slots/poker/town relocation/two-floor/VIP content remains required
in the following stages. VIP currency remains undecided, with no Gold fallback.

## Durability handoff (implemented)

Durable transaction slice now implemented: `casino_blackjack_tables` stores one
private game-state document per physical table with a compare-and-swap version.
A pending transfer records its immutable Gold amount/recipient and proposed next
state with majority+journal acknowledgement BEFORE any character debit. Pending
funds block all other table advances. Existing signed Gold receipts and complete
character-save journaling apply the change, then the table accepts the candidate.
Only a confirmed insufficient-funds debit may reject its candidate; save failures
retain the intent and earned payouts cannot be discarded. Recovery rereads the
current record, so stale work cannot debit an already resolved operation.

`server/casino_gold.go` reuses the existing credit path and signed debit receipts;
it does not create a casino wallet. The account lock must precede the table lock.
Background work must release the table lock before acquiring any account lock;
never hold one player's account lock while acquiring another's. Public transfers
accept only Gold and bounded amounts (debits up to500, inclusive payouts up to8000).
The database document is private and is never sent directly to a browser.

Focused evidence: database intent/replay/concurrent-CAS/currency checks PASS0.352s
on explicit disposable Mongo; actual character+table recovery with reopened journal
and repository PASS0.278s, including interruption after a stake/payout full save
but before table acknowledgement. Live-character interrupted-save/receipt checks
PASS1.327s; competing account spends PASS0.059s. Go build-all/diffPASS. The initial
legacy TestApplyGold selection matched no tests and is not counted as evidence.
Owned Mongo was stopped after these focused checks. This is not a live wager UI.

Next concrete integration: server-owned betting lobby with individually confirmed
stakes, immutable participants at deal, shared rounds/views, turn deadlines and
per-player payout completion. Reuse the serverLoops shutdown-aware scheduler.
The protocol already holds the caller's account-work lock; take table locking
inside it. Background recovery/payouts take recipient account lock first, then
table lock and reread pending state. Recover intents before exposing playable
state. Add the seated rules/stakes/card/action/result UI only after this binding.

Wire the engine to authoritative table membership and seated UI through durable
round operations. Reuse existing account-work serialization, Gold debit/credit
receipts and character-save durability; do not invent a parallel wallet. Record
round intent before debit, persist acceptance before publishing, and recover
unfinished acceptance/settlement exactly once before players can spend again.
Check each currency boundary and failure point with focused tests. Keep wagering
disabled until those safeguards and a real seated round pass.

Display these rules, current balance, stakes and the additional split/double cost
before confirmation. Calculate/review the house advantage and total bounded house
exposure before release. No progressive jackpot or VIP fallback is implied.
