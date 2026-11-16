# Repository layout

The root contains project entrypoints, manifests, configuration, licenses and navigation. Implementation, tooling and records belong to the areas below.

| Area | Ownership |
| --- | --- |
| `src/` | Browser implementation, grouped by responsibility ([source guide](../../src/README.md)) |
| `server/cmd/` | Executable entrypoints, including `eidolon/` |
| `server/internal/` | Go application, simulation, persistence and supporting packages |
| `server/deploy/` | Deployment procedures, configuration and independent deployment tests |
| `tests/` | Client, contract, tooling and browser checks ([test guide](../../tests/README.md)) |
| `scripts/` | Tooling grouped by purpose ([tooling guide](../../scripts/README.md)) |
| `proto/` | Canonical wire schema |
| `assets/` | Public versioned assets, notices and cumulative patch-note payloads |
| `art/source/` | Retained editable art sources |
| `website/` | Independently built marketing website |
| `docs/development/`, `operations/`, `art/`, `content/`, `policies/`, `qa/` | Current guides, canonical content inputs and QA procedures |
| `docs/plans/` | Active plans and remaining-work register |
| `docs/records/` | Dated evidence, reviews and release records |
| `docs/history/` | Retained superseded guides and earlier plan archive |

Go directories define packages. Unit tests that exercise private state remain colocated with their owning package. Splitting those files into arbitrary subdirectories would change package boundaries; extract a new package when it has an independent interface and ownership. The server root contains module/build configuration, while `cmd/eidolon/main.go` delegates startup to `internal/server` and retains the build-version linker interface.

Published HTML entrypoints, shared login modules, runtime bundles, worker URLs and asset URLs are compatibility contracts. Their stable paths are intentional. Asset and art payloads are retained byte for byte during structural cleanup. Keep generated catalog provenance accurate by running the real generator and checking its outputs.

Use `npm run check:layout` to check package roots and prevent loose tooling, tests and dated records from accumulating again. Use `npm run check:content`, lint, Jest, Go tests and the browser/native gates for behavior. A layout check alone does not establish release readiness.
