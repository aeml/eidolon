# Alpha 1.79.53 — returning sessions and world preparation

Accepted October 15, 2026. Runtime source:
`99eefb64d78d55c46d6c4a2cbfb023d7ccc7079d`.
[CI38667006513](https://github.com/aeml/eidolon/actions/runs/38667006513)
completed successfully with all ten jobs passing, including both deployments,
live gameplay, town recovery and two-player Well Rested checks.

Normal-TLS public verification at **02:34:11 UTC** matches both frontend/backend
identities, Alpha 1.79.53, a ready database and all **213** pinned public asset
byte lengths/SHA-256. The analytics module is valid JavaScript. Verification
preceded the final live checks; the accepted source remained unchanged.

## Delivered scope

Returning phone and desktop sessions select current input policy and restore
shared menus, settings and touch controls on teardown, including failed world
loading. [Session qualification](2026-10-15-session-layout-qualification.json).
World preparation preserves twelve exact High/Low maps while bounding first-build
town work and retaining at most 4,915,200 cached CPU bytes for returning sessions.
[World preparation](2026-10-15-world-raster-preparation.json).
Twelve release surfaces are synchronized; 488 cumulative notes preserve the
487 preceding entries across 48 history pages.

| Gate | Result |
| --- | --- |
| Client | 772 suites / 11,793 tests; lint, 14 content groups, dependency audit and benchmark pass |
| Server | Full tests, race detector, persistence/recovery/backup checks, benchmark and build pass |
| Hosted browsers | 394 passes / 13 skips / no reported flakes across three successful shards |
| Native predeployment | 62 passes / one skip / no retries |
| Live QA | Eight main passes / one skip; two recovery cases and one two-player Well Rested case pass |
| Independent public read | Exact identities, ready database and all 213 pins match over normal TLS |

Four optional workflow stages remain skipped; they are not claimed as passed.
Native High class effects retain their original lifetimes and observation limits.
No soak/stress test was started; that qualification remains owner-deferred.

## Retained candidate failures

The first candidate stopped before deployment on stale teardown/phone fixtures.
The second stopped on a High software-rendering Magma expiry observation timeout;
its trace ultimately observed expiry after the 15-second polling deadline.
The correction gives only software rendering a 90-second observation allowance,
retaining the native 15-second limit and exact three-second gameplay expiry.
Both software and native focused cases passed without retries. The final workflow
also passed without a rerun. These are fixture corrections, not changed gameplay
lifetimes or waived rendering assertions.
[Fixture findings](2026-10-15-release1-79-53-browser-fixtures.json),
[timing evidence](2026-10-15-release1-79-53-magma-timing.json).

Final world/actor/audio quality, human class feel, representative performance,
physical devices, operations and the original freeze/beta/release gates remain
open. Raised terrain stays disabled. [Remaining work](2026-10-09-release-readiness-remaining.md).

## Evidence custody

Retained in `/home/aeml/.local/share/eidolon-world-preparation-20261015/.qa-release53`.
The job summary includes byte lengths and hashes for all ten directly downloaded
job logs. Prior candidate/build manifests, failed browser traces and focused
corrections remain alongside the final evidence.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `final-ci.json` | 13611 | `2503da34f734b0db4a5a39576bcbde06a88a273619f675624e551fc895a68b82` |
| `final-public.json` | 75189 | `0ee9775e57f08f19797da5653ad8ecc711a0e2435ab8f9dd373cfcc9da2d2127` |
| `expected-public53-assets.json` | 41099 | `e72e61e3c8fcc22c6f9d69fc42469348ddc273045ed97a60b8536b61fb4b6ab4` |
| `build-summary.json` | 5368 | `04782a79cdfba1dd4a5d84c0276fb8974476ade9874020789eeeee76db4fc572` |
| `final-job-summaries.json` | 3469 | `11db8817f963360071192f51eb1052ef7c5bc37e436da534ae2df19fa80f6511` |
