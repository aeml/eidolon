# Connected casino: shared blackjack flow and Alpha1.9.12 layout correction

Alpha1.9.12 was pushed as38847b2f497f57f693952f2d49c5c869422247d6. Exact CI
34840066682 is **terminal success, all ten jobs passed**; watch42418 exited0.
Live saved-character gameplay and town healing/Well Rested passed; the optional
full-animation step was intentionally skipped under feature-first CI policy.
Terminal receipt: `/tmp/eidolon-1-9-12-ci-final-20260914.json`.
Both deploy jobs passed and
public delivery was verified at12:15:38UTC: frontend manifest and backend
health match38847b2f/Alpha1.9.12, database ready. Exact served source matches the
release-transformed committed login HTML (including cumulative notes), main.js,
CasinoController, both card UIs, CardTableScene, index.css and casino.css.
Receipt: `/tmp/eidolon-1-9-12-public-delivery-20260914.json`.
Final live QA also passed. Do not repeat this completed pipeline. Version labels, server/build
defaults and cumulative login patch notes match.286 tests across five UI/version
suites passed in1.361s; scoped lint, shell syntax and diff checks passed.
Final anonymous browser fixture: four screen sizes passed in11.4s, including
actual dealer/seat bounds after an action, long-name hand totals during play and
results, clear win/clock separation for both games, community-card containment
and Leave hiding the panel. Screenshots were inspected; shorter-screen control
scrolling no longer hides the table. Artifacts:
`/tmp/eidolon-card-table-layout-20260914-ugAo9y/`.
**Release candidate native62628 passed in1.5minutes on clean6b0abea1.** The actual
result image was inspected: dealer, all six seats, both hand totals and the next
betting countdown remain visible. Round34b9c8ec1ea8cd0d95cb5946a1aa1e07 produced
an ordinary loss/push, ending900/1000Gold from1000each; these were real random
cards, not forced winning results. All shared-flow, camera/leave, saved balance,
reconnect and guard checks passed. Artifacts:
`/tmp/eidolon-connected-casino-release-20260914-H8Y8yC/`.
Credential scan passed0changed; owned services and ports cleaned.62628 is terminal,
not a pending check. Publication/public-source delivery and final live
gameplay acceptance passed as described above.

Native70277 passed in1.4minutes on clean da260121 (Alpha1.9.11 runtime plus QA
changes). Two newly registered disposable accounts were initialized with1000Gold
before first character login. No mid-session top-up or production-account write;
this is prepared interaction/economy evidence, not earned campaign progression.

Real mouse/keyboard inputs entered the shared hall and occupied two physical
chairs at the same blackjack table. Both clients saw the occupied seats and
same exposed cards, wagers debited100Gold each, turn actions were enabled for
the actual player, and the displayed clock decremented one second at a time.
The same table DOM persisted through settlement. Round
`7dc5aaa0db74c6d6d57f9e83cd08148e` ended at1150/1100Gold: the first player's actual
blackjack returned250 on100staked (3:2 profit), the other player's win returned200.
The next betting window opened without a wager; editing the next stake to200
spent nothing. Both players left normally with camera settings restored, an
actual reconnect retained the payout, the non-VIP guard denied upstairs entry,
and Recall returned one player to town while the other remained in the hall.

Artifacts: `/tmp/eidolon-connected-casino-r2-20260914-nfZpXb/` contains run.log,
test-results, report, and copied guard/interior images. Credential scan passed
(0files changed), owned containers/image removed and18285/18286/4187 released.
Native70277 is terminal success; do not rerun it for documentation changes.

The original result PNG was inspected. It exposed a real layout defect: the fixed
660px table plus stacked controls made the panel scroll, hiding the dealer/top
seats after an action. A long player name also squeezed the other hand's total
below its internal viewport. A visible DOM node is not proof it is in view.
The corrected layout keeps the table and controls in separate regions, preserves
long names via hover titles, and tests actual bounds at1280×720,1440×1000,
390×844 and844×390. Initial26 UI tests passed0.917s; final results are above.
Intermediate portrait result checks caught wrapped totals and win/clock overlap;
those failures led to the final spacing/caption changes, not relaxed assertions.

Earlier17777 failed in6.7seconds on a strict selector: the open entrance and
Veyra's hidden wardrobe share the same CSS class. The inspected screenshot
showed a working entrance dialogue. Selector620f102e and initial-bankroll fixture
da260121 corrected setup; no game interaction was bypassed. Its artifacts remain
in `/tmp/eidolon-connected-casino-20260914-nNqKZI/`. That run is terminal, not active.

Connected EP poker and its restart walk-back correction now pass separately;
see [actual EP hand and recovery evidence](2026-09-14-vip-poker-connected-recovery.md).
That follow-up correction remains local while1.9.12 CI runs.
This does not cover connected EP blackjack/vendor purchases, connected slots,
busy-floor load, a real phone, or the full1.10 campaign/raid scope. Retain the
earlier poker socket/restart and EP save-recovery evidence separately.
