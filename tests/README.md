# Test ownership

| Directory | Tests |
| --- | --- |
| `unit/` | Client behavior, grouped by source responsibility |
| `contracts/` | Protocol, backend and cross-process contracts |
| `tooling/` | Build, content, QA, operational and CI tooling |
| `release/` | Version presentation and cumulative history |
| `support/` | Shared fixtures, setup and source-location helpers |
| `e2e/` | Browser specifications grouped by feature; `support/` holds browser helpers |

Jest discovers nested `*.test.js` suites and excludes `e2e/`. Playwright discovers nested browser specifications; `scripts/qa/e2e-suites.json` retains the deliberate file ordering used by smoke shards. When relocating tests, preserve every case, assertion, exclusion, timeout and project, and verify the exact discovered case union.

Go tests remain beside the package they exercise. Independent deployment checks live in `server/deploy/tests/`. Browser/account tests use the existing disposable QA wrappers; credentials and private artifacts never belong in this tree.
