# Alpha 1.80.4 maintenance acceptance

Accepted on November 16, 2026 for source
`dd4ca9337d2d57d9b1a7c9c66ac76d8512e22245`.
[CI 43773226029](https://github.com/aeml/eidolon/actions/runs/43773226029)
passed all ten jobs, including both deployments and live character QA.

The release includes PRs [#21](https://github.com/aeml/eidolon/pull/21),
[#22](https://github.com/aeml/eidolon/pull/22),
[#23](https://github.com/aeml/eidolon/pull/23),
[#24](https://github.com/aeml/eidolon/pull/24), and
[#25](https://github.com/aeml/eidolon/pull/25). #24 merged before #25;
#25 was retargeted to master and qualified there before merging.

Replicated support effects and startup-worker ownership are separated into
focused modules, browser suite lists share one catalog, contributor navigation
is refreshed, and retained art sources live under art/source/. The art relocation
preserves published model payloads and URLs. Shared qualification fixes patch
active dependency findings, align Go on 1.27.4, and preserve effect/scenery
assertions under slow rendering. Alpha 1.80.3 was an unpublished candidate;
its maintenance changes are included in this release and cumulative notes.

Qualification:

- 830 Jest suites and 12,890 tests passed, with coverage and the dependency audit.
  The audit reported zero active source advisories and one exact CNA-rejected record.
- Server integration, ordinary module tests, race detection, backup/restore checks,
  benchmarks, module/vulnerability checks and build passed.
- All three hosted browser shards passed.
- Native System Chrome predeploy QA passed 187 cases with two existing exclusions.
- Live anonymous, persistent-character and recovery QA passed 11 cases with one
  existing exclusion. Existing full-stabilization admission remains unchanged.

Frontend publication now uses the complete HTML report emitted by the same
Jest coverage run. This avoids the genhtml category failure when reinterpreting
Istanbul branch data. Required artifact checks run before deployment. The fix
passed 421 focused checks; all 587 client-report files were preserved byte for
byte in the real-artifact publication check. The server report also rendered
successfully on Ubuntu 26.04 without warnings or ignored errors.

Normal-TLS public verification at 00:21 UTC confirmed the frontend manifest,
login version, runtime entry/import identity and backend all identify this source
and Alpha 1.80.4; backend status is ok and database is ready. Four live client
coverage resources match this run's artifact bytes, including the previously
failing source report; the server coverage index is healthy. The adjacent
[verification snapshot](2026-11-16-public-verification.md) retains the public
identity and resource hashes, without account data or credentials.

This is maintenance acceptance within the existing Alpha feature freeze.
The recorded beta, launch, physical-device and owner-assigned soak/stress gates
retain their prior status.
