# Accepted quest promises before balance activation

Status: isolated coordinated-progression candidate, not released. Catalog reward
amounts remain untuned; this is migration protection, not balance approval.

Database quest decoding now records the actual BSON presence of `reward_xp`
and `reward_gold` independently. Both fields have historically been saved
without `omitempty`, so an explicit zero remains a known quote. Older records
with XP but no gold retain their XP and can acquire the missing catalog gold.
Derived flags are neither client-controlled nor written as new BSON fields;
normal production snapshots continue writing both amounts.

Accepted/completed daily and Chronicle quests retain known quoted amounts,
positive kill requirements and the corresponding old objective wording.
Existing opening/collection compatibility rules remain. Ready quests stay
ready, completed receipts remain historical, unaccepted offers refresh, and
the existing daily reset still expires daily contracts normally. Acceptance
marks both current amounts as quoted even before the first save.

Three race repetitions **64515 PASS**: root 4.906s, database 1.052s, game
1.834s. Covers nested BSON absent/partial/zero field presence, catalog changes,
completed/accepted/unaccepted states, idempotence and old opening/collection
compatibility. Follow-up **3728 PASS**, three race repetitions: root 6.878s,
database 1.113s, game 6.922s. Production snapshot/BSON/login mapper/refresh/
manual claim/reload verifies an old ready eight-kill daily remains claimable,
zero-gold and zero/nonzero XP quotes survive, capped XP becomes exactly the
quoted Resonance, and a duplicate claim cannot pay again.

Logs: `/tmp/eidolon-quest-quotes-initial.log` and
`/tmp/eidolon-quest-quotes-roundtrip.log`. These are real production-function
and BSON tests, not a live Mongo login or an earned browser playthrough. Full
server regression and actual session/bridge validation remain required.

Full server race **55919 FAIL**, game395.928s; root24.722s/database1.093s
pass. The expanded-story tests find a real idempotence error: newly inserted
investigation offers acquired quote flags only on their second refresh. Both
live catalogs now initialize the flags before insertion. Existing unchanged
retrospective/all-legacy-milestone tests exercise the correction. Other failures
were exact pre-curve expectations: status deaths expected20XP rather than10,
a promised500XP opening expected136 remaining rather than75 after the new
100+125+200 thresholds, and old catalog repair expected accepted10-kill/1XP
terms to be overwritten with100-kill/50000XP terms. Expectations now enforce
the new budget/preservation contracts, not looser reward checks.

Three repeated race checks **66300 PASS** include every Chronicle test, daily
generation, status kill attribution and all quoted-reward/receipt migrations.
Log `/tmp/eidolon-coordinated-quotes-regression-fixed.log`. A full corrected
server rerun is still required; the failed full run is not a passing gate.
