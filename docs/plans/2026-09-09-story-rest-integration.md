# Expanded Chronicle, coordinated rewards and Well Rested integration

Unversioned development candidate, NOT live and not an approved release. This
combines Well Rested `1c7537f` with expanded-story `92d2bc7` in an isolated
worktree. Inherited 1.0.57 metadata is not permission to publish this as 57.
Existing canonical 51–57 releases and their deployment order are untouched.

## Integration contract

- Retain schema9, fractional saved rest, exact resource snapshots, journal and
  auction receipts, late-login ownership protections, dead-versus-living recovery
  and the newer movement/stealth/HUD fixes from the Well Rested ancestry.
- Bring in the authored 31-chapter story: eight investigations and eight hunts,
  explicit interactions/manual rewards, existing dungeon/raid/crystal/finale
  prerequisites, legacy optional catch-up and discovery evidence persistence.
- Activate coordinated curve2 only in this candidate, alongside content budgets.
  This is not an isolated curve-only patch. Production activation still requires
  the verified compatibility release first and the full earned-play gates.
- Preserve quoted accepted/completed payouts, including explicit zero, and
  existing receipts. Genuinely absent legacy fields still receive catalog defaults.
- Apply the existing rested 25% bonus to the newly budgeted enemy-kill award,
  never to investigation, manual quest, room-clear or gold awards. Apply the 10%
  stat bonus once to final stats and preserve ordinary .01 outside regeneration.
- Keep both normal collision/failure-aware input and expanded story/Rogue/crowd
  controls. No weaker encounter watchdogs, free progress, forced recovery or
  altered kill/fragment requirements merely to make a route pass.

## Evidence and remaining work

September10: fresh story-only44940 on79e9571/code d47f5c6 TERMINAL FAILED16.9m
at4/60Imp credit, after successful opening/diary/Watch40/8Seeds and manual
turn-ins. No death in the completed Watch/collection segments. First hunt took
527s with14 ordinary town rests and paid the correct100Gold1593XP tolevel8;
Seeds took10observed target deaths. Imp chapter began atlevel9 and earned
level10 training naturally before the failure atlevel11.

The120-second encounter watchdog expired without increasing Imp credit above4.
At failure: HP304/380, MP0/260, rest bank0,58retreats,10acceptedFireballs,
97outgoing hits/1440damage and4incoming hits/308damage in the current observer
segment. The intended level20Imp204 remained alive at74HP, distance2.97; the
actual hovered/requested opponent had become Skeleton168 in a close crowd.
Recent samples prove actual basic/fire damage against several targets, not an
unattackable boss or absent ability. They do NOT prove a qualifying Imp died
without credit. Between-encounter recovery currently runs only after hunt-credit
progress; the driver can remain in an unfunded retreat/reselection encounter
without returning to town. Investigate this alongside the real early-level
difficulty gap rather than asserting a server credit defect or weakening gates.
No changes to rewards, levels, deadlines or actual combat are justified by this
single failure alone. Full authored/class/group/readiness acceptance stays open.

Archive `/tmp/eidolon-fresh-imp-credit-proof-qYOiwO`, log
`/tmp/eidolon-fresh-diary-ack-replay.log`; wrapper and retained scan0, actual
failed-collection screenshot inspected. Exact ports18560/18561/41960 and owned
containers were absent after wrapper cleanup. Preserve this evidence before
another run. The release60 fixture verification gets the next browser slot;
this source is now terminal and available for a separately verified correction.

September9 04:29: Fighter62895 TERMINAL PASS1/25.5m on original cleanf3f33e1
(same production gameplay as db3bbb7). Opening105s, diary141s cumulative;
Watch40/40 at1370s hunt time, manual claim and final reconnect complete1388s.
One counted death,17 ordinary town stops totaling380.361s including travel
(20.338–24.759s each); every observed stop restored both actual maximum pools.
No intermediate logins, granted gear/progress or weakened watchdog/death bounds.
Before claim level6/301XP/1566gold became level8/169XP/1666gold; receipt1593XP
and100gold,17occupied slots and560unsold gear value retained. Final reconnect
HP302→302 and MP189→203 occurred in the healing town; this volatile-resource
change is not an exact-zero persistence test or evidence of offline healing.
Console/network assertions and artifact credential scan passed, and exact owned
containers/image were independently absent. Archive
`/tmp/eidolon-primary-fighter-proof-TsBql3/test-results`, log
`/tmp/eidolon-primary-fighter-story-0402.log`; ready-claim image inspected.
Together with the Wizard pass this covers two classes through the first hunt,
not all classes, all Earth chapters, later realms or overall balance acceptance.

The merge compiled all Go packages and passed lint/shell syntax checks before
full regression. Full client93503 FAILED4 suites/3tests (252 suites/3638tests
passed),216.551s: older source-name checks and test mocks assumed the previous
helper imports/evaluation shape. Corrected helpers retain actual collision
planning, scaled melee reach, Rogue shield exclusion and no-input failure handling.
Focused20772 PASS6 suites/77tests2.774s. Log
`/tmp/eidolon-story-rest-merge-input-fixed.log`; the original full failure remains
in `/tmp/eidolon-story-rest-merge-client.log`.

Full Go race62050 FAILED: root23.411s/game391.274s, exactly two failures and no
race report. One asserted curve1 was still active; the other treated the now-known
Earth diary/Watch as unknown content with immutable display metadata. The new
candidate asserts active curve2 while independently preserving every legacy
threshold and explicit2→1 fractional rollback/repeated1→1 identity. Unknown
future-content round-trip uses genuinely unknown IDs; exact zero quotes, objective
counts, evidence, optional status and saved economic state remain checked.
Focused85228 PASS(root1.407s/game10.894s). Original and corrected logs:
`/tmp/eidolon-story-rest-merge-server.log` and
`/tmp/eidolon-story-rest-merge-progression-fixed.log`. Full corrected regression
remains required. Historical documents refer to their own earlier SHAs, never
to proof of this combined candidate.

The original no-rest Well Rested collection failure remains separate evidence:
attacks registered, repeated retreats/reselection moved a level6 character into
level30 DemonOrcs. The opt-in three-rest-stop route passed but its old8000XP
turn-in produced level6→17. Neither result validates this new reward curve or
the forty-kill Watch. Actual integrated earned gameplay is still required.

Review found enemy target acquisition/movement still used the old town rectangle,
and delayed slams could damage a player entering safety during wind-up. Independently
reproduced and corrected in Well Rested badd0cf:6 target,4 movement,2 actual impact
cases plus existing concurrency/protection tests pass race8.000s. Integrated as
1816738 after the main28dd5a1 story merge. No production source changed after
the new full regression started. Regenerating Go/JS protobufs exactly matched
the merged outputs (7d2c3ec9 /75eec1c5); final lint31593 and shell/diff checks pass.
Normal prepare:client92314 finished; ignored vendor assets are present.

Corrected full Go race23067 PASS(root27.543s/game437.789s) and full client98874
PASS256 suites/3645tests240.706s on production1816738. Both handles confirmed
terminal at03:02UTC; logs `/tmp/eidolon-story-rest-integrated-full-server.log`
and `/tmp/eidolon-story-rest-integrated-full-client.log`. No race report.

Additional26402 PASSrace7.460s:8 combined durable-data cases (four classes,
living/dead), each3 BSON/catalog/full-snapshot/private-journal reload cycles.
Legacy level30/9890XP on curve1 becomes level30/10561XP on curve2 once; the
accepted500XP opening receipt,8000XP five-item collection promise and explicit
zero-payout known diary survive, including count/evidence/optional state. Base
stats/currency, exact123.456789 rest, zero mana and living1HP/dead0HP survive.
Log `/tmp/eidolon-story-rest-combined-save.log`. This new test was added after
the full suite started; its separate focused result is required evidence, not
part of the earlier full test count. No production change or actual-socket claim.

Next actual browser route: `fresh-story-uninterrupted`, ordinary opening→diary→
forty-kill Watch with no checkpoint logins, extra rest stops or grants. Preserve
the120s credit watchdog, two-respawn limit and30m route limit. This is new
combined-runtime acceptance, not a rerun of unchanged failed historical source.

After corrected full checks: verify generated protocol parity, ordinary persisted
curve1→2/rested saves, fresh uninterrupted and honestly labeled town-rest routes,
manual investigation/hunt/collection rewards and all-class/realm progression.
Only then package version/patch notes and follow ordered CI plus exact live checks.

## September 9, 03:23 UTC — move-only input and retained route failure

Actual uninterrupted72341 on clean17a4dba FAILED in5.2m. Opening and diary
manual rewards and no-reconnect checkpoints passed; Watch stopped at3/40,
level4,50HP/8MP with zero deaths. An issued walking retreat moved only2.46
units against the unchanged6-unit requirement. Its end position was within
interaction range of New Growth and the screenshot showed that marker hovered.
This suggests click interception during camera movement, but the original run
did not capture the click recipient; it does not establish the unique cause.
Sanitized evidence: `/tmp/eidolon-story-rest-failure-dxIDjf/test-results`;
log `/tmp/eidolon-story-rest-uninterrupted-0303.log`. Owned disposable API,
Mongo and image were cleaned and independently absent. No pacing approval.

Added a visible, player-facing desktop Shift-click move-only control. It resolves
ground through enemies, discoveries and loot, clears pending interactions and
uses ordinary walking/collision/server movement. Normal clicks, mobile taps and
Ctrl-click jump priority remain unchanged. Help explains the gesture. Ranged
retreat QA now uses real Shift input; no shorter minimum, longer timeout,
alternate route, extra rest stop, automatic jump or free resource was introduced.
Movement failures now include read-only click-intent/collision diagnostics.

New production-control tests first failed5/8 before implementation. Corrected
control/raycast checks passed39tests; helper/failure-policy checks passed23tests.
Native pointer fixture37171 PASS1/5.2s: the same rendered lore marker accepts
ordinary interaction, Shift-click ground movement, then ordinary interaction
again. This fixture records movement intent, not server displacement or earned
combat; screenshot inspected and archived under the failure directory's
`move-only-input` subdirectory. Full client73607 PASS257suites/3655tests153.217s;
final lint17253 and diff checks pass. Logs `/tmp/eidolon-move-only-full-client.log`,
`/tmp/eidolon-move-only-browser.log`, `/tmp/eidolon-move-only-lint-final.log`.
Backend unchanged since its corrected full race pass. The same uninterrupted
earned route must now run on the committed new control; its outcome is pending.

## September 9, 03:32 UTC — uninterrupted result and explicit recovery comparison

Actual24785 on clean0a3e1c0 FAILED4.8m, after opening97s and diary136s
cumulative passed without reconnects/deaths. Watch stalled at2/40 against the
unchanged120s credit watchdog: level3,115/150HP,0/130MP, target level3/14HP
20.43 units away. Defense totals39retreats/1crowd jump/18Fireballs. No issued
movement failure occurred in this run. Screenshot inspected; it confirms zero
mana, not a complete diagnosis of combat balance. Retain this as failed no-rest
earned play, not proof that Shift-click makes the campaign pass. Log
`/tmp/eidolon-story-rest-uninterrupted-0324.log`; sanitized images/context archived
under `/tmp/eidolon-story-rest-move-proof-sI5HiW/test-results`. Owned project
story-rest-20260909-0324 containers/image are independently absent after cleanup.

Added a separate opt-in `fresh-rested-story-uninterrupted` route. It starts the
same fresh opening/diary/40-kill Watch, skips the same intermediate logins, and
retains the final persistence check. Between credited encounters only, the
existing real-resource recovery policy may Recall, wait for actual safe-zone
full HP/MP, and leave through normal input. No pre-first-kill extra rest, no
mid-encounter deadline reset, no new grants or changed quotas/rewards. Recovery
failures remain failures; rest stops are counted in hunt evidence. The original
route and CI defaults are not replaced. This comparison measures the requested
town-recovery loop, not uninterrupted no-rest combat acceptance.

New helper tests cover disabled/default behavior, no first-encounter stop,
delegation/failure propagation, malformed credit and required ordinary departure;
source boundary check retains the120s deadline and distinct opt-in shell route.
Initial63450 failed one test because jsdom's URL was passed to Node fs; corrected
explicit node:url import. Final97700 PASS4suites/41tests1.345s plus lint, shell
syntax and diff checks. Logs `/tmp/eidolon-rested-story-policy{,-final}.log` and
`/tmp/eidolon-rested-story-lint-final.log`. No production runtime changes since
0a3e1c0/fullclient3655; actual managed-hunt comparison is still pending.

## September 9, 03:47 UTC — intended recovery loop and inspection ordering

The player explicitly confirmed that town HP/MP recovery and rest are the normal
expedition loop. No-rest sustainability is diagnostic, not a release requirement.
Normal collection/hunt QA now defaults to genuine town recovery for all four
classes; explicit no-rest routes remain available. The shared observation reads
each primary skill's actual configured cost and ordinary gear/talent modifiers,
including zero-cost builds, instead of hardcoding Wizard/30mana. Later Earth
hunts receive the same ordinary departure callback. No production recovery,
reward, quota, deadline or death-limit changes. Focused94740 PASS6suites/68tests
5.927s; lint and shell/diff checks pass. Candidate is now developed separately at
`/tmp/eidolon-primary-town-recovery-lAKY3k`, branchwork/primary-town-recovery-20260909,
from8564500; the old integration tree remained frozen during actual play.

Actual53523 on clean8564500 terminatedFAILED9.3m, but the entire earned Watch,
manual payout and final saved-progress checks completed:40/40 at468s hunt time,
0deaths/11real town stops, level6 before claim;1593XP/100gold manually awarded
tolevel8/174XP/1495gold.15 occupied bag slots/650 unsold gear value retained.
Opening33s/diary73s cumulative had no intermediate reconnects. Normal town
recovery visibly refilled spent pools and banked rest; expiry also occurred
naturally outside. This is one Wizard route, not all-class/full-campaign balance.

The final browser-console assertion caught one earlier server rejection:
`Move closer to investigate`. Do not suppress the error or relabel the full
test green. Log `/tmp/eidolon-story-rest-managed-0332.log`; credential scan passed
and exact owned containers/image independently absent. Sanitized captures at
`/tmp/eidolon-story-rest-managed-proof-C6uixz/test-results`; inspected ready-to-claim
image confirms readable Ilyra text,40/40,1593XP/100gold and explicit Complete Quest.

Source diagnosis found interaction executes before the frame's movement send.
A client within5m can inspect while the server still sees the preceding >5m
position. New regression49807 FAILED2/3 cases (moving/just-stopped). Inspection
now flushes changed ordinary sequenced movement before its request; no enlarged
server radius, bypassed movement validation or local credit. Unchanged rereads
do not flood movement. Corrected70105 PASS5suites/66tests3.444s; independent
server dispatch4933 PASSrace1.734s confirms before-move rejection and after-move
acknowledgement without auto-completion. This establishes an ordering bug that
can cause the observed rejection, not a captured unique cause of that earlier
request. Logs `/tmp/eidolon-chronicle-move-order-{before,after,server}.log`.

Final prepare/lint90207 and diff checks pass. Full client regression and a fresh
actual default-rested route on the corrected source remain required. No new
version/live publication; canonical release order is unchanged.

## September 9, 04:01 UTC — corrected Wizard route passes

Full client45516 on cleandb3bbb7 PASS260suites/3682tests244.675s. Actual default
town-recovery1469 on that same source PASS1/11.2m, including the final browser
error check. Opening52s and diary92s cumulative passed without intermediate
reconnects. Watch40/40 at559s hunt time; manual1593XP/100gold and final saved
progress passed at574s. No deaths,13real town stops totaling265.077s including
travel (18.944–22.107s each). Every observed recovery restored both pools to
their actual maxima; rest naturally expired outside and accumulated in town.

Before claim:level6/270XP/1326gold; after:level8/138XP/1426gold,14occupied bag
slots/320 unsold gear value retained. The ready-to-claim capture was inspected:
readable Ilyra text,40/40 and an explicit1593XP/100gold claim. This is a single
Wizard's full opening/diary/Watch route, not the full Earth campaign, all-class
balance, phone-device or raid approval. Earlier failed routes remain preserved.

Logs `/tmp/eidolon-primary-recovery-full-client.log` and
`/tmp/eidolon-primary-recovery-story-0348.log`; sanitized evidence archived at
`/tmp/eidolon-primary-wizard-proof-M7KhR6/test-results`. Credential scan passed;
owned primary-rest-0909-0348 containers/image independently absent. All local
handles are terminal at this checkpoint. Runtime remains unchanged; next actual
class comparison is Fighter, using the same default rest and earned-input rules.
Unversioned player-facing release-note draft is carried with this candidate;
publication still requires wider earned progression and the ordered release gate.
