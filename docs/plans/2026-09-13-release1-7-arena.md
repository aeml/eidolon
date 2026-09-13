# Alpha 1.7.0 — a competitive arena

Separate worktree based on prepared1.6 commit564487ae. Runtime stays1.6 until
1.7 packaging. This stage does not authorize skipping1.5 or1.6 live delivery.

## Required scope

- Refine actual team-elimination2v2, with clear practice versus ranked queues.
- Rating-aware matchmaking with understandable widening search windows, honest
  queue status, and cancellation/reconnect handling. No fabricated opponents.
- Explicit combat normalization policy visible before entry. Preserve builds and
  ownership, restore real PvE state on exit, and avoid hidden stat scaling.
- Clear team results, rating changes and seasonal rewards with durable, idempotent
  reward settlement. Defend against repeated-opponent farming, intentional losses
  and disconnect/rejoin abuse without punishing innocent teammates as exploiters.
- Package with cumulative notes and synchronized login version, publish and verify
  the exact live release. No invented completed matches or reward receipts.

## Implementation checkpoint — September 13, 03:43 UTC

04:08 durable-results batch: ranked profiles carry monotonic revisions and stable
match IDs. Mongo conditional upserts reject conflicting same-revision writes and
ignore old/replayed snapshots without overwriting newer outcomes. Hydration cannot
replace newer local revisions; ranked entry is refused if DB profiles are missing
or still behind a recorded result. Quarter reset retains revision and earned Honor.

Before applying ranked profiles or returning participants, the game synchronously
records a frozen, checksummed receipt in `<character-journal-dir>/arena-results`.
Atomic temporary write/fsync/rename/directory-sync,0600 files and hashed filenames
protect immutable receipts. This hook performs only filesystem IO, never Mongo
under gameplay locks. Record failure keeps the completed match reserved with a
visible Saving state; a five-second retry uses the identical decided outcome.
Practice/ties with no ranked rewards do not create receipts.

Normal persistence applies every receipt profile via revision checks, then removes
only that receipt. Mongo failure retains the journal and reports syncing instead
of an unverified reward. A five-second retry and pre-login startup replay recover
partial team writes; corruption or unrecoverable receipts block stale logins.
Schema10 marker blocks old schema9 unconditional PvP writers from destroying those
revisions. No backfill is needed. Once1.7 migrates production, rollback requires a
schema10-compatible server; NEVER delete the marker or pending receipts to force
an older binary to start. No production schema change has been made yet.

Focused actual Mongo tests PASS1.086s: reverse/concurrent revisions, duplicate
replay, conflicting same-revision rejection, partial two-player commit replay.
Journal reopen/detachment,0600/path/checksum/conflict/ack checks PASS. Frozen disk-
failure retry and stale hydration checks PASS0.070s. MainPvP/scene/lifecycle
PASS0.211s; focused gamearena/duel/zero-rating PASS13.473s; UI7PASS3.445s including
save-pending feedback; build-trimpath-all and diff checks PASS. Dedicated Mongo
`eidolon-isolated-qa-mongo-arena171309` (mongo7.0.14, loopback32913) is now STOPPED,
data retained for later focused tests. Explicit test URI env is
EIDOLON_ARENA_TEST_MONGO_URI; do not point those tests at production.

Still required: replace flat+25/-20 with rated-result calculations; anti-farming,
intentional-loss/disconnect safeguards; explicit personal/team result presentation;
earned seasonal rewards/history. Review direct-duel queued/shared-party admission,
entry HP/MP restoration (current PvP return still fills both), and round-status
cleanup. Current persistence work does not close those requirements or prove a
full live season/restart matrix. Runtime remains1.6 until1.7 packaging.

Publishing:1.5d8323180 now verified at BOTH public endpoints,Alpha1.5.0 and exact
commit; backenddatabase ready. CI34735541628 has passed all build/browser/predeploy
and deploy jobs, with finalLiveRelease/CharacterQA stillrunning04:05. Await its
terminal result before pushing frozen1.6; no1.6production claim yet.

First arena batch implemented locally. Existing1v1/2v2 modes now carry an explicit
practice flag through protocol, queue, match, result and UI. Practice2v2 retains
actual two-player teams and first-to-two elimination, without ranked profile
changes or a deserter penalty for leaving practice. Ranked defaults preserve old
client requests. Separate practice buttons do not mix into rated queues.

Rated matching prefers the oldest eligible team and its nearest compatible
average team rating: initial±100, +50 per30s, cap±500, BOTH teams must allow the gap.
Incompatible queue heads no longer block other teams. A once-per-second queue tick
can start a match without another join and sends the explicit arena scene via
OnPvPMatchStart. Actor availability is observed before taking PvP.mu; dead/offline/
instanced/changed-party entries are pruned. Same-party1v1 entries cannot match
allies who cannot damage each other. Match IDs include a sequence for same-tick
admission. Cancelling either party member removes the whole queued team.

UI shows practice/ranked, elapsed wait, team rating and actual search window,
polling only an open queued window every5s. It explicitly describes the existing
gear/level/build-sensitive policy,65% damage scalar and35% maximum-health hit cap;
no new hidden stat normalization. A tied timeout now cancels without rating or
rewards instead of arbitrarily awarding teamA. Existing decisive timeout wins stay.

Focused existing gamePvP/duel/arena checks PASS13.356s; new deterministic queue/
practice/revalidation/tie cases PASS0.045s; mainPvP/scene/lifecycle checks PASS0.102s;
sixUI cases inclpractice and polling cancellation PASS0.746s; changed JS lint PASS.
No broad matrix, live matches, season completion or earned PvP rewards claimed.

The original persistence risks found here are addressed by the later04:08 batch
above. Rated calculations, anti-farming, seasonal rewards and admission review
remain open; practice/queue implementation alone is not release completion.

## Initial inspection guidance

Inspect existing server PvP queue/match/rating/reward authority and its current UI,
protocol, persistence and focused tests before extending them. Existing behavior,
not older planning claims, determines missing functionality. Reuse present systems;
do not create a parallel arena framework or speculative abstractions.

Use focused changed-path checks, essential currency/save/progression safeguards,
relevant builds and release smoke. Full real-player season/integration/endurance
matrices remain consolidated final stabilization after all features, not repeated
at every patch. Keep reports short and feature-focused.

## Publishing dependency at creation

1.5 correctiond83231809994317aac31dcf1c901ae5e22791e2d is pushed;
CI34735541628 currently running. Verify1.5 exact client/server live identities,
then push prepared1.6 HEAD564487ae from its worktree and verify that deployment.
Do not push this branch while those milestones remain unpublished/unverified.
