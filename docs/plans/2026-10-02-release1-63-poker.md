# Alpha 1.63 Holdem timeout and settlement preparation

Hold'em preparation combines earlier saved timeout ownership work with clearer
seat and payout presentation. It is not published. Source defaults remain at
prepared 1.62 until that predecessor is accepted; this is not full casino or
roadmap acceptance.

## Player behavior

A 30-second decision timeout preserves the existing check-for-free or
fold-to-a-bet rule. The server captures the actual funded chair's current session,
saves the timeout decision and private release fence, then releases that chair
outside the table lock. This includes legitimate returns with a new live token.
Later ticks retry only the captured session and cannot evict replacement patrons.

After a free check and chair departure, the existing withdrawal flow folds the
remaining live stack. Committed chips remain in their pots, unspent funds settle
normally and all-in hands remain eligible under the existing rules. The private
marker is never part of a public table reply. Legacy no-marker records remain
readable; invalid markers and markers in a betting lobby are rejected.

The table continues to display occupied seats, dealer and hand state. When a
chair is reused, its earlier hand identifies the original owner without exposing
hidden opponent cards. Cash-out captions stay pending during settlement or
processing; the win celebration waits for saved completion. Limits, secure
dealing, side pots, raise rules, wallets and payout amounts are unchanged.

The earlier draft that folded immediately even when checking was free was
replaced before publication to retain the documented decision rule. Both drafts
are preserved in local history; the earlier passing test is not final acceptance.

## Focused evidence

- Reconciled disposable-Mongo race checks passed in 11.176 seconds. Five scenarios
  cover Gold and EP cash-outs, a current chair, a rotated reconnect token,
  free-check and facing-bet deadlines, early-tick protection, claimable chairs,
  public redaction and repeated one-time per-recipient settlement. Private-marker
  and legacy-record checks passed in the same run. The task container and its
  anonymous volume were removed; production records were untouched.
- Pure poker rule, hand and pot race checks passed in 1.194 seconds, retaining
  ranking, blinds, minimum real-player count, private cards, side pots, ties,
  raise rights, all-in eligibility and conservation.
- Three presentation suites passed 24 checks in 0.803 seconds, including hidden
  opponent cards, prior-occupant captions, pending payout wording, countdowns,
  focus and manual action controls. Full lint and whitespace checks passed.
- The existing 390px native presentation route passed in 4.1 seconds; the
  rendered private cards, raise controls and safe exit were inspected. This
  synthetic table presentation is not physical-phone or connected-play evidence.

The existing CI Server Tests job adds these short fixtures to its disposable
card-table check before ordinary socket fixtures occupy shared tables. It adds
neither another job nor a long campaign. Connected restart/VIP receipts remain
separate retained evidence; these prepared timeout timestamps do not prove a
real-time multi-device timeout or physical-phone comfort.

## Prepared work preserved for subsequent milestones

Earlier local branches contain reusable house-table, slots, EP wallet, cosmetics
and membership changes for 1.64–1.68. Preserve and reconcile their individual
commits with current public-name authority and session guards rather than
merging their older release defaults or publishing future milestones together.
Their source receipts remain dated October 1. Final version alignment, cumulative
patch notes, exact-source CI and public acceptance are required for each release.
