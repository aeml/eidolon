# Guardian Roar area consumers — local, unversioned repair

This branch extends the separate Purifying Wave repair, not the running dungeon
test or the older98320775 release candidate. Neither talent repair is deployed.

## Reproduction and change

Lineholder Instinct's existing3% area per rank never reached Guardian Roar's
fixed15-unit query/geometry. Paired paid casts in the diagnostic overlay failed
at five ranks for ordinary/large friendly targets while both rank-zero controls
passed (1174,2.050s on the parent source). The normal regression now also covers
Roar Technique's2% area, Enduring Rhythm's2% area and additive composition.

The server resolves one trained radius for its broad query, final friendly/
hostile checks and authoritative cast event. The accepted ring is self-centered
at the cast point, not the cursor or later interpolated source position. Client
prediction, remote rendering and stale-prediction correction use that same shape.
Offline ally checks use horizontal distance plus target body padding and include
the caster even if the active chunk list omits it. Hostile feedback respects
walls/PvP allegiance. No spell costs, base cooldown, buff magnitude, boss-taunt
set requirement, talent IDs or purchased ranks change.

This does not claim all Fighter area/duration/mastery talents work. In particular,
the existing offline enemy branch displays taunt feedback rather than implementing
a new AI threat system. The new server tests exercise actual enemy threat and the
boss-set gate; do not substitute offline floating text for that evidence.

## Focused evidence

-24071 RED: actual-cast/boundary/accepted-shape tests fail on the old handler,
 8.966s. Client17538 RED28tests1.824s:14 presentation cases expose missing
  shape/rank/position support; the14 offline cases initially also had an invalid
  level-one mana fixture (20mana for a35mana spell). That fixture is corrected
  to200mana for real paid offline casts, not by reducing production costs.
-61557 Go race PASS11.151s: body-padded edges, additive/scoped talent ranks,
  real ally defense effect/shared expiry, actual enemy taunt boundary and
  required boss set bonus, plus existing party-support contracts.
-97414 Go race PASS1.680s: unchanged hostile walls/doorways, friendly support
  across cover, dead/other-instance/PvP-opponent exclusions.
-41565 client PASS93tests/5suites1.755s, including actual offline behavior,
  both-quality local/remote ring geometry, stale accepted-cast correction,
  Purifying regression and isolated-route contracts.77792 lint/shell syntax
  exited0 and discovers exactly one new Guardian Roar native case.
-56585 diagnostic overlay PASS2.022s, including the original paired Roar
  consumer probe. This is not a full160-talent audit sign-off.

Logs: `/tmp/eidolon-roar-area-{server-red,client-red,server-expanded,server-walls,client-final,audit-green}.log`.

## Remaining release gates

The isolated `guardian-roar-area` route is added to required-all without dropping
existing routes. It prepares an explicit disposable level100 fixture, buys actual
Technique/Lineholder/Rhythm ranks through the phone UI, checks accepted mana and
attached rings at15/16.5/18.75/20.25radius, then relogs in landscape and requires
saved ranks plus the high-quality ring. It has NOT run yet. Browser emulation is
not physical-phone acceptance or earned build progression.

Required next: full current-source client/server regression, native Purifying
and Roar purchase/save/render checks, integration review and full release gates,
accurate per-version patch notes and aligned metadata, remote CI and live checks.
Do not fold these changes into the older release candidate without those gates.

## Unreleased patch-note draft

- Guardian Roar now honors its area-talent bonuses for ally protection and
  taunt reach. Its visible ring matches the trained radius for you and nearby
  players. Boss-taunt restrictions remain unchanged.

No version is assigned; publish this note only with the verified feature.
