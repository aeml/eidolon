# Connected ranked arena acceptance

The existing practice browser route proves ordinary attack cadence and forfeit
behavior, not full queued team rounds or saved ranked results. A focused
extension now reuses the existing disposable server/socket helpers to cover
that gap without four rendered browsers or a new QA framework.

`TestArenaActualSocketsTeamRoundsAndSavedResults` passed **66.03 seconds** with
four actual WebSocket clients and the normal server binary built from
`4bab14fad67db14c26c93d9bacb0410f57187626` (Alpha1.9.10). Its guarded database was
new, disposable and loopback-only at18306; production was not contacted. Each
prepared level30 Wizard has an ordinarily generated Rare staff and allocated
Intelligence points. This is not earned leveling or four-class dungeon proof.

## Observed scope

- Ordinary invites/acceptance create two two-player parties. The first party
  visibly enters the replicated queue; the second triggers one ranked2v2 match.
  Every client receives the same match, and teammates remain on the same team.
- Normal movement packets and basic attacks, with real server invulnerability,
  attack and between-round timers. No debug kills, direct world mutations,
  forced damage, accelerated clock or in-match stat/resource grants.
- Two rounds finish2–0 under the normal first-to-two rule. All clients receive
  the complete result and independently contribute real damage:8/28/8/26 hits.
- The announced winning team matches each player's durable result. Two winners
  have rating1016, one win and50Honor; two losers have rating984, one loss and
  zeroHonor. Each saved profile references this exact match once.
- Fresh authentication retains personal wins/losses/rating/Honor and no active
  match. PvE level30, Gold1000, XP0 and the same prepared weapon remain intact.

This is authoritative connected queue/combat/result/relogin evidence, not
rendered team combat, physical-phone testing, or a simulated season. Retain
earlier practice, result-idempotency and UI
evidence; do not claim this one test closes the whole1.7/1.8/1.10 scope.

## Active-match connection loss and restart

The complementary `TestArenaActualDisconnectPenaltySurvivesResumeAndRestart`
passed **2.13 seconds** against the same4bab14fa runtime. Four fresh actual socket
clients formed two parties and entered ranked2v2. Closing one connection—not
sending a forfeit command—settled the match through production cleanup.

Both members of the disconnected player's team recorded one loss/rating984;
both opponents recorded one win/rating1016. **Only the disconnected player**
received the normal five-minute queue penalty. The innocent teammate still
shares the match loss, but receives no deserter flag or queue ban. No participant
received Honor or season points for a forfeit; every profile had revision1 and
the same exact match receipt.

The leaver resumed through the actual rotating token protocol. The completed
match stayed completed and a new ranked-queue request was rejected with the
existing deserter explanation. After closing clients and restarting the actual
server against the same database/journal, fresh logins retained exact per-player
results, revisions and penalty ownership. Repeated cleanup/relogin did not
duplicate a result or extend the saved penalty. This verifies the existing
immediate-forfeit policy; it does not promise a grace period or continued match
after a lost connection.

Log: `/tmp/eidolon-pvp-sockets-20260914-KJXVlY/disconnect-r1.log`.
Owned server logs: `/tmp/eidolon-compat-session-1927539015/server.log` and
`/tmp/eidolon-compat-session-3901816579/server.log`. Both shut down gracefully.
Owned disposable Mongo `eidolon-pvp-sockets-0914b` was stopped with `--rm` after
the test. No production requests or browser workload were introduced, and the
already-passing full combat test was not repeated for this separate scenario.

## Retained evidence and setup correction

Local logs/binary: `/tmp/eidolon-pvp-sockets-20260914-KJXVlY/`.
`run.log` failed startup identity validation6.94s: the helper requires the
binary basename to equal its reported commit. The server itself started and
shut down normally. Renaming the local binary to its actual commit corrected
that precondition. `run-r2.log` passed62.06s; strengthened party/result ownership
and unchanged-PvE assertions then passed in `run-r3.log`66.03s. No gameplay fix
or weakened assertion was used. Final owned server log:
`/tmp/eidolon-compat-session-1917589480/server.log`.

The test closes its server/connections and deletes only its generated account
records. Owned Mongo `eidolon-pvp-sockets-0914a` was then stopped with `--rm`,
removing its disposable database/volumes; port18306 was released. Logs remain.
The default unconfigured invocation skips this explicitly opted-in integration
test; a successful compile/skip is not a substitute for the execution above.
