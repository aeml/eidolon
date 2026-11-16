# Purifying Wave area and offline cleanse

Implemented for the local **Alpha 1.0.36 candidate**, not yet published. This is
one actual area consumer, not completion of Battlefield Ministry across every
Cleric spell or of the 160-talent audit.

## Behavior

Purifying Wave consumes Battlefield Ministry (`CLR_34`) before both its spatial
query and final body-padded hit check: 8m baseline, 8.24m at one rank, 9.2m at five.
The spell remains centered on its caster regardless of cursor position. It emits
that accepted center, radius and full-circle arc, so local prediction and remote
observers use the same footprint. Only stale boundary layers are replaced; cast
animation and cosmetic flashes are not replayed. A delayed event uses the accepted
cast point even when the actor has already moved.

Existing horizontal/body-padding and support-through-wall rules are retained;
this is not a change to which walls block healing/support. Living friendly players
and NPCs can be cleansed, including self. Enemy actors, PvP opponents, dead actors
and actors in other instances are excluded. Target validation and status mutation
now share the target lock.

Offline casting keeps the shared talent-aware cooldown and canonical cast art
instead of overriding them in the class handler. It includes the local player even
when the active-chunk listing omits them, uses horizontal distance/body padding,
and filters enemies/PvP opponents. The existing Actor cleanse now also clears
root and poison timers plus poison/bleed tick accumulators and damage metadata.

No base healing pulse is invented. `CLR_07` still assigns healing mastery to a
cleanse-only spell; its useful player-facing benefit needs an explicit design
repair. Other Cleric areas, offline parity beyond this scope and the wider talent
tree remain open.

## Evidence and retained failures

- Shared six-case JSON covers zero/one/five Ministry ranks, unrelated healing
  mastery, current Wave mastery and Ministry with Technique. Actual server casts
  cover ordinary/4x bodies just inside and outside their radius, full supported
  debuff removal, self-cleanse, cost and accepted geometry. Separate actual casts
  cover friendly NPCs, enemies, dead/other-instance actors and opposing PvP players.
- The first server test file used `string` instead of `EntityType` and failed to
  compile; retain `/tmp/eidolon-purifying-before-server.log`. The corrected fixture
  then fails on missing accepted geometry and the ranked ally outside the old area,
  `/tmp/eidolon-purifying-before-server-corrected.log` (3.916 seconds).
- Before client changes **26/26 checks fail**, 1.210 seconds,
  `/tmp/eidolon-purifying-before-client.log`. Final focused client checks pass
  **49 tests / 4 suites**, 1.794 seconds,
  `/tmp/eidolon-purifying-final-focused-client.log`. They exercise actual offline
  cleanse, self omitted from chunks, all cleaned timers/tick metadata, horizontal
  large-body boundaries, enemy/PvP/dead filtering, actual High/Low meshes,
  private-rank remote presentation and stale local prediction correction.
- Final focused server race checks pass in **4.697 seconds**,
  `/tmp/eidolon-purifying-final-focused-server.log`.
- Before the version-label change, full client checks pass **190 suites / 2,796
  tests in 141.861 seconds**, `/tmp/eidolon-purifying-full-client.log`; full server
  race checks pass root **27.087 seconds** / game **268.765 seconds**,
  `/tmp/eidolon-purifying-full-server.log`. Lint passes.
- The initial isolated phone-layout gameplay route passes **32.3 seconds**
  (30.4-second body), `/tmp/eidolon-purifying-gameplay.log`. It uses existing
  allowlisted level/readiness preparation on a disposable Cleric, normal branch
  selection, actual hotbar taps and normal Ministry purchases. Accepted 8m/9.2m
  casts match attached High/Low rings, resource cost and saved ranks after a fresh
  login and landscape rotation. No browser-side ranks, casts or effects are
  manufactured. Credential scanning and isolated cleanup pass.

The phone route proves cast/presentation/purchase persistence, not a multiplayer
ally being cleansed at an exact boundary or physical-phone ergonomics. Actual
server/offline tests cover cleanse effects and boundary distances separately.
The final 1.0.36 label/notes validation and repeated gameplay receipt belong in
the release-candidate record.

## Next area consumer

The diagnostic overlay now promotes Teleport and Purifying Wave out of its open
probes because normal tests exercise them. Its next actual-cast probe demonstrates
that **Guardian Embrace's periodic healing still ignores Ministry**: the ally at
12.2m remains unhealed at five ranks although the defined 11.5m radius plus 1.25m
body should reach them. Zero-rank control passes; rank-five fails in 0.312 seconds,
`/tmp/eidolon-guardian-area-probe.log`. This failure remains visible rather than
letting the earlier representative fixes imply that all area talents now work.
