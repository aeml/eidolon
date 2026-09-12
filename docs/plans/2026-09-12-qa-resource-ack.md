# Authoritative QA readiness resources

The QA-only readiness receiver invented HP/mana refills from cached client
maxima. After a maximum changed (for example Well Rested expiry), the dedicated
acknowledgement could restore a stale larger value until another state packet.
It also displayed full HP for the actual one-HP near-death preparation. This is
a reproducible test-setup defect; it is not yet proven to be the cause of the
earlier native Rogue185-vs27 mana mismatch.

The existing allowlisted server command now acknowledges its current HP/mana
and maxima under the entity read lock. The receiver applies those values only
when finite/nonnegative, without deriving a refill from old local stats. Missing
legacy fields leave resources untouched for the normal state stream. Cooldown
reset, sequence acknowledgement, allowlist, near-death preparation, persistent
effects, normal resource regeneration and Well Rested rules are unchanged.

Actual receiver regression first failed all4cases: stale1743max after server
1585max, real1/250/1000HP, and malformed/legacy payload. Corrected2suites13tests
passed0.892s including the existing Rogue observer contract. Server command and
real preparation race tests passed2.151s, checking the acknowledgement against
actual resource fields and retaining authorization checks. Changed-file lint,
gofmt and diff passed. Logs `/tmp/eidolon-qa-resource-ack-*-20260912.log`.

Full candidate CI and native Rogue readiness replay remain required before
integration. No normal player command gains resource grants. This belongs to
the1.1.0 release-verification work; no version bump or live release yet.
