# Four-role partial retreat — movement failure retained

Parent61ffba19 preserves failed Fortress party seed-7217624267168898228.
Merged Fortress8864133e (including hazard/reflection correction) before changing
the driver. No boss stats, character resources, threat, damage or cooldowns change.

The previous failed Rogue position reproduces a planning dead end when the actual
120x120 Warden room bounds are included. Rogue(20015.2324,19698.0950), Warden
(20022.5586,19696.6035), healer(20021.0347,19701.1848), room center
(20038.5828,19640). The driver's ideal16.5–18.5-unit firing rings cannot be
reached inside the room and healer's13.5-unit comfort boundary. Without room
bounds it returns an out-of-room move; with the real bounds it returns null,
leaving the Rogue within the observed ordinary melee reach.

When an ideal ring is unavailable, the input planner now considers bounded
3/6/9/12-unit steps, requiring at least one unit of increased enemy separation,
continued healing reach and full path/body/floor/encounter validation. Prefer
the largest safe separation, then shorter travel. Reobserve on the next serial
role step; a partial retreat is not counted as arrival at ideal firing range.
Existing well-spaced actors still hold position instead of continuously kiting.
Blocked paths, intercepted/failed real input, death and missing healer geometry
retain their existing failure/guard behavior.

The exact failed edge regression first failed (1failed/12passed). After the change,
five role/input/spacing suites66testsPASS1.434s, full lint and prepared assets pass.
Logs `/tmp/eidolon-party-partial-retreat-{red,tests,lint,assets}-20260912.log`.
This reproduces one driver limitation, not the complete cause of the encounter
failure or proof of a viable tank threat budget. Actual four-role replay, full
clear/individual credit/Water handoff and broader seed regression remain required.

## First replay result

Native66697 on7f8ea19b FAILED7.4m, actual seed-3283200004721647671,
generator2/attempt0/no fallback. Early trash and town recovery/re-entry passed;
Warden last6959/15000HP, all four alive: Fighter940HP/193MP, Cleric761/405,
Wizard855/16, Rogue855/120. The issued Rogue spacing click moved only0.18846
units rather than1 or actual near-destination arrival. Its planned1.74unit
step(.80839,1.54216) was projected correctly, canvas accepted the move, and
the final movement metrics recorded a blocked stop. This is not a death,
missing-input condition or passing clear. Cause needs failure-time body evidence.

Archive `/tmp/eidolon-party-partial-retreat-failure-wzR2p3`; log
`/tmp/eidolon-party-partial-retreat-native-20260912.log`; scan sanitized2 and
exactowned container/image/port cleanup passed. Exact source CI34708377197 is
SUCCESS; manual native/deploy were skipped and do not override this failure.

Diagnostic follow-up retains each attempted spacing plan, actor state and body
positions before/after even when movement throws. Previous records captured only
successful attempts. Thresholds,1500ms timeout, no-alternate-path setting and
fatal issued-input behavior are unchanged. A disconnected page cannot replace
the original movement error with a diagnostic error. Actual replay remains due.

## Diagnostic replay and ready-aura positioning

23513 onbfca8314 FAILED7.7m, seed4063816672232710614/gen2/attempt0/no fallback.
The route reached and fought the Warden; Fighter died with boss last2606HP.
At death the healer was12.5143units away with60mana,17HealingLight casts,
5GuardianEmbrace casts and3972boss ally healing. A real heal at Fighter132HP
raised him to313; repeated ordinary183hits while the direct heal cooled down
then killed him. Mana was still available; this is not a proven targeting or
resource-exhaustion failure. The earlier blocked movement did not reproduce.
Archive `/tmp/eidolon-party-spacing-diagnostic-failure-hy0s1A`; native log
`/tmp/eidolon-party-spacing-diagnostic-native-20260912.log`; scan0 and exactowned
container/image/ports clear before Blade Storm native began.

The trace also records an idle ready aura,102mana,2.8867s direct-heal cooldown,
Fighter493HP at13.7362units: the planner would approach only for an already
active aura, so this ready aura could never become useful from that position.
New test reproduced the missed planning opportunity (1failed/35passed). During
direct-heal cooldown only, the healer may now approach for an unlocked, ready,
affordable aura, reserving40+25mana. Existing ready-heal, warning, same-instance,
health, collision and active-aura checks remain. It does not grant healing or
change stats/armor/enemies/regen. Actual new positioning must still prove useful
and safe in combat; this is not the full explanation or encounter acceptance.
Two focused suites49testsPASS0.758s plus changed-file lint/diff. Before-body
diagnostics now include IDs/state as well as coordinates, matching after-bodies.
Logs `/tmp/eidolon-party-ready-aura-{red,tests,lint}-20260912.log`.

## Ready-aura replay — encounter still fails

Native89748 on c9ef1164 FAILED16.2minutes (route921.106seconds), actual seed
-5560940123775574701/gen2/attempt0/no fallback. Early trash, two four-player
town recoveries and reentries preserved seed/rooms/gold/inventory/quests.
The long layout required126ground steps and5room traversals before the Warden;
the elapsed time alone was not a stuck-job diagnosis. Rogue died with Warden
last3202/15000HP. Healer was10.77636units away with7mana,18HealingLight casts,
8GuardianEmbrace casts and4990boss ally healing. Fighter last855HP/20mana.
This does not establish encounter viability or close the tank/armor/resource
budget. Diagnose actual healing receipts, threat and intended attainable party
preparation before another driver change; retain requested .01outside regen.

Archive `/tmp/eidolon-party-ready-aura-failure-KiywKO`; log
`/tmp/eidolon-party-ready-aura-native-20260912.log`. Credential scan sanitized0;
owned containers/image/ports cleared before the QA-resource native started.
No full clear, individual completion credit or Water handoff has passed here.

### Damage and dodge timing audit

Do not treat every183/184physical receipt as an ordinary melee hit. The existing
boss slam uses the same damage kind and half-armor formula, a12.5-unit fixed
circle and2-second warning every10seconds. The retained final12damage samples
contain8warning-coincident Fighter hits; all4Cleric and bothWizard retained boss
hits coincide within150ms of a warning impact. Wizard distances9.79/10.22 and
Cleric12.66/13.23 are beyond ordinary7.5melee reach (positions are client-time
observations, not exact server impact positions). Rogue also takes ordinary
close-range hits outside warnings. A blanket ordinary-hit label was too strong.

The final recorded Fighter dodge spent836ms before its ground-ray check and
1468ms before click release; safe arrival was1334ms after predicted impact.
Rogue spent1094ms before its ray check and1567ms before click release, arriving
1992ms late. Wizard's last safe arrival was1536ms late. These arrivals are not
successful dodges; the separate early-escape counts correctly remain lower.
The four browsers already run role inputs concurrently. The general movement
helper still performs multiple serial browser observations and pointer settling
before issuing normal input. Investigate this measured input overhead before
using the failed party run to lower boss damage or increase healing. Retain real
input, collision/ray checks, fatal issued-input failures and authoritative damage
receipts. No enemy/player balance or timeouts changed during this audit.
