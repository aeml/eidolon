# Iron Fortress full-gate contract repair

Hosted regression 34676966185 at befd5284 exposed two stale test contracts:
`IsolatedQADefaults.test.js` still required Guardian Roar to be immediately
followed by Executioner Spin, and `QAStageTimingIntegration.test.js` omitted
the newly required Fortress route from its independent command/stage lists.
The latter omission left its shell double undefined, returning 127 instead of
the deliberately injected failure status 19 at every subsequent stage.

The client job failed with 2 suites / 39 tests failing and 378 suites / 5807
tests passing. This is a test-harness regression, not evidence that the real
Fortress route or gameplay passed or failed. The production 1.0.65 run uses a
different source revision and remains independent.

Add Fortress at its actual position in both explicit contracts. Do not derive
the expected sequence from the wrapper, remove the route, skip downstream
checks, or change accepted exit codes. The shell integration now also injects
a failure at Fortress itself and verifies that later commands stop, artifact
scanning and cleanup still run, and status 19 is preserved.

Focused validation: 5 suites / 81 tests pass in 4.935 seconds, including both
formerly failing suites, timing helper, Fortress registration and observer.
Full lint passes. The first local focused command misspelled the additional
Fortress test filename; its three existing suites passed but the command
correctly failed with ENOENT. The corrected command above is the accepted run.

Evidence logs:

- `/tmp/eidolon-integrated-1-1-befd-client-34676966185.log`
- `/tmp/eidolon-fortress-gate-contract-focused-20260912.log` (command typo)
- `/tmp/eidolon-fortress-gate-contract-focused-corrected-20260912.log`
- `/tmp/eidolon-fortress-gate-contract-lint-20260912.log`

No gameplay, release version, patch notes or deployment gate is changed by
this repair. Native Fortress purchase/save/expiry acceptance and actual
four-player dungeon completion remain open.
