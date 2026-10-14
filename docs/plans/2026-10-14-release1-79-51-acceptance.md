# Alpha 1.79.51 — verified class-feature milestone

Accepted October 14, 2026 at 2026-10-14T06:27:30.920474+00:00.
Runtime source: `e2880b4ee7a1d460f98595c8efe478e6655580e0`. Frontend and backend both report
**Alpha 1.79.51**; the database is ready.
[CI38517044265](https://github.com/aeml/eidolon/actions/runs/38517044265)
completed successfully with all ten ordered jobs passing, including both
deployments and live character/recovery QA. No workflow rerun was needed for
this source.

## Delivered scope

The four class passes add 96 missing rune choices. All 52 learned skills now
have three optional runes, for 156 choices across twelve specializations.
The release also repairs paid and delayed effects, offline parity, support
protection/healing, summons and long skill messages at phone viewport edges.
Existing skill identifiers, single-branch rules, accounts, saves, progression
and public alpha access are retained.

Twelve release version surfaces are synchronized. The 486 cumulative patch-note
entries preserve all 485 previously published entries byte-exact, across 48 history
pages. The private 1.79.52 preparation was consolidated before publication.

See the [class-by-class review](2026-09-28-class-kit-rework.md#october-14-implementation-checkpoint)
and [preparation, scoped receipts and retained failures](2026-10-14-release1-79-51.json).
Those preparation receipts retain their dated state; this acceptance supersedes
their pending deployment labels only within their recorded implementation scope.

## Validation

| Gate | Result |
| --- | --- |
| Client | 769 suites / 11,760 tests; lint, 14 content groups, dependency audit and hot-path benchmark pass |
| Server | Full tests, race detector, disposable persistence/recovery/backup checks, benchmark and build pass |
| Hosted browsers | 385 passes / 13 skips / 0 flakes across three successful shards |
| Native predeployment | 62 passes / 1 skip / 0 flakes; includes all three mandatory High class-effects cases (45.5s) |
| Deployment | Server SSH and GitHub Pages jobs pass |
| Live QA | Eight main cases pass /one skip; two recovery cases and one Well Rested party case pass; no reported flakes |
| Independent public read | Normal TLS; exact frontend/backend identities, ready database, all 199 pinned asset byte lengths/SHA-256 and valid analytics JavaScript match |

Hosted High Wizard/Rogue/Cleric effects are routed to the mandatory native GPU
step on trusted publishing runs. All paid casts, damage, gameplay lifetimes,
cleanup assertions and original native deadlines remain unchanged. Low and
non-release software coverage retain their route. The 13 hosted skips are not
counted as passes. Four optional workflow stages remain skipped: exhaustive
animation gallery, broader Well Rested GPU lifecycle, full disposable character
route, and live four-class/remote-animation route. Their broader scope is not
claimed by this release.

## Retained failures and limits

The initial 51 candidate failed before deployment on stale combo/reflection
fixtures and a High software-rendering retirement timeout. The combined c5
candidate then failed an unrealistic PvP healing fixture and Cleric High
software retirement. Corrections and the native routing qualification remain
in the preparation receipt; intermediate queued candidates were superseded or
cancelled before deployment. Production stayed on accepted 50 until this source
passed the predeployment gates.

The first independent public read matched 197 assets and both identities, but two
requests returned HTTP 408/503. Subsequent targeted reads matched both expected
files exactly. One fresh complete read at the acceptance time above matched all
199assets. Both the failed read and diagnosis are retained; this does not prove
a universal network/provider cause or certify future availability.

Human class feel/balance, campaign pacing, physical-phone playtests, final
world/equipment/audio presentation, representative performance, operations and
the full original freeze/beta/release gates remain open. Raised terrain remains
disabled. Soak/stress qualification remains owner-deferred until features are
nearly complete; automatic scheduling is disabled and prior capacity failures
remain recorded. No feature freeze, closed beta or full release is declared.

[Current remaining work](2026-10-09-release-readiness-remaining.md).

## Evidence custody

Retained locally in `/home/aeml/.local/share/eidolon-cleric-completion-20261014/.qa-completion`. Frozen 11-file acceptance inventory SHA-256:
`6a4ddc58985d726284a4a0eced80720b0cdd2596e518c4939df8963dd9cbfad0`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `final-ci.json` | 22166 | `cfe08db42b8fa97339ef9cfa2b46cfb3dc90a6f45c99916d3863436f96128319` |
| `final-public.json` | 70611 | `515fd50af68391fb9134971e14a4e2f4e2f1e1ad209927417292d7127993f4cf` |
| `expected-public51-assets.json` | 38826 | `5e891c96ea4b6a804369ae218a15bc99568b4dec8f796cefd692d4f806c66105` |
| `build-summary.json` | 5369 | `27ed66bdb6069e95bdb17f5fc8b225816202d9d7913a0bb23c72032206a18d2b` |
| `final-client.log` | 1161168 | `45dafe033fc49ad9625a206615619965c7c7953f8d20e9dc0dbaa665a66443f6` |
| `final-server.log` | 7197256 | `32545e6dacfe465cc3fd33cf30e13c5715094fe547ab45fd325dcf493f3488a1` |
| `final-predeploy.log` | 51927 | `90fc3bdb6d2f9765a1c403fa001f671be4e444dc0284a7b90bda26a8317a686c` |
| `final-live.log` | 218891 | `5993e14ea24127f99365fb269c03ffba0cc0b15ddf32ae49c3f317da93201d39` |
| `final-browser-counts.json` | 51 | `bbe0014e67e622160af6fd4fdd322b7d02062439d9f3b208bbfe976dd1572975` |
| `first-public-check.json` | 70320 | `1d5c14c9f4d9129972e956a3075abac149be0bed9f1e70fdccb62667ec3a0a71` |
| `public-http-diagnosis.json` | 787 | `81fc857d0430f6df196ea98d022d7362a5140287f29723f27b1e903540f5ca46` |
