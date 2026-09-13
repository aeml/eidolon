# 1.5 economy decisions and casino settlement boundary

This is the concrete economy handoff to the later casino milestones, not a claim
that the casino games exist. Ordinary Gold stays the public floor's currency.
The future VIP currency is deliberately unnamed and undefined.

## Source-backed purchasing-power pass

The prior ordinary kill purse was uniformly 10 through `10 × enemy level + 9`.
At level100 that averaged509.5 Gold per kill before Fortune/difficulty/party
modifiers. The level100 mystery box costs3468 Gold and a single-category respec
costs6000. Thus100 ordinary kills alone averaged50950 Gold: about14.7 boxes or8.5
resets, before vendors, rooms and quests. That made a weekly15000 Gold raid cache
comparatively small.

1.5 changes ordinary purses to10 through `2 × level + 9`, with twice that range
for elites. Boss purses retain the original range, including elemental raid bosses.
Existing party distribution, difficulty and Fortune modifiers remain unchanged.
At level100, ordinary mean Gold is109.5:100 kills yield10950 before those modifiers,
or3.2 boxes /1.8 single-category resets. This is purchasing-power arithmetic, not
a measured statement about time to earn, and excludes vendor loot.

New100-kill hunt contracts pay `max(100, contentLevel × count / 5)` Gold, up from
`/10`, making deliberate quest completion a roughly20% bonus to the reduced purse
at higher content levels. A level90 hunt now averages11750 Gold including its new
1800 Gold contract, versus46850 previously; about2.35 rather than9.37 talent resets
at that level. Accepted quest quotes, earned balances, story rewards, boss contracts,
dungeon-room rewards and weekly claim receipts are preserved.

Resonance stays at5,000,000 XP per point. The weekly cache grants1,000,000 (20% of
a point), plus its ordinary encounter rewards. Fortune remains1% per rank, capped
at50 ranks; Well Rested adds25% enemy XP, for a combined maximum1.875× base enemy
XP. Existing point ownership and rank caps remain authoritative. No conversion
from Resonance to casino currency is introduced. These limits, deliberate Gold
sinks and the leaner ordinary purse are the1.5 tuning, not a new XP curve or a
retroactive reduction of earned progress.

Forge upgrades continue consuming their existing Shards/Hearts/gems, not newly
invented Gold fees. The UI now makes exact gains and material balances visible.
Existing source/sink telemetry remains the basis for the final consolidated
playability/balance pass; no extra soak is required for this milestone.

## Currency contract for later casino implementation

Game/session code must request a currency adapter selected by the physical table
or machine configuration, never by a client-supplied wallet name. Public-floor
configuration resolves only to normal Gold. VIP configuration must fail closed
until its separate currency service and product rules exist: never fall back to
Gold, Resonance, a placeholder purchasable token, or an implicit exchange rate.

The adapter contract needs three operations: obtain spendable balance; reserve an
integer wager with a stable round/player operation ID; settle or refund that same
reservation exactly once. All amounts use checked integer arithmetic. Currency,
stake, maximum payout and rules version become immutable when the wager is accepted.
This is a design contract, not an unused general-purpose wallet framework to build
in1.5. Implement the adapter alongside the real seated games in1.9 and the real
VIP currency integration when its upstream system is ready.

## Round, seat and failure rules

- The authoritative server owns seat occupancy, allowed wagers, rules, shuffled
  decks/RNG and results. The browser supplies player choices only. A physical
  interaction acquires a seat/session before betting; one active wagering session
  per character. Other players see real occupied seats.
- Reserve Gold atomically with the round participant record, under the existing
  account-work serialization and durable journal/database receipt discipline.
  Never subtract a client-reported balance or acknowledge before durable acceptance.
- Accepted wager and settlement IDs survive reconnect/restart. A retried request
  returns the original receipt; it does not spin, deal, pay or debit again.
- Blackjack permits one or more real players against the dealer. Poker waits for
  enough real players; no house-controlled replacements. Server-authoritative
  turn deadlines handle disconnects according to published game rules.
- Poker pots conserve committed contributions minus any explicitly displayed
  rake. House-game payouts come from the configured, bounded payout rules and
  exposure limit. Wagers and pending payouts cannot be spent simultaneously through
  trading, stash services, guild banking or another table.
- Leaving returns camera/control but does not erase a committed round. Recover
  unfinished rounds from their durable state. If a round cannot be resumed and
  no result was committed, apply the documented refund policy once; never both
  pay a result and refund its wager.
- Publish game rules, bet limits, payout tables and house advantage before the
  player confirms a wager. Record stakes, payouts, refunds and any rake separately
  from monster/quest income in economy telemetry. Keep cooldowns/session limits
  configurable and avoid progressive jackpots without reserved funding.
- Before releasing casino wagers, focused checks must cover concurrent spending,
  replay, insufficient funds, integer bounds, duplicate seats, disconnect/restart
  at reservation and settlement boundaries, pot conservation and wrong-currency
  rejection. These are currency-safety checks, not a new per-version soak matrix.

The town layout, two physical floors, seated views, themed slots/bonus mechanics,
multiplayer tables and VIP atmosphere remain in the main1.10 roadmap. This document
does not shrink that scope or define purchasing, cash value, exchange or premium
currency policy before the user has chosen them.
