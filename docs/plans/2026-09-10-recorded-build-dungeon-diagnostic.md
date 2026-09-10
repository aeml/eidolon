# Recorded earned build: first-boss combat diagnostic

Status: recorded-build native run failed on issued movement, not death/timeout.
Ground projection correction passes focused/full client/lint; native replay
remains required. No boss balance, regeneration, rewards or release changes.

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

Next repeat this bounded native diagnostic before an hourlong campaign or any
boss-health adjustment. If movement fails again, use the new ray/status evidence;
if survival/pacing fails, evaluate earned kit and enemy tuning without undoing
the requested low regeneration. All wider roadmap and release gates remain open.
