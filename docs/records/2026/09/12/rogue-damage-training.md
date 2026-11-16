# Rogue direct-damage training —1.1 development

Status: reproduced and repaired locally, not deployed or native-accepted.
Built separately from the frozen four-role8f2c82a4 run, on the accepted
Teleport QA portac38aa09. No live or test character was changed by this work.

The offline Rogue paths did not consume their named damage Masteries or generic
ROG_38 skill damage, although ordinary server casts do. Phantom Volley also read
current Dexterity during delayed shot creation instead of keeping paid cast
damage. Odd Dexterity retained fractional Piercing Throw damage, unlike Go's
integer Dexterity term. Thirty of36 paired offline cases failed; six untrained
controls passed. Log `/tmp/eidolon-1-1-rogue-damage-red-20260912.log`(4.684s).

The six-profile contract is checked against actual paid server casts, direct HP
loss or spawned projectiles, and matching real offline casts/first projectile
collisions: Piercing Throw, Backstab, Death Spiral, Fan of Knives, Blade Storm
and Phantom Volley. Rank0/1/5 compose additively with generic rank0/5. Initial
server contract PASS5.300s without changing server runtime; focused race also
PASS13.650s. Added one actual behind-target server cast for positional rounding.

Client metadata preserves all IDs/ranks and names. Each direct consumer resolves
the named Mastery and generic bonus once at the existing damage boundary;
Volley captures its damage before scheduling any shot. Legacy padded/unpadded
IDs are clamped and not double-counted. Other classes, utility skills and
authoritative actors do not receive this offline multiplier. Existing wound
training stays separate; this is not a rewrite of every Rogue rune or talent.

A trained odd-weapon positional Backstab exposed another rounding difference:
431.5HP lost versus the server's431 after armor. RED1failed/14passed3.863s;
the client now truncates the positional bonus before armor and criticals, as
the server does. Log `/tmp/eidolon-1-1-rogue-behind-red-20260912.log`.

Final focused client PASS12suites/210tests6.67s, including legacy rank guards,
delayed-shot snapshots, actual paid hits, trained armor/critical composition,
receiving wounds, status inheritance and existing movement/range cases. Lint
and diff whitespace PASS. Logs
`/tmp/eidolon-1-1-rogue-damage-{final,final-lint,server-final}-20260912.log`.
Final server race PASS12.074s covers the37 new contract/positional cases and
existing Backstab critical/Unstoppable armor consumers. No server gameplay
changes or release bump.

Remaining: full integrated regression and appropriate native/earned training
checks, broad1.1 dungeon/party, progression, balancing and reconnect acceptance.
This does not make the failed native party run a pass, change its online damage,
or complete the full160-talent requirement. Bundle into1.1.0, not another1.0.x.
