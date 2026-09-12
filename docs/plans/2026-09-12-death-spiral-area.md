# Death Spiral consumes Fine Motor area training

Death Spiral used a fixed four-unit radius even with purchased Fine Motor
(`ROG_34`, +3% AoE radius per rank). Its server event also published the cursor
point without the accepted area shape. The offline handler used full3D distance,
did not check walls/hostility/instances, could process duplicated targets, and
played another fixed legacy spin after the canonical presentation.

The candidate consumes the existing area bonus in paid authoritative and
offline casts: rank0/1/5 radii4/4.12/4.6. The server publishes its self-centered
accepted origin, radius and full-circle arc; owner/observer visuals use those
values. The offline handler checks planar body-padded reach, static dungeon
walls, living hostile targets, instance and online authority before damaging
or consuming wounds. The existing damage, critical, bleed-finisher and cost
rules are unchanged. The duplicate legacy spin is removed.

Client regressions first failed8/13 cases. After the change, nine focused
suites221tests passed7.181 seconds, including multiplayer authority, shared
shape elevation, legacy area ranks, Rogue damage and transient visuals.
Server tests purchase actual ranks, check spent points, normal/large body edges,
paid casts, bleed consumption and accepted circles. The initial synthetic source
had empty base stats: purchasing a talent recalculated its positive stub damage
to zero. The fixture now prepares ordinary level-derived stats through
SetPlayerLevel and explicitly rejects zero-damage fixtures. This is a fixture
correction, not a damage buff or weakened hit assertion. Original missing-shape
failures remain recorded.

Corrected targeted Go race tests passed29.963 seconds, including actual Rogue
paid damage, dungeon area walls, Shadow Lunge→Death Spiral bleed consumption
and hostile casts against Arcane Shield. Lint/assets/diff checks passed.
Logs `/tmp/eidolon-death-spiral-{client-red,server-red,server-green,server-corrected,client-green,client-expanded,lint,assets}-20260912.log`.

Full hosted CI and native purchased/saved Death Spiral verification remain
required. This does not close other Rogue utility/area consumers, the full160
talent audit, the earned first hour, dungeon clear gates or1.1.0 release.
