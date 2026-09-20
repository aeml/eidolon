# Rejected administration requests — durable outage recovery

Verified live: Alpha1.9.23 at1eb18f5910999bd19e2824c34f05693f1cecc85f.
Luna reports CI35494967147 passed at07:14:35UTC; the Water launch guard records
matching public client/server identities, readiness and cumulative notes.
The follow-up below is in pending1.9.24, not yet live. Login, package/lock, manifest, server defaults,
isolated QA and CI deployment labels are synchronized. Additive in-game notes
describe the actual recovery fix and retain all prior release entries.
277 focused version/history/runtime-versioning checks pass in4.005s; lint,
shell syntax and diff checks pass. The earned Water continuation has now passed
and its owned services are gone, clearing native browser work for publication.
The guarded Water-region launcher at
`/tmp/eidolon-water-region-20260920-D2U8te/` passed that exact CI/public check
and is now running. Do not infer later releases' delivery from a push alone.

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

Follow-up, local only (not part of the running1.9.23 publication): a failed
`GetAdminOperation` now records a sanitized error attempt through the same
activity/outbox path. The original receipt remains untouched and the response
keeps its correlated pending/non-final status: a lookup outage cannot prove
that an earlier operation did not run. The focused outage reproduction failed
before this change and passes afterward, including exact journal reopen/replay.
New-request and already-applied-request recovery checks both grant/save/complete
exactly once after retry. Related mutation tests pass in0.989s; the focused race
run passes in2.615s. Formatting and diff checks pass. Batch into the next release
with an additive patch-note entry; do not supersede the queued Water run.

The same local follow-up now covers missing role/operation services, pending
admin/casino/trading recovery, character persistence/planning failures and
failed or ambiguous intent preparation. These use the existing outbox and
sanitized error summaries, retaining pending/non-final replies and original
receipts. Thirteen outage cases exercise exact disk reopen/replay, including a
prepare that inserted before returning an error. Related mutation/replay tests
pass under the race detector in6.141s. No new schema or logging subsystem.
Next-release patch-note text: “Administration history now records requests
deferred by character, trading, casino or operation-storage recovery, without
duplicating grants when the same request is retried.” This is not live yet.

This does not close the broader “every operation attempt” audit requirement:
transport admission rejection and completely unavailable activity storage still
need their bounded-policy review. Do not mistake a working live panel for proof of
every failure branch. Batch this correction into the next appropriate release
with patch notes and synchronized identity; do not compete with the current
earned Water browser run or repeat accepted administration mutation matrices.
