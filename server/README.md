# Eidolon Multiplayer Server

This is the authoritative multiplayer server for Eidolon, written in Go.

## Current runtime notes
- Go module/toolchain version: `go 1.27.2` (1.79.10 security correction)
- Persistence: MongoDB
- Networking: Gorilla WebSocket + protobuf state envelopes

## Prerequisites
- Go 1.27.2
- MongoDB (local or Atlas)

## Run locally without TLS
From `server/`:

```bash
go run .
```

Default local endpoint:
- `ws://localhost:8080/ws`

The listen address can be changed with `--addr` if needed.

Readiness endpoint:

- `http://localhost:8080/healthz`
- Reports service status, Mongo readiness, build commit, and version without secrets.

## Run locally with self-signed TLS
If you want local `wss://` for browser testing, generate a self-signed cert:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
go run . --cert=cert.pem --key=key.pem
```

Then trust the certificate in your browser before testing `wss://localhost:8080/ws`.

## Tests
From `server/`:

```bash
go test ./...
go build ./...
```

## Production notes
Typical production shape:
- Go server runs on localhost/HTTP
- Reverse proxy terminates TLS and forwards WebSocket traffic
- MongoDB runs alongside the server environment

See these docs for deployment details:
- `server/deploy/README_LINUX.md`
- repo-level infra/deploy workflow files under `.github/workflows/`

## Build
Example Linux build:

```bash
go build -trimpath -o eidolon-server .
```

## Database
The server uses MongoDB for user and character persistence.

## Emailed account recovery

Configure `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL` (a Postmark-verified
sender) and `POSTMARK_MESSAGE_STREAM` (a transactional stream; blank defaults
to `outbound`) in the private deployment environment. Never commit or print
the token. All three blank disables mail; invalid partial configuration refuses
startup. Existing Docker deployment loads the server `.env`; no new sudo
installation or service is required. Recovery never BCCs `ADMIN_NOTIFICATION_EMAILS`.

Players first sign in and use Account help or Settings to prove their current
password and verify a recovery mailbox using its 30-minute confirmation link.
The original registration email is not trusted automatically. Forgot your
password on the login screen then requests a 15-minute, single-use reset link.
Both links require explicit submission. Resets invalidate existing sessions
but preserve characters, items, currency and roles. There is no admin ownership
override or automatic sign-in. Mail acceptance is not inbox-delivery proof.

After deployment, verify delivery using your own account: request verification,
check inbox/spam, and explicitly confirm the address. A reset test changes the
password and closes other sessions, so only request one when prepared to do so.
Check Postmark sender/stream permissions if mail does not arrive; do not paste
tokens, links, passwords or raw provider responses into reports.

## QA-only commands

`/level`, `/qa-waypoint <combat|encounter|verdant>`, `/qa-hazard <earth|water|fire|air|town>`, and `/qa-loot-next` are disabled for normal accounts. Set a comma-separated `EIDOLON_QA_USERNAMES` value (or `--qa-usernames`) to allow dedicated authenticated QA usernames. Combat and Verdant use fixed coordinates; encounter places only the QA character near the live overworld enemy nearest the fixed combat anchor and cannot accept arbitrary coordinates. All ordinary waypoints use a bounded five-minute protection window. The hazard pilgrimage uses fixed canonical centers and a 45-second inspection clock that admits real environmental damage while retaining unrelated hostile protection, then returns through `town`; `/qa-loot-next` forces the next eligible normal kill through the usual loot generator. Do not add normal player accounts.

## Administrator bootstrap

Administrator access is a durable account role and is separate from QA access. An exact authenticated username in `EIDOLON_ADMIN_BOOTSTRAP_USERNAMES` can use `/relevel` once to persist the role without changing character level or progression. See `../docs/ADMINISTRATION.md` for the authorization and audit requirements for future administrator operations.

The load-test driver generates cryptographically random, in-memory credentials by default. An explicit `--credentials-file` is read-only; credential files and legacy `bot_data.json` paths are ignored by Git.
