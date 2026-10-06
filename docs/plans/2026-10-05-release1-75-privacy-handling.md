# Alpha1.75.0 privacy handling — publication candidate, not live acceptance

Owner decision, October5: use administrator-reviewed account-data exports and
removal requests, preserve current retention settings, and add no automatic
deletion. This decision does not authorize individual account erasure, release
raw records, enable payments, or certify legal compliance.

The publication candidate implements that reviewed-request policy, nineteen
bounded manual owner sections and supporting notices/approval/dependency review.
Physical erasure and complete account archives are not enabled or claimed.
Additional custody/writer/archive fences described below are prerequisites for
any future individually authorized erasure, not permission to perform it during
release. Native UI and isolated schema22 ->23 checks pass; publication and exact
live acceptance remain pending. See
[upgrade checks](2026-10-06-release1-75-upgrade-checks.json).

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
are owner-filtered before decoding. Gameplay item stats/socket fields are available
in the separate `market-items` section described below. Cleared historical
bids/refunds and other economic operations still require separate handling;
these summaries are not a full escrow/operation export or a
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

### Direct-trade and guild-bank operation sections

Approved owners can now manually prepare/save `trades` and `bank` pages. These
collections use immutable hashed string IDs, not ObjectIDs. The 64-character
lowercase hex cursor is a navigation reference scoped by the server-selected
section prefix and owner filter, not an encrypted secret or authority. Binary
keyset ordering handles equal timestamps without offsets or chronological claims.
Current proof, case approval/revision, session and response-size checks remain
mandatory for every read. At most ten entries plus one validated continuation
candidate are read; malformed/oversized rows fail the entire page, not silently
disappear. Projected sources are bounded before driver decoding at272KiB/trade
and72KiB/bank; response512KiB and three-second deadlines remain unchanged.

Trades include the owner's character/offered Gold and explicit gameplay item
fields, stored settlement/cancellation/state/time and agreed incoming offers
only for settlement. Cancellation does not decode/expose the peer's offer.
Peer account/character/revision, fingerprints, raw trade IDs and arbitrary item
recovery/forge payload fields are not exported. Guild-bank pages show only the
owner's character/guild/action, Gold or explicit item fields and recorded state;
other members/transfers, bank contents, private request IDs/revisions and replay
plans stay excluded. Shared private fields are projected out before decoding.

Pending/complete/rejected state describes the durable intent/coordinator record,
not independent confirmation that each participant or guild/character effect was
applied. Reads never execute recovery, settlement, refunds or item transfer.
The source custody validator's accepted legacy empty offer is retained as zero,
not rewritten or silently discarded. These files are not restore images.

Focused race/UI and actual disposable Mongo tests cover10/2 pages for12 rows per
section sharing the same timestamp, own gameplay item fields, cancelled-peer
redaction, binary cursor ordering, reset/revoke/source-size fences and unchanged
whole-source checksums. See
[operation checks](2026-10-05-release1-75-operation-checks.json). Marketplace
held-item coverage is extended below. Other economic/casino operations and
coordinated removal remain open; supported sections are not a complete account export.

### Frozen recipient rewards and marketplace gameplay items

`rooms` and `bosses` provide owner-scoped pages of retained original room/boss
outcomes, using the same binary hashed-ID navigation as trades/bank. The server
filters/maps participants before decoding and includes only the owner's recorded
Gold, XP and explicit gameplay item fields. Room files include type/hook/objective
and recorded shrine health/mana recovery; boss files include boss type and own
incremental quest kill credits. Public dungeon type/difficulty/level/room index,
creation time and coordinator state are included. Other recipients, shared drops,
instance/boss/replay identities, private fingerprints and guild clear projections
are not exposed. Duplicate own recipients/quest/item identities, invalid types,
payload limits and oversized projections fail the whole page.

Room sources are bounded at144KiB and boss sources at576KiB before driver
decoding, with existing two/eight item limits and64KiB per opaque item. The
unchanged512KiB response cap may require separate staff handling for a large
valid page; it never silently truncates an item or declares complete coverage.
Coordinator pending/complete state and original recipient plans are not
independent proof that every character effect was saved/delivered. Reads do not
grant, clear rooms, award quest credit, settle or run recovery.

`market-items` provides a separate80KiB-bounded explicit gameplay item projection
from current retained auctions where the owner is seller/current bidder/buyer or
has pending refunds. It includes stats, slots/descriptions, stack/potency/socket,
gem/set/effect fields, public auction reference and derived own participation
flags. It keeps ordinary ObjectID paging, not hashed-operation cursors. Other
participant IDs/refunds, arbitrary item/gem properties, forge/restore/replay
metadata and asset caches are excluded before decoding; the explicit item DTO
prevents future fields becoming public by default. The original16KiB marketplace
summary stays unchanged, including when full item data is malformed/oversized.
Item files are neither a custody ledger nor gear restore images; no claim,
settlement, transfer or normalization occurs.

Focused race/UI tests and actual disposable Mongo verify12 records per new section
in10/2 pages, own item stats/potency/gems, room shrine recovery, boss quest credits,
private cohort/drop/forge/refund exclusion, failure sentinels, credential-reset and
revocation fences, and unchanged whole-source checksums/counts. Fifteen sections
are supported locally but unpublished. Ground/admin/auction-operation/casino data,
coordinated removal/restore, provider-policy review and full release acceptance
remain. See [encounter checks](2026-10-05-release1-75-encounter-checks.json).

### Ground, auction and administration intents

`ground` selects only own retained drop/pickup records and exposes moved gameplay
item fields, original recorded availability/expiry when present, kind/state/time
and hashed navigation reference. Before/remaining custody payloads, loot/party/
other owner/instance/position data and fingerprints are not decoded. Pending drops
do not invent availability, including valid legacy zero-time records. Ground
availability expiry does not delete the retained operation; reads neither pick
up/drop nor renew its lifetime. Projected sources are bounded at72KiB.

`auction-ops` selects currently retained own auction operations by the writer's
account-scoped player/character identity. It exposes public auction/own character,
bid/listing/buyout/claim/payout kind, planned Gold/fee/gameplay items, original
listing parameters/end time/claim status and previous public listing price.
Missing legacy kind means bid. Private operation IDs, prior bidders' identity and
refund IDs are not decoded. These documents use ordinary ObjectID pages and72KiB
projected bounds. Existing gameplay removes resolved intents; this file is not
complete history, and no unsupported creation time/state is invented.

`admin-ops` selects only retained grant/teleport operations targeting the owner.
It exposes action/state and recorded audit time/result plus a hashed reference.
Only retained Gold/item grant plans are privately parsed into explicit gameplay
DTOs; entire teleport plans (including other-player anchors), staff actors,
reasons/summaries, request IDs/fingerprints and raw execution bodies stay excluded.
Completed operations discard execution payloads; amounts/items are not invented
from private audit text or reconstructed. Recorded pending audit success describes
a planned action, not confirmed delivery, and retained auditing plans may belong
to a denied action. Sources are bounded at68KiB and grant bodies at64KiB; current
25-item admin batch bound is preserved. No grant/teleport/recovery/audit executes.

All three use existing proof/permission/session/admission and manual Save/next,
512KiB responses, three-second deadlines and failure sentinels. Opaque item JSON
remains bounded private input; only the approved gameplay DTO fields are
exported, never arbitrary/private forge/recovery data. These files are not restore
images or independent effect-confirmation ledgers. Actual disposable Mongo tests
prove12 own records per new section in10/2 pages, source redaction before driver
decoding, legacy bid/pending availability, all retained auction kinds, completed
grant/teleport exclusion, source-size/revoke fences and whole-source integrity.
Eighteen sections are locally ready but unpublished; casino, coordinated reviewed
removal/anti-resurrection, provider-policy and complete publication gates remain.
See [economy checks](2026-10-05-release1-75-economy-checks.json).

## Current casino section — local, unpublished

`casino` adds the nineteenth section. Reads select exactly the current29 shared
table keys (including retired funded blackjack) and8 owner/theme/currency slot
keys, contract-tested against the actual game catalog and slot writers. Slots
are stored per owner/theme/currency, not per physical cabinet. Only retained own
participation/wagers, own round cards/hands/stakes/payout fields, slot entitlement
and last-result summary, recorded owed/payment state and own pending transfer
currency/amount are returned. Logical references reveal no hashed owner identity.

Private pending next-state/transfer fields are projected away before driver
decoding. Current binary state is privately parsed through bounded closed DTOs;
the owner selector is decoded before own participant details. Other players'
cards/wagers/names, dealer holes/decks/burns, hidden bonus offers, timeout/seat/
session identities and private replay fields never enter the exported DTO.
This is not a full history, wallet-delivery proof, restore image or live chair
guarantee. Known malformed sources fail rather than certify owner absence.

Each current read streams at most37 records,264KiB projected/256KiB binary state
per record, with a three-second deadline and512KiB response bound. Logical-reference
keyset pages return at most10 own entries; no all-player slot scan, hydration,
dealing, spinning, bonus selection, recovery or currency transfer executes.
Existing current password, case permission and session fences remain mandatory,
with deliberate Prepare, Save and next-page actions. Current records may change
between reads and past overwritten rounds are not reconstructed.

Disposable Mongo proves34 own entries in10/10/10/4 pages across all games,
Gold/EP slots and legacy funded blackjack; three valid unowned table states and
a foreign malformed slot stay out. Own pending join survives without fabricating
current seating. Giant private next-state payloads are projected away, oversized
or malformed known current state fails, revocation denies reads, and all38 whole
source records and owner balances remain unchanged. See
[casino checks](2026-10-05-release1-75-casino-checks.json).

Nineteen sections are now locally verified, unpublished. Coordinated reviewed
removal/anti-resurrection, provider-policy review and publication remain open.

## Removal review procedure — no automatic deletion

Administrators now have **Inspect removal dependencies** on a removal-request
row, separate from case resolution and export approval. This explicit read binds
to the shown exact case/status/review revision, rechecks that quote after database
reads and requires current durable staff authority. Delivery fails if audit
storage, role or current connection cannot be verified, including after blocking
IO. General history receives only a fixed read description, never the case owner,
case text, dependency contents or private execution payloads.

The three-second read projects only the bounded case owner and one constant
presence flag from each of14 current reference categories. It inspects current
auction/intent, trade, guild membership/invitation/bank, ground/encounter/raid,
administration, social, competitive and closed casino-catalog/own-slot selectors.
It does not inspect or settle raw private payloads, count unresolved obligations,
create tables, alter wallets, purge replay identities or delete anything. Casino
catalog presence is explicitly **not verified owner participation**. Empty flags
are not clearance, and missing/failed sources do not become empty observations.
Account existence is observed, not ownership verification or removal outcome.

Current online-session and exact hashed-path pending-character-save presence are
separate, non-frozen observations. A missing configured journal volume, linked/
non-regular file or oversized save fails the read; no configured journal leaves
that field explicitly not checked. Only presence is observed: character bodies
are not read, replayed, acknowledged or removed. Activity/guild/PvP journals,
other hosts/writers, archives, providers/browser copies and durable outcome
reconciliation remain required manual scope even when every flag is absent.
All responses explicitly keep removal unsupported and unauthorized. The UI
provides no delete/settle/restore action, clears observations on disconnect/row
replacement and has no automatic query, retry, download or persistence.

The Mongo-only restore helper now additionally requires
`--confirm-privacy-and-journal-plan` before any Docker/database operation, as well
as loss-of-progress approval and the existing stopped-writer/target safeguards.
Operators must independently review removal decisions outside an old archive and
the matching journals/server before reopening. This acknowledgment is an
operator attestation, **not automated anti-resurrection verification**; it does
not enable erasure, restart writers or fulfill a request. Updated restore
instructions explain those limits.

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

Read-only dependency inspection and an explicit restore-plan gate are implemented
locally. Coordinated irreversible removal and mechanical writer/journal/archive
anti-resurrection fences remain implementation and verification work before any
erasure operation may be enabled. No removal command, worker or scheduled purge
is enabled. See [review checks](2026-10-05-release1-75-removal-review-checks.json).

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

The provider code/documentation review below does not establish current dashboard
settings. Provider configuration confirmation, remaining removal/restore fences,
live delivery acceptance and qualified review where required remain milestone
gates. No beta/full-release readiness claim follows from this workflow.

## Provider review — code and documentation, not dashboard acceptance

Reviewed October5 against current code and primary provider documentation. No
provider dashboard/API settings, retention, consent choice or real-player data
were changed. This is a technical review, not legal certification.

### Google Analytics

Google requires personal information to be excluded from URL paths/parameters,
titles and custom event fields. The shared game/website wrapper previously
forwarded arbitrary event names/properties and retained arbitrary URL paths;
current callers were coarse, but the forwarding boundary could admit personal
text. It now admits only the existing three gameplay events and website Play
click, fixed class/placement/end-reason enums and bounded numeric durations.
Unknown fields, identity/destination overrides and extra getters are not read or
forwarded. Initial configuration and every custom event carry a canonical public
root URL, fixed title and origin-only referrer. Sensitive markers are checked
independently at bootstrap and on every custom emission. These changes do not
unload an already initialized provider tag or recall previously sent data.
[Google PII guidance](https://support.google.com/analytics/answer/6366371?hl=en).

Provider-enabled Enhanced Measurement can independently collect history-based
page views, outbound link URLs, searches, downloads and form metadata; it is
configured in the provider interface. A custom-event allowlist does not control
that separate collection. Inspect and record the actual stream/tag settings,
including history changes, forms, search, links and downloads, before claiming
complete URL/form redaction. No dashboard change was made or inferred.
[Enhanced Measurement](https://support.google.com/analytics/answer/9216061?hl=en).

GA retention applies to user/event-level data but not all standard aggregated
reports. Do not substitute Eidolon's activity-history cutoff for provider
retention. Record the actual property settings without changing them. A separate
authorized provider deletion request has its own scope/status; it is not proof
that every event or aggregate disappeared or that a game case was fulfilled.
[Retention](https://support.google.com/analytics/answer/7667196?hl=en),
[deletion scope](https://support.google.com/analytics/answer/9940393?hl=en).

### Postmark recovery mail

Existing code supplies only the needed sender/recipient/stream/subject/text and
private recovery link; it explicitly sends `TrackOpens:false` and
`TrackLinks:"None"`, with no CC/BCC or administrator copy. Acceptance is not inbox
delivery. TLS fixture tests verify the contract, redirect refusal and generic
errors without contacting Postmark or sending real mail.
[Email API](https://postmarkapp.com/developer/api/email-api).

Provider support describes45-day default message/activity retention with optional
7–365-day settings; this is not confirmation of this account's configured value.
Retention changes affect future messages, expiry queues physical removal, and
aggregate statistics/suppression history have separate treatment. Disabling open
or link tracking does not stop message-body retention. The support article also
states that content cannot simply be hidden or immediately deleted.
[Retention support](https://postmarkapp.com/support/article/how-does-the-retention-add-on-work),
[content retention](https://postmarkapp.com/support/article/can-i-hide-or-turn-off-saving-of-message-content-in-my-activity-page).

An older manual describes indefinite bounce/complaint retention whereas the
updated support article distinguishes expired message/activity copies from
remaining suppression history. Do not promise full provider erasure from either
wording alone; obtain provider clarification for an actual separately authorized
request. Recipient mailbox and downstream copies also remain outside Eidolon's
Mongo export/removal workflow. No provider cleanup was attempted.
[Manual](https://postmarkapp.com/manual).

Owner read-only confirmation on October5: Postmark shows45-day retention with
no editable setting on the current account/plan; GA4's page changes based on
browser-history events is checked. These are owner-reported observations, not
independent dashboard or automatic-event network verification. On October6 the
owner additionally reports event-data retention2 months, user-data retention14
months, and Form interactions/Outbound clicks enabled. Record these values as
reported, not independently verified. The owner separately confirms Reset user
data on new activity enabled; no further dashboard confirmation is requested. Preserve all
settings; do not collect credentials or change provider policy as part of this
review. Automatic-event/private-page network checks remain separate acceptance
work. See [provider checks](2026-10-05-release1-75-provider-checks.json).

## Account-bound journal replay: staged, not a complete removal fence

Native Chrome acceptance on October6 passes four focused application-level
cases, including a390x844 viewport and actual temporary JSON downloads. Resolved
case status alone cannot enable preparation; separate approval/current proof,
manual Save, manual next page, late-reply dismissal, disconnect disposal and fresh
private-page tag suppression pass. The transport/provider are synthetic and all
assets are served from loopback under the allowlisted game hostname; this is not
an actual Google payload, real-device or full server/Mongo acceptance claim. The
new short privacy stage is included once in existing browser shard3. See
[native download checks](2026-10-06-release1-75-native-download-checks.json).

New `WriteForAccount` writes a version2 character journal with the existing Mongo
account ObjectID. Restart reads preserve that identity and reject mixed identity/
version records. Replay dispatch requires the bound commit capability; it never
downgrades such a record to the username-only path. A pending write also rejects
a different account ID, upgrading legacy without reconciliation, or overwriting
a bound record with legacy data; newer same-identity saves remain supported.
A rejected replay keeps the
pending file and receipt. `CommitBoundCharacterSave` scopes both the update and
its majority-primary receipt proof to account ID plus username, never upserts,
and preserves a later independent credit on confirmed retry. This also narrows
the receipt read to the one matching character rather than the full account.

Disposable Mongo checks cover absent accounts, replacement accounts reusing the
same username and character name, a copied old receipt, mismatched ID/name,
legitimate replacement saves, exact retained journal identity and an unchanged
foreign account. Fixture-only removal/re-registration does not enable an
operator or production erasure API. See
[identity checks](2026-10-05-release1-75-identity-checks.json).

**Normal producer adoption is now implemented locally:** trusted account/roster
and offline character loading carry Mongo ObjectID as transient context. Live
entities and detached/save projections retain it without client replication or
embedded BSON storage. Production snapshot creation requires that identity and
writes version2; journal decode restores it for replay. Shutdown still journals
all final characters before its first database attempt. Delegating commits and
ordinary repository saves respect carried identity rather than retarget a stale
image to a replacement account.

The production entry point validates journals before database initialization or
migrations, refuses every legacy pending record without rewriting/removing it,
and enables strict bound-save mode before admission. Schema23 is a marker-only
writer-compatibility fence: old schema22 binaries cannot safely handle version2
journals, so the existing deployment helper must preserve a consistent recovery
point on upgrade. No player/currency/item backfill or new retention setting.

For transition, let the original compatible server reconcile its own pending
work against the matching Mongo/recovery point and finish graceful shutdown;
preserve Mongo, journals and exact release identity together. Confirm no legacy
pending character files remain before admitting the new binary. If refusal
persists, stop the upgrade and retain the original matching recovery set; do not
delete files, guess a new owner or manually stamp a legacy record with today's
ObjectID. The early refusal is before schema23 migration so it does not itself
strand the original binary behind a newer marker. Once schema23 is committed,
an old schema22 image is not a compatible rollback writer. Restore is still an
independently approved coordinated operation, not automatic undo.

Focused strict-mode, producer/clone/privacy, legacy preflight, shutdown and actual
Mongo live/offline/reopened-journal checks are retained in
[adoption checks](2026-10-05-release1-75-identity-adoption-checks.json). Real
deployment transition/recovery acceptance remains open. Other shared-custody
intents/replay journals and independently restored removal
decisions still require coordination before any erasure can be enabled. Character
binding alone does not drain old live writers, prevent archive resurrection or
authorize deletion. No retention change or erasure is enabled;1.75 is unpublished.

The prepared, unpublished1.76+ branch already assigned its own23/24 storage
markers. Before integrating it, renumber those later migrations after this
schema23 fence and update their evidence; do not deploy that older branch or
reuse a marker number for a different contract.

## Session account-generation admission

The production password-login path now reads only the credential account ID/hash
for verification, rejects invalid or excessively expensive stored bcrypt hashes,
and proves that exact ID, username and hash are still current after comparison
using primary/majority reads. Full roster hydration must match the captured ID.
Before recovery/session installation, captured identity must match the live
character; after blocking recovery work it is checked again against the current
account and live state. Connection binding is private and immutable once pinned.

Resume-token metadata captures that generation at issue. Join checks current
identity before recovery/hydration. Resume checks DB/live/client generation before
consuming the token or executing recovery, then checks again before attaching the
character. An unavailable or replacement account refuses instead of retargeting
the token. Existing closure, rotation, one-use and expiry rules remain; no account
ID is returned in token/login/character payloads or added to analytics. No lookup
per simulation tick or ordinary movement packet is added. Failed resume restores
the recipient's previous authentication context; after-consume failures retain
the existing one-use rule rather than resurrecting a bearer.

Focused identity/protocol/lifecycle tests and two real-binary socket checks pass:
ordinary registration/legacy-password login, takeover and one-use reconnect;
fixture-only same-name replacement rejects new attachment to old live data and
rejects the original token while preserving the replacement's whole BSON image.
See [session checks](2026-10-06-release1-75-session-identity-checks.json). This is
not coordinated account removal or complete shared-operation generation fencing:
an eventual individually approved removal must drain existing sessions/writers,
reconcile shared obligations and handle independently retained archives before
any erasure is enabled. No deletion API, automatic purge, retention/provider
change or real-player account replacement is introduced here.
