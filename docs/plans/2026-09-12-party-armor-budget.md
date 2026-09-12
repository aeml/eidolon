# Party armor and Fortress budget audit

Native party19674 ended with Fighter/Rogue deaths and first Warden2160HP.
Its regular Warden hits were183/184 respectively, with late mana-blocked healing.
The new audit uses factory-created eight-slot Common armor at30/70, canonical
level stats and the actual server post-wind-up damage path. It is an armor-only
fixture, not the14-slot party build or a whole encounter simulation. No crit,
dodge, resource sustainability or dungeon victory is inferred.

Measured current values:

| Level | Armor set | Defense | Warden raw | Actual hit |
| --- | --- | ---: | ---: | ---: |
| 30 | Plate Fighter | 10 | 188 | 183 |
| 30 | Plate + paid Fortress | 15 | 188 | 181 |
| 30 | Leather Rogue | 8 | 188 | 184 |
| 30 | Cloth Wizard | 8 | 188 | 184 |
| 70 | Plate Fighter | 21 | 488 | 478 |
| 70 | Plate + paid Fortress | 31 | 488 | 473 |
| 70 | Leather Rogue | 11 | 488 | 483 |
| 70 | Cloth Wizard | 8 | 488 | 484 |

The70 Warden is an explicit level-scaling comparison, not the70 dungeon's actual
entry boss. Item flat stats are squished25:1, then armor is subtracted flat;
this boss ignores half. Many30 armor pieces round to the same one-point minimum.
Fortress adds50% armor, so its40mana payment saves only two damage per30 hit.
Its UI already says damage reduction; offline instead grants1% per Strength,
capped75%, and lacks the server armor/speed behavior. This is a confirmed
balance and parity problem, not evidence to restore passive regeneration.

First audit fixture passed an empty impact instance and correctly hit nothing;
fixed the fixture to supply the actual same instance, without bypassing admission.
Corrected6cases pass under race2.403s. Logs
`/tmp/eidolon-party-armor-budget-audit{,-corrected}-20260912.log`.

## Next implementation

Give Fortress20% incoming reduction on client/server in addition to its existing
50% armor and20% movement penalty; preserve40mana/60s base cooldown/30s duration,
duration-only Mastery, runes, finite expiry, receiving shield order and saved IDs.
Restore offline armor/speed parity and replace the divergent Strength reduction.
Test real paid impacts with current equipment, expired/malformed timers, shields,
other reductions, rune/Mastery duration, equipment changes and remote ownership.
Then run native paid impacts and the actual four-player dungeon; do not infer
balance closure from a unit pass or assume this alone fixes tank threat/positioning.
The item quantization issue remains required economy work: multiplying already
rounded saved stats cannot restore lost roll/material distinctions. Do not
silently re-roll or inflate saved equipment while changing this class skill.
