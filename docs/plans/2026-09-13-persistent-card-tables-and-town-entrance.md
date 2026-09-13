# Persistent card tables and town entrance — local, unreleased

Follow-up to deployed Alpha1.9.3 (`03373b0f`). User requested a stable multiplayer
table UI, smoothly ticking timers and automatically recurring betting windows,
then reported the casino roof, missing door hover cue and obstructive stash.
Implemented locally; no version bump, push or deployment in this batch.

## Next release patch notes

- Blackjack and Hold’em retain one six-seat felt, dealer and physical seat layout
  through betting, playing, saved results and the next hand. Unfunded seated
  players, reconnect reservations and open chairs stay represented. Your seat
  is highlighted and the active player has a clear turn outline. Cards update
  inside stable seat containers; long split hands scroll within their seat.
- Table clocks tick locally every second from server deadlines, rather than
  changing only on three-second polls. Monotonic anchors account for device clock
  skew; unchanged polls do not restart the timer. Clock expiry disables actions
  but never invents a server deal, timeout or wager. Leaving clears the timer.
- Betting windows last30seconds independently of a first wager. Saved results
  retain the existing12-second interval, now visibly counted down, then open the
  next betting window automatically. Empty windows repeat; Hold’em still needs
  at least two real connected, funded players. A lone player's reserved buy-in
  persists across waiting windows and is refunded normally when leaving.
  Joining/funding does not reset the shared countdown. Wagers remain opt-in:
  no automatic debit, poker rebuy, house opponent or new seat-ejection policy.
- Win panels occupy the table center instead of covering all seats/the dealer.
  Bet/buy-in controls appear below the same felt during betting; hand actions
  take that space during play. Turn inputs survive unchanged polling and roster
  updates. Stakes,3:2blackjacks, payout formulas and private-card rules unchanged.
- Casino roof now covers the upper cornice correctly. This was a rotated,
  non-uniformly scaled cone exposing the gold ceiling slab, not an extra legacy
  building. Rotation is baked before rectangular scaling; canopy footprint28×18.
- Hovering the town casino door shows **Casino**, a click/approach prompt and
  pointer cursor, with a door-only gold highlight. Existing click-to-walk and
  Enter Casino dialogue still control entry to the shared casino zone.
- Stash moved west and slightly south from(-8,185) to(-14,193), beside the Trading
  House and away from the casino approach. Server spawn, local fallback/recovery
  and town/minimap wayfinding agree. Collision follows the moved coffer.

## Evidence and scope

- Initial focused client63PASS/eight suites for cards, controller, town collision,
  maps and raycast priority. Expanded geometry/controller coverage47PASS/five
  suites. Latest affected card/controller26PASS/four suites3.438s. New tests cover
  six persistent seats, unfunded/reconnecting presence,30→29→28→27 without polls,
  wrong local clock, duplicate polls, next-window timer, expiry and timer cleanup;
  roof bounds and actual door raycast/highlight reset also covered.
- Focused server casino/blackjack/poker tests compile/pass. Disposable loopback
  Mongo ran `^Test(PokerMongo|BlackjackMongoIndependentTablesAndDebits|CasinoTableClock)`:
  PASS1.993s. Includes duplicate buy-ins, privacy, interrupted payout recovery,
  conserved Gold, completed→empty betting→next empty window with no wagers, and
  independent blackjack tables. Owned temporary Mongo container stopped/removed;
  no production database touched and no soak started.
- Browser existing celebrations, poker controls and full generated town approach:
  4PASS30.7s,301walking/site samples with zero blocked samples. Town roof/stash
  screenshot reviewed. New full-six-seat desktop/phone fixture caught real layout
  overlaps; fixed seat footprints and compact card text resolved them. Final
  affected2PASS17.3s includes no overlapping seats/dealer/clock, live ticking,
  visible hand-action buttons, preserved presence through results/betting and
  no horizontal overflow. These are UI fixtures, not six connected live clients.
- Changed JavaScript lint and git diff whitespace checks pass. No broad release
  suite or CI run started. No owned browser/static-server/DB processes remain.

Visual evidence: `/tmp/eidolon-blackjack-six-seats-390.png`,
`/tmp/eidolon-poker-six-seats-1440.png`, corresponding other viewport/game files,
and `/tmp/eidolon-world19-town-20260913.png`.

Public reference: [Stake poker](https://stake.us/casino/games/poker) and public
table screenshots. Signed-in playable sessions were not accessible; no claim
of live-session parity or copying their assets/rules. EP wallet/games, payments,
and the remaining1.10 roadmap are unchanged and incomplete. Preserve1.9.3's
high-stake receipt compatibility on any rollback; never erase funded rounds.
