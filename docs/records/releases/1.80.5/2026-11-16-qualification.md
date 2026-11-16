# Alpha 1.80.5 repository cleanup qualification

Baseline: selected merge `84f2f9b8f8757b8722c5c23935df428c08a6bc98`, followed by the accepted Alpha 1.80.4 publication repair `dd4ca9337d2d57d9b1a7c9c66ac76d8512e22245` and documentation acceptance `e45f2cbee`.

This milestone reorganizes the repository without selecting unfinished gameplay changes. The original dirty checkout was preserved; all implementation and validation used an owned detached worktree. Master synchronization and production acceptance are recorded separately.

## Structural preservation

- All 10,214 original tracked files have retained destinations: 470 Go files, 552 client/tooling files, 1,378 test/helper files and 1,500 documentation files were relocated.
- All tracked public asset/art payloads retain their baseline SHA-256 digests. Of 5,189 asset/art files checked, 5,185 are byte-identical; four Markdown guides update navigation or tooling paths.
- All 721 relocated JSON evidence receipts retain their original bytes.
- Executable AST comparison matches 564 of 565 client modules after normalizing import/path references. The remaining generated geometry catalog matches exactly after removing only its source/generator provenance, refreshed by real native-GPU generation. Geometry binaries retain their existing digests.
- All 2,781 Go test/benchmark declarations, 829 baseline Jest suites and 1,066 Playwright cases remain discoverable. The accepted publication repair adds one Jest suite, for 830 total. Browser case titles, projects, expected status and timeouts remain unchanged.
- Exact smoke discovery covers 583 cases with no omissions or duplicates.
- Local Markdown-link audit retains the same 186 preexisting broken links and introduces none. Historical receipts keep their source-time references; this cleanup does not claim to repair every older recorded link.

## Qualification

The full local coverage run exercised 830 suites / 12,890 tests: 829 suites and 12,889 tests passed. Its sole failure was a duplicated path in the documentation-only CI policy expectation after relocation. That expectation was corrected; the focused final release run passed all four suites / 420 cases, including the policy suite. No assertion, exclusion, retry or timeout was relaxed. Hosted CI must rerun the complete suite on the committed release before deployment.

All Go module tests and the full race suite passed (game package 504.523 seconds under race instrumentation). Dependency policy found zero active source advisories; the previously rejected advisory remains explicitly rejected. Go vulnerability analysis found zero called or imported-package vulnerabilities and retained one uncalled required-module finding.

Final lint, layout, synchronized Alpha 1.80.5 defaults and client preparation passed. Native System Chrome publication qualification passed four cases with zero retries: scene-profiler delivery, interrupted engine recovery, lazy login/four-class construction, and immutable/cached worker delivery. All 526 earlier patch-note entries remain byte-identical in the 527-entry cumulative history.

The layout gate accepts a clean temporary fixture and rejects loose files from package roots. All 17 content groups pass without rewriting outputs. All original asset/art payload hashes and 721 raw receipt hashes are unchanged; the four asset-directory guide edits are limited to current paths. Exact browser smoke coverage remains 583 cases.

This is local structural qualification, not production acceptance. The mandatory hosted server/browser, native predeployment, frontend/backend publication and live character/recovery gates remain in force. Record the exact successful run and public release identities in a separate acceptance receipt.

## First hosted candidate

[Initial run 43785385307](https://github.com/aeml/eidolon/actions/runs/43785385307) at `62a8ec84175e33026de9d88651b540ad8bd7336c` retained two failures in the static-delivery browser fixture: a computed URL still assumed its earlier directory depth. Deployment was blocked. The fixture now uses the repository-root path helper; all four static-delivery cases pass in native System Chrome with zero retries. An AST audit reviewed every computed `new URL(..., import.meta.url)` in tracked JavaScript and found no other unresolved relocation. No production code or test assertion changed in this correction.

## Historical rendering comparison correction

[Run 43786291574](https://github.com/aeml/eidolon/actions/runs/43786291574) at `c02c7542b27e7c35f8717e787dd94fa867cbc09a` passed all five hosted jobs: all three browser shards, all 830 Jest suites / 12,890 tests, and the full server gates. It was deliberately held during native QA before deployment when the broader audit found historical comparison routes outside default CI that still used the former source layout.

Eighteen QA files now use one reference-module helper. It reads the original module from its recorded Git tree and rebases only parsed import/export locations to the current source tree. Virtual comparison modules retain their original namespace; ambiguous filenames fail. Parsing is lazy and uses the already-declared ESLint development dependency. Default browser checks do not fetch historical source.

Qualification preserves the executable AST of 40 actual pinned modules. Native System Chrome import checks loaded all 40 dependency graphs and the two-module virtual Birch pair with zero retries. The helper's eight regression cases use a disposable local Git repository, so shallow CI checkouts need no old project commits. The focused tooling/release run passed 194 suites / 2,592 tests. Playwright discovery remains identical for all 1,066 original cases, with the same 583-case smoke partition. The added helper suite raises full Jest discovery to 831 suites / 12,898 cases. No production client/server code, assertion, exclusion, timeout or retry policy changes in this correction.

## Absolute documentation links

The final absolute-URL audit found three current-branch GitHub links in two Markdown guides that the relative-link scan did not cover. The generator links in the garment provenance guide and the licensing link in the Thai fork response now point to their current locations. Pinned commit URLs, asset payloads and raw receipts remain unchanged. [Run 43793627793](https://github.com/aeml/eidolon/actions/runs/43793627793) at `87ef3980118c990cb019e2391da86c5caf2e0dde` passed all five hosted jobs, including 831 suites / 12,898 client tests and 566 browser passes / 17 existing exclusions, before being held during native QA to include this documentation-only correction in the same unpublished release.

## Live Gold-accounting investigation

Run 43798222029 at `2fe572c065a3fdf55bf4658a0404fed08c2ce0e6` passed all hosted/native gates (831 client suites / 12,898 tests; 566 hosted browser passes / 17 existing exclusions; 187 native passes / two existing exclusions) and both deployments. Its live extended-character route retained an exact bag-sale Gold discrepancy of +12; seven other live cases passed and one existing exclusion remained. Town-recovery follow-up did not run after that failure. Public frontend/runtime/backend identity, readiness and coverage-publication checks match the deployed source. This release is not yet accepted.

The existing numeric Gold-provenance observer is being reused for one bounded, explicitly dispatched observation against that exact deployed source. The diagnostic workflow is restricted to trusted master code, pins both live identities before login, forwards every packet verbatim and retains hashed/numeric evidence. The unchanged exact assertion remains in force. The tooling-only diagnostic checkpoint holds automatic redeployment while evidence is collected; it is not a skipped or waived release gate. Final acceptance still requires the complete release/live gates to pass.

## Separate economy and combat phases

[Bounded diagnostic 43806724582](https://github.com/aeml/eidolon/actions/runs/43806724582) completed against the exact deployed `2fe572c` source. Its hashed/numeric observer retained all 913 observed events with zero dropped records or decode failures. It recorded a fresh wallet of 503,493 Gold, a single 1,500-Gold sale, an exact resulting balance of 504,993, and a separate +12 balance change about 2.2 seconds later during combat. An earlier retained room award independently credited its exact 175 Gold. This demonstrates that combat and the transaction observation can overlap; it does not retroactively explain every packet in the earlier uninstrumented failure or waive that failed gate.

The shared extended-gameplay route now prepares full bags before starting its ability encounter. If another earned delivery or real pickup fills that slot, ordinary Recall must complete before a second bag preparation. Recall cannot conceal death or a failed recovery. Exact wallet correlation, transaction arithmetic, room-reward identity and custody checks remain unchanged; unrelated credits still fail. The ordinary ability, real basic-attack kill, manual pickup, dungeon and fresh-login checks remain required. No game client/server behavior changes.

Four focused preparation cases verify that an available slot needs no action, transactions wait for completed town recovery, failed/dead recovery prevents transactions, and strict Gold failures remain failures. The preparation, exact-reward and bag-helper suites pass all 48 cases. With the trusted diagnostic guard suite, full Jest discovery is now 833 suites / 12,905 cases. Complete CI/CD and live release qualification remain required on the final source.

## Final accepted result

[Run 43807360210](https://github.com/aeml/eidolon/actions/runs/43807360210) at `981cba7249c0a7dea7d36829e555cf585875a0f4` passed all ten required CI/CD jobs. Client qualification passed 833 suites / 12,905 cases. Hosted browsers passed 566 cases with 17 existing exclusions and zero flaky results; native System Chrome passed 187 cases with two existing exclusions and zero retries. Server coverage, real Mongo/socket/recovery checks, race, benchmarks, builds and vulnerability gates passed. Both deployments succeeded. Live QA passed eight anonymous/persistent-character cases, two rest/travel/recovery cases and one live party-aura readability case, with one existing exclusion.

Two additional disposable native fixtures verified the new full-bag boundary both before combat and immediately after a real Wizard ability. Original packets were forwarded unchanged. Both observed Recall, a correlated wallet read, one exact three-Gold sale, retained inventory/equipment metadata and matching fresh-login/Mongo saves. Before combat the wallet was 1,000 and the result 1,003; after the real ability the wallet was 1,011 and the result 1,014. These isolated qualification fixtures are outside the release-suite counts. Initial temporary-harness attempts stopped before gameplay on an unstamped binary and a missing static-server working directory; those setup errors were corrected without changing any assertion, retry or deadline.

Public frontend manifest, login/runtime and backend identity match the accepted source and Alpha 1.80.5. Backend status is `ok`, MongoDB is `ready`, and the published client coverage files match the exact final CI artifact. Earlier checkpoint and failed-candidate observations above are retained as history. See [acceptance](2026-11-16-acceptance.md) and [public verification](2026-11-16-public-verification.md).
