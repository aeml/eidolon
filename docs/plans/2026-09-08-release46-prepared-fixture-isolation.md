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
