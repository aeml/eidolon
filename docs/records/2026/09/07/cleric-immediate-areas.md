# Blessings and Heaven's Trumpet: trained immediate areas

Implemented in the local Alpha 1.0.37 candidate. Its full client/server and
Cleric-area gameplay checks pass in the release record; it is not published.

Both Blessings now resolve Battlefield Ministry before querying and applying their
effect: 10m / 10.3m / 11.5m at ranks 0/1/5. Heaven's Trumpet similarly uses
12m / 12.36m / 13.8m. All three publish the accepted caster position and full-circle
radius/arc. Client prediction and remote presentation share that footprint; a late
cast event uses the accepted center, not the observer's newer actor position.
Attached buffs are recipient-sized decorations, not persistent area auras.

Server target rules, body padding, durations and actual derived-stat buffs remain
unchanged. Friendly players/NPCs receive Blessings; enemy and opposing PvP players
do not. Trumpet retains damage, weakness, CC immunity and dungeon-wall protection.
Dead and other-instance actors remain excluded.

Offline casting retains the shared cooldown and canonical presentation instead
of overriding them or adding a duplicate ring. Blessings include self if omitted
from chunks, use trained planar/body-padded reach and filter PvP/hostile targets.
Resolve now has the server's 20-second base duration. Trumpet's previously missing
base damage is applied before its weakness debuff, with body/cover/allegiance and
stun-immunity checks.

## Retained limitations

Offline Resolve still uses its older 25% damage-reduction modifier rather than the
server's +20% defense; offline Zeal's older attack-rate factor does not establish
server-equivalent +20% movement/+30% attack rate. Their current status-detail copy
also needs reconciliation against the authoritative effects. This patch does not
claim those systems are aligned. Trumpet's offline damage mastery/derived-damage
pipeline and Cleric duration talents remain part of the open consumer audit.

## Evidence

- The initial three-skill overlay fails in 0.494s. Review found its Trumpet caster
  had zero Wisdom, so its damage assertion alone was insufficient proof of an
  area defect. The caster now has 10 Wisdom. The corrected probes pass against
  the repaired runtime in **0.520s**,
  `/tmp/eidolon-cleric-immediate-area-after-probes.log`.
- The shared nine-case JSON drives normal server and client tests. Server cases
  use actual dispatch, resource payment, ordinary/4x bodies immediately inside and
  outside each boundary, accepted geometry and real defense/haste/damage effects.
  Separate tests cover allegiance, NPCs, dead/other-instance actors, PvP opponents,
  CC immunity and closed-wall/open-doorway Trumpet behavior.
- Initial expanded server checks fail in **7.597s**; after runtime changes the
  first follow-up still fails in **7.736s**. Those fixtures had zero caster Wisdom
  and compared synthetic defense/attack defaults against recalculated stats.
  Fixtures now initialize real base/equipment-derived stats and nonzero Wisdom;
  no game balance was changed to satisfy them. Focused race checks then pass in
  **7.003s**, `/tmp/eidolon-cleric-areas-focused-server-corrected.log`.
- To validate the corrected regressions, a temporary Go build overlay substitutes
  only the old `3458918` Cleric handler while keeping the corrected tests. It fails
  in **7.750s** on missing accepted geometry and trained targets outside the old
  footprint (`/tmp/eidolon-cleric-areas-corrected-fixtures-old-runtime.log`). The
  normal workspace and running browser source are not modified by that overlay.
- Initial client checks fail **40/41 in 2.439s**. The first runtime follow-up fails
  eight checks because the fixture retained a level-one Cleric's 40 mana for a
  50-mana Trumpet. Tests now supply sufficient mana while still asserting normal
  cost/cooldown. Final focused client checks pass **92 tests / 4 suites in 2.060s**,
  `/tmp/eidolon-cleric-areas-focused-client-corrected.log`, including Guardian,
  holy-ground and cleansing regressions. Mesh tests inspect actual High/Low local
  and rank-private remote boundaries, not only numeric radius helpers.

Final versioned full-suite, gameplay and publication results belong in the
Alpha 1.0.37 release record. The entire 1.1–1.10 roadmap remains open.
