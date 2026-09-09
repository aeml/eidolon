# Earned investigation reading after combat

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
