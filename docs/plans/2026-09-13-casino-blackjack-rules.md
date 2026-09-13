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
