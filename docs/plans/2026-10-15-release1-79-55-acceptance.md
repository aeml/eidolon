# Alpha 1.79.55 acceptance

Runtime source: `1c936dfc609160f5dfade1618c4e6e0f0657b69e`.
[CI38680587219](https://github.com/aeml/eidolon/actions/runs/38680587219)
completed successfully: all ten ordered jobs passed, including both deployments.
The milestone delivers the searchable earned Lore Book, direct quest tracking
navigation and clearer manual NPC quest review.
[Preparation](2026-10-15-release1-79-55-preparation.json).

Validation:777 client suites/11838 tests;399 hosted browser passes/13 skips/no
reported flakes;64 native predeploy passes/one skip, with no retries; eight live
main passes/one skip and two town-recovery/Well Rested passes. Four optional
workflow steps remain skipped. No soak or capacity qualification is claimed.
The focused feature evidence now includes228 distinct checks after the additional
session-teardown regression, and13 distinct native UI cases.

Normal-TLS public verification at **2026-10-15 05:06:14 UTC** matches both
Alpha1.79.55 identities and the exact runtime source, ready database, analytics
module and **all227 pinned public asset bytes/SHA-256**. The copied publication
contains4146files/502bundled modules; the immutable worker remains
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.
All489 previous patch notes remain byte-exact within490 cumulative entries.

Raw evidence is retained under
`/home/aeml/.local/share/eidolon-master-20261011/.qa-release55`.
The combined CLI log omits slash-named browser jobs; the three direct API job
logs retain their complete results. The earlier missed isolated-QA version
default and stale town-fixture label are retained with their corrections.
This acceptance closes this milestone's publication gates. Shared-menu polish,
durable window preferences/reset, the18-look garment catalog, world/art,
performance, devices, operations, owner decisions and beta/release gates remain
open. Soak stays deferred.

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `.qa-release55/final-ci.json` | 13636 | `6a30fdc03db929627a4afca87680d80fdb46df4da3cacf0c8d01c0104bb06228` |
| `.qa-release55/final-public.json` | 79816 | `98e596ad5234c4d134c3ad75b7817a9552c1ef1fe42fd98b6e0f277594c6c378` |
| `.qa-release55/expected-public55-assets.json` | 43411 | `c10887eaf6f47c24a6eb7aa967aeda118ba835caabd8befa45d6e6612327590c` |
| `.qa-release55/build-summary.json` | 5357 | `272c568be569c46d881a96d88073dd977794dd2f9f6641083f6fdd88366660ad` |
| `.qa-release55/all-jobs.log` | 12362944 | `1e5a5cf7a7806c4f409103d0597383e45c289802a76ccd36cf86e11ddae64fe0` |
| `.qa-release55/browser-1.log` | 78056 | `7f97d5b43a1f94e3cba2c891d833c35a5141f6d638a5633a1316106caddf1d44` |
| `.qa-release55/browser-2.log` | 92215 | `f731cf4a60e0d452c0bb5f8e026ab0091de173d8ab31853ecf8e40a48a13c4fc` |
| `.qa-release55/browser-3.log` | 92971 | `5b510f0e26bb6b4176f4caeab32cd486f8ed41c6af9d266ceb1dbed87a5aa817` |
| `.qa-release55/final-job-summaries.json` | 1057 | `02c9b77facdd4821788ca01396dbb2c484e19f17803ebbceb491d7942e7b20dd` |
