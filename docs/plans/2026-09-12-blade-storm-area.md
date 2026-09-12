# Blade Storm bounded flight — 1.1.0 candidate

The old ten-unit cone described aim direction, not actual projectile range:
authoritative daggers could fly for five seconds at35units/second, and offline
daggers for ten seconds. Fine Motor training changed neither flight boundary.

Blade Storm now snapshots its ten-unit range plus3% per Fine Motor rank when
the paid cast creates five daggers. The accepted event publishes that same
radius and90-degree arc for presentation. Each dagger stops at its travel limit
or the first dungeon wall, sweeping its legal segment for intermediate hits so
a slow frame cannot skip a target or pass into a disconnected room. The existing
one-hit-per-dagger target list, five-shot fan, damage, mana and cooldown remain.
Other projectile lifetimes and server-owned client replicas are unchanged.
The projectile collision capsule still includes its existing1unit radius and
0.5target padding; the flight limit describes the dagger center, not a promise
that target centers outside the radius can never overlap it.

Offline flight is horizontal at launch height, uses the same radius and stops
locally only when the client owns simulation. ROG_38 is damage-only: an initial
test incorrectly treated it as area training. The fixtures were corrected;
catalog bonuses were not changed to satisfy that incorrect expectation.

Evidence before the added subframe cases: focused client4suites43tests passed,
full client407suites6341tests passed229.125s, full lint passed, focused server
race passed16.302s (paid0/1/5 Fine Motor crossed with0/5 damage training,
walls, intermediates, snapshotting and existing projectile/dungeon contracts).
Additional subframe coverage passes8tests/0.885s: all three ranks stop at the
same snapshotted boundary under0.05s updates and a single1s update.
Initial tests reproduced unrestricted flight and missing cast radius on both
sides. Logs use `/tmp/eidolon-blade-storm-area-*-20260912.log`.

Still required: final candidate CI, actual native paid/trained/saved casts and
High/Low rendered flight/boundary checks, then merged regression. This candidate
does not prove all160 talent consumers, whole dungeon balance or live release.

## Draft 1.1.0 patch note (unreleased)

## Authored native phone route (execution pending)

The new blade-storm-area route uses a dedicated allowlisted Rogue, normal phone
branch/talent purchases with actual wire ranks and exact point accounting,
rank0/1/5 High/Low casts and saved rank5 landscape login. Only level is prepared;
resources recover through normal town healing and cooldowns expire naturally.
No cast, projectile, rank, timer or endpoint is assigned. Each paid30mana cast
must show an attached authoritative cone at the trained radius and five distinct
server terminal events at that distance, followed by replica removal. Server
wall/intermediate-hit tests remain separate from this open-town flight check.

The receiver observer forwards each message once even if another observer wraps
it; missing geometry and optimistic ranks cannot manufacture success. The route
is included once in full QA with zero retries. Focused2suites11testsPASS2.156s,
changed-file lint, assets, shell syntax, single-scenario listing and diff passed.
Logs `/tmp/eidolon-blade-storm-native-{focused,lint,assets,list}-20260912.log`.
Runtime6cd11168 CI34709688359 currently client/serverPASS, browser shardsactive.
Actual native execution and final combined regression still required.

## Draft 1.1.0 patch note (unreleased)

- Blade Storm's five daggers now stop at their intended range and dungeon walls.
  Fine Motor training expands that range and its cone indicator consistently;
  targets crossed between frames can be hit without daggers passing through walls.

Keep the production login version and released patch-note history unchanged until
the complete1.1.0 release gates pass; include this entry in that milestone's notes.
