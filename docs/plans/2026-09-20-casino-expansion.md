# Expanded Lanternhold Casino — next deployment batch

Status: local implementation in progress; **not deployed or fully verified yet**.
Keep this batch intact until roulette and baccarat have functioning shared games.
Parent: [casino roadmap](2026-09-09-town-casino-roadmap.md).

## Implemented locally

- Two equal 112×112 decorated floor scenes, separately visible. Only the active
  floor's patrons, attached effects and furniture appear. Guard/stairs transfer
  between public Y=0 and server-authorized VIP Y=8, both landing at Z=104.
- Each floor's catalog contains 4 blackjack, 4 Hold'em, 2 roulette, 4 baccarat
  and 32 slot stations: 92 total. Numbered slots retain owner/theme/currency
  entitlements instead of treating each cabinet as a new free-spin wallet.
- Expanded safe-zone bounds, walk containment, physical obstacles and generated
  administrator landing geometry agree with the full-floor footprint. Retired
  fifth public blackjack table is unseatable but keeps funded-round recovery.
- Stash moves to (-28,193), west toward the Trading House; obsolete entity-sync
  override removed. Local fallback and map markers agree. Casino doorway gains
  a “Lanternhold Casino” nameplate and matching hover title.
- [Automatic administrator VIP plus 100 monthly EP](2026-09-20-admin-vip-allowance.md)
  is included in this release batch, not a separate partial deployment.
- Pure roulette/baccarat rules, cryptographic outcomes, currency limits and
  payout bounds are implemented. New tables have distinct procedural furniture.
- Shared rounds now use the existing durable table and full-character receipt
  system. Startup, per-account admission recovery and periodic settlement are
  wired. Each table runs a 30-second betting window, a six-second reveal, saved
  payouts, then a 12-second result pause and the next window without a first bet.
- Betting UI is wired to authenticated `house_bet` requests. Default single-spot
  bets take one click; an optional slip builder combines multiple positions under
  one total cap. Confirmed slips are immutable for that round. Stake controls can
  prepare a different amount for the next round. Dealer/seats remain visible;
  countdowns interpolate every second, results animate, and saved wins celebrate.

## Game rules

Single-zero roulette includes straight, split, street/trio, corner/first-four,
six-line and outside bets. Winning returns include the original stake; straight
returns 36×. Zero loses outside bets. Punto banco uses an independently shuffled
eight-deck shoe per round, natural stopping and standard mandatory third cards.
Player profit is 1:1, Banker 1:1 less 5% commission, Tie 8:1; ties return Player
and Banker stakes. Rules checked against
[NJ game rules, sections 3.3, 3.9 and 5.2](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf).

Implementation policy: the entire accepted slip, not each selected spot, is
capped at 100,000 Gold or 100 EP. Baccarat uses 20-unit steps for exact integer
commission; roulette uses 20 Gold or 1 EP steps. No currency conversion or
payment flow. Receipt maxima: roulette 3.6m Gold/3,600 EP; baccarat 900k Gold/900 EP.

## Verification and remaining work

- Focused server rules/layout/admin-landing/currency checks pass (game 4.286s,
  database 0.014s, main 0.805s). This is not Mongo/connected-game acceptance;
  opt-in disposable database cases were not enabled in this command.
- Six focused client suites pass, 43 tests/4.932s: floor visibility, collision,
  stash sync, map markers, VIP controls, and generated teleport geometry parity.
- Disposable loopback Mongo checks now pass for both games and both currencies:
  two funded seats sharing one result, idempotent wager retries, continued
  settlement after leaving/membership failure, currency isolation, next-round
  and idle clocks. Prepared pending-debit and pending-payout interruptions recover
  after clearing the world/cache, using stored character receipts without paying
  or charging twice. Focused `TestHouse` suite PASS 3.102s; this is real database
  handler/tick coverage, **not yet actual WebSocket or rendered acceptance**.
- House/blackjack/poker/controller/clock/VIP UI regression checks: 38 tests pass,
  3.469s. Focused lint and whitespace checks pass. Reuses existing six-seat scene
  and celebration components; no new wallet, purchase flow or auto-wager loop.
- Actual WebSocket checks PASS 133.479s: two real authenticated sockets share a
  roulette Gold round and a baccarat EP round, retry identical wagers, settle
  after one guest disconnects, then reconnect to a fresh server process with
  unchanged settled wallets/receipts. Upstairs includes one administrator with
  no paid membership and one normal VIP; each receives exactly 100 EP and passes
  the guarded stairs. This checks protocol movement, not client collision paths.
  Binary: `/tmp/eidolon-house-connected-20260920-kjg81m/house-767219a1`;
  retained server logs: `/tmp/eidolon-compat-session-2791273675`,
  `2646596758`, `2288127417`, `2776053657` (same prefix). Owned disposable Mongo
  `eidolon-house-connected-20260920` removed after terminal success; no production
  accounts, roles or balances were touched.
- Canonical catalog plus actual client interior/furniture colliders: both floors
  have collision-free connected walking routes to all 116 seat exits each, with
  a full 1.25-radius actor. A one-unit flood fill checks edge midpoints and the
  final sub-unit approach to every chair; this is geometry, not rendered review.
- Updated bounded busy-floor fixture renders all 92 stations with 40 equipped
  actors (20 visible per floor), checking that the other floor stays hidden.
  Stairs and connected blackjack fixtures now use the expanded venue coordinates.
- Still required: browser review. `casino-house-layout.spec.js` covers both games
  at 390/1440 widths, but has only been authored/linted, not run or visually
  accepted yet.
- Still required: rendered expanded-floor review,
  full batch patch notes/version bump, deployment and live verification. Updated
  browser fixtures are not a claim that the new screenshots have been reviewed.
- Native Water campaign QA uses a frozen older source checkout and remains
  independent. Do not start competing native browser workloads while it runs.

Reuse the established casino transfer journal and account-lock order rather than
inventing a second currency system. Every new game must settle already funded
bets after leave/disconnect/VIP expiry and reject late or duplicate debits. Show
only persisted outcomes; keep both Gold and EP receipts/caches isolated by table.
Once these games accept live wagers, rollback builds must retain their pending
intent recovery/admission fence. Do not remove recovery while funded rounds or
unacknowledged wallet transfers remain in the database.
