# Four-role healer aura uptime — input strategy, not a balance adjustment

Run25565 on4f5d0439 failed after10.7minutes with Fighter death against Warden,
last observed5282HP. The archived failure is
`/tmp/eidolon-four-role-tank-failure-1PRIEN`. The failed survival assertion is
authoritative; the final Fighter snapshot had already recovered in town and
must not be read as a survival pass. All previous gates remain in force.

The last five healer decisions stayed11.5584units from the tank. Healing Light
was pressed when ready, but the next decisions waited on its cooldown even
while Guardian Embrace was active. That separation exceeded the10unit aura and
the target's1.25body padding. The driver never used that cooldown time to restore
periodic-heal coverage. The trace does not prove that positioning alone explains
the entire failure or that the encounter is balanced.

The driver now uses an active aura's replicated radius to plan ordinary follow
input during a direct-heal cooldown of at least one second. It aims three units
inside the aura and only moves when outside a one-unit inward margin. A ready
or nearly-ready direct heal, active telegraph movement prohibition, inactive aura,
dead/other-instance/invalid actor or already-covered target cannot trigger it.
The real movement helper still owns collision and input validation. No movement
assignment, stat/resource grant, extra skill, gear change, cooldown edit or
relaxed survival/clear/credit/manual-turn-in/save requirement is introduced.

Focused tests cover the actual recorded distance/cooldown and trained radii,
warning/ready-heal priority, invalid health/position and already-covered actors.
Three initial suites123tests passed0.685s plus full lint (13487). Full regression
and native completion with this strategy remain required. The previous clear
attempt does not become successful because these input-policy tests pass.

This work is separate from frozen1.0.63 and the Teleport candidate's running full
regression. Coordinate the next local native run with the self-hosted deployment
checks rather than competing for the same GPU.
