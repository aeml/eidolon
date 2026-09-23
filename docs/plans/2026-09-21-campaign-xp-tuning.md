# Campaign XP tuning toward the approved100-hour target

Local implementation, not deployed. This is an initial balance target, not a
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
