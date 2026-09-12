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

Full candidate CI34710643517 on e7b907ce PASSED: client403suites6332tests
in133.2seconds, server tests/race (game292.718seconds) and all three browser
shards. Manual native/deployment jobs were skipped, not counted as passes.
Logs `/tmp/eidolon-qa-resource-ack-ci-{client,server}-34710643517.log`.

Native50451 on the same frozen commit PASSED3.8minutes, zero retries: the real
Rogue utility Technique route exercised normal purchases, High/Low, saved rune
training and strict paid-resource/cooldown checks. Archive
`/tmp/eidolon-qa-resource-ack-pass-KniFfg`, native log
`/tmp/eidolon-qa-resource-ack-native-20260912.log`. Credential scan sanitized0;
owned containers/image and all three ports were verified clear after termination.
The prior185-vs27 mismatch still has no demonstrated causal explanation; this
passing replay does not erase its retained failure evidence.

Ready for integration, followed by combined regression. No normal player command
gains resource grants. This belongs to the1.1.0 release-verification work; no
version bump or live release yet.
