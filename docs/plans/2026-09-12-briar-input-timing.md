# Briar Matron — unresolved four-role failure

Native77501 failed after29.0m on208b0aa3, seed5588237360194778703. Rootbound
Warden and four town recovery/same-run checks passed, but Rogue died at Briar
Matron. The run is not a full dungeon/shared-credit/manual-turn-in acceptance.
Retained artifact `/tmp/eidolon-four-role-briar-failure-Z5rFVi`; log
`/tmp/eidolon-four-role-aura-follow-20260912.log`. Credential scanner0 and
disposable party120146 services removed before any new local full suite.

The final escape records took2.0–3.75s, with completion after the warning had
expired. Earlier Warden escapes were roughly0.6s. Both bosses use the actual2s
generic slam warning. These observations do not establish whether projection,
input delivery, render load, movement or strategy is responsible. The preserved
healer decisions show direct healing occurred; at Rogue death the Cleric still
had413MP and had healed1683 during Briar, but was18.884units away.

Added optional timing to the existing real ground-input helper: observer setup,
origin read, clear-path query, projection, pointer movement, hover settlement,
ground ray, click/release, click observation and movement observation. Invalid
rays and failed movement remain failures. The four-role route retains those
phases with planning time, game frame counts and renderer resource counts in
its bounded escape history. No timing record generates input or game state.
Existing Shift-click, projection/collision rules, deadlines and survival checks
are unchanged. Three focused client suites/36tests PASS1.113s plus changed-file
lint; logs `/tmp/eidolon-party-input-timing-{tests,lint}-20260912.log`.

This is diagnostic instrumentation, not a gameplay or balance fix and not a
passing native retry. Reproduce only when it will not compete with release QA;
do not grant resources, weaken survival assertions or skip the eventual full run.
