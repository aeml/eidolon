# Equipment health normalization — 1.1.0 candidate

Ordinary equipment removal could retain HP above the new maximum. Passive
regeneration returns already-full resources unchanged, so it did not repair
this state. The shared player stat recalculation now caps only excess HP after
all talent, equipment-set and Well Rested multipliers. It does not refill missing
HP/MP, change death state or change NPC health. Existing mana normalization stays
in place. Talent reset already had its own explicit HP cap; this is not a claim
that reset previously provided an exploit.

Actual PerformEquip/PerformUnequip/GetEntityCopy/re-equip tests cover all four
classes, rested/unrested and full/depleted/dead states (24 cases). Before the fix,
eight full-health cases retained excess HP; a separate final-bonus case failed
too. Repeated recalculation with unchanged talent/rested bonuses must not lose
valid HP, and re-equipping must never refill a deficit.

The broad focused race run failed two older shield cases: their synthetic
defender started at500HP while derived maximum was495. Charge/Gravity debuffs
recalculate stats, exposing that invalid precondition. The shield test now
derives its defender from base intelligence100, initializes actual maxima before
the duel, and retains every paid-cast, shield-absorption and no-HP-loss assertion.
The corrected targeted race run passes4.996s, including all hostile shield casts
and the new equipment cases. Full server race regression is pending; no native,
integration or production acceptance is claimed yet.

Logs: `/tmp/eidolon-health-cap-red-20260912.log`,
`/tmp/eidolon-health-cap-green-20260912.log` (retained initial shield failures),
`/tmp/eidolon-health-cap-fixture-green-20260912.log`, and
`/tmp/eidolon-health-cap-full-race-20260912.log`.

Verification update: local full race handle90222 terminated with exit143 before
the game package reported a result. Root27.180s, loadtest1.034s and database1.079s
passed; this is NOT a full server pass and the signal source is not established.
The process was confirmed absent. Independent hosted CI34716297331 on2162b442
is running (client passed, server pending at this entry); use its actual terminal
result rather than restarting or calling the partial local log green.

## Draft 1.1.0 patch note

- Removing health-boosting equipment now immediately limits current health to
  the new maximum. Changing equipment does not refill health or mana.
