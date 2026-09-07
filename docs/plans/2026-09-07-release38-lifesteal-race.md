# Alpha 1.0.38 — damage event / loot insertion race

Corrected candidate `b3c1057` is pushed successfully, but CI **34139776521**
fails the Go race stage. Client tests pass; browser/predeploy and both deployment
jobs are skipped. The detector reports an unlocked `World.Entities` lookup in
`fireDamageEvent` racing asynchronous loot insertion in `handleDeath`, reached
from `TestWhirlwindParallelFriendlyPlayersDoNotDeadlockOrHitEachOther`.
Log: `/tmp/eidolon-release38-movement-ci-failure.log`.

Separate `work/release38-lifesteal-race` retains the earlier movement candidate.
A bounded insertion/damage test reproduces the same race locally (**0.241s**),
with ordinary locked entity insertion concurrent with damage/lifesteal events.
The source pointer already exists at every production callsite. Passing the
live caster explicitly removes the extra world-map lookup without taking a
world lock recursively inside normal locked ability dispatch. Whirlwind passes
its live owner, not the damage snapshot, so lifesteal still heals the actual
player. All four classes' callsites are migrated; event payloads are unchanged.

Twenty repetitions of concurrent insertion, simultaneous friendly Whirlwind,
typed feedback and lifesteal checks pass **13.238s**. A separate world-lock-held
regression ensures a naive additional map lock cannot deadlock the ordinary
dispatch path. Logs: `/tmp/eidolon-release38-lifesteal-race-before.log`,
`/tmp/eidolon-release38-lifesteal-race-after.log`,
`/tmp/eidolon-release38-lifesteal-lock.log`.

1.0.38 notes add **Safer shared combat**. Runtime checkpoint **`814adbf`**
passes the full server race suite (root **7.749s**, game **210.796s**); the
world-lock-held/lifesteal set passes twenty repetitions in **7.040s**. These
tests finished on the exact source subsequently committed as this checkpoint.
The actual Whirlwind route passes **29.4s**, covering ordinary and Extended
casts in high/low graphics, acknowledged duration and effects following normal
movement. Credential scanning passes with zero sanitizations and disposable
cleanup finishes. Final version/default/Teleport checks pass **221 / 2.062s**
and lint passes. An initial direct Jest invocation omitted the project's ESM
flag and failed before running tests; the successful run uses `npm test`.
Logs: `/tmp/eidolon-release38-lifesteal-full-server.log`,
`/tmp/eidolon-release38-lifesteal-whirlwind.log`,
`/tmp/eidolon-release38-lifesteal-contract-after.log`,
`/tmp/eidolon-release38-lifesteal-lint.log`.

Client runtime is unchanged from the verified movement candidate; retain its
52 anonymous and real movement/loot proofs. Publication checks remain open.
Carry this additional correction into the queued 39–43 descendants and the
separate Shield work. Live is not updated by a failed CI run; do not push a
later version past it.
