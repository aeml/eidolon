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
