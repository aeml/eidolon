# Wizard ground-spell geometry

Status: locally verified after `b7342f6`, now packaged in the unpublished
[1.0.36 candidate](2026-09-07-release36-combat.md). Earlier unversioned labels
below describe this individual implementation checkpoint.
This advances the range/area consumer audit; it does not close the 160-talent,
class-balance, dungeon or roadmap gates.

## Player-facing changes

Gravity Well, Meteor Drop and Inferno Cataclysm now consume range talents for
placement and area talents for their separate effect footprints. Rune-adjusted
bases are retained. Accepted casts publish their resolved position, radius and
full-circle arc; local prediction reconciles stale boundaries without replaying
the cast animation or cosmetic layers. Observers need no private talent ranks.

Meteor preserves the existing server's 1.65-times authored hit/telegraph radius;
this is not a new baseline online area buff. Cluster and delayed Apocalypse
meteors retain their cast-time radius even if ranks change later. Additive protocol
field `impact_radius = 112` carries each Meteor's resolved impact footprint through
both entity-copy paths, snapshots and deltas. A projectile-removal message arriving
before the typed impact event therefore cannot replace the talented footprint with
an untrained fallback and suppress the later correct impact through deduplication.

Offline ground placement now respects range and dungeon walls before spending.
Gravity Well uses the server-style immediate damage/pull/slow, not the old repeated
damage zone. Inferno's ordinary tick cadence is one second; its hit checks use
horizontal distance, target-body padding, hostility and dungeon cover. Falling
offline Meteors reach their selected ground point (including empty ground), apply
their saved footprint once and cannot detonate early on an actor's head. Cluster
scatter remains inside connected dungeon floor.

## Evidence

- Shared 12-case JSON contract exercises baseline, range-only, area-only, combined
  talents and Expanded/Extinction/Cluster runes. Actual server casts clamp placement
  and hit/miss targets just inside/outside body-padded boundaries, including 4x
  enemies. Actual zone ticks, Meteor impacts, scales and accepted events are checked.
- Delayed Apocalypse testing observes all six real projectiles/telegraphs after
  changing ranks, including saved radii and wall-safe scatter.
- Client checks exercise High/Low meshes, stale prediction correction, actual
  offline casts/ticks, cover, hostile filtering and encoded protocol data through
  new-observer synchronization and removal-before-impact deduplication.
- Focused protocol/client suite: **99 tests / 3 suites**, 1.799 seconds,
  `/tmp/eidolon-ground-talents-protocol-client.log`. Focused server race suite:
  root 1.102 seconds / game 23.880 seconds,
  `/tmp/eidolon-ground-talents-protocol-server.log`.
- Full final client suite: **189 suites / 2,770 tests**, 94.214 seconds,
  `/tmp/eidolon-ground-talents-full-client-corrected.log`.
- Full server race suite: root 11.952 seconds / game **282.511 seconds**,
  `/tmp/eidolon-ground-talents-full-server.log`.
- Final lint and diff checks pass; lint log
  `/tmp/eidolon-ground-talents-final-lint-confirmed.log`.
- Final isolated `ground-shape` gameplay route: **36.2 seconds** (34.5-second
  body), `/tmp/eidolon-ground-talents-gameplay-final.log`. Normal menu purchases
  train five Mana Geometry ranks; all three spells reject blocked placement
  without cooldown, accept connected floor, render the accepted talented footprint
  at both quality levels across the route, and retain ranks after fresh login.
  Artifact credential scanning and isolated cleanup pass. This repeats the earlier
  49.8-second passing route after the last offline Inferno hostility change.

## Retained failures and limitations

Baseline server checks failed on absent accepted dimensions and unscaled placement.
The first client fixture omitted the Wizard constructor identity; after correcting
that mock, **25/28 tests failed**, not 28 actual product regressions. Logs are
`/tmp/eidolon-ground-talents-before-server.log` and
`/tmp/eidolon-ground-talents-before-client-corrected.log`.

The first after-change server fixture compared damage against MaxHealth after
Gravity Well correctly recalculated slowed target stats. The corrected fixture
compares original health; retain both `after-server` and `after-server-corrected`
logs under `/tmp/eidolon-ground-talents-`. The first full client run failed two
obsolete expectations: Meteor's exact layer objects lacked its newly explicit arc,
and a source guard expected the removed repeated Gravity Well zone expression.
Behavioral coverage remains in GroundTalentShape, not only the updated source guard.

This browser route does not prove exact placement-boundary distances; the actual
server fixtures do. Offline Apocalypse's additional five meteors and broader
offline rune/duration/damage parity are still open. Rogue ground abilities,
directional projectile travel, Cleric area consumers, remaining talent consumers,
normal cross-branch combo access and physical-device/group playtesting remain open.
No release version is advanced by this checkpoint.

The post-checkpoint diagnostic audit still fails the actual rank-five Cleric
Purifying Wave cast at the 10.2m ally, while the Teleport probe passes. Retain
`/tmp/eidolon-post-ground-talent-audit.log` (0.254-second game test run). Passing
the standard suites does not turn this explicitly open consumer into a working
talent or close the larger area-consumer requirement.
