# Four-role warning timing — first instrumented result

Native37629 on clean8f2c82a4 TERMINAL FAIL after13.7m. Prepared level30/Common/
rank5 Fighter, Cleric, Wizard and Rogue formed a party, entered Normal Verdant,
cleared the opening room and recovered through one full town visit. All four
regained resources and retained their instance/seed/rooms/Gold/inventory/quests.
Seed-6948543675275706922, generator2/attempt0/fallbackfalse. This was a new
generated run, not a replay of the previous Briar failure's seed.

The Fighter died at Rootbound Warden; last periodic boss report12338/15000HP
is not the boss's exact terminal HP. Cleanup returned the Fighter to town at
940HP/610MP; the explicit sawDeath flag and fatal event prove that is not a
survival result. Combat totals: Fighter3021damage/1808taken, Cleric3123effective
ally healing/552taken, Wizard2392damage/544taken, Rogue3758damage/2600taken.
Everyone had392Gold; final Sentinel quest count remained zero. No boss clear,
full dungeon, personal turn-in, saved Water handoff or earned progression proof.

Complete sanitized artifact `/tmp/eidolon-four-role-timing-failure-WNbMXB`;
log `/tmp/eidolon-four-role-briar-timing-20260912.log`. Credential scan0; owned
party09120431 API/Mongo absent and18185/18186/41875 ports free afterward. No
production service, other test or scheduled soak was stopped.

## What the new measurements establish

The second warning response finished late on all four clients:

| Role | Total response | Input helper through observed movement | Completion after impact |
|---|---:|---:|---:|
| Fighter |1955ms|1629ms|289ms|
| Cleric |2068ms|1772ms|396ms|
| Wizard |1945ms|1616ms|333ms|
| Rogue |2153ms|1802ms|618ms|

Those helpers perform many serial browser exchanges before mouse input: install
observer, read origin, check path, project destination, move pointer, settle
hover, read hover, resolve ground ray, reset click probe, modifiers/click, read
intent, read click receipt, then observe movement. For the Rogue,998ms elapsed
before ground-ray validation and1524ms before click/modifier release.
For the Fighter the corresponding times were1056ms and1461ms. Planning itself
was28ms and145ms respectively. This establishes substantial input-harness
overhead, not a game-server movement delay or a proven boss-balance defect.

The Cleric did heal during the boss. Its last ready heal targeted the Fighter
at140HP from6.15units, followed by a normal3.97s cooldown; it still had451MP.
No claim of a healer outage or inadequate mana is supported. Earlier self/ally
target choices and healing cadence remain relevant strategy evidence.

Next investigate combining read-only browser observations to reduce serial
round trips, while retaining real pointer/modifier input, collision/ray checks,
hostile-interception detection, receipt/displacement proof and all survival
assertions. Do not extend the boss warning or give the party resources to make
the test pass. Any retry must wait for active65 native release QA to finish.
