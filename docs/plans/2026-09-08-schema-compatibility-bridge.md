# Schema compatibility bridge — candidate, not released

Based on canonical queued55/9f92f985e6857edcdb99863b99d823af9196b4af.
Worktree `/tmp/eidolon-schema-compatibility-bridge-ehsEZY`, branch
`work/schema-compatibility-bridge-20260908`. Runtimef2238ce506c4961fbd8cc117b706a885ba45dc0f.
No new release version is assigned yet; metadata remains55.

## Purpose and behavior

The current55 server knows database schema7. It previously ran known migrations
and then admitted players even when newer migration records were present. Its
full-character writer cannot retain future resource snapshots/receipt fields.

Before any migration/index write, this bridge reads the highest stored schema
version and refuses a newer version. Read errors, invalid negative versions and
decode errors fail closed. Empty/known schemas retain normal migration behavior.
The existing server startup propagates this error and exits before constructing
the world or opening admission. The standalone migration command uses the same
database constructor. The error instructs operators to deploy a compatible
binary, never to edit the migration records to bypass protection.

This is a startup compatibility fence, NOT a distributed writer lease. The
supported deployment remains one authoritative server; stop the prior writer
before starting a format-changing release. It does not retroactively protect
unmodified55 or older binaries and does not make them supported rollback targets.

## Verification — September 8, 21:04 UTC

Focused45306 PASS1.056s, final72751 PASS1.029s. Actual52120 CLOSED PASS0/1.903s,
exact race-builtf2238ce binary, disposable owned loopback Mongo. Prepared future
schema8 and a raw character containing zero mana, gold1209, listing receipt-25
and an unknown future field. Two database-open attempts and TWO actual server
processes refused before admission. Raw character BSON stayed byte-for-byte
identical; no collections or migration indexes were added. After removing ONLY
the test's prepared marker, normal fresh migration to7 and repeated migration
succeeded. This fixture manipulation is not a production downgrade procedure.

Exact owned Mongo `eidolon-schema-bridge-proof-20260908-2103` and volumes removed
by EXIT cleanup; container independently absent. Log
`/tmp/eidolon-schema-bridge-actual.log`; binary
`/tmp/eidolon-schema-bridge-proof-1ZQbf4/f2238ce506c4961fbd8cc117b706a885ba45dc0f`.
Full race17140 remains ACTIVE, `/tmp/eidolon-schema-bridge-full-race.log`.

## Remaining release gates

1. Close full race verification, assign the next ordered patch after55, update
   all version/login/patch-note metadata and verify the normal release checks.
2. Deploy and independently verify the bridge before publishing the resource/
   auction persistence candidate. Do not skip intervening49–55 release gates.
3. Carry this fence into the schema8 resource candidate. Exercise the actual
   bridge → resource candidate → refused bridge → compatible recovery sequence
   against preserved characters, resources, receipts, operations and journal.
4. Document/enforce supported deployment targets so unguarded55 or older are not
   used after the format boundary; preserve backups and require roll-forward
   recovery when the bridge deliberately refuses a future schema.

The bridge's narrow refusal proof does not close the entire rollback, resource,
raid, phone or1.1–1.10 roadmap acceptance scope.
