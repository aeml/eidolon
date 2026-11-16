# Alpha 1.80.5 repository cleanup acceptance

Accepted at 2026-11-16T06:11:00.067307+00:00. Runtime source: `981cba7249c0a7dea7d36829e555cf585875a0f4`. [Successful CI/CD run](https://github.com/aeml/eidolon/actions/runs/43807360210).

The entire repository was audited and organized by ownership. This is a maintenance release preserving the selected gameplay baseline; it does not close outstanding game, beta, capacity or physical-device gates.

## What changed

- 3,900 existing files received organized homes: 470 Go files, 552 client/tooling files, 1,378 tests/helpers and 1,500 documentation files.
- The Go service starts at `server/cmd/eidolon/`, with application code in `server/internal/server/` and independent deployment tests in `server/deploy/tests/`. Go package tests remain with their owners.
- Browser implementation and tests are grouped by responsibility. Tooling has build, content, art, QA, protocol, operations, release, reporting and validation homes.
- Current guides, active plans, canonical content and dated evidence are distinct. [Repository layout](../../../development/repository-layout.md) documents ownership; `npm run check:layout` enforces package-root conventions in CI.
- Historical rendering comparisons retain their pinned source and resolve current dependencies without changing their algorithms. Current-branch documentation links follow the new paths.

## Preservation and qualification

All 10,214 baseline tracked files remain accounted for. All 5,178 baseline asset/art payloads retain their original SHA-256 digests; four Markdown asset guides only update navigation or tooling references. All 721 relocated JSON receipts retain their original bytes. The new cumulative history has 527 entries, retaining all 526 previous entries byte for byte.

Executable AST comparison preserves 564 client modules; the remaining generated geometry catalog differs only in genuinely regenerated source/generator provenance. Geometry entries and binary payloads remain identical. Forty real historical comparison modules retain their algorithms after parsed import rebasing, with browser import qualification for every graph and the virtual Birch pair. The new helper has eight self-contained regression tests using disposable Git fixtures.

All 2,781 Go test/benchmark declarations, the 829 original Jest suites and all 1,066 original Playwright cases remain discoverable. The accepted reporting fix, reference-module regression suite, trusted diagnostic guards and economy-preparation cases bring Jest to 833 suites / 12,905 cases. The exact 583-case browser smoke partition retains every case once. No assertion, exclusion, retry or timeout policy was relaxed. Local Markdown navigation retained the same 186 preexisting broken links and introduced none; the current-branch GitHub source-link audit is clear.

The shared QA route prepares full bags before combat and requires ordinary Recall before any later preparation. Exact wallet, transaction, earned-room-credit and item-custody assertions remain in force. Two additional disposable native System Chrome fixtures passed with zero retries: full-bag preparation before combat and immediately after a real Wizard ability. Both recorded Recall → correlated wallet → one sale, the exact three-Gold credit, retained bag/equipment metadata, and matching fresh-login/Mongo saves. The latter wallet included the separately earned eleven combat Gold before the sale baseline. The temporary fixture source/evidence remain isolated in the owned qualification worktree; they are outside the release suite counts. The earlier failed live gate and bounded diagnostic are retained in the qualification record. No game behavior changed for this correction.

The final run passed all ten jobs, including client/server gates, all three hosted browser shards, native System Chrome predeployment QA, production-input validation, frontend/backend publication and live character/recovery QA. Qualification and superseded candidate observations are retained in [the qualification record](2026-11-16-qualification.md).

## Public verification

Normal-TLS reads independently matched the frontend manifest, login label, runtime entry/import identity and backend health to `981cba7249c0a7dea7d36829e555cf585875a0f4` / `Alpha 1.80.5`. Backend status was `ok` and MongoDB `ready`. Five representative client coverage resources matched the exact run artifact byte for byte, including the relocated engine report. The new Go application/startup report is reachable from the server coverage index. [Verification details](2026-11-16-public-verification.md).

The original dirty checkout was preserved. Completed work was ordinarily merged into synchronized master; no force push or unfinished feature selection was used. Existing readiness limitations and owner deferrals remain in force.
