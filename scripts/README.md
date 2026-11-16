# Repository tooling

Run the documented npm commands from the repository root. Script files live with their responsibility:

| Directory | Responsibility |
| --- | --- |
| `build/` | Client preparation, bundles and publication paths |
| `content/` | Generated catalogs and read-only freshness checks |
| `art/` | Asset inspection and explicit authoring/derivative workflows |
| `qa/` | Browser suites, native launch, disposable fixtures and evidence sanitation |
| `protocol/` | Protocol generation |
| `validation/` | Repository and dependency policies |
| `operations/` | Operational utilities |
| `release/` | Cumulative patch-note publication |
| `reporting/` | Coverage report publication |
| `dev/`, `benchmarks/` | Local server and performance tools |
| `lib/` | Shared tooling modules |

New scripts belong in one of these directories. Derive the repository root from the script location, preserve execution from outside the checkout where supported, and keep npm entrypoints and CI callers synchronized. `npm run check:content` checks committed outputs without repairing them; generation remains explicit.
