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

Combined CI34696773008 on92afea0a SUCCEEDED:402suites6309tests115.96s,
game86.9%/101.572s, race354.803s and browser40+53+26=119actual checks.
Logs `/tmp/eidolon-fighter-verified-ci-{client,server,browser1,browser2,browser3}-34696773008.log`.
Native/deployment jobs were skipped, as expected for the development dispatch.
This combined candidate is accepted for primary integration using that full
regression run and the frozen component native evidence above. No full1.1
or production acceptance is implied.

## Owner/recipient gate integration — next candidate

Primary and integrated advanced to da4a07cc after the above acceptance; their
trees exactly matched docs-only d960a7c3. Candidate now additionally merges
Fighter buff proof13edc4ec (native sourcebe3dc413). Corrected component
CI34696956771 SUCCEEDED:398suites6277tests129.273s, game86.9%/98.373s,
race346.035s and browser119actual checks. Native72952 success and its
owner/untrained-Cleric/saved/High-Low/expiry scope remain in the buff document.

Merge conflicts were restricted to the allowlist and parallel full-stage command/
name lists. Preserve all entries in order: existing Whirlwind, Earthshaker area,
Whirlwind area, Fighter buff mastery, then phone. Initial combined tests failed
two old immediate-adjacency expectations (2fail93pass5.036s). Both now require
the complete expanded sequence, retaining every previous stage. Corrected
7suites95tests passed2.401s; full lint/shell/diff passed. Logs:
`/tmp/eidolon-fighter-verified-buff-integration-{tests,final,lint-final}-20260912.log`.
No runtime changes in this added gate merge. Its new combined full CI remains
required before primary advances again; prior component successes do not imply
that this new combined commit has passed.
