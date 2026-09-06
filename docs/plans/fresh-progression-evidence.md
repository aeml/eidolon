# Fresh-character progression evidence — 1.1 gate

## Alpha 1.0.26 candidate — explain the first dungeon handoff

The guide previously described **all** dungeons as unlocking at level 30, even
though server family entry gates are Verdant/legacy Crypt 30, Abyssal 60,
Molten/Tempest 70 and Umbral 100. An under-level leader could press Start, and
an empty unlocked-run list incorrectly fell back to every level band through
100. Twelve new desktop/phone assertions failed against that implementation;
two preservation cases passed.

The candidate publishes a copied server entry-level map, uses it in the guide,
and displays the selected family's unmet requirement and current player level.
Start is disabled for unmet family/run/difficulty/leader requirements, with a
guard in the handler as well as the button. Phone footer text repeats the reason.
Empty run lists now show a disabled placeholder. Qualified followers can still
resume, and eligible level-60 characters can still choose level-30 Water scaling:
family entry eligibility and run scaling are intentionally separate rules.
Server entry authority, party-wide qualification, story access and XP are unchanged.

Focused checks pass **30 client tests** across three suites; server race-enabled
menu/authority checks pass. The first full client run found an outdated friend-
toast test mock missing the newly imported run-level validator (165 suites /
2,370 tests passed, one suite could not load). The mock now includes that export;
the corrected complete suite passes **166 suites / 2,386 tests in 106.277 seconds**,
with lint passing. Full `go test -race ./...` passes (server root 17.634 seconds,
game package 222.400 seconds). Logs `/tmp/eidolon-1-0-26-client-final.log` and
`/tmp/eidolon-1-0-26-server.log`; the earlier client failure remains in
`/tmp/eidolon-1-0-26-client.log`.

Corrected fresh Wizard route **passes in 1.6 minutes**, ending at level **16**.
The collection portion took **53 seconds**, observed four target deaths, four
natural seeds and **zero deaths**, then manually awarded **100 gold / 8,000 XP**.
Four seeds were consumed; collection completion, next accepted chapter, bag
remainder and earned level persisted after login. The guide reported Verdant's
level-30 requirement/current level 16 and disabled entry. The earlier opening
portion also had zero deaths and manually awarded 100 gold / 500 XP. Credential
scan and disposable cleanup passed. Log `/tmp/eidolon-1-0-26-fresh-Wizard.log`,
session `60541` closed. This measures the first two chapters, **not a route to 30**.

Fighter also passes in **2.6 minutes** (2.5-minute test body), ending at level 16.
Collection took **70 seconds** with five observed target deaths, four naturally
collected seeds and zero deaths; the opening was also death-free. Manual rewards,
exact four-seed consumption, fresh-login persistence and the blocked level-30
handoff all passed. Credential scan and disposable cleanup passed; log
`/tmp/eidolon-1-0-26-fresh-Fighter.log`, session `59366` closed. Wizard and Fighter
used the candidate before a subsequent button-color-only polish; its disabled
entry semantics are unchanged. Cleric/Rogue and layout repeats target that polish.

Real-browser phone-layout fixtures pass **3 checks in 25.6 seconds** at 360×800,
390×844 and 844×390 with 125% text. They retain qualified entry/reset behavior
and check the under-level explanation, disabled controls, reachable footer,
scrolling space and no footer overflow. Portrait/landscape captures were visually
inspected. This is emulated layout evidence, not physical-phone gameplay or earned
level preparation. Log `/tmp/eidolon-1-0-26-phone-layout.log`, session `23735` closed.
Visual review found the disabled entry still looked green/active; the candidate
now uses a readable muted background, border and label, removes the active shadow
and exposes the disabled cursor without dimming the entire control. A layout
regression compares the available and unavailable entry colors.

After that polish, the full client suite again passes **166 suites / 2,386 tests
in 95.791 seconds**, plus lint (`/tmp/eidolon-1-0-26-client-styled.log`, session
`28739` closed). No server runtime changed after its full race pass.

Cleric and Rogue also pass on the polished candidate, with **zero opening or
collection deaths**. Cleric took **1.5 minutes** overall, **48 seconds** for
collection, four observed target deaths and finished at **level 17**. Rogue took
**1.4 minutes** overall (1.3-minute body), **47 seconds** for collection, three
observed target deaths and finished at **level 16**. Both naturally collected four
seeds, manually received 100 gold / 8,000 XP, consumed exactly four seeds, retained
the earned chapter/level/bag state after fresh login and saw correctly disabled
level-30 entry. Area-effect kills can credit additional enemies beyond the selected
target count; these counts must not be interpreted as total kills. Credential scans
and disposable cleanup passed. Logs `/tmp/eidolon-1-0-26-fresh-{Cleric,Rogue}.log`,
sessions `82427` and `3062` closed.

All four classes now have a death-free automated first-two-chapter pass. None
establishes progression from level 16/17 to the first dungeon, human discovery,
full build/rune balance, real phone feel or a complete fresh campaign.

Final phone-layout repeat after the button polish passes **3 checks in 27.7
seconds**, including distinct available/unavailable button colors; the updated
portrait capture was visually inspected. Log
`/tmp/eidolon-1-0-26-phone-layout-final.log`, session `92897` closed.

The optional `fresh-collection` route extends `fresh-opening` through four natural
seed pickups, manual turn-in, exact bag consumption, positive rewards, next-quest
acceptance, fresh-login persistence and the first dungeon guide. It uses normal
canvas movement/combat and Settings auto-loot, with no QA level, item, progress,
protection or travel grants. Collection reports observed selected-target deaths,
not a claimed total of every possible area-effect kill. Read-only world-state
navigation and automated input do not establish human discovery or phone feel.

First measurement against the 1.0.25 runtime collected four seeds after six
observed target deaths, with zero collection deaths, but the new diagnostic
waited for a nonexistent `#dungeon-unlock-note`. The run was deliberately
interrupted after confirming that harness defect; it is **not a full pass**.
The error stack confirms the missing locator, not a gameplay timeout. Credential
scan passed and the isolated script exited. Log
`/tmp/eidolon-fresh-collection-first.log`. The corrected diagnostic has an explicit
five-second label timeout and respects the existing hidden under-level raid card.
The menu now exposes that label as part of its accessible entry explanation.

## Alpha 1.0.25 candidate — an actual starter band

The new local candidate addresses the reproduced encounter mismatch without
changing saved player stats or weakening all enemies. Overworld Skeletons now
start at level one within 45 world units outside Lanternhold's town rectangle,
then gain a level per 20 additional units up to the unchanged level-ten anchor.
Level-one Skeletons have 30 HP / 2 Damage, increasing toward the existing
150 HP / 30 Damage at level ten. Levels remain tied to spawn locations rather
than adapting to each player. Other families and dungeon profiles are unchanged.

Three ordinary Skeletons have authored spawn points outside the east gate, with
random spawns kept 16 units clear of those points. They use the normal world
enemy, combat, loot, quest-credit and respawn systems. Ilyra explicitly describes
the weakened risen near the wards and directs the player east. Reward amounts,
manual completion and all dungeon/raid gates are unchanged.

Focused server checks pass for the bands, monotonic starter profiles, unchanged
level-ten/other-family/dungeon profiles, authored spawn placement and ordinary
respawn. The full client suite passes **165 suites / 2,367 tests in 111.719 seconds**.
The fresh Fighter repeat passes in **97 seconds**, level one → five, **zero
deaths**, three ordinary kills and manual 100 gold / 500 XP turn-in with fresh-login
persistence. Wizard also passes in **34 seconds** with zero deaths, three retreat
movements and the same manual reward/persistence checks. Logs
`/tmp/eidolon-1-0-25-fresh-fighter.log` and `/tmp/eidolon-1-0-25-fresh-Wizard.log`;
credential scans and disposable cleanup passed. The remaining class and server
results, including the subsequently discovered elite/recall issues, are recorded
below. This candidate does not yet prove all-class opening balance, the first dungeon's
earned-level handoff or the wider first-hour gate. It is not published ahead of
the corrected 1.0.21 and queued 1.0.22–1.0.24 releases.

Follow-up findings during candidate verification:

- Rogue completed in **38 seconds**, zero deaths, level one → five with manual
  rewards and persistence; `/tmp/eidolon-1-0-25-fresh-Rogue.log`.
- The first full server race run failed the new starter-band scan because a
  level-ten elite Skeleton could still spawn beside the gate (the old safe-zone
  logic pushed it to x=120). Elites now retain their level/stats but spawn beyond
  the starter band, within their original sector. The focused band/profile/
  respawn checks pass ten race-enabled repetitions in 2.845 seconds. Full rerun
  pending; retain `/tmp/eidolon-1-0-25-server-tests.log` as failed evidence.
- Cleric earned all three kills without death, but recalled 11.2 units away from
  the town arrival point after the next movement ticks. Overworld recall does not
  receive `enter_instance`, so its old pending combat chase survived. Four new
  client cases reproduced the stale intent before the fix (four failed, 50
  existing cases passed). Living recall now clears pursuit, queued abilities,
  held input and jump/charge movement state immediately; dead recall remains
  unchanged. Focused tests pass; the real Cleric repeat is pending. Retain
  `/tmp/eidolon-1-0-25-fresh-Cleric.log` and `...-recall-red.log` as failed results.

The final full reruns include both the elite-placement and recall corrections;
the earlier Fighter/Wizard/Rogue runs predate those additions. No earlier pass is
being presented as exact-source proof of the final candidate.

Final-code results so far: **Cleric passes in 43 seconds**, zero deaths, normal
recall, manual 100 gold / 500 XP turn-in, level five and fresh-login persistence.
Log `/tmp/eidolon-1-0-25-fresh-cleric-recall.log`, session `19863` closed. The
real phone quest route passes in **48.9 seconds** (46.1-second body), including
touch movement, Menu → Recall, manual turn-in, reply/next offer, rewards and
saved progress. It uses functional level-30/waypoint preparation, unlike the
fresh desktop routes; it is not phone first-hour balance evidence. Log
`/tmp/eidolon-1-0-25-phone-quests.log`, session `47133` closed. Credential scans
and disposable cleanup passed for both. The final client suite passes **165
suites / 2,371 tests in 124.612 seconds**, plus lint; the completed server race
rerun is recorded below. The four recall regressions and prior cases pass together with
version checks: **252 tests in two suites, 6.85 seconds**.

The **final full server race suite passed**: root 16.862 seconds, game 251.592
seconds; `/tmp/eidolon-1-0-25-server-final.log`, session `11224` closed. Clean
runtime commit **`bea6c349284a42e3bfbf5007c092c73ac2bede0d`** then passed the
fresh opening as **Fighter in 93 seconds** and **Cleric in 45 seconds** (the
latter 50 seconds including overhead). Both had zero deaths, earned all kills,
ended at level five after manual 100 gold / 500 XP rewards, and retained the
completed chapter after fresh login. Credential scans and cleanup passed;
`/tmp/eidolon-1-0-25-exact-{Fighter,Cleric}.log`, session `88889` closed.
These repeats include the elite-placement and recall fixes. Subsequent test-only
cleanup removes a redundant population spawn from the constructor regression
and explicitly preserves elite positions already outside the starter band.
This is local release evidence, not a deployed 1.0.25 or full first-hour claim.

Before the starting-area correction, the optional opening route **passed in 93 seconds**
(1.6 minutes including overhead), fresh Wizard level one → six, three earned
Skeleton kills, 18 real retreat movements and **one death**. Normal respawn,
manual Ilyra completion, 100 quest gold / 500 quest XP, the next unaccepted offer
and fresh-login persistence all passed. Credential scan and disposable cleanup
passed; `/tmp/eidolon-fresh-opening-recovery.log`, session `92005` closed.
Source was `a8d0aa9` plus the test/documentation changes recorded here; no runtime
balance changes. This is neither death-free onboarding nor whole first-hour,
all-class, phone or first-dungeon progression evidence.

The first-hour gate requires earned-level play. The existing level-100 dungeon
routes and level-prepared collection routes verify functionality, not onboarding
balance or the time required to reach a dungeon.

## Opening-chapter route

All-class follow-up: clean `f2b7b76` **failed as Fighter** after three deaths
with zero opening kills, still level one. The route stopped at its existing
two-respawn bound; no extra protection, level grant or weakened bound was added.
Log `/tmp/eidolon-fresh-opening-fighter.log`, session `35594` closed; credential
scan passed. Investigate actual target acquisition/damage and the fresh-stat
baseline before attributing every death to numerical balance. The Wizard pass
does not establish a dependable opening for all four classes.

The next diagnosis should also cover the advertised starter band. `world.go`
labels the town's Skeleton sector “Lv 1-10” but passes fixed level 10 to
`spawnEnemyRect`; `balancedEnemyBaseStats` also clamps all lower levels to the
level-10 profile. Fresh unequipped Fighter Strength 10 becomes basic Damage 2
under `RecalculateStats`, while that Skeleton profile has 150 health and Damage
30. These are source-derived baseline values, not a simulated time-to-kill or
proof of the exact damage exchanged in the failed browser run. Capture actual
target acquisition and damage, then address the real starting encounter/stat
budget without weakening the no-grants test or globally nerfing later dungeons.

The diagnostic repeat also **failed after three deaths without a kill**. It
observed a fresh Fighter with 100 maximum HP, basic Damage 2 and Charge, against
a level-10 Skeleton. The intended target was actually hovered at close range;
its health fell 150 → 130 during the first life, then 130 → 117 during the
second. Damage reaches the target, so a wholly unattackable enemy is not a
sufficient explanation for this failure. Starting encounter/character budget
is the next gameplay priority; this does not measure every class or prove the
entire combat system balanced or broken. Log
`/tmp/eidolon-fresh-opening-fighter-damage.log`, session `76713` closed with
failure; credential scan passed. Source was `370f759` plus diagnostic and
documentation changes, with unchanged game runtime.

Optional isolated route `fresh-opening` registers a new character, asserts level
one, talks to Ilyra, accepts the opening Chronicle, travels through the east gate,
earns three Skeleton kills, explicitly completes the quest and continues the
conversation. It checks positive gold/XP rewards and persistence after login.
Travel and combat use real canvas/keyboard input. It does not use level grants,
QA teleports, protection, guaranteed drops, quest grants or inventory grants.

The route permits at most two ordinary respawns and reports deaths explicitly.
That bound keeps an automated check finite; it is not a design target for how
often a new player should die. Read-only entity positions guide the automated
player, so this route cannot establish that a human can discover the objectives
without help. It is also only the opening chapter, not an entire first hour.

First attempt: the stationary Wizard killed one Skeleton, reached level two,
then died on the second encounter. Log `/tmp/eidolon-fresh-opening-first.log`;
credential scan passed, session `96516` closed with failure. This is not evidence
that the complete quest is impossible. The next attempt adds normal death
recovery; review found its proposed retreat used the wrong class field, so do
not cite that attempt as evidence of ranged kiting. Record corrected results
separately after the route ends.

Second attempt completed the opening chapter in **77 seconds**, ending at level
six with 100 quest gold and 500 quest XP, after **two deaths**. Normal respawn
preserved objective credit; manual completion, next unaccepted offer and fresh
login persistence passed. Credential scan and disposable cleanup passed, session
`25471` closed, log `/tmp/eidolon-fresh-opening-retreat.log`. Because the class
guard prevented retreat, this is recovery/quest evidence, not a ranged-control
or death-free onboarding pass. The corrected route uses the actual character
constructor and reports its retreat count as well as deaths.

Third attempt exercised the corrected class guard but failed when the player
died during the movement helper's polling window. Log
`/tmp/eidolon-fresh-opening-kiting.log`, session `72455` closed; credential scan
passed. The route now sends deaths during retreat through the same normal
respawn path, while still throwing non-death movement failures. This is a test
recovery correction, not a runtime movement fix or a passing onboarding result.

## Progression budget to investigate

The authoritative XP curve in `server/internal/game/progression.go` is exponential:
100 XP at level one, then integer `100 × 1.2^(level−1)` per level. The first two
Chronicle chapters award 500 and 8,000 XP. Quest-only XP therefore leaves a fresh
character around level 16, while the cumulative budget for level 30 is roughly
98,400 XP. Ordinary kill XP starts at `enemy level × 10 + 10`, with separate
enemy, difficulty and party multipliers. Kill XP and optional activities matter;
the quest-only comparison is not an observed completion-time estimate.

Also audit the class-stat baseline before interpreting prepared-level runs:
`server/client_dispatch.go` creates fresh characters with all five base stats at
10, whereas `canonicalBaseStatsForClass` used by level preparation and progression
unit fixtures starts the class's primary stat at 20. Fresh login copies the saved
stats into the player. This discrepancy is another reason prepared-level evidence
cannot stand in for fresh balance; decide the intended baseline and compatibility
for existing saves before applying any stat migration.

Before changing rewards or entry levels:

- Measure normal kills, natural collection drops, deaths, rewards, earned level
  and elapsed time through the second chapter for all four classes.
- Check what the journal, Ilyra and dungeon guide tell an under-level player at
  the first dungeon handoff; distinguish an explained preparation interval from
  an unexplained progression dead end.
- Measure an ordinary route to the first dungeon's entry level without debug
  grants. Verify subsequent area handoffs too; one opening success is not full
  campaign pacing evidence.
- Keep dungeon/raid unlock authority and manual completion intact. Any tuning
  needs reward/replay/cap regressions and its own player-facing patch notes.
- Retain human discovery, phone controls and real-device review as separate
  requirements; automated world-state-assisted navigation cannot replace them.
