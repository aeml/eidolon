# Eidolon

[![CI](https://github.com/aeml/eidolon/actions/workflows/ci.yml/badge.svg)](https://github.com/aeml/eidolon/actions/workflows/ci.yml)

A browser action RPG by [Robert Mendola](https://mendola.tech): a JavaScript/Three.js client, an authoritative Go server, and MongoDB persistence. The game runs in the browser; this repository does not contain a Godot project.

[Play the alpha](https://play.eidolonrealms.com/) · [Website](https://eidolonrealms.com/) · [Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md)

## Quickstart

Use **Node.js 24**, npm 11+, **Go 1.27.4**, and a separate local MongoDB instance. Do not use production accounts or storage for development. See [local setup](docs/development/local-development.md) for Windows commands and LF-preserving checkout, custom ports and database details.

From the repository root:

~~~sh
npm ci
~~~

In one terminal, start the backend against your local MongoDB:

~~~sh
cd server
go run . --addr=127.0.0.1:8080 --mongo-uri=mongodb://127.0.0.1:27017
~~~

In a second terminal at the repository root (Bash):

~~~sh
EIDOLON_STATIC_WS_URL=ws://127.0.0.1:8080/ws npm run serve
~~~

PowerShell equivalent:

~~~powershell
$env:EIDOLON_STATIC_WS_URL = 'ws://127.0.0.1:8080/ws'
npm run serve
~~~

Open http://127.0.0.1:4173. The existing static-server override changes only the served login HTML, not tracked files. **Without an override, the checked-in client points to the production backend.** Check the served server-address before registering or testing. [Override details](docs/development/local-development.md#select-the-backend-without-editing-indexhtml).

## Find the code

| Area | Start here |
| --- | --- |
| Browser boot and game lifecycle | [index.html](index.html), [src/main.js](src/main.js), [src/core/](src/core/) |
| UI and styles | [src/ui/](src/ui/), [src/styles/](src/styles/) |
| World and actors | [src/world/](src/world/), [src/entities/](src/entities/) |
| Go simulation and persistence | [server/internal/game/](server/internal/game/), [server/internal/database/](server/internal/database/) |
| Wire protocol | [proto/](proto/), [protocol guide](docs/PROTOCOL.md) |
| Art and generated catalogs | [art contract](docs/art/EQUIPMENT_ASSETS.md), [provenance](docs/art/CONTENT_PROVENANCE.md), [src/assets/](src/assets/) |
| Tests and tooling | [tests/](tests/), [scripts/](scripts/), [edit-here/test-here map](docs/development/contributor-map.md) |
| Standalone marketing site | [website/README.md](website/README.md) |

The [architecture map](docs/ARCHITECTURE.md) distinguishes editable ES modules from the copied, bundled Pages publication. Do not edit generated publication files as source.

## Checks

Start with the tests for the behavior you change; the [contributor map](docs/development/contributor-map.md#choose-the-right-check) gives combat, UI, quests, protocol and art examples.

~~~sh
npm run check:content
npm run test:smoke
npm run lint
~~~

Full client tests use npm test. Server tests/build run from server/ with go test ./... and go build ./.... Browser and native-GPU checks have separate prerequisites; do not treat a unit-test pass as gameplay or visual acceptance. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [QA guides](docs/README.md#testing-and-evidence).

## Project status

Current source version: `Alpha 1.80.4`.

The latest documented accepted release is **Alpha 1.80.2**, runtime source b3889294cb3c0db234f54f854e6d7151865692b8. This is a release record, not a live availability claim. [Acceptance](docs/plans/2026-10-20-release1-80-2-acceptance.md) · [remaining work](docs/plans/2026-10-09-release-readiness-remaining.md) · [roadmap](ROADMAP.md).

The game remains open alpha. F1–F5 feature freeze is recorded as accepted; beta/launch gates and P01–P13 remain open. Soak/stress and owner-assigned human/device checks retain their documented deferrals. Versioned player patch notes are in the login screen.

<a id="connect-the-assets-to-gameplay"></a>

## Character and equipment assets: integration guide

Use the [equipment binding and authoring guide](docs/art/EQUIPMENT_ASSETS.md), [character delivery notes](docs/art/UNEQUIPPED_CLASS_BASES.md), and [canonical-input contributor guide](CONTRIBUTING.md#content-sources-and-checks). Preserve source models, manifests, hashes, IDs, and supplied notices. The [documentation index](docs/README.md#art-and-content) collects the other art guides.

## Earlier documentation

The [previous full README](docs/history/readme-before-navigation-refresh-2026-11-15.md) preserves the long feature list, detailed asset integration notes, QA route descriptions, and dated release history. Use the active guides above first. Historical receipts and canonical inputs remain at their existing paths.

## License

Project-authored software uses [AGPL-3.0-only](LICENSE). Project-authored visual/audio assets and editable art sources use the separate [Eidolon Asset Share-Alike License](ASSET-LICENSE). Third-party inputs retain their own terms. See [NOTICE](NOTICE), [licensing and fork policy](docs/LICENSING.md), and the [provenance inventory](docs/art/CONTENT_PROVENANCE.md).
