# Beta operations handoff — draft, not a beta announcement

October8 optional public-monitor preparation: startup-only HTTPS login-page,
release-manifest and public-API checks are implemented, bounded and race-tested.
A read-only four-GET check observes matching current1.79.8 public identities.
The installed service remains local-only; no production flags, mail recipients,
retention, DNS or service settings changed. This is not browser execution,
off-machine/whole-host coverage or1.83 acceptance. See
[operator controls](../server/cmd/monitor/README.md) and
[exact scope](plans/2026-10-08-public-monitor-checks.json).

Prepared for Alpha1.19. Owner-approved direction is near-completion closed beta,
not beta at1.20. Current public Alpha access, labels and saves remain unchanged.
This document does not authorize a wipe, invite restriction, production restore,
payment integration or new infrastructure purchase.

## Approved direction and decisions still required before transition

| Decision | Current safe state |
| --- | --- |
| Existing alpha accounts, new invitations and cohort date | Retain existing accounts; invite new beta players only once the game is nearly complete.1.90 is the planned readiness review, not an automatic opening. |
| Character continuity | Preserve existing characters/progress; no wipe. |
| Cohort/concurrency target and hosting budget | Up to100 beta players planned. Owner approved existing self-hosting/Postmark and no new paid service on October6. Concurrent capacity/headroom still must be measured; no numeric spending ceiling or service guarantee inferred. |
| Support/moderation channel and coverage | In-game reports, with JSON viewable in-game by admins. Staff coverage and response-time commitments remain unassigned. |
| Report retention, backup retention and recovery objectives | Await explicit decisions. Existing technical defaults are not a published policy. |
| Beta channel label and announcement | Keep open Alpha until the near-completion CB go/no-go. |

The owner approved existing `ADMIN_NOTIFICATION_EMAILS` recipients as outage
owners with30s health probes,3 failures,2 recoveries and30m reminders. The single
labelled Postmark test reached its inbox. Ordered1.78 CI/deployment and actual
independent monitor/public acceptance remain pending; approved settings are not
proof of installed or off-machine coverage. Staffing/response commitments and
the eventual beta transition remain separate decisions.

## Live 1.71 password change and emailed recovery

The accepted release permits a current-password-proved change only for its authenticated
connection's account, with the same new-password limits as registration and
shared per-account/concurrency bounds. Its conditional Mongo update replaces
only the observed password hash. Success rotates the resume token; uncertain
database acknowledgement disables resume until another login rather than
promising rollback or replaying credentials. Login/resume handoffs are serialized
with the change. [Backend checks](plans/2026-10-02-release1-71-password-checks.json)
include actual disposable-Mongo data preservation and fresh-process sockets.
The form appears in authenticated **Account help** before world entry
and in online **Settings** (phone: **Device**). It requires the current password,
preserves spaces/case, and clears fields on submission, closure, category change
or disconnect. It never automatically retries an uncertain change. Closing a
form does not cancel a submitted request. Its current transport consumes token
rotation independently of the form, including a late world-entry handoff or
blocked browser storage. [UI checks](plans/2026-10-02-release1-71-password-ui-checks.json)
use scoped mocked browser sockets; the earlier backend receipt records actual
disposable Mongo/fresh-process proof separately.
The owner chose **emailed recovery links via Postmark** on October 4. The
database/provider helpers require password proof and a separate mailbox
verification before an address can recover an account; registration email alone
does not prove ownership. Challenges store only token digests, expire, and are
consumed by a conditional credential update. Password changes also invalidate
outstanding recovery/verification challenges. No roles, characters, Gold or EP
are replaced. Provider requests use a fixed HTTPS endpoint, finite timeout,
no redirects and no tracking or administrator copies. Configure
`POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL` and `POSTMARK_MESSAGE_STREAM` only
in the server environment, using a verified Postmark sender and transactional
stream. `ADMIN_NOTIFICATION_EMAILS` is not a recovery recipient list.
The protocol supports password-proved setup, anonymous verification
and reset, generic asynchronous recovery requests, bounded/shared admission and
session invalidation only after proved credential mutation. Two bounded mail
workers join shutdown; reset notifications contain no password. Partial mail
delivery is not retried automatically or represented as guaranteed inbox delivery.
Login/settings UI and the pre-analytics private-link handoff are integrated in
the accepted1.71.0 release. Three native browser/bootstrap checks and a real
disposable-Mongo/socket test verify the bounded explicit-action flow, including
link durability across restart and old-session revocation. The browser sockets
are mocked; the separate connected proof uses real game processes and a local
TLS Postmark stand-in. Neither proves actual inbox delivery. Exact-source CI37182320668
and post-terminal independent public checks accepted4bc0b95c as Alpha1.71.0.
Runtime mail configuration is present; the owner must still verify an address
and confirm actual inbox delivery. [Public acceptance](plans/2026-10-04-release1-71-public-acceptance.json)
records exact identity and skipped visual/full-gameplay scopes. The successor
Alpha1.71.1 also passed all ten CI jobs in run37190290208; post-terminal public
checks matched1b6f44d2 on both services and the recovery runtime files. Its
[public acceptance](plans/2026-10-04-release1-71-1-public-acceptance.json)
records the narrow mystery-equipment safeguard and all four mail settings present
without exposing values. Schema17 remains; this is not the later durable-purchase
handler, actual inbox delivery proof or a beta announcement.
See [prepared email checks](plans/2026-10-04-release1-71-email-recovery-checks.json).
Administrators gain no arbitrary reset, ownership or password-reading action.

## Direct-trade escrow-edit hotfix

Accepted1.70.1 plans offer edits before mutating live items or Gold. Keeping
an offered item needs no empty slot; swaps free the new offer's slot first.
Removing escrow with no room is rejected rather than silently spilling it during
an edit. Cancel retains its existing single-return overflow behavior. Ambiguous
existing item IDs are preserved and rejected, not automatically deleted.
[Scoped checks](plans/2026-10-02-release1-70-1-trade-checks.json) distinguish this
offer-edit fix from the still-open crash-durable two-account settlement work
at1.73. Do not infer historical duplicate counts or purge inventories from it.
All ten exact-source CI jobs and independent public identity/readiness checks
passed for fa414f0b/run37068064995. This hotfix is live; full1.73 is not.

## Player reports and private triage

Players can open **Report Bug / Feature** in the game menu, select Bug Report,
Feature Request or Player Report, then type up to3200 characters; the server caps
the complete text, including optional context, at4000 characters. Confirmation
and a report ID follow successful server persistence; a failed submission is not
a queued ticket. A Player Report does not automatically punish its subject.
Include the displayed version, approximate time, realm and reproduction steps.
Do not include passwords, session tokens or payment details.

The operator queue is `server/cmd/reports`, backed by Mongo's `reports` collection.
Use only a compatible trusted checkout and an explicitly configured database.
Its `list` action defaults to open reports, oldest first, with100 results; `resolve`
changes an exact open report ID. Output includes usernames and report text: keep
it private and redact before sharing a reproduction in a public issue. Resolving
a report changes its status; it does not delete it or apply moderation.

Important: this CLI calls `database.New`, which runs schema migrations at startup.
Even `list` is therefore **not a purely read-only database connection**. Do not
run a newer/unreviewed checkout merely to view reports on production. The current
report indexes do not implement automatic report expiry. In-game reporting is
the chosen channel; staff coverage and a retention policy remain unassigned.

The accepted1.19 release adds **Administration → Player reports** with open,
resolved and all-status filters,10-report cursor pages and expandable JSON.
Reads use the existing server
database connection, recheck the durable admin role and require an audit entry;
they do not resolve reports or publish their bodies into activity history.
JSON is rendered as text, not HTML, and private results clear on reconnect or
access loss. The existing CLI remains an operator fallback, not the primary
player-support destination. [Administration](ADMINISTRATION.md) also provides
online players and activity history. Its durable role checks remain separate
from QA authorization. Existing audit retention defaults to90days, configurable
within7–365days; that does not set report or backup retention. Grants/teleports
are not needed for routine health/report acceptance.

## Voluntary progression feedback (1.21–1.40 implementation)

Help offers a default-off, page-local playtest timer. Players label their activity
and outside assistance; the summary distinguishes idle, hidden, disconnected and
suspended/unobserved time. Its initial/latest levels and first observed level30
crossing are not proof of a complete new-character journey. Closed-page time is
not measured. A sixty-second input-idle heuristic can also classify unattended
combat as idle; do not treat it as authoritative encounter telemetry.

Nothing is stored on disk or sent by the timer. Players may stop, inspect, and
explicitly append a bounded summary to a report draft, then separately submit it.
That report has the same authenticated identity, private admin review and
retention rules as other submitted reports. Clearing the local timer does not
delete copies the player already placed in drafts or submitted. No automatic
recruitment, identity/input/chat recording, grants or balance adjustment occurs.

The1.39 implementation adds a known class label, active time by level band and
party roster size. Interval attribution uses the previous observed context;
roster size is not evidence that those members fought together. The timer does
not collect party member identities. The1.40 Help guide puts pacing/Forge goals
and useful report context alongside current platform/population limits.

For a useful first-hour/level30 sample, ask for start/end levels, active versus
idle/offline time, assistance, and the principal point of confusion. Compare
fresh journeys separately from existing or helped characters. Record sample
limits before evaluating the2–3-hour target; do not extrapolate one timer test
into the full100-hour campaign. The owner assigned human pacing to playtesting.

## Release verification

For each published version, retain the exact commit, mandatory CI/live-QA result,
frontend `release.json`, backend `/healthz`, login version and cumulative notes.
Verify the deployed assets changed by that release. A green upload alone does
not prove both endpoints serve the same build or that character QA passed.
Keep deployments serialized and preserve the previously accepted release.

IPv4 verification is explicit. The owner deferred the IPv6/DDNS issue; do not
describe it as fixed or treat an IPv4 pass as all-network acceptance. Distinguish
a DNS/connectivity failure from an unhealthy database or mismatched release.
Keep incident evidence free of credentials, raw authentication payloads and
private reports. Do not create compensating Gold/item grants based solely on an
uncertain response; use the existing operation-history/retry safeguards.

## Recovery boundaries

Follow the [Linux deployment/recovery guide](../server/deploy/README_LINUX.md).
The upgrade backup helper stops the API and saves Mongo, private journals/logs
and the previous image together. It is not a harmless read-only status check.
Integrity markers and checksums do not prove a successful restoration or approve
loss of post-snapshot progress.

The legacy Mongo-only restore helper requires an exact archive and explicit
data-loss confirmation. It refuses active/ambiguous Compose API state and limits
restoration to Eidolon, but it is not a global writer lock or a full recovery.
Stop external writers too, serialize operations, preserve the original backup
and restore a compatible journal/database/server set under explicit approval.
A failed `--drop` restore may already have removed data. Do not remove volumes,
journals or schema markers to force an older server to start. Use isolated
storage for rehearsal; never aim a test restore at production.

## Evidence limits and next acceptance

The [device matrix](art/2026-09-28-beta-device-matrix.md) separates measured Linux
Chrome workloads from phone-sized emulation and untested devices. Those render
results do not establish concurrent-player capacity. Choose the cohort target,
then use a bounded representative multiplayer workload to establish headroom.
Do not repeat the112-hour campaign to obtain an operations number.

The1.19 report viewer and scoped deployment checks are accepted; see its
[release record](plans/2026-09-28-release1-19.md). Do not activate invitations now. Before CB, finish
all mandatory game/art work and resolve staffing, retention, recovery and capacity
evidence; implement the approved transition server-side with save protection.
Human
campaign pacing and actual-phone dungeon/party feedback remain user-playtest
owned; no acceptance is inferred from their deferral.

## Prepared 1.72 connection-pressure controls — not live yet

The candidate aligns the bounded WebSocket envelope (33KiB) with its largest
declared payload (32KiB for reports). Unicode/JSON-escaped reports no longer hit
the former8KiB transport ceiling before their per-message validation. Report text
still caps at4000 characters server-side and3200 in the UI; authentication,
message-specific caps/rates,256KiB byte burst and64KiB/s sustained allowance are
unchanged. [Envelope checks](plans/2026-10-02-release1-72-envelope-checks.json)
cover real socket reading/validation and retained fragmentation/flood rejection,
not database persistence, casino wager execution or public acceptance.

The security candidate adds `-http-max-connections` (default1024, range1–8192).
It caps accepted HTTP/TLS transports, including hijacked WebSockets, before
creating their HTTP connection workers. Saturation waits in the kernel backlog;
it does not evict an existing player or return an application-level503.
Use a value above your chosen `-ws-max-connections` cap (default512) to leave
ordinary HTTP headroom. The separate WebSocket gate can return503 after HTTP
admission. These are protection limits, not measured player capacity.
The WebSocket reservation also covers reader/writer termination, exactly-once cleanup
and connection-owned saves/presence work. A closed TCP socket may therefore
continue to consume a slot while that work drains; overload still returns503
with a retry hint. This prevents repeated reconnects from accumulating retired
connection cohorts outside the gate. It is not a global completion-worker cap.
[Work-lease checks](plans/2026-10-02-release1-72-work-lease-checks.json) record
actual small-pool reconnect and focused race evidence, not live acceptance.
Login/resume replacement closes now share that ownership tracking too: at most
one brief notification/close task per old connection, outside the global session
mutex. Sealed worker admission closes the stale socket immediately without an
untracked fallback. [Replacement-close checks](plans/2026-10-02-release1-72-replacement-close-checks.json)
cover a real socket with a controlled close barrier and duplicate observers,
not a new connected-binary credential acceptance run.
The [writer ownership follow-up](plans/2026-10-02-release1-72-writer-lease-checks.json)
adds the outgoing writer to the base reservation. Its slot is released only after
the writer's queue loop and socket cleanup finish, alongside the reader,
retirement and owned child tasks. The regression failed on the previous source
and passes with the actual writer held at a controlled socket-close barrier.
This is an admission-lifetime guarantee, not a guarantee that shutdown awaits
every writer through the separate background completion group.

Weekly raid completion and periodic retry also share one recovery worker in the
candidate. It discovers recorded live completions even after socket disconnect,
then uses the existing character journal, entitlement and grant receipts.
Failure retains work for a later request/tick; saturation or shutdown rejection
does not acknowledge an earned reward. The initial completion is still in memory
until its journal write succeeds. [Weekly reward checks](plans/2026-10-02-release1-72-weekly-sync-checks.json)
cover burst/retry/expiry handling with isolated journals and simulated database
writes, not a connected raid clear, overall outbox-size bound or capacity proof.

Arena result recovery reads bounded journal batches and commits at most32
receipts per ordinary pass. A remaining backlog keeps profile hydration/ranked
admission pending; periodic recovery retries. Startup drains healthy backlogs in
bounded batches before logins, and still refuses real storage/replay failures.
[Arena backlog checks](plans/2026-10-02-release1-72-arena-batch-checks.json)
include actual disposable-Mongo newer-before-older replay. These limits do not
bound all IO time. The [arena result admission limit](plans/2026-10-02-release1-72-arena-capacity-checks.json)
now caps one live journal owner's new pending result files at4096. At capacity,
already-recorded identical retries remain valid and newly unrecorded settlements
stay frozen until space is freed. Opening the journal reconstructs its count;
existing over-limit backlogs remain readable, not trimmed. This is not a physical
disk quota or multiple-writer coordination. Pause writers before manipulating
the volume and restart to recount after restore; monitor other journals, crash
temporary files and database/storage growth separately. No result is crash durable
before its first journal write succeeds.
The [guild-clear capture layer](plans/2026-10-02-release1-72-guild-clear-capture-checks.json)
now retains original completion time/season and the server-owned identities of
unique reward recipients; repeat repair clears count without advancing a story
quest. It is not a transactional proof of database membership at the exact kill time.
The [guild-clear replay layer](plans/2026-10-02-release1-72-guild-clear-replay-checks.json)
records qualifying clear receipts under `save-journal-dir/guild-clears` before
requesting one shared consumer. Replay processes at most8 receipts/5 guild groups
each per pass; partial commits and acknowledgement failures retain the immutable
receipt. Startup retries one batch, then periodic recovery; lagging leaderboards
do not block character logins. Corruption stays for operator review, not deletion.
The staged1.71 predecessor carries reader-only directory compatibility and must
be accepted before1.72 creates this folder. Do not use1.70 as a direct rollback
target for that newer journal layout. Preserve the private outbox in the durable
volume/backup. Before a successful local write, the clear is not crash durable;
write failure is explicitly reported. Overall disk growth and operator repair/
retention remain separate from this bounded decoder/consumer.

The candidate also bounds ordinary headers, body reads, writes and idle
keepalives, and upgrade-handshake writes. Active game sockets retain their own
Pong/fragment deadlines. [Connection-pool checks](plans/2026-10-02-release1-72-http-connection-checks.json)
and [HTTP deadline checks](plans/2026-10-02-release1-72-http-bound-checks.json)
name the shortened/small-pool fixtures and remaining upstream/worker limits.
Do not assume these flags or protections exist in an earlier deployed binary.
