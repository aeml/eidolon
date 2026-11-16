# Alpha 1.80.5 repository cleanup qualification

Baseline: selected merge `84f2f9b8f8757b8722c5c23935df428c08a6bc98`, followed by the accepted Alpha 1.80.4 publication repair `dd4ca9337d2d57d9b1a7c9c66ac76d8512e22245` and documentation acceptance `e45f2cbee`.

This milestone reorganizes the repository without selecting unfinished gameplay changes. The original dirty checkout was preserved; all implementation and validation used an owned detached worktree. Master synchronization and production acceptance are recorded separately.

## Structural preservation

- All 10,214 original tracked files have retained destinations: 470 Go files, 552 client/tooling files, 1,378 test/helper files and 1,500 documentation files were relocated.
- All tracked public asset/art payloads retain their baseline SHA-256 digests. Of 5,189 asset/art files checked, 5,186 are byte-identical; three Markdown guides update navigation or tooling paths.
- All 721 relocated JSON evidence receipts retain their original bytes.
- Executable AST comparison matches 564 of 565 client modules after normalizing import/path references. The remaining generated geometry catalog matches exactly after removing only its source/generator provenance, refreshed by real native-GPU generation. Geometry binaries retain their existing digests.
- All 2,781 Go test/benchmark declarations, 829 baseline Jest suites and 1,066 Playwright cases remain discoverable. The accepted publication repair adds one Jest suite, for 830 total. Browser case titles, projects, expected status and timeouts remain unchanged.
- Exact smoke discovery covers 583 cases with no omissions or duplicates.
- Local Markdown-link audit retains the same 186 preexisting broken links and introduces none. Historical receipts keep their source-time references; this cleanup does not claim to repair every older recorded link.

## Qualification

The full local coverage run exercised 830 suites / 12,890 tests: 829 suites and 12,889 tests passed. Its sole failure was a duplicated path in the documentation-only CI policy expectation after relocation. That expectation was corrected; the focused final release run passed all four suites / 420 cases, including the policy suite. No assertion, exclusion, retry or timeout was relaxed. Hosted CI must rerun the complete suite on the committed release before deployment.

All Go module tests and the full race suite passed (game package 504.523 seconds under race instrumentation). Dependency policy found zero active source advisories; the previously rejected advisory remains explicitly rejected. Go vulnerability analysis found zero called or imported-package vulnerabilities and retained one uncalled required-module finding.

Final lint, layout, synchronized Alpha 1.80.5 defaults and client preparation passed. Native System Chrome publication qualification passed four cases with zero retries: scene-profiler delivery, interrupted engine recovery, lazy login/four-class construction, and immutable/cached worker delivery. All 526 earlier patch-note entries remain byte-identical in the 527-entry cumulative history.

The layout gate accepts a clean temporary fixture and rejects loose files from package roots. All 17 content groups pass without rewriting outputs. All original asset/art payload hashes and 721 raw receipt hashes are unchanged; the three asset-directory guide edits are limited to current paths. Exact browser smoke coverage remains 583 cases.

This is local structural qualification, not production acceptance. The mandatory hosted server/browser, native predeployment, frontend/backend publication and live character/recovery gates remain in force. Record the exact successful run and public release identities in a separate acceptance receipt.
