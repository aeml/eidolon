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

The bounded account reader now requires the exact approved case/owner/permission
revision, current owner password, and checks permission again before returning
data. Staff role alone is not an owner's password proof. Public owner delivery
and complete category coverage remain unimplemented: approval changes permission
metadata only and does not send an export. No deletion action exists.
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

The internal reader now supplies bounded profile and one-character gameplay
sections, using explicit DTOs reused from the prepared serializers. It verifies a
current password, matches its hash again during the data read, limits projected
Mongo input before driver decoding, caps output, and fails closed instead of
truncating a source. Profile input is capped16KiB, one character256KiB, response
512KiB, with a three-second query deadline and bcrypt cost cap14. A source that
exceeds its bound requires separately implemented paging/staff handling; it is
not reported complete. These internal helpers have **no public transport** and
do not supply full account coverage. Staff admission and case-local reversible
approval are implemented; complete category coverage and owner-bound public
delivery are still implementation work. The
request queue must not be described as a complete data-export facility.

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

Website analytics/provider policy review, full export coverage, delivery access
checks, coordinated-removal fixtures and qualified review where required remain
milestone gates. No beta/full-release readiness claim follows from this workflow.
