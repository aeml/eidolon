# 1.80 public-monitor deadline correction

The first feature-freeze candidate `a4b905e4ef217621fa8dfd2bf1c4332c5739c0e4`
fails original [CI 39352722710](https://github.com/aeml/eidolon/actions/runs/39352722710)
in the server race-enabled suite: `TestPublicMonitorSharedDeadlineAndShutdown`
receives `public_invalid_response` instead of `public_probe_timeout`.
There is no data-race report. Client and all three hosted browser jobs pass;
the remaining five jobs, including native QA and both deployments, are skipped.
No workflow retry/cancellation occurs and production remains accepted86.

Original run/job metadata and all five terminal job logs are retained read-only
under the owned master's `.qa-release180-freeze/`. Failed-original inventory
SHA256: `ffb40dd9f3f945262fc377e0a20a61778687f331488b0a9b9369f91fc682be37`.

## Reproduction and correction

A canceled response can end with EOF. `io.ReadAll` converts EOF to successful
completion, so the old public probe checked cancellation only for a nonnil read
error. Empty late responses then became invalid JSON, while a complete late
health response could incorrectly count as ready after the shared deadline.

Six new deterministic cases retain the actual HTTP client's context/budget and
return empty or complete bodies at cancellation for the login page, manifest
and backend. Four cases fail on the unchanged runtime: all three empty-body
cases and the complete late backend response. Both earlier valid-response
controls pass because a subsequent request catches the expired context. The
same six cases pass after the correction, with exact bounded request counts and
one close per opened response. No transport request continues after the deadline.

The runtime now checks the shared context immediately after `ReadAll`, before
parsing, regardless of the read error. The existing timeout classification,
parent-shutdown precedence, response/body limits, TLS/redirect policy and single
shared request budget remain. The original 500ms TLS deadline/shutdown fixture,
its three-equal-deadline assertions and termination bounds are unchanged.
No retry, alternate endpoint, longer timeout or weaker assertion is introduced.

Focused public-monitor race checks pass four top-level tests / 32 tests including
subtests in 3.266s. The complete operations package then passes 31 top-level tests /
168 including subtests in 8.623s. Those scopes overlap and are not added together.
One existing opt-in live public probe stays skipped in each local run. Both use
Go 1.27.2, two low-priority CPU cores and no live configuration/data/mail mutation;
all five workflow-status queries were empty before local test work.

This is a scoped stabilization fix for F2/P09 and the existing monitor contract,
not a new gameplay feature or public-monitor activation. The corrected 1.80
candidate retains the frozen dependency graph, game rules, models, schema,
protocol, wallets and original feature scope. It requires its own original full
CI, deployment/live and exact public verification before 1.80 acceptance. The
first failure is retained; prior scoped passes do not waive the failed gate.
