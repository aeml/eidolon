# Beta operations handoff — draft, not a beta announcement

Prepared for Alpha1.19. Owner-approved direction is near-completion closed beta,
not beta at1.20. Current public Alpha access, labels and saves remain unchanged.
This document does not authorize a wipe, invite restriction, production restore,
payment integration or new infrastructure purchase.

## Approved direction and decisions still required before transition

| Decision | Current safe state |
| --- | --- |
| Existing alpha accounts, new invitations and cohort date | Retain existing accounts; invite new beta players only once the game is nearly complete.1.90 is the planned readiness review, not an automatic opening. |
| Character continuity | Preserve existing characters/progress; no wipe. |
| Cohort/concurrency target and hosting budget | Up to100 beta players planned. Concurrent capacity/headroom must be measured; budget remains unapproved. |
| Support/moderation channel and coverage | In-game reports, with JSON viewable in-game by admins. Staff coverage and response-time commitments remain unassigned. |
| Report retention, backup retention and recovery objectives | Await explicit decisions. Existing technical defaults are not a published policy. |
| Beta channel label and announcement | Keep open Alpha until the near-completion CB go/no-go. |

## Player reports and private triage

Players can open **Report Bug / Feature** in the game menu, select Bug Report,
Feature Request or Player Report, then submit up to4000 characters. Confirmation
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

## Voluntary progression feedback (1.21 candidate)

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
