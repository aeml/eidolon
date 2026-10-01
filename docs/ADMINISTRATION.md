# Administration

## Account role

Administrator access is an explicit durable account role in MongoDB. It is not represented by character level, equipment, QA access, or a client-side flag. Server-side authorization must query the durable role for every privileged operation.

The initial bootstrap allowlist is configured with `EIDOLON_ADMIN_BOOTSTRAP_USERNAMES` or `--admin-bootstrap-usernames`. It is exact and case-sensitive. The production Compose default contains only `donveetz`.

An allowlisted authenticated player can type `/relevel` in chat. The server consumes the command without publishing it, records the `admin` account role, and leaves character level and progression unchanged. Once granted, the durable role remains authoritative even if the account is later removed from the bootstrap list.

QA authorization is independent. `EIDOLON_QA_USERNAMES` does not grant administrator access, and the administrator role does not grant QA commands.

## In-game panel (available since Alpha 1.9.17)

Open the game menu and select **Administration**. The launcher appears only after
the server verifies the authenticated account's durable role; ordinary and
QA-only accounts cannot use it. A role lookup failure hides or disables access.

**Online players** lists authenticated accounts, names, classes and levels.
**Activity history** provides paginated login, resume, disconnect and administrator
activity, with account/action filters. These are structured records, not raw
server logs or private character dumps.

**Player reports** (Alpha 1.19) shows the existing in-game support queue.
Choose **Open**, **Resolved**, or **All reports**, then **Refresh reports**.
Expand **Inspect report JSON** to see the submitted record, including its ID,
author, type, text and status. Pages contain at most ten reports, newest IDs
first; **Next page** continues that filter and Refresh starts again.

Browsing is private and read-only: viewing does not resolve a report, delete it,
or punish a player. Each request rechecks the durable administrator role and
requires an audit entry; report bodies are not copied into activity history.
JSON is displayed as text, and the results clear on disconnect or lost access.
Redact usernames and personal details before sharing a reproduction publicly.
Use the existing operator report tool for resolution; see the
[operations handoff](BETA_OPERATIONS.md) for its migration and privacy cautions.

Local 1.59 preparation adds **Moderation Appeal** to the player's existing report
form. Players can include a notice/report reference and their explanation; it
enters this same private queue as an open report. Submission requests review,
not automatic sanction reversal, and reveals no staff notes or other reports.
Neither the appeal route nor the following review controls are deployed yet.

Local 1.59 preparation also adds **Review and resolve report** to each case.
Enter a private one-line reason, choose **Mark resolved** or **Reopen report**,
then confirm the displayed report ID and revision. **Keep unchanged** cancels
without sending a review. Resolving is a case-status decision, not a player
sanction, and does not grant items or modify an account. A changed case requires
a fresh read and a new decision; an old confirmation cannot overwrite it.

An uncertain reply offers **Retry same review**, preserving the exact request
and confirmed values. It never retries automatically. After a timeout or page
reload, reopen the case and inspect `lastReview` before deciding again. A
successful historical retry reports its original revision, not proof that a
later reviewer has left that status unchanged. Success refreshes the queue.

Status, revision and the private actor/time/reason receipt commit together on
the case. Activity history records admission as **Report review requests** and
explicitly directs staff to the case receipt for the outcome; it does not copy
allegations or private reasons. Rejected authenticated attempts are audited with
fixed descriptions. Failure to store the admission audit prevents the change.
Private receipts remain with their case and are bounded to 256 reviews; only
the latest receipt is exposed in report JSON. The existing report collection
has no automatic expiration; this work introduces no purge or new retention
policy. Staff coverage, final evidence retention and the initial sanction scope
still require owner decisions. See the [local review evidence](plans/2026-10-01-release1-59-moderation.md).

Under **Character operations**, select an exact account or **Use my account**:

- **Grant Gold:** positive whole amounts, up to100,000,000 per request.
- **Create item:** canonical equipment levels1–100, Common through Legendary,
  or supported materials. Inventory capacity and server-side quantity limits apply.
- **Teleport me to this player**, **Bring this player to me**, or **Send this
  character to town**. Characters must be online, alive and available; private
  instances, VIP access, occupied landings and gameplay-state restrictions remain.

Supply a reason, choose **Review change**, verify the exact target and values,
then **Confirm change**. Reviewing or cancelling does not submit a mutation.
The panel does not expose arbitrary coordinates, custom item stats or role grants.

## Authorization and recovery contract

Item creation, Gold grants, teleportation and audit viewing use dedicated bounded
WebSocket messages rather than free-form chat arguments. Every operation must:

- derive the actor from the authenticated connection;
- recheck the durable admin role;
- validate strict payload and value bounds;
- use an idempotent request ID;
- run under the target account's character-work lock;
- persist the resulting character before reporting success;
- write a structured audit record containing actor, target, action, request ID, timestamp, and result.

If the result is uncertain, use **Check / retry the same operation**. The retained
request ID and payload allow the server to recover or replay the original outcome
without a second grant or teleport. Do not create a replacement grant merely
because a response timed out. The UI retains this retry across an in-memory
reconnect, not across a browser reload; consult history before recreating a
request after losing the page.

Delivered follow-up (Alpha1.9.25): administration mutation
payload/rate violations end the offending connection.
For an authenticated account, its rejection is recorded without creating a new
operation; oversized bodies are not parsed into history. Reconnect and retry
the same request ID if its earlier outcome is uncertain. Closing the connection
bounds audit production from further buffered packets. Unauthenticated packets
cannot supply an actor identity and never reach character operations.

If both the history database and private activity journal are unavailable, the
server refuses the change, ends that connection and retains the rejection in the
existing in-memory recovery buffer. Health readiness fails and clean shutdown
waits until those events are journaled. This buffer is not crash-durable: forced
termination before storage recovers can lose these rejection/disconnect events.
It does not authorize a character change or report a successful operation.

History pages contain at most50 entries. Retention defaults to90days;
`EIDOLON_ADMIN_AUDIT_RETENTION_DAYS` accepts whole numbers7–365. Expired entries
are excluded from reads, with asynchronous database cleanup. Permanent operation
deduplication receipts are separate from browseable history retention.

Schema14 protects full-character operation receipts from older writers. Recovery
requires a compatible database, private journals and server image; do not remove
schema markers or run an older writer against a newer database.

## Safe live acceptance

Sign in with an existing administrator account and confirm that **Administration**,
**Online players**, **Activity history** and **Player reports** load. No production grants or teleports
are needed for this check. Authenticated disposable two-account mutation, replay,
restart and rendered checks are already recorded in the
[implementation evidence](plans/2026-09-19-administration-console.md) and
[verified Alpha1.9.17 release](plans/2026-09-19-release1-9-17-administration.md).
