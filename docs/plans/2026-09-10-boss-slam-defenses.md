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

Pending: full regression, native four-player acceptance, successor integration,
versioned patch notes and deployment. This is not live or a dungeon-clear receipt.

Proposed patch note: Boss ground slams now respect defensive shields,
invulnerability and damage-reduction buffs. Shield retaliation retains normal
party kill credit.
