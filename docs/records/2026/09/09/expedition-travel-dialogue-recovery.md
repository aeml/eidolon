# Earned expedition travel — prevent incidental NPC conversations

Primary replay12121 on7fab2eb ended FAILED after14.6m, not a completed Earth
readiness run. It passed opening/diary, the40-kill hunt with manual reward and
reconnect, and8naturally collected Seeds with manual turn-in/consumption. Bag
management equipped9earned pieces (4free slots became13); no sale was needed.
The Imp stage then reached level10, traveled back to train branchC and two
WIZ_01 ranks from earned points, and resumed combat tolevel11. Both actual HP and
MP recovery passed between encounters. Full Imp count was not captured in the
failure receipt; do not infer it from level or damage counts.

The terminal error is GroundInputUnavailableError in findExpeditionTarget at
(-15.17,199.29), safeZone=lanternhold, HP407/407 and MP319/319,9free bag slots.
No pointer attempts could reach the destination because quest-window was open.
The inspected failed-collection.png shows the DAILY quest giver's Demon Orc
offer covering the center of the screen, not an enemy-death or resource failure.
The exact prior click which opened it was not recorded. Source inspection shows
ordinary travel crossed town toward the Imp anchor and used ordinary clicks,
which can become an NPC interaction when hover changes before the final raycast.

Use the existing Shift-click move-only gesture for expedition search travel.
This preserves real input, walking/collision, existing optional jump fallback,
100-step/deadline bounds and actual enemy selection. It does not suppress normal
NPC interactions, close all menus, accept dailies, grant credit or change game
rules. The actual runtime already resolves this explicit gesture before NPC
interaction. Add the real QuestNPC type to its regression and assert that both
fresh/prepared shared target acquisition select the move-only travel path.

Also retain actual quest counts in future read-only failure receipts, and fix the
bag helper's receipt note so equipping-only recovery does not claim a merchant
sale was tested. Sale behavior remains independently unverified.

Evidence retained at `/tmp/eidolon-story-travel-dialogue-failure-G3M8F7`;
original wrapper credential scan sanitized2files, archive rescan0. Exact owned
containers and API18560/Mongo18561/web41960 were absent after wrapper cleanup.
Original log `/tmp/eidolon-story-safe-exit-2322.log` remains. No production changes.

Focused59919 PASS37tests/5suites0.835s+lint. Full82812 PASS283suites3984tests
101.714s+lint; logs `/tmp/eidolon-expedition-move-only-full-{client,lint}.log`.
Actual complete fresh/prepared Earth routes still require passing gameplay.
