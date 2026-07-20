# Eidolon Multiplayer Server

This is the authoritative multiplayer server for Eidolon, written in Go.

## Current runtime notes
- Go module/toolchain version: `go 1.24.5`
- Persistence: MongoDB
- Networking: Gorilla WebSocket + protobuf state envelopes

## Prerequisites
- Go 1.24.5
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

## QA-only commands

`/level`, `/qa-waypoint <combat|encounter|verdant>`, and `/qa-loot-next` are disabled for normal accounts. Set a comma-separated `EIDOLON_QA_USERNAMES` value (or `--qa-usernames`) to allow dedicated authenticated QA usernames. Combat and Verdant use fixed coordinates; encounter places only the QA character near the live overworld enemy nearest the fixed combat anchor and cannot accept arbitrary coordinates. All waypoints use a bounded five-minute protection window; `/qa-loot-next` forces the next eligible normal kill through the usual loot generator. Do not add normal player accounts.

The load-test driver generates cryptographically random, in-memory credentials by default. An explicit `--credentials-file` is read-only; credential files and legacy `bot_data.json` paths are ignored by Git.
