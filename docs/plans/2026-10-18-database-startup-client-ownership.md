# Failed database startup releases its client

This local component is based on corrected82
`48cf3c079c3e118c6aceaf6e9507ce6bd5f9a293`. It resolves the explicit resource
lifetime review item in the
[startup-budget qualification](2026-10-18-database-startup-budget-qualification.md).
It is isolated pending integration and publication after82acceptance. No new
release version, production request or deployment claim is made.

After mongo.Connect succeeds, New owns its client until the fully migrated DB
is returned. Previously a failed Ping returned without disconnecting it. The
new real-Mongo fixture reproduces that error with a refused ping and observes
three remaining connections belonging to that exact constructor application.
It queries active and idle server connections by a unique appName using Mongo's
[$currentOp stage](https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/currentOp/).
The same fixture proves a real migration-command refusal already disconnects,
and that successful New leaves a usable client open until DB.Close. The latter
is a positive control for connection observation, preventing an empty observer
from falsely certifying cleanup.

The constructor now defers error cleanup immediately after Connect, with a
separate five-second cleanup context. Only successful migration transfers
ownership to DB; failed Ping and failed migrations share the same release path.
The old unbounded migration-error Disconnect is removed. Original error values,
ten-second connection and45second migration work budgets, schema27, migration
order, saved data and successful DB.Close behavior remain. Error cleanup can
add up to five seconds; successful connection/schema work remains bounded by
the existing55seconds. This is not a whole-service recovery-time guarantee.

The unchanged-runtime negative run has one failed ownership subcase: three
connections remain after a ping refusal. Its migration refusal and successful
handoff/Close controls pass, as do both existing startup-budget tests. The
race-enabled Go package selection exits1 in26.403seconds. The corrected actual
CI wrapper passes all three top-level startup tests and all three ownership
subcases, exits0 in26.398seconds and preserves the original delayed real-command
checks. The connection-deadline case still passes its9–11second constructor
assertion. The ordinary CI wrapper already selects this new TestDBStartup case;
no workflow expansion or assertion relaxation is needed. Formatting/whitespace
checks pass.

Both runs use fresh fault-enabled Mongo7.0.14, one CPU/512MiB, exclusively on
owned loopback port18314. Both containers/volumes are removed; the port is no
longer bound. This is bounded error-path qualification, not a load/soak test.
Raw original/corrected wrapper logs and original/qualified source snapshots are
retained in
`/home/aeml/.local/share/eidolon-db-client-ownership-20261018/.qa-db-client-ownership`.

Its integrated source still needs the selected milestone's full server/CI,
deployment and public acceptance. Original movement-audio/native failures,
final art/campaign/device/performance/operations/owner requirements and the full
F1–F5/beta/1.99scope remain open. Soak and stress testing remain deferred.
