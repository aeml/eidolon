# Boss slam defensive-ability correction

The failed four-player run42295 prompted inspection of the ordinary enemy AI's
telegraphed slam. Its delayed impact directly subtracted HP, bypassing the
defenses used by basic hits. This is a real ability-consistency defect, not a
demonstrated explanation of that party wipe: its Wizard never cast Arcane Shield.

The real two-second AI wind-up regression76331 failed before the correction:
active invulnerability, both Sanctuary variants, Guardian Angel reduction and
all three tested paid shield variants took the unmitigated200damage. Ordinary
damage and half-armor controls behaved as expected. Log:
`/tmp/eidolon-boss-slam-defense-red.log`.

Basic hits and slams now share the existing impact-defense calculation, including
shield absorption and rune retaliation. Shield depletion is committed before
unlocking for an explosion, so an older hit cannot clear a concurrent new shield.
Slams retain their original damage, half-armor rule, radius, two-second warning
and cooldown. They retain impact-time presence/safe-zone checks. Source state is
read under its lock; retaliation and lethal damage retain the correct world-lock
mode for party-credit processing. No gear, regeneration or encounter tuning.

Focused66582 passed9.426s. Expanded race84455 passed16.956s, including real AI
slams, paid shields, invulnerability preserving shield capacity, expired
invulnerability, stronger-of-two Sanctuary reduction, shield-rune lethal
retaliation sharing exact unclaimed rewards with a distant downed teammate,
ordinary shield training/runes, safe-zone entry during wind-up, Dark King damage
paths, impact reach and reflection instance identity. Logs:
`/tmp/eidolon-boss-slam-defense-green.log` and
`/tmp/eidolon-boss-slam-defense-regression.log`.

Full primary Go race68058 subsequently passed on server treed3a54d4a: root29.012s,
game385.718s, other tested packages passed/cached, no race warning. Log
`/tmp/eidolon-boss-slam-full-server.log`. Terminal exit0 recovered September10
22:22UTC. Subsequent primary34cf39a4 changes only the party test/controller/docs.

Pending: native four-player acceptance, full successor regression,
versioned patch notes and deployment. This is not live or a dungeon-clear receipt.

Proposed patch note: Boss ground slams now respect defensive shields,
invulnerability and damage-reduction buffs. Shield retaliation retains normal
party kill credit.

## Successor integration

The successor also imports this correction from primaryd3a54d4a. The two
extracted ordinary-hit blocks conflicted only around the primary's separate
Dark King phase damage cap. This release retains its existing uncapped explosion
and reflection damage, as before; it does not silently import that later scope.
All shield, invulnerability, Sanctuary and world-lock corrections are retained.
The primary evidence above remains attributed to that source. Fresh successor
focused race88780 passed the actual slam/shield suite plus ordinary shield,
safe-zone, reflection, party eligibility, snapshots, all-class and individual
turn-in regressions. Log`/tmp/eidolon-next-slam-defense-focused.log`.
The successor's earlier full server pass predates this runtime change; a new
full server regression is required, along with final native/version/live gates.
