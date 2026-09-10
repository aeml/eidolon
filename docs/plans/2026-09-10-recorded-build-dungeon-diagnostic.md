# Recorded earned build: first-boss combat diagnostic

Status: the fourth recorded-build replay reached the eight-minute encounter
limit without another input cancellation, but did not kill the Warden. The
three earlier movement failures remain preserved. Actual input-event coverage,
full client regression and a server-side economy audit now separate the input
corrections from this recorded build's remaining preparation/pacing failure.
No boss balance, regeneration, rewards or release changes.

## Fixture and scope

`tests/fixtures/earned-wizard-31.json` preserves failed44188's actual entry gear
and latest build/story receipts from source4b3991ffea239bb3152ea93263fbc0bbe95c05a3.
Level31,14equippeditems, base70STR/40INT/40DEX/40WIS/70VIT, WIZ_01rank5,
Control branch and unlocked Teleport/Arcane Shield/Gravity Well. No rune grants.
It does not contain the full bag or an exact saved character, and is not proof
of current fresh-character progression, drop quality or acquisition.

Explicit isolated `recorded-build-dungeon` seeds only a newly registered empty
account in disposable loopback services. After loading, exact build/gear/skill
assertions precede ordinary town recovery, guide entry and real traversal.
No level command, protected waypoint, in-fight refill or reset during combat.
Room-boundary recovery uses the accepted ordinary expedition loop. The diagnostic
stops after actual confirmed Warden death; ordinary helper Recall still runs.
It deliberately does not assert four-boss clear, story reward or Water handoff.
Eight-minute encounter/stall/world-state bounds remain, with20minute test ceiling.

## Preserved native result

29121 terminal1 onclean8c8b64f510e4b1d0f60edfe22228cba51badc1fd: one test5.6min,
zero retries, seed-7178858117422988328/generator2/attempt0/no fallback.
Build/gear/skill/story-gate assertions passed. Room1 cleared; mana14/670→111/737
townarrival→737/737full, restbank0→1.320791435→10.856633467. Same-run re-entry
passed. Warden entry was full1254HP/737MP with3.8289084seconds of Well Rested;
ordinary expiry reduced maxima to1140HP/670MP. No damage/health override occurred.

Warden observed15000→7320HP, character remained1140HP. Mana quickly exhausted
and stayed mostly near zero. Final error was an issued Shift-click retreat
(-8.919479921,+1.201198545) from(20015.82603571,19583.04192879), actorY=.5,
with zero displacement. BlockedStops2, hardCorrections3; no death, damage-stall
or eight-minute timeout. Thus this run does not settle survival or pacing.

Archive `/tmp/eidolon-recorded-build-failure-hT5iS1`: reports/testresults/native
and focusedlogs. Wrapper actual credential scan sanitized2files; extra archived
native-log username redaction sanitized1file. Owned API/Mongo and18580/18581/
41980listeners absent after cleanup. The original `/tmp/eidolon-recorded-build-native.log`
contains disposable identifiers in its error line; prefer the redacted archive
for sharing. Recordings disabled; no screenshot acceptance claim.

## Projection correction and verification

The old helper projected actor height instead of the production ground plane;
the resulting ray need not hit the collision-checked floor destination. A real
Three projection/raycast negative fixture demonstrates this mismatch. It does
not reconstruct the original runtime camera or establish the sole failure cause.

Now project onto InputManager.groundPlane, keep collision-checked vectors
unscaled, and reject pre-click camera drift exceeding.25units before issuing
input. Report planned/actual ground points and stun/root/freeze timers on future
failures. An issued click that fails movement remains a real failure; no failure
classification, survival condition or timer was weakened.

-25910 initial fixture unit failure: jsdom lacked structuredClone. JSON-only
 clone fixed without weakening detachment;8134 PASS23tests/3suites0.825s+lint.
-32004 PASS33tests/6suites1.136s+lint on projection candidate1eb1cbcc.
-98271 first fullFAIL:302suitesPASS/one existing assertion needed the new
 explicit allowScaling argument;4211passed/onefailed,127.8s. Preserve
 `/tmp/eidolon-ground-projection-full-client.log`; lint did not run afterward.
-0a806ec2 updates that test and adds actual strict-vector/camera-drift/issued
 failure dispatch checks.64050 PASS43tests/7suites1.206s+lint.
-50861 terminal0 onclean0a806ec2:303suites/4215tests129.496s+lintNode24. Logs
 `/tmp/eidolon-ground-projection-verified-full-{client,lint}.log`.

## Exact-ray replay and held-Shift correction

90163 terminal1 on8987d870 retained the recorded build and normal resource rules.
Warden entry was full1254HP/737MP with2.343352126seconds of Well Rested.
Last observed Warden10180HP; player1140HP. The failed retreat had identical
planned and actual ground points, no stun/root/freeze, and zero displacement.
The initial click returned true with MOVING state but its destination disappeared.
This is not a completed fight or evidence warranting a boss-health adjustment.
Archive: `/tmp/eidolon-recorded-ground-failure-0DYeGS`; wrapper sanitized2files,
additional archived-native-log username redaction sanitized1. Owned services and
listeners were absent before the next isolated run.

Inspection found that initial Shift-click honored move-only intent while the
held-left-mouse branch in `GameEngineRuntime.update` did not. A hovered enemy
could replace the destination with attack/chase behavior before mouse release.
Two actual-engine-update regression cases reproduce both near and distant
enemies:16888 RED2failed/9passed. Runtime df07c50f shares the normal
`movePlayerToPointerGround` path for initial and held Shift, before enemy handling
but after Control/Meta handling. Collision, movement authority, jump and menu
guards remain intact; no direct position writes or resource changes.

47241 PASS48tests/4suites1.85s plus lint covers held modifiers, move-only actions,
input handling and movement smoothness. Logs:
`/tmp/eidolon-held-shift-{red,focused,lint}.log`.
4117 TERMINAL0 onclean80cf99ce (runtime df07c50f): full303suites/4217tests
passed131.087s followed by lint underNode24.18.0. Logs:
`/tmp/eidolon-held-shift-full-{client,lint}.log`.
A new native recorded-build replay remains pending.

## Real input tracking — September 10, 14:13 UTC

95608 TERMINAL1 onclean d918dfc6: one case5.8minutes, zero retries,
seed7932272933816589379/generator2/attempt0/no fallback. Room1 clear and ordinary
Recall/rest/re-entry passed: mana14/670→111/737→737/737, bank0→1.319529076→
10.032322459. Warden entry1254HP/737MP with2.309406338bank; last observed boss
8344HP/player1140HP. The failed retreat had the correct floor ray,0displacement,
no stun/root/freeze, blockedStops0/serverAdjustments0. Initial click returned
true/MOVING; its target disappeared immediately. No death or timeout occurred.

Archive `/tmp/eidolon-held-shift-build-failure-TfsZo0` retains reports, native
log and prior full/lint evidence. Actual wrapper credential scan sanitized2files,
additional archived-native username sanitation1file. Exact owned containers and
18580/18581/41980listeners were absent after cleanup. Prefer the sanitized archive
over the original redirected native log, which includes disposable identifiers.

InputManager only records keys already declared in its keys object. Shift was
missing, so the initial mouse event carried shiftKey=true but held frames saw
no keys.shift. The earlier engine regression directly invented that property;
its green result did not cover actual input propagation. Updated engine tests
use real InputManager keydown. 48997 RED4failed/20passed/1.527s confirms the gap.

87dcda4d declares Shift and adopts the real left-click modifier snapshot for a
key first pressed while chat owned keyboard focus. Both Shift keys, keyup, blur
and focused-chat-to-canvas transitions have coverage. 63700 PASS51tests/4suites
2.011s+lint/diff. 29492 TERMINAL0 onclean87dcda4d:303suites/4220tests151.132s
plus lint underNode24.18.0. Logs `/tmp/eidolon-real-shift-{input-red,input-focused,
input-lint,full-client,full-lint}.log`. No combat, resource or timer changes.

## Completed replay and economy audit — September 10, 14:36 UTC

27194 TERMINAL1 onclean f2c643f2: one case11.6minutes, zero retries,
seed-547736827228613654/generator2/attempt0/no fallback. Cleared two trash rooms,
used ordinary town recovery twice, preserved the instance, and earned level32.
Warden entry was full1165HP/685MP, with the short rested bank already expired.
The eight-minute combat limit ended with last observed Warden3926HP and player
1165HP. Attacks dealt damage throughout; no death, movement cancellation or
stall error occurred. This is not a boss kill, full dungeon clear, reward turn-in
or fresh campaign acceptance, nor an all-seed movement guarantee.

Archive `/tmp/eidolon-tracked-shift-build-failure-l2rwIf` retains native results
and full/lint evidence. Credential scan sanitized0files; the redirected native
log contains no disposable username prefix. Exact owned services and18580/18581/
41980listeners were absent before later browser checks.

d87d00f2 adds `TestRecordedWizardEconomyAudit`, which reads the same14item record,
normalizes only the client rarity wrapper, applies actual stats/training and
emits a real server Fireball. It asserts the native health/mana/basic-damage
profile and reports actual costs, regeneration and attack timing. Level32 uses
ordinary one-level growth, not different equipment or bonus stats.

| Unrested recorded gear | Level31 | Level32 |
|---|---:|---:|
| Intelligence / Wisdom / Dexterity | 52 / 69 / 52 | 53 / 70 / 53 |
| HP / mana | 1140 / 670 | 1165 / 685 |
| Mana per second | .69 | .70 |
| Basic damage / interval | 22 / 1.5873s | 22 / 1.5810s |
| Fireball damage / cost / cooldown | 148 / 30 / 1s | 151 / 30 / 1s |
| Full-bar casts / raw spell damage | 22 / 3256 | 22 / 3322 |
| Eight-minute stationary raw reference | 11550 | 11822 |
| Normal level30 Warden HP | 15000 | 15000 |

The reference sums cooldown-limited basics and mana/cooldown-limited Fireballs.
It excludes crit, variance, mitigation, movement, misses, animation and action
contention; it is not a maximum-damage proof, combat simulation or balance signoff.
26189 PASS0.153s;69032 focused race PASS1.990s, retaining existing prepared-Wizard,
overworld gear-band and dungeon difficulty/rank checks. Logs
`/tmp/eidolon-recorded-wizard-economy-{audit,race}.log`. No production server change.

Next evaluate ordinary preparation and encounter budgets against this evidence,
not another unchanged replay or a longer watchdog. The record deliberately has
an empty bag, so it cannot establish the original run's available Forge materials.
Inspect upgrade costs and retain material/inventory receipts on the next earned
route before claiming an available preparation path. Any counterfactual gear
probe must be labelled, not treated as earned progress. Recheck a justified
candidate through actual play and retain all-class/party/later-boss comparisons.
Do not restore high passive regeneration or claim the main campaign is accepted.
All wider roadmap and release gates remain open.

## Forge affordability and complete entry evidence — September 10, 14:58 UTC

Source f1ca0220 extends the server audit with explicitly counterfactual normal
Forge level upgrades. Each fixture supplies exactly the quoted shards, invokes
the actual upgrade action, preserves item identity and verifies exact material
consumption. These supplied materials are not earned-player evidence.

| All equipped items upgraded to player level | Level31 | Level32 |
|---|---:|---:|
| Required Eidolon Shards | 239 | 253 |
| HP / mana | 1280 / 770 | 1355 / 805 |
| Fireball raw damage / mana cost | 172 / 30 | 180 / 30 |
| Eight-minute stationary raw reference | 13928 | 14745 |

The same exclusions above apply: this is not a combat simulation, a maximum
damage bound, or evidence that the Warden is cleared. Focused audit77915 passed
.209s; focused race85596 passed2.316s including prepared-Wizard and dungeon-rank
regressions. Logs `/tmp/eidolon-recorded-forge-economy-{audit,race}.log`.

The original archived run DOES retain a later failure receipt. In
`/tmp/eidolon-earned-upgrade-failure-sQmC8N/run.log`, its level32 player has
19 Eidolon Shards and two Eidolon Hearts, zero stat points and one talent point.
The receipt was captured after the failed attempt, not before dungeon entry;
it does not prove an exact entry budget or an exact saved inventory/stash.
Its abbreviated inventory omits full item stats/basis/gems. Existing inventory
maintenance already retains materials and gems; do not treat their loss to
selling as an established cause. Gold alone does not pay the Forge shard cost.

The original preparation logs at levels10/20/22/30 all report zero available
stat points and zero allocations. Source inspection reveals a separate parity
question: new-character creation in `server/client_dispatch.go` initializes all
five stats to10; `canonicalBaseStatsForClass` used by `SetPlayerLevel` and many
prepared audits instead gives the class primary stat20. The recorded Wizard's
base Intelligence40 at31 matches the actual creation path plus ordinary growth.
Do not silently treat the stronger prepared baseline as fresh-player evidence.
Resolve the intended starting-stat contract and save-compatibility implications
before changing it; no new-character or saved-player stats changed here.

The fresh campaign now attaches `earned-dungeon-entry` after ordinary equipment
swaps and before traversal. It retains detached full equipment, inventory,
observed stash, base/derived stats, training, quests, resources, source identity
and timestamp without account identity or credentials. It is explicitly not a
database save. Attachment failure stops the long encounter from starting without
its receipt. Unknown stash is null, not a claimed verified empty store.
80072 TERMINAL0 onf1ca0220:304suites/4226tests154.437s plus lintNode24.18.0.
Logs `/tmp/eidolon-earned-entry-full-{client,lint}.log`.

Follow-up receipt coverage adds available stat/talent points, distinguishing
actual zero from unknown/null.72143 RED2failed/3passed/.962s;72281 PASS76tests/
4suites1.592s plus lint. Logs `/tmp/eidolon-earned-entry-points-{red,unit,lint}.log`.
No new native fresh campaign has yet produced this attachment. The full client
result predates this two-field follow-up, whose scoped regression passed.

Next balance decision remains whether ordinary Normal story dungeons should be
comfortably soloable with reasonable earned gear or require a party; an async
question is pending. Meanwhile, resolve preparation/starting-stat evidence and
continue independent ordered release validation. Do not grant this fixture
unearned Forge materials, repeat its unchanged failed fight, extend watchdogs,
or declare all-class, full campaign or live balance acceptance.

Follow-up: [starting-stat parity](2026-09-10-starting-stat-parity.md) resolves the
divergent prepared helper by matching the existing live baseline, without
buffing new players or rewriting saves. Focused regressions pass; native and
full acceptance remain pending. This does not change the recorded Wizard's
actual stats or turn its failed Warden attempt into an accepted clear.
