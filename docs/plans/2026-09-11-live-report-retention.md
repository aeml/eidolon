# Retain each live animation invocation's evidence

Unpublished QA follow-up, independent from the game-runtime branches.

Alpha1.0.62's completed live job passed its declared stages, but its downloaded
HTML archive contained only the last multiplayer invocation. The wrapper ran
four class matrices and remote multiplayer using the same default HTML and
test-results roots; each later invocation could clean earlier output.

Each class and the remote matrix now receives a distinct nested HTML directory
and test output directory: `playwright-report/live-{fighter,rogue,wizard,cleric,remote}`
and corresponding `test-results/live-*`. The earlier anonymous report remains
at the parent root. Town recovery already uses distinct screenshot roots and
line reporting, so it does not replace HTML. Existing recursive sanitizer and
upload roots include every new directory; no extra unsanitized upload path.

Installed Playwright's reporter implementation confirms
`PLAYWRIGHT_HTML_OUTPUT_DIR` takes precedence over configured outputFolder.
Shell harness verifies all five invocations select distinct paths, preserve the
existing tests/identities, and stop on each possible failure with its exact
exit23 rather than running later stages or printing success. It performs no
browser launch, network request or production-account action.

Initial harness failed partly because an absent output environment variable was
expanded under the wrapper's nounset mode; do not count its six failures as six
runtime defects. Final harness initializes that variable empty. Actual old
artifact loss is evidenced by the inspected62 artifact and shared source paths.
Final21tests/2suites PASS0.784s, bash syntax PASS, full lint PASS. Logs:
`/tmp/eidolon-live-report-retention-{red,green,final}.log` and
`/tmp/eidolon-live-report-retention-lint-final.log`.

Next release must verify the actual retained directories after real browser
execution. This focused wrapper proof is not a new live gameplay pass. No
pipeline gate, runner queue, timeout or source publication changed. The soak
stays cancelled.
