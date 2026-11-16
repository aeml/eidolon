# Resource HUD — zero means empty

Observed during the low-regeneration campaign review: `updatePlayerStats` used
`player.stats.mana || 100`. Spending the final mana therefore displayed `100`
instead of `0`, despite the unchanged authoritative resource value. This can
look like a sudden refill and misrepresent whether another spell is affordable.

The regression reproduced `100 / 160` instead of `0 / 160`. The focused initial
run (69063) failed eight new boundary cases; seventeen existing/fractional cases
passed. This is a confirmed display bug, not evidence of a server regeneration
or mana-cost bug.

Health and mana now use one presentation-only calculation. Zero remains zero;
non-finite/missing values and unusable caps show an empty bar; displayed amounts
and widths are bounded to valid resource capacity. Health still rounds upward,
mana downward. Input stats are never changed. Existing HUD diffing and later
normal recovery remain functional. Passive regeneration stays 0.01 per stat.

24585 passes all 42 focused HUD, runtime-diffing and passive-regeneration tests
in 2.540 seconds, full lint and diff checks. Full65671 passed225suites/3302tests
in108.318seconds on bfde53b. Version55 adds its own "empty means empty" notes,
keeps54 and all prior history, and aligns login/package/backend/deploy defaults.
22993 passes260version/HUD/regen tests in2.331s plus lint/bash/diff.91989 server
root tests pass1.734s after the version update.

89061 rendered presentation fixtures pass3cases/7.7s at1280x720,390x844 and
844x390. Zero mana has visibly zero fill and text0/160; a later1mana snapshot
updates that same HUD. This is a component presentation fixture, not an earned
cast or physical-phone session. Desktop and portrait captures were inspected;
all three are archived at `/tmp/eidolon-resource-hud-evidence-ZPk14d/`.
The rendered route is retained in the anonymous CI step through its own npm
command. Final55297 packaging checks pass229version/history/default tests in
1.311s, full lint and diff. The55 candidate is locally verified, not published.

This isolated candidate is based on queued 54, not final
47/cadence; it is not deployed and must inherit final earlier releases in order.

Separate observed issue, not fixed here: the target-intent Fireball preview uses
an arbitrary 1.5 × basic damage (`AbilityController.buildSoftDamagePreview`),
showing about 5 when the level-five server spell's unmodified damage is 48.
Other skill previews use similar placeholder multipliers. Correct those against
actual ability formulas/modifiers, rather than claiming these approximate values
are trustworthy or bundling an unverified combat-formula change into this HUD fix.
