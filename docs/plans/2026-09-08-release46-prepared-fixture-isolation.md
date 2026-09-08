# Release46: explicit prepared-dungeon starting state

CI34232562890 oned5f64a ended FAILED in predeployment,6/7character tests passed.
Client/server/anonymous browser gates passed; both deployment jobs were skipped.
The two-boss route onseed-2919309235239002724 entered at level100 with1216/1685
mana after earlier independent tests. Rootbound Warden died; Briar Matron was
damaged16800→1995 before the120-second fight ceiling, with player1338HP/2mana
at the last sample. This is observed resource exhaustion, not an attackability
failure. Retry then removed its already-equipped Empowered rune by clicking the
toggle again, failing the exact authoritative rune assertion. Original log:
`/tmp/eidolon-release46-predeploy-failure.log`.

Prepared functional QA now explicitly submits the existing allowlisted `/level
100` fixture once before entry, including when earlier tests already leveled the
shared QA character. It waits for a fresh system acknowledgement and full
starting bars, records pre/post resources, and retains normal build purchases.
This command rebuilds canonical base stats, XP/points and starting resources;
it is deliberately confined to prepared QA, not an earned route or runtime
recovery change. No refill/reconnect is added between encounters, and no combat
deadline, damage/death assertion, regen rate or boss stat changes.

Wizard/Fighter rune preparation reads replicated equipped IDs before clicking;
matching runes are retained, different/missing ones still use actual UI input
and require the original acknowledgement. A new isolated fixture route tests a
real cast, explicit next-test reinitialization and repeated preparation preserving
the same talent/rune build, then runs actual Verdant on the shared character.

Focused25tests, lint/bash/diff pass (93404,1.053s). Actual fixture-reuse/two-boss
and final regression checks remain required before committing a publication
closure and pushing46 again. Keep47–55 behind the complete46 CI/live gate.

## Actual closure and more precise resource diagnosis

22302 on clean45df969 completed PASS2/4.5m, explicitQA_SCRIPT_EXIT=0, normal0.
Fixture reuse passed29.2s: real Fireball depleted mana, next-test explicit level
setup restored starting bars, and a second normal preparation retained exact
talent ranks/points and Empowered rune with zero duplicate purchases.
The following Verdant passed3.9m, seed3243300853383481175/gen2/normal30 Wizard100:
both15000/16800HP bosses, later enemies, cleared rooms/gold/town return passed.
Last Matron sample953HP with player2450HP/483mana before confirmed boss death.
There was no resource reset between encounters. Scan0 and independent exact
container/network/image absence passed. Log
`/tmp/eidolon-release46-prepared-fixture-gameplay.log`.

Full client10846 PASS223suites/3251tests/174.985s, normal0. Server's existing
TestSetPlayerLevel race checks60849 PASS1.508s; runtime/server code is unchanged.
These supplement25focused tests/lint/bash/diff. Log
`/tmp/eidolon-release46-prepared-fixture-client.log`.

The new repeated-login observation refines the initial explanation: login itself
returned2080/2575HP and1190/1685mana, even after full bars before disconnect. Both
495-point deficits are exactly the level100 flat resource bonus. Source
client_dispatch initializes CURRENT resources from base stat×10; recalculation
includes the missing bonus in MAXIMA. Database Character stores neither current
resource. Thus it is not simply preceding tests spending mana. This separate
gameplay persistence defect remains OPEN: do not claim this QA fixture fixes
reconnect recovery or earned progression. The root roadmap has a dedicated
resource-reconnect acceptance contract. No runtime/version/patch-note content
changes from46; publication still requires complete CI and exact live identity.
