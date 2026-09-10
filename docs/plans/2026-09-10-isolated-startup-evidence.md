# Retain disposable service startup failures before cleanup

Run17921 (`earth-stash-0910-0050`) on a9678db terminated with exit1 after
`Isolated Mongo readiness timed out.` It never started the API or Playwright;
there is no new quest/storage result or new browser report from this attempt.
Original log `/tmp/eidolon-earth-stash-0050.log` retained. Exact owned containers
and ports18560/18561/41960 were absent after cleanup. Disk had134GBfree; a Docker
destroy event was retained, but the removed database's startup log was not.
These checks do not establish the cause of its failure.

Add bounded failure-only diagnostics before the wrapper's existing cleanup:
inspect only the exact disposable container's State (not Config/Env), and retain
its last80log lines from both stdout and stderr. Each command has a5second/
1MBbound. Redact all known QA account and database credentials in memory before
writing private artifacts beneath a unique test-results subdirectory. Partial
output from failed/timed-out diagnostic commands is also redacted and retained.
Unrelated or mismatched container targets are rejected.

Mongo/API startup deadlines, fatal failure statuses, gameplay requirements and
cleanup ownership are unchanged. Diagnostic capture failure cannot turn a failed
readiness check into success. No game/server/runtime behavior change. Existing
full3995-test stash regression remains valid for that runtime/helper code; these
additional failure-path changes have targeted behavioral/tooling verification.

Unit coverage includes exact Docker argument/bound checks, stdout+stderr capture,
repeated/overlapping secret redaction, thrown errors, timeout partial output and
unrelated-target rejection. Wrapper tests retain startup fatal exits, runtime
preflight, all required route commands/order and exact cleanup registration.
Lint and shell syntax checks are required before the instrumented retry.

The next actual replay remains necessary. If startup fails again, preserve and
inspect the new diagnostic folder before another run can overwrite test-results.
Do not call a startup-only attempt evidence for quest or stash behavior.
