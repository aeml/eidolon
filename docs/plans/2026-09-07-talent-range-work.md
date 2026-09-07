# Range consumers — work after Alpha 1.0.35

Status: **in progress, unversioned and unpublished**. Base is the verified local
1.0.35 candidate `0088543`; the separate `release/35-with-forge` branch must keep
that tested source. This is not completion of the range/area or 160-talent gate.

The current overlay audit still reproduced both representative failures on that
base: five Aether Reach ranks reject a 17m Teleport, and five Battlefield Ministry
ranks leave the friendly actor at 10.2m uncleansed. Log
`/tmp/eidolon-talent-range-area-current.log`.

## First consumer: Teleport

A shared server range multiplier now applies existing additive talent bonuses
after the rune-adjusted base. Teleport consumes it after Blink's existing 15m →
22.5m base change. No new movement permission or changed wall policy is added.
The client uses the same range for targeting/intent and offline Teleport landing.
Wizard range metadata covers the existing server WIZ_29 (+3%), WIZ_35 (+4%) and
WIZ_38 (+2%) definitions. Aether Reach's old +3% copy is corrected to +4%.

The shared JSON contract covers untrained, one/five Aether ranks, Blink alone,
Blink plus Aether, stacked range talents with/without Blink, and the Technique
talent that must not extend range. Each server case actually casts just inside
and outside its boundary; rejection must not move, spend mana, start cooldown or
emit a movement effect. Success must pay and publish the exact destination.
Client cases check targeting and actual offline landing against the same numbers.

Before implementation, six of eight client cases and five server inside-boundary
cases failed. Retained logs: `/tmp/eidolon-teleport-range-before-{client,server}.log`.
The expanded client regression passes **31 tests**, with lint, in
`/tmp/eidolon-teleport-range-expanded-client.log` and
`/tmp/eidolon-teleport-range-lint.log`.

The first new ranked dungeon probe used a non-dungeon instance ID and therefore
did not invoke dungeon constraints. Its failure is retained in
`/tmp/eidolon-teleport-range-expanded-server.log`. The corrected fixture uses the
production `dungeon_` prefix and asserts that precondition. It checks a target
beyond the original 15m edge through both a solid wall and an open doorway at
world offset 60000, including the published visual destination. Run results are
recorded separately; do not mistake the malformed-fixture failure for a newly
introduced wall bypass.

The corrected server race checks **pass in 7.180 seconds**, including all shared
inside/outside cases, the new ranked wall/doorway cases and the existing dungeon
movement-ability suite. Log `/tmp/eidolon-teleport-range-expanded-server-corrected.log`.
The Teleport-only full client suite passed **184 suites / 2,572 tests in
112.702 seconds**, `/tmp/eidolon-talent-range-working-client.log`. No release is
marked ready.

## Second consumer: Scorch Beam

The server now scales the existing 18m beam before wall clipping, broad-phase
query and final body-padded hit checks. Local cast intent and predicted meshes
consume the same multiplier. Remote events already carry the final endpoint;
their presentation now preserves that endpoint instead of reconstructing an
untrained 18m beam from private/missing talent data. Tests deliberately omit
remote ranks and provide stale local ranks/layout to verify that distinction.

Offline Scorch Beam previously hit only 15m despite its 18m online/visual reach.
It now uses the shared 18m base plus talents, horizontal aim (including elevated
realms), canonical wall clipping and target-body padding. This is an intentional
offline parity repair, not an untrained online range change.

The seven-case shared JSON contract covers baseline, single/five Aether ranks,
Runic Precision, Mana Geometry, stacked bonuses and unrelated Technique ranks.
Before implementation **15 of 21 client checks failed**; server ranked endpoints
also failed. Logs `/tmp/eidolon-beam-range-before-{client,server}.log`.
After implementation **70 client checks pass**, including both quality levels,
actual predicted/remote meshes, offline cover and the existing Wizard/Teleport
regressions. Log `/tmp/eidolon-beam-range-after-client.log`.

Server boundary cases cast at world offset 60000 against ordinary and 4x-scale
targets just inside/outside body-padded reach. Separate cases retain cover,
doorways, side/behind misses, friendly-player protection and instance isolation.
The first extended-room fixture expected 21.6m in a room ending at 21.5m; the
server correctly clipped that last 0.1m. Preserve the failed run at
`/tmp/eidolon-beam-range-after-server.log`. The corrected fixture extends the
receiving room while retaining its original gap and doorway. The expanded
Teleport/beam/directional-wall **race suite passes in 22.505 seconds**, log
`/tmp/eidolon-beam-range-after-server-corrected.log`.

Preparing the real-server purchase route exposed another accessibility bug:
desktop specialization hid all 14 general talents, although the phone panel had
already been repaired in 1.0.32. All twelve desktop class/branch probes reproduced
the omission (`/tmp/eidolon-desktop-general-talents-before.log`). The desktop
filter now retains general talents alongside its ten relevant skill talents.
Its existing optimistic purchase interaction remains a separate UX concern;
the gameplay route must prove accepted geometry and saved ranks, not rely on
optimistic client rank values as proof of server acceptance.

Expanded full client checks pass **185 suites / 2,608 tests in 109.2 seconds**,
`/tmp/eidolon-beam-range-full-client.log`; lint passes in
`/tmp/eidolon-beam-range-expanded-lint.log`. The isolated `beam-walls` gameplay
route **passes in 53.1 seconds (51.1-second test body)**, log
`/tmp/eidolon-beam-range-gameplay.log`. The browser route uses normal menu training and hotbar casts at
zero/five Aether ranks, compares actual meshes with accepted server endpoints
at both qualities with/without cover, and checks the saved rank after login.
All eight rank/quality/cover combinations match the accepted endpoints; the
fresh login retains five ranks. Browser failures are empty, credential scanning
passes and the route exits successfully after disposable container/data cleanup.
It uses a prepared level-100 disposable character, not earned progression or
proof of remote multiplayer play. Runtime and selected browser source stayed
unchanged throughout that run. No range release is ready yet.

Source trace for the next consumers: ordinary server projectiles expire after
five seconds in `world_update_entity.go` (traps use sixty); Fireball speed is
20m/s or 12m/s with Magma, while the offline projectile has a ten-second baseline.
Client Fireball intent uses 36m and the server ability-spec entry says 18m.
These are distinct existing values, not a single authoritative travel limit.
Do not overwrite actual baseline travel with a convenient spec value merely to
make a talent test pass. Trace and document the intended cast, travel and homing
limits; pair real outcomes before changing them. Beam endpoints and projectile
expiry must remain consistent with their replicated presentation.

## Required next work before a range release

- Continue Wizard and Rogue actual consumers, not just Teleport: direct target
  validation, cone/beam reach, directional projectile travel/lifetime, placement
  bounds and relevant runes. Preserve base behavior where no ranks are allocated.
- Next direct/homing boundaries: Arcane Missiles still validates both explicit
  and cursor-selected homing targets at a fixed 18m; Weak Point Mark still uses
  fixed 10m. Preserve the distinction between a rejected homing target (missiles
  still launch without homing) and a rejected targeted debuff (no resource cost).
  Flame Whip still uses fixed 12m, Shadow Lunge fixed 10m/15m with its rune, and
  Backstab fixed 2.5m. Do not change only their search radius while retaining an
  old final hit/movement check.
- Update client chase/targeting and local/remote presentation for every changed
  consumer. Teleport's helper alone must not be wired globally ahead of working
  server consumers. Current metadata does not mean all corresponding spells work.
- Pair inside/outside boundary casts with unchanged LOS, walls, height, instance,
  relationship and oversized-target checks. Add real-server gameplay and saved
  rank checks before publication, then separate patch notes/version metadata.
- Keep area consumers (including the still-failing Purifying Wave probe), other
  talent/copy gaps, physical phones and the full 1.1–1.10 scope open.

1.0.28 remains the last fully verified live release. 1.0.29 CI `34078663504` is
in predeploy gameplay QA; do not push a successor before its whole CI/live gate.
