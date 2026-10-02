# Alpha 1.62 blackjack fairness and presentation

Blackjack preparation fixes timeout chair release and makes saved hand results
clearer without changing odds, stakes or payout amounts. It is not published;
the accepted 1.60 and 1.61 releases must precede it.

## Timeout ownership

A successful server timeout still stands the current hand, but now releases the
current session in that player's funded chair. The server captures it when the
deadline expires; a player back in the same chair after reconnect remains the
hand's owner. The release happens after the round update
is saved and outside the table lock. It does not debit, refund, cancel or reroll
the accepted wager. Remaining funded hands continue through ordinary server
transitions and settlement.

The release compares the captured session again, so a later occupant or newly
acquired session cannot be ejected by a stale release. A participant in a
different chair only watches the earlier wager: they must return to its funded
seat to act, and its timeout cannot eject their unrelated chair. Funding records
remain unchanged. A private table-level timeout marker retains the captured
session so a later tick can retry a missed world release. Public views omit the
marker; legacy rounds without it remain valid. Disconnect reservation remains
60 seconds.

## Hand and payout presentation

The earlier prepared next-wager controls are now reconciled with these changes.
Wager controls remain visible during a hand, but edits only prepare the next
manual bet. They cannot alter accepted stakes, double/split costs or cause
automatic wagers. On phones, turn decisions precede wager preparation.

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

- Three client suites passed 56 checks in 1.637 seconds, including all five
  result categories, chair replacement, private dealer cards, pending actions,
  persisted seat UI and 30/29/28/27 countdown behavior without polling resets.
  Full lint passed.
- Pure blackjack rules and exact-session chair release passed under the race
  detector in 1.100 seconds. Three server projection, cache-separation and empty
  betting-clock checks passed in 1.067 seconds; counts overlap and are not additive.
- A fresh task-owned Mongo instance exercised actual wager debits, persisted
  timeout transitions, settlement, saved balances and exact retries. The current
  session and a resumed session in the same funded chair were released; an
  unrelated chair was retained and could not issue or receive actions for the
  earlier hand. The final reconnect/seat-action refinement passed in 4.065
  race-package seconds. The earlier independent-table debit exercise passed
  within its 4.802-second package. The deterministic prepared 16-versus-17 shoe isolates settlement
  and is not random gameplay or an odds benchmark. The container and anonymous
  volume were removed afterward; production was untouched.
- One System Chrome phone-sized rendering case passed in 3.8 seconds with visible
  hand counts, hidden dealer card, win presentation and no horizontal overflow.
  The blackjack render was inspected. This is synthetic table state, not an
  actual phone or a connected wager.
- Before the final reconnect refinement, the ordinary prepared server binary completed the existing two-player shared
  Gold round, legal turns, saved payouts and restart exercise in 44.80 seconds
  (race-package total 45.858 seconds). Both sockets saw the same public cards and
  dealer; private funding session tokens were absent. This uses real random
  dealing and normal timers, not the prepared timeout shoe. The first attempt
  failed the harness identity check because the build commit did not match the
  executable basename; rebuilding with the required identity fixed the fixture
  without weakening readiness. The task-owned database container and anonymous
  volume were removed after both attempts. Production was untouched.

The first prepared timeout implementation saved an original session token and
would therefore miss a legitimately resumed chair. It was replaced before
publication with a current-seat capture, reducing stored fields and preserving
normal reconnect behavior. Reconciliation with the earlier prepared branch
retains private saved timeout fences for release retries rather than relying
on a single world update. Exact-session stale-release tests remain.

The final reconciled disposable-Mongo checks passed in 7.626 seconds under the
race detector, covering six timeout scenarios, Gold/EP wins, resumed and unrelated
chairs, exact-once settlement, private projection and retries after a deliberately
missed world release. Invalid-marker and legacy-record checks passed in the same
run. Production records were untouched; the task container and anonymous volume
were removed. A native desktop/390px route passed in 8.3 seconds, with both
final screenshots inspected; it uses synthetic table state and procedural actors,
not live multiplayer or physical-phone evidence. The aligned version/defaults,
patch history and three blackjack presentation suites passed 365 checks in
2.462 seconds. Full lint and whitespace checks passed. A prior client command
used a nonexistent CardTableView test path; the corrected CardTableScene suite
passed. Counts overlap earlier evidence and are not additive.

## Remaining publication checks

Retain the [existing blackjack rules and connected acceptance](2026-09-13-casino-blackjack-rules.md)
as historical evidence, not proof that the new timeout path was already live.
The ordinary connected shared-round exercise is retained above. Before
publication, align version defaults and cumulative login patch notes, then require exact-source CI
and independent public frontend/backend acceptance. Hold'em timeout handling
belongs to 1.63, not this prepared blackjack change.
