# Rogue utility Mastery integration

Candidate starts at accepted primary0ebfac25 and merges componentad8bd5b3.
No conflicts occurred. Preserve Fighter owner/recipient, Fortress, Earthshaker,
Whirlwind, Death Spiral and Smoke gates while enrolling the Rogue utility route
once. This does not include the later utility Technique economy changes.

Component native1494 passed5.1m/5.2m0retries onab202a67 with normal paid
rank0/1/5 purchases, High/Low duration/expiry, fresh-login20ranks and selected
LastingShadow. Exact component CI34699201516 passed400/6311/131.29s,
game87.0%/106.880s/race341.201s and119actual browser checks. Full details and
retained earlier failures are in2026-09-12-rogue-utility-mastery.md.

Combined local tests6 suites/80 tests passed3.234s, including stage enrollment
and retained Fighter gates; full lint, shell syntax and diff checks passed.
Logs `/tmp/eidolon-rogue-verified-integration-{tests,lint}-20260912.log`.
Full combined CI is required before primary advances. No new combined native,
production deployment, full talent audit or1.1 acceptance is implied.

## Combined CI acceptance

CI34705692232 SUCCEEDED on0d79c485: client6336 tests/108.575s;
server game86.9%/100.135s, race349.671s; browser40+53+26=119actual checks.
Logs `/tmp/eidolon-rogue-verified-ci-{client,server,browser1,browser2,browser3}-34705692232.log`.
The frozen Mastery component native proof above is retained for this integration;
the dispatch's native/deployment jobs were skipped. This accepts the combined
development regression, not a release or universal timing/performance guarantee.

Separately, the later Technique candidate8fe4117b passed its new native profile
but its Mastery replay failed on a saved Smoke local-timer observation after
passing the wire-duration bounds. That failure remains open and is being
instrumented; do not credit this older combined CI as solving or covering it.
