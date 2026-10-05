# Alpha1.75 privacy handling — implementing, not released

Owner decision, October5: use administrator-reviewed account-data exports and
removal requests, preserve current retention settings, and add no automatic
deletion. This decision does not authorize individual account erasure, release
raw records, enable payments, or certify legal compliance.

## Request and review workflow

An authenticated player selects **Account Data Export** or **Account Removal
Request** in the private report form. Account help at character selection offers
both categories without world entry. The current session determines the owner;
there is no client-supplied target account. No automatic diagnostics, inventory,
chat, log or account dump is attached to a privacy request. The player reviews
their own text before Submit. Existing report text, payload and shared rate
limits apply. The draft remains until a correlated persisted acknowledgement;
timeouts do not automatically resubmit.

The owner can check the returned reference. The lookup is scoped to the
authenticated account and includes only category, status and timestamps, not
staff notes, case text or another account's details. **Resolved means case review
finished, not proof that data was delivered or removed.**

Administrators find the two categories under Administration → Reports. Existing
durable role verification, admission audit and confirmed revision-fenced review
apply. A review updates the case and private immutable receipt together. It can
be explicitly reopened; retrying the same quote does not apply another review.
An export case now also has a separate **Approve owner export / Revoke owner
export approval** control. It requires a reason and explicit confirmation and
fences both current case review and permission revisions. Its private durable
receipt is independent of case resolution. Permission starts disabled; exact
retries return their original decision without reinstating a subsequently revoked
grant. A changed review quote conflicts instead of granting against stale context.
Ordinary case review does not itself grant or revoke export permission. Revoking
prevents future admissions; it cannot recall data already delivered.

The bounded account reader requires the exact approved case/owner/permission
revision, current owner password, and checks permission again before returning
data. Staff role alone is not an owner's password proof. The unpublished branch
now provides authenticated owner delivery of profile, one-character gameplay,
paged owner-submitted reports, retained login/session history, current social
relationships, marketplace summaries, guild memberships/invitations and stored
PvP/weekly raid records. Complete category coverage remains unimplemented. Approval itself
changes permission metadata only; the owner must separately request a section
and click Save. No deletion action exists.
Do not put tokens,
passwords, identity documents or full account dumps in review reasons.

## Export preparation and delivery procedure

1. Bind the request to its authenticated account and confirm continued account
   ownership before preparation or delivery. A typed email, administrator role
   or knowledge of another account's name does not prove that account's ownership.
2. Record requested scope and review the source inventory. A profile-only
   snapshot is not a complete account-data export. State included, withheld and
   unavailable categories explicitly. Do not return partial results as complete.
3. Use bounded owner-scoped projections and explicit export types. Never marshal
   raw User/Character images or Mongo documents. Exclude hashes, token digests,
   credentials, provider secrets, private staff reasons, other players' personal
   details and private shared-operation payloads. Retained review receipts remain
   private. Shared transactions need an owner-facing summary, not a raw ledger.
4. Review redaction and ownership on every supported category and page. Set
   query, response, pagination and admission bounds. Avoid publicly accessible
   files, persistent browser catalogs and downloads that outlive the session.
5. Deliver only through a separately implemented and verified authenticated
   owner-bound channel. Do not invent a recipient from the submitted registration
   email or place the export in a public report response. Record delivery outcome
   and limitations privately without storing the exported data in general audit.

The internal reader supplies bounded profile and one-character gameplay
sections, using explicit DTOs. Profile now includes the name/class/level character
roster, recorded VIP periods and current stored owner-facing moderation notices
(including public reasons and whether each is active at read). It does not expose
private moderation receipts, staff reasons or provider/payment data. Recorded VIP
periods are not a derived claim about administrator VIP entitlements. Invalid
recorded membership/notice data fails instead of being silently reported absent.
It verifies a
current password, matches its hash again during the data read, limits projected
Mongo input before driver decoding, caps output, and fails closed instead of
truncating a source. Profile input is capped16KiB, one character256KiB, response
512KiB, with a three-second query deadline and bcrypt cost cap14. A source that
exceeds its bound requires separately implemented paging/staff handling; it is
not reported complete. These helpers do not supply full account coverage.

The owner download control first links to a fresh private account-support page,
using a non-secret query marker that the blocking bootstrap scrubs before the
analytics module starts. A fragment-only navigation would not unload an existing
analytics tag. An already tagged document offers no password/download form.
This guard does not protect against extensions or recording on the owner's device.
After signing in, the owner checks their own approved case, supplies their current
password and explicitly requests one section. The protocol accepts no target
account. Cross-connection per-account limits and shared credential-work slots
bound password verification. Fixed-content durable admission history contains
no password, exported contents or claim that a file was saved. Audit failure,
revoked/stale approval and replaced/closed sessions fail closed.

Report submissions use newest-first immutable-ID keyset pages of at most ten.
The owner can manually choose the next page after saving the current one, or
enter the cursor from their previously saved file. Each page repeats current
password and approval verification; no next-page read happens automatically.
Reports about the owner but submitted by someone else are not returned. Only
the owner's submitted text, reference, type, case status and timestamps are
projected. Private review/permission metadata is excluded before decoding.
Oversized projected rows emit a bounded failure sentinel, not a filter that
silently skips a submission. Cross-store reads recheck the current password hash
after reading; reset/removal or withdrawn approval cannot admit an old proof.
Pages are not a frozen point-in-time history: new submissions and status changes
may occur while downloading. This is not a source for personal data in staff notes.

Retained login/session exports use the same explicit ten-entry continuation and
credential/approval/session safeguards. They select only this account's login,
resume and disconnect events with no other target, matching the exact normalized
account key (including legacy hashed identities). They apply the current activity
retention cutoff, per-record expiry and read-time upper bound. Staff-only actions,
reason/summary/correlation and other accounts' history are excluded before
decoding; malformed/oversized selected sources fail the page. The file includes
the current retention days/cutoff and recorded connection start on disconnect if
available. Older missing starts are not backfilled. Connection duration is not
active or AFK gameplay. Pages follow immutable IDs, not event-time ordering, and
history may expire/change between reads. No retained record is modified.

Social pages include accepted friendships, sent/received pending requests and
the owner's own block/ignore choices. Incoming private block/ignore choices by
someone else are excluded, not disclosed as relationship statuses. Counterparts
are the existing public gameplay player IDs; no other account/profile lookup is
performed. Ownership uses the current server's account-scoped `player-username`
binding, not a client-provided character/player target. Deleted relationships
are not reconstructed. Oversized or malformed selected rows fail the page.

Marketplace pages cover current stored auctions where that account is seller,
current bidder, buyer or has a pending refund. They expose public listing/item
summary, price/time/status, owner participation and only the owner's refund
amounts and applicable deposit/claim information. Other participants' identifiers,
refunds, claim state and internal replay/custody payloads are excluded. Refunds
are owner-filtered before decoding. Full held-item stats/appearance/socket data,
cleared historical bids/refunds and unpublished economic operations still require
separate handling; these summaries are not a full escrow/operation export or a
restore image. No export changes the listed items, funds, claims or relationships.
Both use the same ten-entry manual continuation, proof/approval/session fences,
three-second deadline and failure sentinels. No category gets a client target.

Guild membership exports select only that player's current membership and guild
identity/name/tag. Own rank/join/last-online fields are owner-scoped before
decoding; missing last-online timestamps are not invented. Other members' account
or status data, bank contents, audit/events and operation state are excluded.
Duplicate/malformed own memberships fail instead of selecting an arbitrary one.
Invitation exports contain only active sent/received invitations involving the
owner, with direction, public counterpart ID, guild identity and timestamps.
Existing invite expiry applies, without reconstructing deleted/expired records.

Competitive exports read stored own rating/counters, owner-facing last result,
season history and day/deserter-until queue state with explicit output DTOs. They
exclude private match/revision identities and opponent anti-abuse counts. The
read does not call profile hydration/season settlement: missing records stay
missing and oversized histories require staff handling, not silent truncation.
Weekly raid pages show own week, completion time and stored delivery-pending
flag, excluding worker retry schedules, other players and private cohort/reward
payloads. Existing absent legacy pending flags remain false; no rewards are
granted or settled. These are current stored records, not full reward/operation
ledgers or immutable account archives. All four retain the same bounded manual
paging, credential/approval/session fences and non-mutating read behavior.

Every profile, gameplay and report file includes a coverage manifest naming its
included fields, omitted sections, withheld private/security data and categories
requiring separate handling. Unsupported categories are not assumed absent and
`complete_account_export` remains false. No provider/local/archive retrieval is
claimed. Sources with oversized data still require operator handling.

One bounded section is prepared in memory; **Save section locally** is a second
deliberate click using a short-lived object URL. Close, disconnect, replacement
or timeout discards pending work/proof; there is no automatic retry/download or
browser storage catalog. The application cannot verify that the browser actually
saved the file. Full category coverage and paging for remaining stores remain
work. Neither this control nor the request queue is a complete
account-export facility. See the [delivery checks](2026-10-05-release1-75-delivery-checks.json).
See also [report-page and manifest checks](2026-10-05-release1-75-report-page-checks.json).
See [account and session checks](2026-10-05-release1-75-account-session-checks.json).
See [social and marketplace checks](2026-10-05-release1-75-social-market-checks.json).
See [guild and competitive/raid checks](2026-10-05-release1-75-guild-reward-checks.json).

## Removal review procedure — no automatic deletion

1. Verify the request owner and exact scope. Obtain separate explicit approval
   for any irreversible action; submitting this case is not that approval.
2. Reconcile characters, auctions and held items/refunds, direct trades, shared
   guild ownership/bank custody, casino settlements and pending rewards. Resolve
   or safely transfer shared obligations without deleting another player's data.
3. Preserve financial/outcome deduplication identities needed to prevent replay,
   duplicate credits or lost delivery. Review journals and admitted save work;
   deleting a user document alone is not coordinated removal.
4. Classify retained case/audit records and provider copies using existing
   settings. Explain what remains and why without promising immediate physical
   erasure. No new TTL, purge schedule or retention extension is approved here.
5. Before implementing removal, add a controlled removal record and restore
   procedure that reapplies authorized removals before recovered archives serve
   players. Fence old writers and journals so an old save cannot resurrect a
   removed account. Verify on disposable fixtures, never real-player archives.
6. Do not mark a case fulfilled unless separately authorized work and its outcome
   have actually been verified. A review can record deferral or a follow-up
   requirement without claiming erasure.

Coordinated removal and anti-resurrection handling remain implementation and
verification work. No removal command, worker or scheduled purge is enabled.

## Current retention and data notice

The [source inventory](2026-10-05-release1-75-data-inventory.json) covers all19
registered Mongo collections plus browser state, RAM chat/session state,
save journals, logs, backups, analytics, QA artifacts and recovery-email delivery.
Source descriptions are not a production/provider access audit.

Accounts and private reports have no generic deletion TTL. Activity history keeps
its existing default90days and configured7–365-day bounds; Mongo expiry is
asynchronous and operational replay identities have separate durability needs.
Recovery challenge validity is not physical erasure. Logs, archives and provider
copies follow existing configurations; no new deletion deadline is promised.
The optional playtest timer remains local until explicitly shared; that is
separate from existing website analytics and recovery messages sent via Postmark.

The unpublished player-facing notice is available before sign-in, in Settings
and Account help/Report Bug / Feature. All three surfaces share source-backed
text and keep a short script-independent fallback. Native collapsed details,
44px summary/link targets, wrapping and visible keyboard focus preserve the
existing menus. Mounting reads no storage or account state and sends no data;
it adds neither a consent gate nor an analytics/provider setting. A clean private
support link reloads the document before suppressing the analytics tag.

The notice distinguishes request/review from export permission, section files
from a complete account export, connection duration from active play, expiry from
erasure and case resolution from authorized removal. It discloses existing
Google Analytics/Postmark and out-of-band archives/provider/mailbox copies,
without claiming legal certification or provider cleanup. Focused automated UI
and boot regressions pass; actual-device/live notice acceptance is not claimed.
See [notice checks](2026-10-05-release1-75-notice-checks.json).

Website analytics/provider policy review, full export coverage, delivery access
checks, coordinated-removal fixtures and qualified review where required remain
milestone gates. No beta/full-release readiness claim follows from this workflow.
