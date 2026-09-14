# VIP casino games — implementation in progress

## Alpha1.9.7 — combined feature implemented and packaged

September14: functional VIP entry, server-ownedY8 floor, physical EP tables,
currency-aware handlers and UI are implemented together. Version/login defaults
and cumulative patch notes now1.9.7. Pending push/CI verification; this is not yet
a live1.9.7 claim.1.9.6 is verified live at
f99bc61e4c78b844d6f4c673960df961021b4b14 on both domains, database ready;
CI34797469252 TERMINAL SUCCESS/all ten jobs. Do not repoll that completed run.

- Trusted guard entry and new VIP seat/funding refresh account membership. EP
  ownership cannot grant entry. Public games remain Gold. Already-funded card
  actions and automatic settlement continue after expiry; unconsumed slot bonus
  and free-spin state stays owner/currency scoped. No real accounts provisioned.
- Poker has distinct public/VIP records, caches, pending owners, round IDs, shared
  rosters and recovery. Blackjack reuses its multi-table engine. Slot keys include
  EP in the owner/theme namespace. All decoders bind game currency to record ID,
  and transfer creation/shortfall handling uses the correct durable wallet.
- Six VIP stations: Crownless Court blackjack, Sovereigns' Covenant Hold'em,
  four elemental Sovereign Edition machines. Public catalog order is retained.
- Server-owned floor state cannot be supplied through movement height. Guard
  takes admitted guests toY8; rear balcony/side-gallery bounds prevent crossing
  the atrium. The landing returns downstairs, including after expiry. Seat exits,
  client picking/colliders, ground plane, camera and other seated models useY8.
  Process-restart saves restore upstairs guests beside the public guard; they
  must obtain current access again, while saved payouts/features are retained.
- Removed two decorative coffee tables/sofas overlapping new VIP card stations.
  Floor-specific geometry batches support cutaway without hiding upstairs guests.
- UI shows actual EP balance/limits/blinds for every game and wager adjustment,
  result, pot, celebration and auto queue. No Gold fallback. New anonymous CI
  fixture checks rendered phone/desktop floor/table interactions.

Focused verification: existing public card/slot UI tests and CasinoNavigation
pass; updated CasinoController plus new VIP UI tests11PASS. Version/UI checks
266PASS2.351s. Mongo public poker/slots/blackjack compatibility passed except two
index-based fixtures caught public catalog reordering; fixed by preserving public
order, failed changed-path checks thenPASS. Floor QA caught the shared movement
reset flatteningY8; reset now precedes the landing transform with a fresh movement
context. Corrected floor/slot/VIP poker integrationPASS0.785s/main and0.012s/game.
Additional two-player EP blackjack settlement after expiryPASS0.396s. Currency
recovery evidence from the previous implementation remains valid; no repeat soak.

Rendered VIP fixtures390/1440 bothPASS11.9s. Reviewed actualWebGL balcony and
phone table screenshots `/tmp/eidolon-vip-balcony-1440.png` and
`/tmp/eidolon-vip-table-390.png`: shared seat/dealer layout, EP-only visible text,
usable scrollable phone panel andY8 exit. Initial fixture failure inspected
hidden inactive Gold minigames via textContent; assertion now checks rendered
innerText, retaining visible-currency guarantee. Lint/build/diff checks pass.
Disposable `eidolon-vip-tables-qa-20260914` stopped/removed; only its QA data was
discarded. No runner changes, bridge interfaces, production VIP grants or wagers.

Release next: push this combined batch, keep its exact new CI handle, then verify
both live SHA/version endpoints. Full1.10 remains active: audit remaining roadmap
features and complete the consolidated acceptance rather than declaring the
whole goal done because the casino now works. Earlier sections below are history.

## Implemented locally, not released

September 14: EP settlement and currency-aware game rules are implemented. This
is internal progress toward the combined VIP floor/games release, NOT a finished
VIP casino and NOT a separate version bump. Keep the full1.10 scope active.

- `EPCasinoReceipts` is separate from Gold receipts, exchange receipts and monthly
  allowance receipts. Signed EP debits/credits, exact retries, mismatched receipt
  rejection, insufficient EP and integer overflow are validated before mutation.
- Character hydration, private entity copies and full journal saves preserve the
  ledger. Settlement pins a live character until durable save and works offline.
  Earned payouts don't depend on current VIP membership or being in the casino.
- The existing table intent/recovery path selects the wallet from immutable
  record identity. `vip-blackjack`, `vip-poker`, and
  `slots:ep:<64-character lowercase owner SHA256>:<theme>` require EP. Public/legacy
  records keep Gold. Malformed VIP IDs, cross-currency intents and unknown
  currencies reject, including direct attempts to use the Gold delivery helper.
- EP caps:100 per debit; blackjack total return≤1600 (four doubled hands),
  poker≤600 (six100EP stacks), slots≤20000 (Fire free-spin jackpot). A confirmed
  EP shortfall resolves the unaccepted intent without consuming Gold. Save/IO
  errors retain recoverable intent. EP doesn't enter Gold economy telemetry.
- Existing game engines now accept an explicit server-chosen currency through
  `NewBlackjackRoundForCurrency`, `NewPokerRoundForCurrency`, and
  `NewSlotSessionForCurrency`. Persisted Currency is retained through proposals,
  restore and validation; empty retains legacy Gold. Existing public constructors
  are unchanged in behavior. No client payload can currently enable these games.
- Whole-EP denominations: blackjack2–100 in steps of2 keeps natural3:2 exact;
  poker10–100 buy-ins in steps of10 with1/2EP blinds; slots10–100 in steps of10
  gives all ten paylines whole-EP stakes. Shared `CasinoBetLimits` and
  `PokerBlinds` supply future handler/UI metadata. Do not round small line wins
  away or present Gold values under an EP label.

## Evidence retained

Focused database/world/handler checks pass: receipt replay, balance bounds,
cross-floor currency rejection, private snapshots, unchanged Gold/stats/XP,
unchanged Gold telemetry, failure/reopened journal for both debit and payout.
Actual disposable Mongo verifies offline debit commit/table-ack interruption,
restart recovery, EP-empty/Gold-funded rejection,20000EP payout replay and legacy
Gold recovery. Package results database0.854s/game0.184s/main0.973s. No soak.

Currency engine checks pass: exact2EP natural and doubles, restored production
shoe, real-player unequal EP side pots with conserved130EP,1/2blinds, solo poker
rejection, all four slot themes, paid stake changes, saved bonus/free-spin stake
retention, exact lines and20000EP maximum jackpot. Existing affected blackjack,
poker and slot rule tests pass0.045s; new EP rules pass0.016s. `go build ./...`
and diff whitespace checks pass. No browser tests run: no client changes yet.

Disposable container `eidolon-ep-casino-qa-20260914` stopped/removed after checks;
only its QA data was discarded. It used host networking, loopback38761, no new
bridge interfaces. No production accounts, balances or VIP periods modified.

## Next work — finish the feature, not another groundwork-only release

1. Wire table sessions to explicit currency and bind decoded state to immutable
   record currency. Blackjack already caches multiple tables. Poker currently
   hardcodes public-poker throughout: generalize actual independent VIP table
   cache/load/recovery/seat roster, don't share the public hand or fake currency.
   Slot owner/theme record keys must include EP namespace and state.Currency
   must agree with it. Public legacy keys/entitlements remain unchanged.
2. All transfer creation uses record currency and `casinoInsufficientFunds` for
   both currencies; existing handler error branches still mention only Gold.
   Views need currency, real wallet balance and currency-specific limits/blinds.
3. Refresh trusted account membership for upstairs entry, new seat/new wager and
   blackjack extra split/double funding. Do not require membership to recover
   money, finish funded turns or consume already-earned bonus/free spins. Wallet
   source failures must not erase the saved entitlement. EP ownership isn't VIP.
4. Implement guarded entry/return in the shared zone at actual balconyY8, with
   server-owned floor state, movement bounds, restore/reconnect, seat+exitY,
   furniture/collision/camera/ground plane and cutaway consistency. Never reuse
   obsolete small-town Y6 stairs. UI guard is not an access-control boundary.
5. Add genuine upstairs EP machines and multiplayer tables; currency-aware
   display/controls retain continuous timers, shared layout, auto-spin pauses and
   celebrations. Focused server integration and rendered desktop/phone checks.
6. Package completed batch with matching version/login/patch notes; push only
   after current1.9.6 CI34797469252 finishes. Last observation: server/client and
   browser3/3 passed, browser1/3 and2/3 running. Continue that exact handle, not a
   replacement.1.9.5 is last verified live; its CI is complete. Then finish the
   remaining full roadmap/consolidated1.10 acceptance, not just this casino list.

Rollback must preserve EPCasinoReceipts alongside existing EP/allowance/exchange
fields and cosmetic ownership. Do not deploy a server that drops these fields
once EP play has been enabled. Payments/purchases remain out of scope.
