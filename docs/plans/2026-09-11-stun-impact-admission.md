# Stun at basic-attack impact — local follow-up

Status: reproduced and repaired locally; full regression/native/release gates
remain open. This extends the separate general stun lifecycle repair, not the
unfinished Fighter talent description/scope work.

The ordinary attack entry point already checks stun twice, but the delayed
impact callback only rechecked death and instance. A Shield Slam accepted after
an enemy began its swing therefore failed to stop damage while still stunned.

84336 reproduced the defect (game0.156s, terminal1): the actual enemy wind-up
was accepted, a paid Shield Slam applied stun, and its synchronous post-wind-up
impact damaged the player. The paired expired-stun control passed. Log
`/tmp/eidolon-stun-impact-red.log`.

The callback now rechecks `Stunned` under the same attacker lock, before consuming
next-attack bonuses or taking its damage snapshot. Already-launched projectiles
and separately telegraphed boss abilities are not removed or rewritten. Existing
CC immunity and start-time cooldown/resource rules are unchanged. This suppresses
an impact while stun is active; it does not introduce a general attack-generation
invalidation system or promise to cancel a swing whose impact occurs after stun
has already expired.

30832 focused race passed game5.403s, including active/expired post-wind-up
controls, paid enemy stun/resume, DOT/NPC cleanup, immunity/target exclusions,
existing enemy reach-at-impact and player basic-cadence tests. The test uses an
hour-long fixture cooldown to keep the independently scheduled callback out of
the synchronous impact assertion; `StopBackground` cancels that owned callback.
It is not a real-time/browser timing acceptance test. Log
`/tmp/eidolon-stun-impact-green.log`.

Integrate this with the lifecycle repair before claiming complete stun gameplay
acceptance. The earlier current-source full server run did not contain this
impact change and must not be attributed to it. Keep remaining full regression,
native dungeon/party combat and production validation open.
