# Honest combat-card information

Separate prototype based on primarybd8a347, excluded from recovery58.
The old card invented spell damage using class multipliers of basic attack
power (Fireball1.5×), unrelated to authoritative spell formulas. It also showed
zero damage for Teleport but arbitrary positive damage for other utility casts.

The card now labels the replicated character stat as **Attack power**, with no
claim that it is the final hit on this target. The spell row shows its mana cost
using the same configured ability/talent/equipment calculation as the real local
cast check. That calculation is extracted once and shared, with unchanged cost
rules. Unknown costs use a dash; genuinely free abilities show0MP. Target level,
distance, range status, targeting and actual server damage remain unchanged.
Both engine and UI caches include power/cost, so discount changes refresh without
retargeting. The fallback no longer fabricates spell damage either.

RED:3failures in2suites, `/tmp/eidolon-combat-preview-before.log`.
Focused GREEN26cases/4suites1.971s plus lint;
`/tmp/eidolon-combat-preview-final-{focused,lint}.log`.
Tests cover normal/overridden skill, talent+equipment rounding, zero/unknown cost,
UI+engine refresh and absence of invented hit estimates.
`combat-action-preview.spec.js` prepares real controller/UI/CSS desktop and
phone-card fixtures; it is presentation evidence, not a server-cast playthrough.
Browser93717 PASSED2/6.6s on fdcccb2, log
`/tmp/eidolon-combat-preview-browser.log`, archive
`/tmp/eidolon-combat-preview-proof-nHkrnp`. Desktop and phone screenshots viewed:
desktop explicitly shows Attack power5 / Fireball27MP, phone retains its compact
level/status/clear-target card. Neither claims spell hit damage. Fullclient
validation and integration are still pending; no production change/acceptance.
