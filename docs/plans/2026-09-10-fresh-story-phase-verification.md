# Fresh Earth campaign — bounded phase verification

Unversioned QA-only change; no game rules, rewards, story content, character
state, movement limits or production deployment changes. Full campaign balance
and readiness remain unproved. Release60 continues separately on62dc2d1.

## Why the observation budget changed

Actual fresh-story22725 on a285fbc completed Watch40, Seeds8, Imp60 and all three
scar investigations, then hit the fixed one-hour session deadline at Orc4/50.
The retained report proves this, including the original3600000ms timeout inside
the final984ms landing poll, not a separately exhausted8s landing watchdog.
Archive `/tmp/eidolon-fresh-orc-departure-proof-AlfWPN`; log
`/tmp/eidolon-fresh-hunt-rest-replay.log`. Imp alone took2169s including manual
claim/save,26 ordinary recovery stops and earned training; Watch took746s. A
single one-hour limit cannot observe the entire expanded150-kill campaign at
that pace. It does not prove an impossible Orc encounter or level30 shortfall.

## Explicit limits, not a renewable timeout

Only the validated story-only readiness route receives the following named
Playwright steps. One attempt retains one ordinary earned character, existing
chapter order and fresh retry identity. Each step has its own absolute timeout;
the enclosing test has one fixed185-minute sum, set once at the start.

| Phase | Maximum QA observation time |
|---|---:|
| Opening and diary, including normal rewards/save | 10 minutes |
| Watch40, including town recovery/training/claim/save | 30 minutes |
| Seeds8, including natural drops and manual turn-in | 20 minutes |
| Imp60, including recovery/training/claim/save | 45 minutes |
| All three scar investigations and manual turn-in | 10 minutes |
| Orc50, including recovery/training/claim/save | 60 minutes |
| Dungeon offer, saved gear/progress, guide and raid lock | 5 minutes |
| Strict story-only level30 readiness | 5 minutes |

These are diagnostic caps, NOT target session lengths or evidence that current
quest pacing is enjoyable. Imp's45-minute cap accommodates the observed36-minute
route; Orc's60-minute cap allows a full authored hunt without giving an individual
stalled encounter more time. Class comparisons and player-facing balance still
require actual results, not merely completion inside these observation limits.
The smaller opening/first-hunt/legacy comparison diagnostics keep their existing
timeouts. There is no new environment knob for unlimited or escalating retries.

Every phase emits start and pass/failure receipts with elapsed time. The runner
rejects skipped, duplicate or simultaneous phases and cannot continue a failed
phase as success. All eight phases, including final readiness, must complete.
Phase timing wraps existing actions; it does not repeat or manufacture progress.

## Preserved acceptance requirements

- All150 hunt kills, eight actual personal Seeds and three scar interactions.
- Same120s encounter deadlines, ordinary combat, two-death bounds, recovery
  rules,4s jump displacement/8s landing checks, input and camera assertions.
- No prepared levels, grants, free gear, automatic claims or daily substitution.
- Earned merchant/stash receipts, manual rewards and exact save checks.
- Original level30 dungeon entry and uncleared/sealed raid prerequisites.
- Console/network failures and terminal artifact sanitation/cleanup.

## Verification

Focused72393 PASS87tests/6suites1.562s, lint and actual Playwright discovery of
the existing gameplay spec. Tests cover fixed limits, ordered execution/results,
failure preservation, duplicate/concurrent rejection, incomplete final readiness,
source wiring and prior recovery/inventory/readiness contracts. Reviewed the
installed Playwright types: `test.step` supports the per-step timeout option.
Logs `/tmp/eidolon-story-phase-{focused,lint,discovery}.log`.

Full88926 PASS287suites/4047tests138.029s plus lint on cleanf2ca8e5. This includes
the prior jump-error cause preservation and its tests. Logs
`/tmp/eidolon-story-phase-full-{client,lint}.log`.

Actual fresh84056 on ea6cdbb passed the opening85495ms, Watch563138ms,
Seeds152103ms, Imps1733807ms and scars32962ms phases. The Orc phase failed at
37/50 on the merchant helper's15-second settled predicate, not its phase cap.
No final handoff/readiness acceptance. Archive
`/tmp/eidolon-fresh-orc-phase-proof-A6Wgqj`; log
`/tmp/eidolon-fresh-phases-replay.log`; actual-credential scan/cleanup passed.

See [merchant approach verification](2026-09-10-merchant-approach-verification.md)
for the bounded diagnostic, independently confirmed offset timing race, correction
and native checks. Subsequent13998 on clean/frozencb348ef PASSED all eight
phases in52.7m, retries0, ending atlevel31 with no daily quests accepted and
level30dungeon entry enabled. [Full earned proof](2026-09-10-earned-earth-readiness-proof.md)
records every phase, reward, inventory visit, archive, cleanup and acceptance
boundary. The previous failures remain failures. Other classes, groups, actual
dungeon clears, later realms/raids, physical phones, economy tuning and the full
remaining1.1–1.10 roadmap are not closed by this one fresh Wizard result.
