# Fresh-character progression evidence — 1.1 gate

## Earned dungeon-readiness extension — September 6, measurement pending

The optional `fresh-ready` route extends the same real opening, collection and
100-Skeleton contract with normal preparation and the existing 100-Imp contract.
It uses collected eligible equipment to fill empty slots, spends up to five
earned Intelligence points and five Fireball Mastery ranks through the desktop
menus, and checks those choices after fresh login. Ordinary westward Ctrl-click
travel and canvas attacks must earn the Imp credits; its 150,000 XP and gold
require a manual NPC turn-in and saved-login check before inspecting Verdant entry.
No level, item, skill, protection, quest or travel grants are used. Enemy positions
assist automated navigation read-only; this is not human-discovery evidence.

The first measurement ran against `8609a6f` plus QA-only changes, runtime Alpha
1.0.27, log `/tmp/eidolon-fresh-ready-Wizard.log`, session `48789`. Its result is
**failed after a third Imp death**, not a successful level-30 or dungeon clear
claim. The 16.1-minute test last reported 61 Imp credits, level 28 / 10,478 XP /
11,760 gold at 402 seconds from Imp hunt start, with two deaths at that checkpoint.
It then exceeded its existing two-respawn bound; it did not claim the Imp reward.
Credential scanning and exact disposable cleanup completed; the handle is closed.
The earlier unequipped
Skeleton baseline remains available as `fresh-hunt`. Dailies remain optional
activities, not new campaign prerequisites. This route is Wizard-only preparation;
melee/all-class comparisons and actual earned-build dungeon combat remain open.

The first attempt passed both story turn-ins and the Skeleton daily:
100 credits in 312 seconds with zero deaths; manual 50,000 XP / 100 gold and
fresh login yield level 27 / 4,688 XP / 2,292 gold (333 seconds including return
and persistence). Preparation saved five `WIZ_01` ranks and no attribute
allocations because `statPoints` was zero. It made 11 equipment actions, but
inspection of the saved snapshot found only 10 occupied keys, **including an
unsupported `gem` equipment key**. Generic trinkets can replace occupied slots,
so the initial helper is not accurately restricted to filling empty legal slots.
Do not treat this initial preparation as a clean gear baseline.

This also exposed a real ordinary-click validation gap: desktop `InventoryUI`
and `Actor.equipItem` exclude materials/relics but allow a gem slot; server
`PerformEquip` accepts any exact matching item/target slot without restricting it
to the 14 character-sheet slots. The gem key survived login in the disposable
character. The helper must use a legal-slot allowlist and resolve ring/trinket
empty slots explicitly; the game needs separate client/server regressions,
rejection of non-equipment and a lossless recovery policy for any existing
unsupported equipped items. The current run makes no live-player changes or
balance tuning. Preserve its raw outcome, including its compromised gear
baseline, then remeasure after the scoped corrections.

After that handle closed, the helper was restricted to the 14 real equipment
slots plus explicitly resolved ring/trinket categories, with no gem/material/
relic equip attempts or replacement of filled slots. It checks saved equipment
count and forbids a gem key. Readiness now explicitly opens the Dungeons tab,
selects Verdant and requires a **visible** enabled Start button. The default
Skeleton helper still retains its original contract/reward assertions; its
progress log now avoids a shadowed target name. These test-only corrections
require a new played measurement; no rerun pass is claimed here. Before balance
tuning, add appropriate Wizard spacing/defensive skill use to this simple
stationary-casting hunt strategy and compare lawful equipment builds. Do not
raise the death bound or grant levels merely to obtain a pass.

### Build-copy follow-up found during preparation inspection

The baseline uses Fireball **Mastery**, whose +4% damage per rank agrees between
`src/core/Constants.js` and `server/internal/game/talents.go`. Several other Wizard
descriptions demonstrably disagree with their server definitions, so readable
build menus alone do not establish trustworthy preparation guidance:

| Talent | Current client description, per rank | Server definition, per rank |
|---|---|---|
| Fireball Technique (`WIZ_02`) | +3% cooldown reduction and +2% range/area | +3% skill cooldown reduction, −2% skill mana cost |
| Quickened Formulae (`WIZ_28`) | +2% global cooldown reduction | +1.5% global cooldown reduction |
| Channel Discipline (`WIZ_37`) | +2% channeled spell damage | +3 flat Intelligence |
| Contingency Wards (`WIZ_40`) | +2% damage reduction | +2% maximum health and +2 flat Wisdom |

This is a source-level description mismatch, not a played effect measurement.
Audit all class descriptions against both definitions and their actual consumers,
then add drift regressions and correct the copy in a separately versioned patch.
Do not silently rebalance authoritative talents to match old text. No talent
effect or description is changed by the current QA-only extension.

The consumer search found a more important follow-up than wording: production
code calls `GetSkillDamageMultiplier` (including Fireball in `ability_wizard.go`),
but `GetSkillCdrBonus` has no production caller. Searches for `SkillManaCost`,
`SkillRange` and `SkillDuration` find their definitions/accumulation, not use in
authoritative ability execution. Treat those bonuses as **unverified consumers**,
not working effects established by a populated `TalentBonus`. Add paired real
ability tests for rank zero versus earned ranks, including cooldown/mana/range/
duration and client/server agreement; establish each missing effect before
choosing implementation versus revised design. Fixing tooltip wording alone
cannot close that combat/build gate. The current baseline's Fireball damage
multiplier does have an authoritative consumer.

The separately versioned **1.0.29 candidate** now reproduces and repairs the
cooldown/mana consumer gaps in paired four-class casts. Its phone UI route buys
the ranks normally on a prepared level-100 fixture, observes Fireball's actual
cost change from 30 to 21 mana and reduced cooldown, and repeats after fresh
login in landscape (**25.8 seconds**, passing). A shared Go/JavaScript contract
checks those bonus fields across all 160 talents. This does not establish range,
duration or the other effects listed above, does not reclassify the failed Imp
hunt, and is not earned-progression evidence. Full verification and publication
status remain in the [talent economy record](2026-09-06-talent-economy.md) and
execution ledger.

## Preparation-route measurement — in progress after 1.0.26

The next optional route, `fresh-hunt`, extends the genuinely earned first two
chapters through the existing Skeleton daily: normal NPC acceptance, 100 ordinary
kill credits, manual completion, actual level/XP/gold and fresh-login persistence.
It does not grant levels, equipment, quests, protection or travel. This initial
baseline stays unequipped and does not spend talents, so it cannot establish the
best preparation route or tuned-build combat. Auto-loot is deliberately disabled
through Settings during the hunt and restored afterwards; this is kill/reward
measurement, not a bag-management or loot-optimization test.

The first attempt passed the early story but failed to acquire the daily NPC at
the helper's selected mesh-center pointer. No daily was accepted and no hunt
result was obtained. Log `/tmp/eidolon-fresh-hunt-Wizard.log`, session `25293`
closed; credential scan and disposable script cleanup passed. The next attempt
tries the rendered mesh point and ordinary body-height projections, verifying
actual hover before clicking, and records pointer/position diagnostics if none
works. It never forces a hovered entity or calls the NPC interaction directly.
Inspection also corrected the new XP diagnostic to the actual client fields
`xp` and `xpToNextLevel`; the first attempt had not reached that diagnostic.

Source budget is not a played duration: the first two story rewards total 8,500
XP, the existing Skeleton daily awards 50,000, and level 30 requires 98,391
cumulative XP. Those quest rewards alone reach level 27 and leave 39,891 XP to
30. Adding 2,000 or 11,000 hypothetical kill XP yields level 27 or 28 respectively;
neither is a measured hunt outcome. Measure ordinary enemy levels and actual XP
before using this comparison for tuning. Daily contracts stay optional, not a
new prerequisite for the main story.

Separate guidance defects are confirmed by source/failing regressions: the town
tracker still claims “all base dungeons” unlock at 30, and the first dungeon
description does not explain its level requirement or preparation. Corrections
must preserve acceptance, saved progress, manual turn-in and existing objectives;
they do not by themselves close the first-hour pacing gate.

The second full attempt also failed before daily acceptance, with the giver
reported under the cursor but no usable projected point. Its diagnostics did not
yet identify the covering DOM element; the precise cause is not proven. Log
`/tmp/eidolon-fresh-hunt-Wizard-pointer.log`, session `37287` closed, credential
scan/disposable cleanup passed. The helper now recognizes a daily conversation
already opened by normal approach input and adds DOM-blocker diagnostics.
Short isolated daily-acceptance checks pass both from initial login (**12.0
seconds**, 9.4-second body) and after visiting/closing the Dungeon Guide (**19.4
seconds**, 18-second body). Logs `/tmp/eidolon-fresh-hunt-npc{,-guide}.log`,
sessions `13693`, `97252` closed. These checks do not replace the full hunt.

### Alpha 1.0.27 — before the descent (candidate)

Ilyra's first dungeon description now explains level 30, Earth exploration,
earned equipment and unspent skill/talent points; it explicitly keeps daily
contracts optional. Each of the four dungeon objectives includes its family
entry level drawn from server entry authority. Existing metadata refresh carries
the copy into saves without changing acceptance, counts, completion or rewards.
The town tracker now identifies Verdant at 30 instead of claiming all dungeons
are available. Patch notes and login/build versions advance together.

Focused client checks pass **32 tests**; focused race-enabled Chronicle checks
pass. Full client checks pass **167 suites / 2,388 tests in 92.966 seconds**, lint
passes, and full Go race checks pass (root **14.681 seconds**, game **228.499
seconds**). Logs `/tmp/eidolon-1-0-27-client.log` and
`/tmp/eidolon-1-0-27-server.log`, sessions `93465` and `51002` closed.
The complete hunt measurement is still running. This attempt observed the daily
conversation already opened by normal approach input, then accepted the contract;
the helper no longer insists on clicking through an open dialogue. Actual XP
diagnostics are now present. The first 30 credits took 86 seconds with no deaths,
but do not extrapolate that partial observation into a completed hunt result.

That attempt subsequently earned all **100 Skeleton credits in 255 seconds**, with
zero deaths, reaching **level 18 / 472 current XP** before payment. It then failed
waiting for the contract-list row on return to the giver; no manual daily reward
or persistence pass was obtained. Log `/tmp/eidolon-1-0-27-fresh-hunt-Wizard.log`,
session `85226` closed, credential scan/disposable cleanup passed. This is combat
and earned-credit evidence, not a completed-contract pass. The helper now stops
world approach clicks once a dialogue is visible, accepts the matching detail
view if it is already selected, and otherwise uses the ordinary contract list.
It captures the pre-reward snapshot only after returning to the giver, so late
ordinary combat updates cannot be mistaken for the quest reward. The full route
is being repeated with those harness corrections; gameplay/reward logic is unchanged.

The next repeat again earned all **100 credits**, in **245 seconds** with zero
deaths, reaching **level 18 / 1,276 XP** before payment, but the ground-movement
helper failed during the return approach. Its diagnostic explicitly reported
`openPanels: ["quest-window"]`: opening a conversation was being mistaken for
failed ground travel. No daily reward was claimed. Log
`/tmp/eidolon-1-0-27-fresh-hunt-Wizard-turnin.log`, session `64778` closed;
credential scan/disposable cleanup passed. The route now frames the giver with
normal wheel input, confirms actual hover and clicks the NPC itself, allowing
the game's normal interaction approach to handle movement. The dedicated
initial-login/after-guide check passes in **24.5 seconds** (22.3-second body),
log `/tmp/eidolon-1-0-27-daily-direct.log`, session `25110` closed. The full hunt
repeat remains pending; do not turn these failed return checks into reward proof.

The direct-NPC full route **passes in 5.2 minutes overall**. It earned 100 hunt
credits in **196 seconds**, and completed return, deliberate turn-in and fresh
login in **208 seconds** from hunt start. There were **zero deaths**. Baseline
was level 17 / 4 XP / 363 gold; before payment it was level 18 / 840 XP / 2,155
gold. Manual payment granted **50,000 XP and 100 gold**, yielding **level 27 /
4,701 XP / 2,255 gold**. All displayed progression fields and completed daily
state persisted after login, and Verdant entry correctly remained disabled.
Log `/tmp/eidolon-1-0-27-fresh-hunt-Wizard-direct.log`, session `11411` closed;
credential scan and disposable cleanup passed. The preceding failures remain
recorded above. This is one unequipped Wizard's existing-contract baseline,
not an optimized build, a level-30 route or a full first-hour completion.

A final copy sweep also found the old “all base dungeons” claim in current Help.
Its failing regression is corrected along with the generic under-30 server error;
both now describe the first dungeon/run threshold rather than implying every
family opens at 30. Earlier patch-note history is retained. Full validation is
being repeated after these final copy edits.

After the final Help/error wording changes, client validation passes **167 suites
/ 2,389 tests in 81.992 seconds**, with lint passing. Phone conversation/journal
layout fixtures pass **3 checks in 41.6 seconds** at 360×800, 390×844 and 844×390;
these are emulated layout checks, not physical-phone sign-off. Logs
`/tmp/eidolon-1-0-27-client-final.log` and `/tmp/eidolon-1-0-27-phone-quest-layout.log`.
The final server race repeat is still running at this observation.

Final server validation subsequently passed: `go test -race ./...`, root
**17.100 seconds**, game **177.865 seconds**. Log
`/tmp/eidolon-1-0-27-server-final.log`, session `7476` closed. Exact clean runtime
**`ac494b8eb3123d5890f4a1b9880cae88d7ad713c`** repeats fresh Wizard collection and
the new Ilyra preparation text successfully in **1.5 minutes**: zero deaths,
five observed collection target deaths, four natural seeds, manual gold/XP,
exact bag consumption and fresh-login persistence, ending at level 17 with
correctly disabled Verdant entry. Log `/tmp/eidolon-1-0-27-exact-collection.log`,
session `7035` closed; credential scan/disposable cleanup passed. All local QA
handles from this continuation are now closed. The final Help regression and
phone layout results are included; no physical-device sign-off is implied.

The measured level-27 / 4,701-XP result corresponds to **61,424 cumulative XP**
under the current curve, leaving **36,967 XP** to level 30. It does not yet
establish the ordinary entry-level dungeon experience. The 1.0.27 candidate
remains behind earlier releases in the deployment queue.
The preparation-copy correction is not a replacement for a verified, enjoyable
first-hour route. No reward, entry-level or existing-save stat tuning has shipped
as part of this candidate.

Next first-hour evidence must extend beyond this one contract:

- Follow an ordinary Earth preparation route toward level 30 (including the
  existing Imp contract if chosen), with real west-gate travel and actual combat.
  Distinguish the contribution of optional contracts from ordinary kill XP; do
  not present contracts as mandatory campaign prerequisites.
- Include normal equipment inspection/equipping and available skill/talent
  decisions before interpreting a weak unequipped run as proof that all players
  need easier enemies. Compare at least melee and ranged starts, then all classes.
- Enter and fight the first dungeon at the character's **earned** level/build.
  Existing prepared-level-100 clears cannot establish level-30 encounter balance.
  Record actual attack acquisition, damage exchanged, deaths, boss mechanics,
  recovery and completion; fix demonstrated defects rather than granting access
  or weakening the test to reach the next chapter.
- Retain discovery, pacing judgment, phone controls and real-device evidence as
  separate gates. A world-state-assisted automated route proves execution, not
  that a first-time human finds it naturally or enjoys the repetition.

The broader curve also needs a deliberate campaign budget, not just an opening
reward bump. Source-derived cumulative XP is **98,391 at 30**, **23,477,600 at
60**, **145,369,863 at 70**, and **34,507,488,832 at 100**. The 15 current Chronicle
rewards sum to **90,008,500 XP**, some only obtainable after high-level gates.
This is not a duration estimate and omits combat, optional contracts and other
sources; nevertheless, full fresh-campaign readiness cannot be inferred from
the early chapter passes. A non-blocking player question asks whether level-100
/ Dark King readiness should target roughly 15–25 or 40–60 hours of ordinary
questing/combat, excluding raid organization. No response or target is assumed.
Before changing the curve, measure actual activities, review quest and kill XP
together, preserve earned levels/progress through any save migration, and keep
gold/Resonance balance separate rather than accidentally repricing every reward.

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

Exact clean runtime commit **`479cfd73c4a6ed8406d9159380c43d9af488df1d`** repeats
the fresh Wizard route successfully in **1.8 minutes** (1.7-minute body). Natural
drop variation required eight observed collection target deaths and **65 seconds**,
ending at level **17**, with zero deaths. Ordinary four-seed pickup, exact turn-in
consumption, manual gold/XP, next accepted chapter, fresh-login persistence and
blocked level-30 entry all pass. Credential scan and disposable cleanup pass;
log `/tmp/eidolon-1-0-26-exact-Wizard.log`, session `79631` closed. No local browser
or test process remains from this continuation. This candidate is committed but
not pushed past the earlier release queue.

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
