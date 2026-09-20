# Expanded Lanternhold Casino — next deployment batch

Status: local implementation in progress; **not deployed or fully playable yet**.
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
- Still required: durable shared roulette/baccarat rounds and recovery; protected
  wager handlers; continuous shared countdowns; betting boards, dealer/results,
  animated outcomes and clear wins; connected settlement/reconnect evidence.
- Still required: rendered expanded-floor review, reachability of all stations,
  full batch patch notes/version bump, deployment and live verification. Updated
  browser fixtures are not a claim that the new screenshots have been reviewed.
- Native Water campaign QA uses a frozen older source checkout and remains
  independent. Do not start competing native browser workloads while it runs.

Reuse the established casino transfer journal and account-lock order rather than
inventing a second currency system. Every new game must settle already funded
bets after leave/disconnect/VIP expiry and reject late or duplicate debits. Show
only persisted outcomes; keep both Gold and EP receipts/caches isolated by table.
