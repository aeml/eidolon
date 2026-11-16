# Juggernaut training and elevated shockwave presentation

Part of the 1.1.0 combat/talent foundation, not a separate 1.0.x release.
This does not close the dungeon, native gameplay or full-roadmap gates.

## Corrected behavior

Juggernaut Charge retains its existing self-centered shockwave behavior, 30 mana,
20-second base cooldown and 60% slow with five-second base duration. This change
does not invent a second dash or alter the class's existing ability sequence.

- Named damage training FTR_17 now applies its 4% per rank, alongside generic
  damage training, to the authoritative Damage + Strength hit budget.
- Named area training FTR_18 now applies its 2% per rank, alongside generic
  area training. The base 10-unit radius reaches 13.5 at both area caps.
- Cast-time normalization uses a temporary entity, preserving the saved map;
  ranks are bounded and foreign-class talents do not contribute.
- The server publishes the actual self-centered origin, radius and full-circle
  arc. Local prediction and rank-private observers use that public footprint;
  accepting an unchanged footprint does not restart its animation.
- Offline paid casts use the same damage and planar, body-padded radius, with
  wall, hostile, active/living, instance and duplicate-target checks. Online
  damage is never applied by the offline handler. Critical and CC immunity
  remain at their ordinary hit/status boundaries.
- The redundant legacy wave is removed. Remote self-centered effects use the
  caster's floor elevation with the accepted event's X/Z, instead of drawing
  at world Y=0 in raised realms and dungeons.

## Evidence and limits

Initial paid server tests reproduced missing training and missing accepted
geometry; initial offline tests failed 11 cases. Adding actual mesh elevation
checks reproduced two further failures (High and Low remote roots at Y=0
instead of Y=40). These are behavior failures, not source-text assertions.

Expanded client checks pass: four suites, 179 tests, 5.347 seconds, including
actual attached High/Low circle boundaries, every enrolled self-centered remote
ability's raised-floor origin, and stale-footprint replacement without replay.
Server focused race checks pass in 39.059 seconds, covering rank0/1/5 with
generic0/5, paid casts, edge/exterior targets, wall/doorway admission, threat,
one damage receipt, critical and CC immunity. Real normal purchases cover both
named talents through five one-point upgrades, rejected sixth purchases, and
malformed-rank caps without saved-map mutation. Ability payload roundtrips pass
with race checking in 1.085 seconds. Full lint and whitespace checks pass.

Logs are in `/tmp/eidolon-juggernaut-{client-expanded,server-final,wire-final,lint}-20260912.log`.
Full local client and hosted CI acceptance are recorded in the execution ledger
when terminal; this document does not anticipate their results. Native phone
purchases, real remote-party combat and dungeon hit/clear acceptance remain
open, as does deployment of the complete 1.1.0 milestone.
