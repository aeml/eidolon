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
