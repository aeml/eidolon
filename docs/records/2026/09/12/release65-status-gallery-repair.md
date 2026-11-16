# Release 65 native gallery gate repair

Production CI 34673903787 at 66ca3a3d stopped before deployment. Client/server
checks and all 104 anonymous browser cases passed. Native animation gallery
job 103502445330 ended with 29 passes and one failure (7.1 minutes): the new
`protection` status family had no gallery class mapping, so selectOption received
undefined. The automatic retry reproduced it. Later deployment jobs skipped.
Public frontend/backend remained healthy Alpha 1.0.64 / 6d5e82cb on inspection.

Failure artifact: `/tmp/eidolon-release65-native-failure-KAP9Bb`.
Log: `/tmp/eidolon-release65-production-native-34673903787.log`.

Extracted the explicit family/class mapping into a shared test helper and added
protection -> Wizard. The new all-family unit matrix first failed exactly the
protection entry (1 failed / 24 passed, 1.683s). Inspection also found missing
preview activation and cleanup state for protection: two real local/remote actor
tests reproduced those omissions (2 failed / 25 passed, 1.797s). The gallery now
activates the preview and clears its replicated and offline Phase timers when
switching presentation. No live gameplay, buff strength, duration, or release
version changed. Native coverage retains every status; no fallback or exclusion.

Focused final checks: 4 suites / 65 tests pass in 3.872s, changed-file lint and
diff whitespace pass. Logs use `/tmp/eidolon-release65-status-gallery-` with
`red`, `activation-red`, `final`, and `final-lint` suffixes plus `-20260912.log`.

The first local native attempt (45621) terminated before gallery startup because
this new worktree lacked generated vendor dependencies. Its evidence is retained
at `/tmp/eidolon-release65-status-gallery-unprepared-Bt7kxf`; it was not replaced
while running. After ordinary prepare:client, final hardware Chrome session
30960 passed the unchanged-scope status test in 24.3s, covering all 25 statuses
at High/local and Low/remote, unique identity, finite visible geometry and cleanup.
Accepted evidence: `/tmp/eidolon-release65-status-gallery-accepted-D3GvQ9`.
Log: `/tmp/eidolon-release65-status-gallery-native-final-20260912.log`.
Inspected protection screenshot shows the thin blue floor seal and orbiting
shards without an enclosing cube. Port 41877 is free after termination.

The complete production workflow must run on this correction before release 65
can be called deployed. Forward-port the gallery repair into 1.1 after its
currently running eb20789a regression terminates. No ordinary release 66.
