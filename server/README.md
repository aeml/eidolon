# Eidolon Multiplayer Server

This is the authoritative multiplayer server for Eidolon, written in Go.

## Current runtime notes
- Go module version: `go 1.23`
- Toolchain declared in `go.mod`: `go1.24.5`
- Persistence: MongoDB
- Networking: Gorilla WebSocket + protobuf state envelopes

## Prerequisites
- Go 1.23+
- MongoDB (local or Atlas)

## Run locally without TLS
From `server/`:

```bash
go run main.go
```

Default local endpoint:
- `ws://localhost:8080/ws`

The listen address can be changed with `--addr` if needed.

## Run locally with self-signed TLS
If you want local `wss://` for browser testing, generate a self-signed cert:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
go run main.go --cert=cert.pem --key=key.pem
```

Then trust the certificate in your browser before testing `wss://localhost:8080/ws`.

## Tests
From `server/`:

```bash
go test ./...
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
go build -o eidolon-server main.go
```

## Database
The server uses MongoDB for user and character persistence.
