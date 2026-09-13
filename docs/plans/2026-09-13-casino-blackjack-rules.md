# Lanternhold Blackjack — round and integration rules

Implementation candidate, not enabled wagering. Rules version `lanternhold-s17-v1`.
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

## Required next integration

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
