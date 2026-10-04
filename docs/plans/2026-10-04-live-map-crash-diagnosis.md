# October4 live entity-map crash: diagnosis, not remediation

## Observed incident

The deployed `76225a2f4278be3c897af624de5c0c1b91e1e7f8` / Alpha1.74.0
backend started at14:22:31UTC and crashed at15:07:31.281666UTC with
`fatal error: concurrent map iteration and map write`. The runtime stack names
`World.CollectExpiredDisconnectedPlayers`, world.go:1340, called from the
periodic disconnected-session sweep. Docker restarted it at15:07:31.586620UTC;
the inspected container has restart count1 and OOMKilled=false.

At19:00–19:01UTC, read-only IPv4 checks returned frontend HTTP200, backend
`/healthz` statusok/database ready with that exact release identity, and normal
HTTP/1.1 WebSocket upgrade101. The intentional three-second WebSocket probe
then timed out while receiving frames; that timeout is not a failed upgrade.
This proves recovery at that observation time, not permanent availability,
successful login/gameplay or corrected concurrency. No service restart, source
repair, deployment, database/account mutation or DNS change was performed.

## Unsafe writer identified in the deployed source

The sweep takes `w.Mu.Lock` before iterating the map at world.go:1337–1340.
The deployed `World.spawnEliteInRect` at world.go:911–986 takes no world lock
but assigns `w.Entities[elite.ID] = elite` at:979 and updates the spatial grid.
`World.updateFrame` releases its deferred-action world lock at
world_update.go:136, then calls that spawner at:164 every five minutes.
The comment at:147 claims the spawner locks internally, but the implementation
does not. Thus the caller and writer are both unprotected and can race with
the locked sweep, broadcast readers or other writers.

The incident occurred45minutes after startup, consistent with a periodic
five-minute spawn. That timing supports the diagnosis; it does not prove which
writer was concurrent at the exact crash. The fatal stack identifies the
iterator, not the writing goroutine. Other map mutations still need their lock
contracts checked when implementing remediation.

## Follow-up / authority

The user's latest direct request was to check why the server was down. The
assistant asked whether to fix and deploy the crash; no affirmative human
answer has arrived. Automatic roadmap continuations are not that answer.
Keep this incident open. Once remediation is authorized, protect runtime elite
publication with the world lock, respect entity/world lock ordering, correct
the misleading contract comment, and run a small focused concurrent
spawn/sweep/update regression. Reuse completed encounter checks rather than
another whole campaign. Publication must preserve remote website changes and
use the normal exact-source CI/deployment/release-notes procedure; prepared
policy-gated successor releases must not be pushed out of order as a hotfix.
