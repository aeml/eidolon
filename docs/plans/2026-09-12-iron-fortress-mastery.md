# Iron Fortress Mastery — useful protective uptime for 1.1

Inspection found FTR_07 advertised and supplied +4% skill damage per rank, but
Iron Fortress's actual cast has no direct damage consumer. Its optional Thorns
reflection also uses a fixed 20% of applied HP damage, without the Mastery.
The ordinary buff therefore gained no benefit from this purchased talent.

Selected replacement benefit: +4% Iron Fortress duration per rank, maximum20%.
This is an explicit utility-talent correction, like Time Warp Mastery, not a
claim that the previous definition already promised duration. Existing FTR_07,
five-rank cap, point costs and saved investments remain. Untrained duration,
defense/speed modifiers, reflection strength and mana/cooldown costs are unchanged.
Rank5 gives36s, or54s with Extended, before generic duration training. Generic
FTR_30/FTR_37 duration adds to Mastery after the rune's base duration is selected.

The new contract was exercised through real paid server/offline casts, all four
rune variants, ranks0/1/5 and generic training0/5. Before the correction the
16 trained server casts retained the old durations while baseline controls
passed; the separate definition assertion also failed (game1.067s). Client
RED17failed/9passed1.089s. Logs
`/tmp/eidolon-iron-fortress-mastery-{server,client}-red-20260912.log`.

Server metadata now supplies skill-scoped duration, consumed by the existing
effect-duration resolver. Client metadata/copy and the actual offline consumer
match. No broader Fighter buff redesign, rune reset, global damage multiplier,
or release65 gameplay change. Other utility Masteries remain separate audit work.

Final focused server race PASS11.683s includes paid duration, snapshots, expiry,
unchanged defense/speed/reflection/rune flags, unrelated skill isolation,
ordinary five-rank purchases and rejected sixth purchase, existing generic
Fighter duration/party recipients and the all160 rank-clamping contract.
Client PASS6suites/376tests3.492s includes metadata, malformed/max rank guards,
online authority, exact paid mana/cooldown, stunned expiry, generic duration,
Shield Slam, Charge/Shattering Charge and all52-skill cooldown consumers.
Changed-file lint and diff whitespace pass. Logs
`/tmp/eidolon-iron-fortress-mastery-{server-final,client-final,lint}-20260912.log`.

Built separately on9bd27ada at
`/tmp/eidolon-1-1-iron-fortress-mastery-20260912`. Full integrated regression,
native purchase/save/readable duration/expiry acceptance and the wider four-role
dungeon/earned progression gates remain required. Include this player-facing
change in 1.1.0 patch notes when that milestone is actually released; not1.0.66.
