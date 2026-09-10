# Earned investigation reading after combat

## September10 — reading acknowledgement during resumed approach

Fresh story-only62038 on5a01ce8 FAILED1.2m. Opening/manual100Gold+100XP/reconnect
passed36seconds, level2,0deaths. Diary approach engaged one enemy; the later
failure image shows the exact Mara diary open and1/1server quest credit, still
requiring manual Ilyra completion. The driver had already entered another walk,
which moved0.748units before failing its1-unit displacement requirement beneath
the journal. Character healthy136/137HP,96/126MP,25emptybag slots; no daily quests.
This is not evidence of missing diary credit or a fresh balance result.

The initial journal-state check did not cover acknowledgements arriving during
the subsequent approach. Guard each resumed movement against that exact visible
open entry, recheck afterward, and recognize the reading if it appears during a
failed movement. Do not issue the next movement or prop click once it is open.
Report `already-open`, not successful travel or a new inspection. Unrelated,
hidden and collapsed entries cannot suppress movement errors. Retain survival,
exact title/open-state, total server credit, unclaimed reward and manual turn-in
checks. No runtime, quest, movement threshold, timeout or reward changes.

Focused21692 passed19tests/2suites0.825s+lint. New tests cover delayed opening
during both successful and failed movement, prevention of the next command,
continued fatal blocked movement without the exact reading, and route wiring.
Archive `/tmp/eidolon-fresh-diary-race-proof-U6i3rY`, wrapper sanitized2files,
supplemental0, inspected at-failure reading screenshot; exact disposable services
and18560/18561/41960ports absent. Log `/tmp/eidolon-fresh-story-0203.log` retained.
Full regression and another complete fresh story-only replay remain required.

## Prior reading and opening-credit work

The cf9f2cc story run38966 failed after first-diary approach combat with the
journal already open. Archive `/tmp/eidolon-story-diary-input-failure-gOwlye`
retains its report/context/log; there was no screenshot of this failure. An
ordinary click can reach the evidence prop when a foreground enemy dies, but
that exact interception was not recorded, so it remains a plausible cause.

The test driver now recognizes the exact visible/open discovery entry instead
of issuing another movement click under it. If that entry is not open, close
any visible journal with its normal button before deliberately approaching and
inspecting. Keep the actual evidence/title, total server quest credit, unclaimed
reward and explicit Ilyra turn-in assertions. Never inject discovery credit or
skip combat. Capture future reading/second-approach failures before teardown.

Focused83791 passed15tests/3suites0.59s and lint. Full87041 passed280suites3963tests
115.831s and lint; `/tmp/eidolon-diary-reading-full-{client,lint}.log`.
The exact/open, unrelated/closed/hidden, no-journal and propagated-failure branches
are covered. Actual corrected story/merchant/collection/readiness proof remains
pending. Server source and production release58 are unchanged.

Replay30264 on1ff8e2a FAILED2.5m before reaching the diary. Actual opening count
was already3/3, but credit arrived during target selection and the driver then
waited for count>3 until its120s watchdog. This is a distinct test completion race,
not evidence that the player's third quest kill failed. No fourth credit can be
awarded after the quest's cap. Archive `/tmp/eidolon-story-opening-credit-race-Dfdn0o`
retains report/context/log; scanner0 and exact owned containers/ports cleaned up.

Target selection now checks objective progress before and after ordinary target
acquisition. A ready objective returns to the existing manual-claim path instead
of starting another encounter; unfinished work snapshots the new count and still
requires earned progress within the unchanged watchdog. Invalid counts and input
failures propagate, with no quest credit/reward injection. Focused45762 passed
14tests/2suites0.711s and lint; `/tmp/eidolon-opening-credit-race-{focused,lint}.log`.
Full regression and actual earned replay remain due for this follow-up.

Full94963 on e530999 passed281suites3972tests137.488s and lint;
`/tmp/eidolon-opening-credit-race-full-{client,lint}.log`. Actual corrected browser
replay remains required; neither this race fix nor the diary fix has yet reached
the bag/merchant/whole-Earth readiness checks in a successful earned run.
