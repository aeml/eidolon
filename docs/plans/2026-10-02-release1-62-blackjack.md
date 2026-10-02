# Alpha 1.62 blackjack fairness and presentation

Blackjack preparation fixes timeout chair release and makes saved hand results
clearer without changing odds, stakes or payout amounts. It is not published;
the accepted 1.60 and 1.61 releases must precede it.

## Timeout ownership

A successful server timeout still stands the current hand, but now releases the
exact chair session that funded it. The release happens after the round update
is saved and outside the table lock. It does not debit, refund, cancel or reroll
the accepted wager. Remaining funded hands continue through ordinary server
transitions and settlement.

The private funding record retains its seat-session binding; public table views
remove it. A stale timeout cannot eject a later occupant or the same account
after acquiring another session. Legacy saved hands lacking that binding remain
valid and retain their prior stand-only behavior rather than guessing which
current chair to eject. Disconnect reservation remains 60 seconds.

## Hand and payout presentation

When an earlier participant leaves and the physical chair is reused, their dealt
hand explicitly identifies its original owner instead of appearing to belong to
the new patron. The seat name and available actions still follow current
presence and the server turn.

Each result distinguishes a natural's 3:2 profit, an ordinary win's 1:1 profit,
a push refund, bust or loss. Currency is described as pending until the server
reports completion without processing or unavailability. The existing win popup
continues to use actual returned currency minus actual committed stakes; no
client award is invented.

## Focused local evidence

- Three client suites passed 53 checks in 1.636 seconds, including all five
  result categories, chair replacement, private dealer cards, pending actions,
  persisted seat UI and 30/29/28/27 countdown behavior without polling resets.
  Full lint passed.
- Pure blackjack rules and exact-session chair release passed under the race
  detector in 1.085 seconds. Three server projection, cache-separation and empty
  betting-clock checks passed in 1.051 seconds. Separate saved-binding validation
  passed in 1.064 seconds; counts overlap and are not additive.
- A fresh task-owned Mongo instance exercised actual wager debits, persisted
  timeout transitions, settlement, saved balances and exact retries. The current
  session was released; a newly acquired session and a legacy hand were retained.
  The existing independent-table debit test also passed. Race-package total was
  4.802 seconds. The deterministic prepared 16-versus-17 shoe isolates settlement
  and is not random gameplay or an odds benchmark. The container and anonymous
  volume were removed afterward; production was untouched.
- One System Chrome phone-sized rendering case passed in 3.8 seconds with visible
  hand counts, hidden dealer card, win presentation and no horizontal overflow.
  The blackjack render was inspected. This is synthetic table state, not an
  actual phone or a connected wager.

## Remaining publication checks

Retain the [existing blackjack rules and connected acceptance](2026-09-13-casino-blackjack-rules.md)
as historical evidence, not proof that the new timeout path was already live.
Before publication, retain an ordinary connected shared-round exercise, align
version defaults and cumulative login patch notes, then require exact-source CI
and independent public frontend/backend acceptance. Hold'em timeout handling
belongs to 1.63, not this prepared blackjack change.
