# Alpha 1.30.0 — failed CI and validation repair

CI 36487906612 for c6b20797 failed before deployment. Alpha 1.29 remains the
last accepted live release. This follow-up changes validation only, retains
1.30.0 and its cumulative player-facing notes, and excludes all 1.31+ work.

## Causes and corrections

- Jest: one of 7,715 tests expected the retired “portal is open” wording after
  the Nexus completion receipt. The greeting correctly distinguishes private
  court access from the shared Fourfold Portal. The fixture now names earned
  court access and still checks that optional lore cannot rewind progression.
- Browser shard 1: four phone layouts selected every Journal summary/details
  element. The new independent journey recap made that selector ambiguous.
  Select the Recovered Lore archive specifically; touch, open-state retention,
  scrolling, tracking and viewport assertions are unchanged.
- Browser shard 2: eight High/Low Eidolon screenshots shared one 120-second
  deadline; the test and retry timed out during capture. Each phase/quality now
  has a fresh normal-budget case, preserving geometry/count, screenshot,
  effect cleanup and browser-error checks. No skipped case, extended global
  timeout, changed graphics preset or runtime-effect modification.

## Local evidence

The corrected conversation suite passed 26 checks in 1.352s. An initial command
also named a nonexistent ChronicleRecap.test.js and failed that invocation;
the corrected explicit path is the passing result, not the failed command.
All 12 targeted browser cases passed in 1.0 minute with no retries, including
eight cue variants and four phone layouts. Evidence is in
`/tmp/eidolon-130-ci-repair-browser`. Scoped lint and whitespace passed.

Repair prepared in an isolated worktree at the failed 1.30 SHA, so pending
1.31–1.35 source changes cannot enter this publication. Fresh mandatory CI and
main-agent exact public IPv4 release verification are still required. This
record does not declare 1.30 deployed or approve human campaign pacing.
