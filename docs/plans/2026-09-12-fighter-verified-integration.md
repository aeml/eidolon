# Verified Fighter changes — combined candidate, not yet accepted

Base064704cb retains accepted Death Spiral and Smoke Bomb fixes. This candidate
merges Fighter area branch46ad3bb5 and Fortress status branch3a303173 without
conflicts. The full QA route retains both area stages and existing Rogue stages;
the runtime addition is the verified Fortress status descriptor/extraction.

Area source6263f4e8: full CI34695174069 succeeded (400suites6289tests101.773s,
game86.9%/98.772s, race342.566s, browser40+53+26=119actual checks). Earthshaker
native63410 passed1.1m; Whirlwind72405 passed55.2s/56.8s total, both zero retries.
Purchased ranks, saved runes, high/low geometry, actual effect lifecycle and
screenshots are retained in the source evidence document and native archives
`/tmp/eidolon-earthshaker-current-pass-FiKJSJ` and
`/tmp/eidolon-whirlwind-current-pass-eYKlcR`. Both scans/owned cleanups passed.

Fortress source3a303173: corrected full CI34694694526 succeeded (394suites6249
tests128.314s, game86.9%/89.109s, race275.593s, browser119actual checks).
Native59562 passed2.2m test/2.3m total, zero retries: normal purchases and rank0
30s/rank5 36s, saved Extended54s, High/Low effects, visible status, natural expiry
and independent Well Rested retention. Archive
`/tmp/eidolon-fortress-native-pass-eQlXjG`; scan/owned cleanup passed. Previous
runtime badge failure and covered launcher test failure remain recorded.

Combined local9suites146tests passed3.609s, full lint/assets/shell/diff checks
passed. Logs `/tmp/eidolon-fighter-verified-integration-{tests,lint,assets}-20260912.log`.
Combined full CI is still required before moving primary. Native evidence above
is from the frozen component candidates, not a new combined native run.
No master push, version bump, production deployment or broad milestone closure.
