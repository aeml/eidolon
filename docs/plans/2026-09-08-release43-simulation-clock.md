# Release 43 — verify the summon against its simulation clock

CI **34174381235**, source **f955608**, fails anonymous browser smoke:
**61 pass / one fails / 8.2m**, including the expiry test's retry. All deployment
and live jobs are skipped. The public release remains verified 42/bfbbc87.
Failure log: `/tmp/eidolon-release43-ci-failed.log`.

The prepared offline component scene admits at most 50ms of simulation per
rendered frame, but the test assumed its trained 16.5-second lifetime must expire
within 22 seconds of wall-clock polling. Runtime `updateOfflineSeraph` decrements
the admitted `dt`, not the observer's wall clock. No evidence here establishes a
multiplayer expiry bug; authoritative paid casts/lifetimes have separate coverage.

Observational **72586ae** adds an 8fps component-rendering case and records time
delivered through real chunk updates. **69010 FAIL / 27.6s** reproduces the old
assertion: **25.880s wall / 9.700s admitted / 6.800s remaining**, summon active,
seven genuine smites. No duration, damage, expiry or disposal state is forced.
Log `/tmp/eidolon-release43-timing-before.log`.

QA-only **c3264c3** allows up to 90 wall seconds for slow rendering but asserts
the actual expiry boundary: positive remaining time before the final update,
no more than that update's `dt` remaining, nonpositive remainder afterward, and
total admitted lifetime within one update of 16.5 seconds. Ownership, chunk
membership and mesh attachment must all be removed. The slow case must really
take more than twice its simulated lifetime in wall time. The production summon,
game clock, server, patch notes and version are unchanged.

**88992 PASS / four / 1.2m**: native expiry **16.5161 simulated / 16.5017 wall**
seconds; 8fps expiry **16.5000 simulated / 43.8697 wall** seconds. Both retain
real damage/attribution/mana checks; disconnected-floor and following/instance-
departure cases also pass. Log `/tmp/eidolon-release43-timing-after.log`.
Lint/diff pass. Full client **34919 PASS / 213 suites / 3,166 tests / 76.949s**,
log `/tmp/eidolon-release43-timing-client.log`. All these owned handles are closed.
Server code is unchanged from the failed CI's successful server job.

Republish a normal descendant as corrected 43; keep every older candidate ref.
Propagate this test correction through the queued 44–50 descendants. Do not
publish 44 until every corrected-43 job and fresh exact public identity pass.
This correction does not complete the roadmap, balancing or investigation gates.
