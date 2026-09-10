# Current-candidate browser partition — unpublished

Based on socket successor298ecde0, including canonical62dc release ancestry.
This carries only the earlier CI partition prototype and its contracts, not the
old primary's unpublished story, crystal art, balance or server changes. No game
runtime, version, patch notes for shipped content or public workflow changed.

## Integration and coverage

The previous prototype targeted an older primary's separate crystal-art/journal
commands. Current release candidates instead have one required interface command.
The port initially failed closed on the absent crystal-art command, rather than
silently dropping coverage. The planner now consumes the current manifest's
complete interface command in job2; nameplates/resource HUD remain in job1.
Future interface files automatically follow that manifest command. Missing or
unsupported commands and duplicate coverage fail before browser execution.

The anonymous command is unchanged. Only the already-reviewed independent
entrance and effects families use case sharding; ordinary cases retain file
sharding. All stages retain one worker, configured retries/timeouts, their full
assertions, independent HTML/result paths and the existing predeploy dependency.
No additional GPU runner, concurrent local browser or skip policy is introduced.

CI-mode pinned Playwright discovery12853 TERMINAL0 verifies the exact current
baseline command union:101cases, no omissions, duplicates or empty stages.

| Job | Ordinary | Entrances | Effects | Supplemental |
| --- | ---: | ---: | ---: | --- |
|1|22|4|3|6 nameplates +3 resource HUD|
|2|23|3|3|9 interface|
|3|20|3|2|None|

The older prototype's107cases belong to a different source with unpublished
content; they are not the baseline for this candidate. That content and its
future acceptance remain required in their own workstreams. Discovery starts
no browser/server and proves coverage distribution, not runtime or a speedup.

## Evidence and corrections

- Imported2b7ba711/126877c5 as6cba0605/b636843c; resolved the expected CI workflow
  conflict in this isolated worktree, leaving the running primary unchanged.
-33238 RED:3failed suites/1passed;7failed/11passed tests2.055seconds. The old
  planner's missing crystal-art command prevented current coverage discovery.
-6466 PASS255tests/4suites1.988seconds plus lint after current interface routing.
  Logs`/tmp/eidolon-browser-cost-current-{red,focused,lint}.log`.
- Added17 real subprocess orchestration cases. They copy the actual runner/plan
  into a disposable fixture and substitute only a recording child CLI. All three
  successful shard invocations preserve exact arguments and evidence paths;
  a failure at each of12stages exits7 and prevents subsequent launches. Child
  SIGTERM exits1; plan mode starts no child; invalid CLI arguments fail closed.
  This is process-level orchestration evidence, not real browser execution.
-92474 failed to load the new suite because the shared test setup requires a
  DOM. Removed the unnecessary Node-environment override; retained the failure
  log.44309 then passed272tests/5suites7.013seconds but lint caught multiline
  curried-call formatting. Corrected that formatting; no assertion was removed.
-81077 TERMINAL0:272tests/5suites7.028seconds, lint and diff check all pass under
  Node24.18.0. Logs`/tmp/eidolon-browser-cost-current-final-focused.log` and
  `/tmp/eidolon-browser-cost-current-clean-lint.log`.
- Locked asset preparation and discovery logs:
  `/tmp/eidolon-browser-cost-current-{prepare,discovery}.log`.

## Required before promotion

Run full client regressions and all three real bundled-Chromium CI-mode groups
on the frozen integrated candidate, retain independent artifacts, inspect their
rendering, and measure durations. These are pending because the primary's earned
campaign owns the sole local heavy/browser slot. Do not interrupt that campaign
or repeat the unchanged socket authenticated all gate as missing.

The actual release queue is a separate constraint: canonicalCI34434837759 waits
behind nightly34433520743 on the existing runner. This partition does not resolve
that reservation. No soak cancellation, scheduling policy, runner change or push
has been authorized by this integration. Canonical62dc acceptance, versioned
patch notes/CI and live acceptance are still required before successor delivery.
