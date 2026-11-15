# Local development

Use a clean checkout and read [CONTRIBUTING.md](../../CONTRIBUTING.md) before editing. These commands run a development client and backend, not a deployment. Keep production credentials, databases and saved characters out of this setup.

## Prerequisites

- Node.js 24 and npm 9+; [.nvmrc](../../.nvmrc) and [package.json](../../package.json) declare the supported runtime.
- Go 1.27.2, as declared in [server/go.mod](../../server/go.mod).
- A separate local MongoDB instance. The repository's [Compose file](../../server/docker-compose.yml) pins Mongo 7.0.14. Database setup depends on your machine; use disposable development storage rather than a production URI.
- Git LFS only when you need editable Blender sources. See the [art guide](../art/EQUIPMENT_ASSETS.md).

From the repository root, run npm ci. Its postinstall prepares locked browser dependencies under ignored vendor/ and builds the gameplay geometry worker. It does not regenerate the tracked content catalogs. Do not copy node_modules or vendor from another checkout.

On Windows, preserve the repository's LF line endings. A fresh clone can opt out of automatic CRLF conversion without changing global Git settings:

~~~sh
git -c core.autocrlf=false clone https://github.com/aeml/eidolon.git
~~~

The generated geometry catalog and its provenance validate exact source bytes. A CRLF-converted checkout can fail preparation with `Invalid generated geometry catalog` or a stale-provenance error even without a logical source change. Diagnose checkout line endings before regenerating content; do not commit conversion churn. Some negative-fixture tests also need permission to create symlinks, which a standard Windows session may lack. Report that limitation rather than weakening those tests or claiming a full pass.

## Start the backend

With local MongoDB already running, use a separate terminal:

~~~sh
cd server
go run . --addr=127.0.0.1:8080 --mongo-uri=mongodb://127.0.0.1:27017
~~~

The explicit bind keeps this development API on loopback. Use your own local authenticated URI if MongoDB requires it; do not put real credentials into committed scripts or examples. Go reads the command flags shown here; the deployment Compose environment is a separate setup.

Check http://127.0.0.1:8080/healthz before testing. A ready response must report status ok and database ready. A running process alone is not sufficient. The readiness function can fail for durable session-activity storage, shutdown state, an uninitialized database, or Mongo connectivity. See [server/main.go](../../server/main.go).

## Select the backend without editing index.html

The checked-in [index.html](../../index.html) contains the public production WebSocket address. The existing [static server](../../scripts/serve-static.mjs) accepts EIDOLON_STATIC_WS_URL and substitutes the hidden server-address value in the **served** index response. It does not write index.html or change the production deployment.

From the repository root, Bash:

~~~sh
EIDOLON_STATIC_WS_URL=ws://127.0.0.1:8080/ws npm run serve
~~~

PowerShell:

~~~powershell
$env:EIDOLON_STATIC_WS_URL = 'ws://127.0.0.1:8080/ws'
npm run serve
~~~

Open http://127.0.0.1:4173. The variable must contain a ws:// or wss:// URL. It configures the client destination only; it neither starts nor authenticates a backend. Without the variable the static server leaves the production address intact. Do not use ordinary production accounts for local mutation tests.

Before logging in, inspect the returned HTML for id="server-address" and confirm it names your local server. For example, in PowerShell:

~~~powershell
(Invoke-WebRequest 'http://127.0.0.1:4173/').Content |
    Select-String -Pattern 'id="server-address"'
~~~

Stop the static server with Ctrl+C. PowerShell environment variables stay in that shell; clear the override when finished:

~~~powershell
Remove-Item Env:EIDOLON_STATIC_WS_URL
~~~

Bash's inline assignment applies only to that command.

## Ports and browser checks

The client server binds 127.0.0.1:4173 by default. Set PORT for another client port, and --addr for another backend port; keep the WebSocket override consistent with the latter.

~~~sh
PORT=4192 EIDOLON_STATIC_WS_URL=ws://127.0.0.1:8080/ws npm run serve
~~~

PowerShell uses $env:PORT = '4192' before npm run serve. Use an unused port, and clear it afterward with Remove-Item Env:PORT. The static server and API use different ports.

For Playwright's managed local server, use EIDOLON_E2E_WEB_PORT for the client port and EIDOLON_E2E_WS_URL for the backend. The [configuration](../../playwright.config.js) forwards the latter to EIDOLON_STATIC_WS_URL. Setting EIDOLON_E2E_BASE_URL to a different origin disables that managed local server; it does not rewrite a remote deployment. See the [contributor check map](contributor-map.md#choose-the-right-check).

## Source, publication and website

Local npm run serve serves the source checkout. The game publication is a copied tree with a lazy engine bundle, analytics/style processing and release-versioned imports; see [architecture](../ARCHITECTURE.md#source-and-published-client). Never run publication transforms against the editable root.

The standalone marketing site has its own [website/README.md](../../website/README.md) and npm --prefix website run build command. It is not the game-client build or a replacement for backend readiness.
