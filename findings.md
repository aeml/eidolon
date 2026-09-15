# Eidolon Review Findings

Reviewed production source: `origin/master` at `a22e42afc5ee8e4e503023eaa09cee704082799c` (`Alpha 1.9.14`).

## Critical

1. Production secrets and database backups are readable by every local user. `/home/aeml/eidolon/server/.env` was mode `0775`, `/etc/mongo-backup.env` was `0644`, and nightly Eidolon archives were `0644` beneath a `2775` directory. Restrict access and rotate the exposed credentials.
2. QA privileges can be claimed through username case variants. QA checks normalize usernames, while registration, authentication, and Mongo uniqueness preserve case (`server/main.go:101-114`, `server/internal/database/db.go:340-377`, `server/internal/database/migrations.go:172-176`).
3. Movement remains client-authoritative. Walking has no elapsed-time speed budget and jumps have no distance limit (`server/internal/game/world.go:1450-1568`, `server/protocol_policy.go:55-56`).

## High

1. Direct trades complete without durably saving both participants (`server/internal/game/direct_trade.go:146-181`, `server/direct_trade_handlers.go:48-69`).
2. Guild-bank transfers and weekly raid rewards commit one side before character persistence (`server/guild_handlers.go:339-410`, `server/main.go:838-861`).
3. Quest completion and several economy actions acknowledge success before persistence (`server/client_dispatch.go:1121-1200`, `1411-1477`, `1526-1634`).
4. Authentication rate limits are per WebSocket and reset on reconnect (`server/protocol_policy.go:219-241`, `server/network.go:255-271`).
5. Entity locking is inconsistent with the parallel world loop (`server/internal/game/world_update.go:77-107`, `server/internal/game/economy_actions.go:181-268`, `448-595`).
6. Frontend and backend publication is non-atomic and has no automatic rollback (`.github/workflows/ci.yml:264-269`, `425-430`, `server/deploy/deploy_linux.sh:103-135`).
7. The production branch has no branch protection, and the backend deployment has no protected GitHub environment approval boundary.
8. `/usr/local/bin/mongo-backup.sh` can report a failed `mongodump` as successful because each backup function ends with a successful status message. The nightly unit has already exhibited this behavior for another configured database.
9. Daily and schema-upgrade backups remain on the same physical host, with no verified off-host copy or Eidolon restore drill.
10. The API receives Mongo root credentials, including through container command and health-check metadata (`server/docker-compose.yml:14-18`, `36-49`).

## Medium

1. Buyback bypasses the 25-slot inventory cap (`server/internal/game/economy_actions.go:583-592`).
2. Shop, stash, forge, casino, and auction actions lack server-side location checks.
3. Nearby players receive private gold, talent, rune, and build details (`server/state_serialization.go:848-863`, `1237-1266`).
4. Event broadcasting can create unbounded goroutines (`server/main.go:489-558`, `621-677`).
5. The API container has no memory, CPU, or PID limits, capability drops, read-only root filesystem, or Docker log rotation. The host filesystem was 87% used during review.
6. The restore helper can run `--drop` against a live database without proving writers are stopped or validating the complete backup bundle.
7. Active Nginx configuration is maintained outside the repository and is not reproducible from the deployment source.

## Positive Controls

- Exact Git SHA deployment and post-deployment identity checks.
- Future-schema rejection and read-only schema preflight.
- Graceful shutdown with a 60-second container grace period and character journals.
- Upgrade backups with checksums and retained previous images.
- Separate soak runner and live browser acceptance after deployment.

## Verification

- 6,903 Jest tests passed under Node 24.
- ESLint passed.
- `go test -race ./...` passed.
- Live anonymous Playwright checks passed for desktop/mobile presentation, runtime dependencies, WebSocket connectivity, and release health.
- The latest schema-upgrade backup passed checksum and gzip integrity validation.

## Versioning Notes

- The Git SHA is the authoritative build identity.
- Semantic versions are manually synchronized across package metadata, lockfile metadata, `release.json`, `index.html`, server defaults, Docker/Compose/deployment defaults, isolated QA, CI, roadmap status, and version-presentation tests.
- There are no Git tags, GitHub Releases, or immutable registry images.
- Published fixes increment the patch version. Corrections to a candidate that has not successfully deployed retain the candidate version.
