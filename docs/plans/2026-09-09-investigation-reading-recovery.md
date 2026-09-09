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
