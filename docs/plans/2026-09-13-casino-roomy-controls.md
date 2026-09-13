# Casino seated layout and flexible stakes — Alpha 1.9.2

User requested publication after implementation. Packaged as Alpha 1.9.2 with
aligned login/runtime/server/deploy versions and cumulative in-game patch notes.
Deployment must be verified against the exact release commit before claiming live.
The implementation evidence below predates release packaging.

## Player-facing patch notes

- Seated casino games use a larger desktop panel with a persistent Leave button.
  Slots place bet controls beside larger reels; on phones, reels precede the
  controls in a scrollable layout with touch-sized buttons.
- Slots separate Manual and Auto play. Type a Gold amount or use ½ / 2×;
  paid spins now accept 20–500 Gold in steps of 20. Change the next stake between
  rounds. Existing animated reels and 50/100/custom auto-spin queues remain.
- Blackjack bets and poker buy-ins also gain ½ / 2× shortcuts within their
  existing limits. Submitted wagers cannot be changed while awaiting settlement.
- Saved slot bonuses/free spins retain their earned stake until finished.
  Normal play uses Gold, not EP. The upstairs guard remains locked.

## Reference and implementation boundaries

Reviewed the public [Stake.us slot controls](https://stake.us/casino/games/slots)
and [blackjack controls](https://stake.us/casino/games/blackjack): amount input,
½ / 2× actions, and slot Manual/Auto modes. Adapted these interaction patterns
using Eidolon's existing art and Gold games; no external account, wager, branding,
assets, sweepstakes system or copied game mathematics.

The server advertises slot minimum, maximum and increment. It validates bets
and keeps bonus stakes pinned. Expanded stakes raise absolute Gold exposure:
the maximum slot return is now 100,000 Gold (200 × 500), restricted to internal
slot receipt IDs. Card-table transfer limits remain unchanged. Relative odds,
paytables and bonus mechanics are unchanged; durable settlement still validates
the stored outcome against its actual payout.

Old clients can continue their 20/40 Gold bets; new clients conservatively show
20/40 when talking to the old server. **Rollback warning:** after enabling stakes
above 40, the old 1.9.1 backend cannot decode those saved slot sessions. Any
rollback must retain the expanded stake/payout decoder and receipt bounds;
do not blindly restore the old binary or discard player bonus state.

EP policy quantities were separately recorded as 1,000,000 Gold → 1 EP and
100 EP per VIP month, one-way and cosmetic-only, with no payment integration.
This batch does not implement the EP wallet, exchange, allowance or vendor.

## Focused verification

- Client: 33 tests across SlotMachineUI, BlackjackTableUI, PokerTableUI and
  CasinoController. Covers stake changes, shortcut/pending locks, auto queues,
  saved bonus stakes, rejection handling and seating lifecycle.
- Go: focused slot game/database tests passed; focused server slot/casino
  action-error/Gold tests passed. Includes 20–500 validation, maximum jackpot
  save roundtrip, bonus stake rejection and separate card/slot transfer limits.
  Mongo-gated integration tests were not enabled; no database was started.
- Browser: slot presentation, poker presentation and casino seating all passed
  (3 tests, 26.5s). Screenshot review caught CSS overriding hidden Auto controls;
  fixed specificity and added actual visibility assertions. Affected slot test
  rerun passed (12.5s) on 390×844 and 1440×1000 viewports; no horizontal overflow.
  Reviewed updated desktop screenshot. This is fixture evidence, not live QA.
- ESLint on changed JavaScript and git diff whitespace check pass. The client
  uses static modules served by the browser fixture; there is no bundle build
  script. No broad soak, full release matrix or production change was run.

Temporary screenshots: `/tmp/eidolon-casino-roomy-desktop.png` and
`/tmp/eidolon-casino-roomy-phone.png` (not durable repository assets).
