# Fourfold Hold’em — local 1.9 implementation

## Current rules — September20 reconciliation

Poker is implemented and delivered, including the
[connected EP hand and restart correction](2026-09-14-vip-poker-connected-recovery.md).
The original sections below are historical, not the current stake limits,
currency decision or deployment status. Public buy-ins are100–100,000 Gold in
steps of100 with5/10 blinds; VIP buy-ins are10–100 EP in steps of10 with1/2 blinds.
The30-second betting window repeats without inventing opponents; at least two
connected, funded real players are required. Every new hand still requires an
explicit buy-in. Turns last30seconds and results12seconds. The old500-Gold cap,
3,000-Gold table exposure and15-second joining window below are superseded.
Payments remain excluded. Busy-floor, integrated visual and broader economy
acceptance remain open; physical-phone play is user-deferred.

Sources: `server/internal/game/casino_currency.go`, `casino_poker.go`,
`server/casino_table_clock.go`, `casino_poker_sessions.go`, and `src/ui/PokerTableUI.js`.

## Original implementation record

Implemented and packaged in1.9 candidate, NOT verified deployed. Physical table/seats/
camera now connect to poker_buy_in, poker_play and a dedicated seated UI.
Runtime metadata is now1.9; its own CI/deployment/live verification remains.

## Chosen table rules

- Two to six real funded players; no solo deal, bots, rake or house opponents.
- No-limit Texas Hold’em, securely shuffled52-card deck, two private cards,
  burned flop/turn/river and best five of seven. Folded cards stay private, as do
  uncontested winners' cards. Button rotates to the next funded seat. Heads-up
  button posts small blind, acts first preflop and last on later streets.
- Fixed5/10Gold blinds; explicit100–500Gold buy-in in steps100 for EACH hand.
  Two funded players begin a15-second joining window; all funded players must
  be connected to deal. Lone players wait for real opponents and can refund by
  leaving. No repeat-hand consent inferred from a previous buy-in.
- All betting uses the reserved stack, not additional wallet debits. Raise-to
  means total bet on this street. Minimum increment is the last full raise,
  initially10. Short all-ins reopen earlier raises only when the accumulated
  increase reaches that player's full-raise threshold. Short calls remain
  eligible only for covered pots. Derived side pots, uncalled excess returns,
  ties and odd Gold clockwise left of the button. Maximum funded total3000Gold.
- Thirty-second turns: timeout checks if free, otherwise folds. No automated
  extra bets. Disconnect seat grace60seconds does not stop the turn timer.
- Leaving before deal durably refunds buy-in BEFORE releasing the physical seat.
  Explicit mid-hand leave durably folds a remaining stack; all-ins retain their
  eligibility. Unspent stack AND winnings cash out after the hand, even offline.
  Results remain12seconds before a new lobby; every hand needs new confirmation.

## Persistence, privacy and reconnection

Reuses legacy-named casino_blackjack_tables opaque private JSON/version/pending
intent, signed Gold receipts and full-save journal. No new wallet, transfer-cap
change or VIP currency choice. Pending writes fence their own account even on
ambiguous acknowledgement. Validate recovered intents against exactly one lobby
buy-in/refund or the recomputed completed-hand payout. One account lock BEFORE
poker table lock; no cross-account locking. One recovery recipient per tick.

Saved round validation checks cards/conservation and recomputes winners/payouts.
Public views omit deck, burns and private seat tokens. Only recipient hole cards
or non-folded showdown cards are exposed. Actions require current authenticated
seat token, round ID and revision. In-progress hands reserve funded non-folded
seats; their original accounts can use new connection tokens at the original seat
after restart. Missing entities get60-second restart seat grace; turn deadlines
still apply. Explicit leaving/reseating cannot undo a saved fold or refund.

## UI and reusable focused evidence

The [local 1.10 quick-play revision](2026-09-13-casino-quick-play.md) replaces
Review/Confirm with direct cost-labelled actions. Each hand still requires an
explicit buy-in click; existing table rules and persistence are unchanged.

Phone-sized felt, community/private cards, active player and dealer markers,
stack/street/committed Gold, main/side pots and authoritative cash-out display.
Review/Confirm buy-ins, raises and all-ins; explicit call cost. Legal server
actions only, duplicate-click lock, stale quote invalidation and unchanged-poll
input/focus preservation. Rules explain Gold custody, waiting and leaving.
Existing controller owns camera/seat/input/leave; no minigame menu bypass.

- Poker rules PASS0.041s: hand categories/kickers/wheel/best-of-seven, minimum
  real players, blinds/turns, side pots/uncalled returns, ties/odd chips, privacy,
  short all-ins, stale actions, leave/timeouts and100 small seeded legal hands
  checking conservation. Rule evidence, not earned play or an endurance run.
- Actual disposable Mongo handler/storage checks PASS0.723s: funded live seat
  entities, idempotent buy-in, solo waiting, deal/private view, cache reload/new
  seat token, cash-outs, pre-deal refund and saved debit-intent recovery. Added
  payout-receipt-before-intent-resolution case PASS0.514s. NOT network-client or
  full-process restart evidence; the tests call the real service handlers.
- Poker UI/controller8tests PASS1.593s; changedJS lint and Go build-all PASS.
- One390px rendered component PASS8.6s; screenshot
  /tmp/eidolon-poker-phone-20260913.png inspected. Actual UI with prepared
  responses, NOT a connected multiplayer table/camera scene. No broad matrix.

Actual two-player socket hand now PASS40.210s, including the normal15-second
joining window, private cards, process stop/start DURING the hand, new seat tokens,
unchanged cards, stale-turn rejection, full check/call showdown, cash-outs and
saved Gold conservation. Logs /tmp/eidolon-compat-session-1196209317 and1493643058.
The first fixture over-polled and hit the normal casino limit; fixed fixture
cadence, NOT the production limit. No repeat of unchanged rule/UI/Mongo suites.

Slot tuning and event-site/shared-presence checks also completed for packaging;
see the1.9 release plan. Final connected floor/camera, earned encounter and broad
cross-game checks remain consolidated1.10 work, along with separate-currency VIP.
The currency question still awaits the user; full goal remains active.
