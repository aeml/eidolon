# Rejected administration requests — durable outage recovery

Packaged locally as Alpha1.9.23 after accepted Alpha1.9.22;
**not pushed or deployed yet**. Login, package/lock, manifest, server defaults,
isolated QA and CI deployment labels are synchronized. Additive in-game notes
describe the actual recovery fix and retain all prior release entries.
277 focused version/history/runtime-versioning checks pass in4.005s; lint,
shell syntax and diff checks pass. Wait for the active earned Water run to end
before publication invokes native deployment browser work. Then use Luna for
the exact CI run and verify public identities and notes before accepting delivery.

The remaining administration audit review found that malformed mutations,
conflicting request IDs and failed role lookups wrote rejection events directly
to Mongo only. All three focused reproductions lost their audit during a store
outage, while correctly refusing character changes. Successful/valid-denial
operation journals and the accepted live panel are unaffected.

The rejection path now falls back to the existing private activity outbox when
the database append fails. It preserves the exact event ID, UTC time, expiry,
server-derived actor, bounded target/reason and sanitized summary. Existing
startup/runtime draining replays the same event. If both database and disk fail,
the response still reports activity storage unavailable and changes no character.
No schema, permissions, rates, rewards or public payloads were added.

The new three-case regression fails before the correction and passes after;
it reopens the real disk journal and checks exact replay with no duplicate on a
second drain. A separate dual-storage-failure regression checks the fail-closed
response and absence of grants/saves. Related mutation and session-journal tests
pass normally in2.395s; the final expanded focused race run passes in6.283s
(native70284 exit0). Formatting and diff checks pass.

This does not close the broader “every operation attempt” audit requirement:
transport admission rejection and unavailable-operation-store paths still need
their bounded-policy review. Do not mistake a working live panel for proof of
every failure branch. Batch this correction into the next appropriate release
with patch notes and synchronized identity; do not compete with the current
earned Water browser run or repeat accepted administration mutation matrices.
