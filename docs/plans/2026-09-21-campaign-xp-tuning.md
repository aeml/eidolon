# Campaign XP tuning toward the approved100-hour target

Delivered in Alpha1.9.30 atcdf45e3a, verified through CI35826334400 and public
identity/assets checks. This is an initial balance target, not a
measured human completion time. The shared Dark Realm adds a separate8–12-hour
content target; its content and acceptance remain in the
[campaign expansion plan](2026-09-21-campaign-pacing-and-dark-realm.md).

## Changes

The existing reward was10% of the enemy-level XP threshold for ordinary kills,
20% for elites, and35% of run-level threshold for a personal boss reward.
Increasing the level curve alone would also increase those rewards. The retained
earned Wizard samples already show large level gains over comparatively few
objectives; they do not supply reliable human kill-per-hour measurements.

Keep progression version2, all100 level thresholds, saved XP/levels and stats
unchanged. Tune incoming rewards instead:

| Enemy level | Ordinary XP | Elite XP |
| --- | ---: | ---: |
|1|5|15|
|10|26|78|
|30|179|537|
|60|566|1,698|
|80|780|2,340|
|100|1,225|3,675|

Integer interpolation between anchors avoids reward cliffs at boundaries.
Rewards never depend on the recipient's level; farming trivial enemies cannot
inflate their value. Ordinary/elite sharing and its existing party bonus remain.
Boss rewards are personal20% of the selected run-level threshold. Normal30
therefore awards4,225XP per eligible recipient, not7,393.

Fresh ordinary dailies pay20% of the corresponding solo ordinary-kill budget.
Fresh boss dailies pay2% of content-level threshold per objective, preserving
difficulty multipliers and existing Gold. Overlapping generic/regional/difficulty
contracts remain a bonus rather than the primary source of dungeon XP. Accepted
daily quotes, progress, story rewards and earned receipts are unchanged.

No health/damage, combat speed, respawn, quest counts, drop probabilities, Gold,
gear, Forge supply, room-clear income, Well Rested or Resonance thresholds changed.
There is no purchase, forced daily, timer gate, XP debt or saved-character reset.
New level100 combat XP converts to Resonance through the existing reward path.

## Forecast assumptions and limits

`TestCampaignPacingForecastUsesActualSourcesAndExplicitAssumptions` reads actual
combat/party/rest rewards, the unchanged thresholds and ordered pre-cap story
payouts. It claims29 chapters before the level100 expedition. Objective kills
are part of ordinary activity, not paid twice. Nexus/finale/expedition rewards
cannot help qualify for their own gate. No dungeon income is modeled below30.

Reference mixed play rates are90 ordinary kills and3 elites per hour, with a
boss every4 hours and1.5 base room clears/hour after30. These are explicit design
assumptions including normal travel/recovery, not observed throughput. A four-
player field party is assumed to clear ordinary/elite enemies three times as
fast before the existing shared pool is divided. Dailies, Fortune and Heroic/
Mythic are excluded. Time spent purely socializing, casino play or idle is not
counted toward this active-progression target.

| Reference route | No Well Rested |50% rested kill uptime |
| --- | ---: | ---: |
|Solo field play; party-capable dungeon income|108.6h|96.8h|
|Four-player cooperative field party|104.4h|93.1h|

The same assumptions with the old rewards predict roughly7–9 hours; that is a
model comparison, **not** a claim about previous human or automated clear times.
The18 scenarios also vary throughput by±25% and rest uptime0/50/100%. Faster
groups remain faster; this is not a mandatory100-hour clock or a reason to delay
combat. The mixed-income forecast does not simulate encounter survival, obtain
gear, verify every objective or prove the dungeon access route.

## Evidence and remaining release work

### September23 first-dungeon reward-gap audit

The existing `TestProgressionPacingAuditQuestBudgets` reports actual fresh
quotes, including the version2 Seeds quote of1200XP (not its unadjusted1600
base). Combined with the new ordinary-kill anchors and unchanged thresholds,
minimum-level objective enemies give this **budget-only** solo path:

| Last completed objective | Total XP | Resulting level |
| --- | ---: | ---: |
|Opening and diary|315|3|
|40 level3 wardens|2,268|7|
|Eight Seeds, assuming20 level3 kills|3,648|8|
|60 level20 Imps|16,611|13|
|Returning Scar investigation|16,811|13|
|50 level30 Demon Orcs|41,604|18|

Level30 requires195,750 cumulative XP, leaving154,146 outside these required
objectives. This deliberately omits incidental/elite kills, higher-level
collection sources, Well Rested and dailies, and optimistically assumes the
underleveled character can defeat every objective. It is **not** a native
failure or measured grind duration. Nevertheless, the story moves from a
level8 budget into level20 targets and from level13 into level30 targets;
the full100-hour forecast does not establish a smooth first-dungeon path.
The old earned Earth receipt predates these combat rewards. Fresh level3
acceptance cannot close this gap either.

Asked the player for the desired level30/first-dungeon milestone within the
100-hour total (2–3,5–8 or10–15 hours). Keep this early-story bridge open for
coordinated content/reward tuning; do not silently require daily resets, undo
the entire XP reduction, change saved contracts or apply rejected stat scaling.
No production balance change follows from this diagnostic alone. Existing audit
passed in0.08s; no campaign rerun was needed to identify the budget gap.

### Regional handoffs and repeatable-dungeon sensitivity

The existing regional readiness audit also ran against current budgets for one
unrested player,20 collection kills, starting at the previous dungeon's minimum
level. It includes the previous dungeon's quest turn-in, but deliberately omits
all of that dungeon's enemy/room XP, incidental kills and optional activities:

| Story segment | Starting level | Ending budget level | Next gate | XP shortfall |
| --- | ---: | ---: | ---: | ---: |
|Water|30|39|60|1,226,817|
|Fire|60|62|70|778,293|
|Air|70|72|70|0|

These are conservative handoff diagnostics, not observed player levels or
proof that the gates are unreachable. Dungeon income and optional play must
be added explicitly; the first-dungeon-only adjustment cannot establish a
coherent full route. All three selected audit scenarios passed without running
native gameplay (`TestChronicleRegionalReadinessBudgetAudit`, collection20,
party1/restedfalse).

The audit now also includes a single clear of the preceding dungeon at its entry
level, sampling generator seeds1–3. It counts the actual initially generated
enemy levels/ranks through production combat/party/rest reward functions and
collects actual room-clear payout events (including reward hooks). Boss counts
and generated progression layouts are checked. No combat is simulated or claimed;
summoned adds, repeated clears, Fortune, incidental travel and dailies remain
excluded. Three seeds are a sample, not a procedural minimum/maximum guarantee.

| Following story segment | Previous dungeon XP, solo/unrested | Remaining XP gap to next gate |
| --- | ---: | ---: |
|Water, after Verdant30|21,580–23,539|1,203,278–1,205,237|
|Fire, after Abyssal60|105,071–111,489|666,804–673,222|
|Air, after Molten70|140,328–147,917|0|

The selected diagnostic passed in4.46s; all36 solo/party, rested and collection
scenarios subsequently passed in4.180s. Adding the omitted single-clear income
does **not** close Water/Fire's required-story budget gaps. This strengthens the
case for coordinated regional progression work; it does not establish actual
grind hours, inaccessible gates or a reason to inflate every combat payout.
These figures retain20 collection kills and minimum-level field objectives.

The opposite risk is efficient dungeon repetition. Normal boss rewards remain
20% of the **run-level** threshold per eligible player: four Verdant bosses
therefore provide approximately80% of that threshold, before trash/room XP or
Well Rested. Supported ten-level run bands extend from30 to100 and remain
limited by character level; Heroic/Mythic are level100-only. The reference
forecast's one boss per four hours does not describe a group repeatedly clearing
dungeons. Use real encounter/travel evidence to compare a dungeon-focused route
as well as mixed field play before calling the100-hour pacing accepted. Do not
treat automation's slow formation time as a human clear time, add forced waits,
or nerf rewards from an assumed clear duration alone.

Focused Go coverage across all packages passed (game8.259s): progression/save
conversion, quest budgets, Chronicle/manual claims, party credit, Dark Realm,
Well Rested and dungeon room awards. The final forecast and real daily-refresh
quote preservation checks passed7.216s. All100 enemy levels are checked for
rank/difficulty/party accounting and monotonic ordinary rewards. Production boss
death receipts and overlapping daily claims retain their accounting assertions.

Bounded connected check `xpopening0923a` passed September23 against source
`02b11f0d`: a newly created level-one Wizard, ordinary baseline stats and no
grants, earned three opening kills with no deaths, manually claimed100Gold/
100XP, then inspected the diary and claimed25Gold/200XP. Saved receipts and
levels survived normal reconnects. The route reached level3 in110s; Playwright
passed1/1 in1.9min. This verifies the playable opening and reward persistence,
not the modeled full-campaign duration. No earned dungeon rerun was necessary.

Preserve existing earned checkpoint19 exactly: its previous
XP receipts describe the previous balance, not a newly earned route. Do not replay
the entire campaign to validate each rate edit or wait100 real hours to publish
an initial target. Remaining raids/finale belong to the consolidated1.10 pass.
The new release must disclose slower incoming XP, honored accepted contracts,
and unchanged saved progression in cumulative patch notes and version labels.
