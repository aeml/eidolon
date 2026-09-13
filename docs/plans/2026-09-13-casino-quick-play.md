# Casino quick play — local 1.10 changes

User requested fewer wager clicks, visible spinning reels and selectable queues
such as 50 or 100 spins. This supersedes the original review/confirm UI decisions
in the blackjack, poker and elemental-slot handoffs. Not deployed yet.

- Slots: choose stake and click **Spin · N Gold** once. Blackjack: direct Bet,
  Double and Split with displayed Gold costs. Poker: direct Buy-in, Raise-to and
  All-in from the reserved stack. Poker still requires a new buy-in per hand;
  there is no automatic card-game betting. Existing limits/rules remain intact.
- Slot symbols cycle visibly, then five reels stop in sequence before line wins,
  cascades and result audio. Reduced-motion mode uses a short static transition.
  Outcomes still come exclusively from the server, not the animation.
- Auto-spin has 50/100 presets and a custom integer count of 1–1000. Displays
  total possible stakes before starting; selected stake is fixed during a queue.
  Each spin awaits its authoritative revision, saved settlement and animation
  before the next one starts. No bulk debit, parallel requests or auto retries.
- Saved free spins retain their original stake and count toward the requested
  number of spins. A bonus choice stops the queue for manual selection. Leaving
  preserves earned bonus/free-spin entitlements but discards unstarted spins.
- Stop cancels only unstarted spins; a wager already submitted still settles.
  Hidden tab, connection trouble, result timeout, insufficient Gold, unavailable
  state, seat/session/machine changes and departure stop auto-spin. Queues are
  session-local and never automatically resume after reconnect.
- Duplicate clicks remain locked across unchanged polling responses. No change
  to server odds, payout math, currency receipts, seat authority or EP policy.
- Server sends a scoped `casino_action_error` acknowledgement containing the
  rejected seat/action/round identity. Only the matching pending command unlocks;
  a rejected spin cancels auto-spin without retries. Ambiguous settlement still
  uses the existing server processing fence and recovery, not a presumed refund.

Verification is focused on changed UI/queue behavior and phone presentation;
reuse existing unchanged server settlement/replay/recovery evidence. This is not
a new full-casino integration or populated-floor performance acceptance.

Focused evidence: 29 UI/controller tests PASS7.18s, changed JavaScript lint and
diff check PASS. Existing selected server slot/cache/save tests PASS0.132s;
new explicit rejection identity test PASS0.067s. Mongo-gated tests were not run
again. Phone poker PASS15.9s; phone slots PASS19.7s, including changing reel
symbols, single-click wager, saved bonus choice, 100-spin preset and Stop.
The 390px slot screenshot was inspected at
`/tmp/eidolon-slot-phone-20260913.png`; controls fit the scrollable panel.
Blackjack chair/camera/phone/leave PASS20.0s after fixing an obsolete test locator
that waited for the old Split/Cancel confirmation (initial120s timeout). Only
that failed fixture was repeated. No broad matrix, load test or soak launched.
