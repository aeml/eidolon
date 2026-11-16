# Purifying Wave Mastery — local, unversioned work

Part of the 1.1 full-tree talent-consumer gate, based on candidate98320775.
This isolated branch does not change the running four-player dungeon source,
publish a release or close the entire talent audit.

## Intended benefit and compatibility

`CLR_07` previously supplied4% skill healing per rank, but Purifying Wave has no
healing consumer: it cleanses. Client copy vaguely promised increased "power."
The repair makes the investment increase cleansing radius by4% per rank,
20% at the existing five-rank maximum. The ID, purchased ranks, point budget,
base8-unit radius,30mana cost and12-second cooldown remain unchanged. No healing
pulse is added. Existing global Ministry area bonuses compose additively:
five Mastery ranks give9.6radius; five Mastery plus five Ministry give10.8.

The server's existing effective-area handler now consumes a skill-scoped area
bonus. The client area helper also filters skill-scoped bonuses; other Cleric
areas, Beacon and Mass Revival do not inherit this mastery. Predicted and
accepted remote rings use the same radius, including both graphics qualities.

## Evidence and remaining gates

- Shared Go/client boundary fixtures retain baseline, Ministry and technique
  cases and add one/five Mastery ranks plus additive composition. Original
  runtime fails the actual accepted-cast footprint expectations:34068 RED,
 8.063s. Client19129 RED:18failed/25passed,2.276s. Logs
 `/tmp/eidolon-purifying-mastery-{server,client}-red.log`.
- Initial corrected actual-cast Go race75631 PASS9.893s. Client62294 PASS138tests
  across6suites4.194s after correcting a new test that used a numeric matcher
  on Divine Intervention's intentionally absent circular footprint. Includes
  actual offline cleanse, unchanged target HP, body-padded edges, effects,
  spell isolation, rank clamps and copy. Log
 `/tmp/eidolon-purifying-mastery-client-expanded.log`.
- Ordinary talent-purchase coverage adds all six investment levels against the
  same ally at10units, unchanged cost/cooldown, point consumption and legacy ID
  normalization. Its first expanded run24430 failed only the rank-zero fixture:
  the manually constructed caster had not recalculated its derived stats,
  whereas each purchased rank had. All cases now start from recalculated stats;
  final6143 race check PASS10.302s covers all Purifying Wave boundary, relationship,
  ordinary purchase and legacy/scoping cases. Log
 `/tmp/eidolon-purifying-mastery-server-final.log`. This does not change production
  player stats. The earlier expanded batch is still a failed batch, not a full
  green regression run.
- Focused lint exited0; updated native route discovers exactly one case. Native
  route now retains Ministry-only baseline/purchase checks and additionally buys
  five Mastery ranks through the phone talent UI, casts with both investments,
  relogs and checks saved ranks plus the authoritative high-quality ring in
  landscape. Existing preparation commands/resources are explicitly a fixture,
  not earned progression. This new native route has NOT run yet.

Still required: full current-source client/server
regression, native ordinary purchases/saved-build/render acceptance, integration
review, per-version patch notes and synchronized version metadata, remote CI and
live deployment verification. Only one heavy local gate at a time; wait for the
existing four-player run's authoritative terminal result before starting another.

## Unreleased patch-note draft

- Purifying Wave Mastery now increases cleansing radius by4% per rank (20% at
  five ranks), with a matching visible ring and clearer talent description.
  Existing talent ranks are preserved. It remains a cleanse, not a healing spell.

Transfer this note into the actual release's patch notes only after integration
and acceptance. No version has been assigned to this isolated work.
