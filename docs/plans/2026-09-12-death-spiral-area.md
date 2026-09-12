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
# Native purchase and saved-session verification

The combined native candidate includes the accepted fence batching and corrected
Smoke Bomb gate. Its new `death-spiral-area` route uses a distinct allowlisted
Rogue, ordinary branch A selection, five paid Fine Motor purchases, rank0/1/5
casts, and a fresh login retaining ranks and remaining points. Readiness/level
commands are disposable fixture preparation, not earned progression evidence.
Paid35-mana receipts and server radii4/4.12/4.6 must match independently measured
attached effect boundaries and origins at high/low quality and portrait/landscape.
The observer does not invent missing meshes or alter gameplay.

The full native gate and timing catalogs include the new non-retrying stage.
Initial focused tests caught a copied command name in the enrollment assertion;
corrected four suites70tests passed2.015s, with lint, assets, shell syntax and
diff checks passing. Logs `/tmp/eidolon-death-spiral-native-tests{,-corrected}-20260912.log`,
`/tmp/eidolon-death-spiral-native-{lint,assets}-20260912.log`.
Actual native execution and combined full CI remain required; no release claim.

Native25693 on a1513834 PASSED22.0s test/24.0s total, zero retries: rank0/high
radius4, rank1/high4.12, rank5/low4.6 and saved rank5/high4.6. All paid mana,
attached-boundary/origin and normal purchase/persistence assertions passed.
Main-agent screenshot review shows the real Rogue and spin footprint in the
landscape world. Archive `/tmp/eidolon-death-spiral-native-pass-k1DpfW`, original
`/tmp/eidolon-death-spiral-trained-native-20260912.log`; credential scan and owned
service/port cleanup passed. Combined CI34694650346 remains pending completion;
native success does not replace its full regression gates.
