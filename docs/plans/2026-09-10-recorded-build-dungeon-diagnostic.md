# Recorded earned build: first-boss combat diagnostic

Status: three recorded-build native runs failed on issued movement, not death/timeout.
Ground projection and the held-Shift runtime path are corrected. The third run
exposed missing production Shift-key tracking hidden by the original mocked key
state. Actual input-event/engine-update tests now cover that fix and full client
regression passes; another native replay remains required.
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

Next repeat this bounded native diagnostic before an hourlong campaign or any
boss-health adjustment. If movement fails again, use the new ray/status evidence;
if survival/pacing fails, evaluate earned kit and enemy tuning without undoing
the requested low regeneration. All wider roadmap and release gates remain open.
