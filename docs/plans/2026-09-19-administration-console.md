# Administration console — work in progress

This is an **undeployed feature batch**, based on Alpha1.9.16. It does not close
the full administration release gate or the broader1.10 roadmap. Do not publish
a separate patch for each control; finish the meaningful administration batch
with accurate release notes and synchronized versions before deploying it.

## Implemented locally

- Hidden-by-default Administration launcher in the game menu. The authenticated
  server checks the durable MongoDB role on each status, player-list and history
  request. Bootstrap allowlists and QA access are not panel authorization.
- Registered, authenticated WebSocket messages with1KiB payload ceilings and
  five-request/ten-second bursts. Closed schemas reject unknown/duplicate keys,
  wrong types and invalid request IDs. Requests carry no authoritative identity.
  The history `actor` field is only an exact-account **filter**, not the caller.
- Capped50-player sorted account-keyset pages from authenticated sessions, with
  only account/name/player ID/class/level. No serialized characters, emails,
  credentials, currency balances, tokens or raw logs.
- Structured administration-read history with success/denied/error outcomes,
  server-derived actor, bounded summary, request ID and UTC time. Each response
  is withheld if its audit append fails. Role/store failures clear the panel's
  data and authorization; disconnects discard pending/stale replies.
- Login, resume and disconnect events now use a private checksummed disk outbox
  under the existing save journal directory. Login/resume wait for durable local
  capture; a database outage retains exact event IDs for replay. Runtime sync
  uses50-event batches every5seconds; startup drains all batches before admission.
  Unavoidable disconnects during local-storage failure are retained in memory,
  make readiness fail and keep graceful shutdown waiting for durable storage.
  Sudden host loss while disk writes are failing cannot preserve those RAM-only
  events. No password/token/raw authentication payload enters the outbox.
- Failed audited resumes restore the original disconnect time, never extending
  the user's15-minute dungeon logout rule. Legacy oversized/control-character
  account names get collision-separated SHA-256 history keys, not a new login
  restriction; the player list exposes the corresponding history key as needed.
- History has exact-account/activity filters and50-entry timestamp/ObjectID
  keyset pages. Insert-only activity records permit identical recovery replay
  but reject conflicting content for an existing ID.
- Local schema13 adds history query and expiration indexes. Default retention
  is90days; `EIDOLON_ADMIN_AUDIT_RETENTION_DAYS` accepts7–365 whole days and rejects
  invalid configuration at startup. Each event retains its original expiration;
  reads additionally enforce the current retention cutoff. Reducing the setting
  immediately hides older records, while physical removal follows their recorded
  expiry (MongoDB TTL is asynchronous). Increasing it cannot resurrect expired
  records. No production schema changes have been made.
- Desktop and phone portrait/landscape presentation, scrollable records, loading,
  empty/error states, filter-safe pagination and touch-sized controls. Screenshot
  review caught a flex-direction issue; header is now above the content, with
  a regression assertion rather than just screen-bound checks.

## Evidence and limits

- Focused Go administration admission/authorization/failure tests pass; activity
  validation, retention and cursor tests pass.
- Actual isolated authenticated MongoDB test passes migration/index creation,
  immutable replay/conflict refusal,61 same-timestamp records without pagination
  gaps/duplicates, expired-record exclusion and a fresh repository connection.
  The disposable container was removed; no production account was changed.
- Eight focused UI tests pass. Existing UI binding/settings/HUD tests55pass.
- Three Chrome HTML/CSS-only presentation cases pass at1280x720,390x844,844x390.
  These use synthetic responses: they are **not** authenticated socket or actual
  phone acceptance. Final connected acceptance remains required.
- Actual two-account production-binary/socket test passes in1.62seconds:
  admin/non-admin status and roster authorization, ordinary login, token resume,
  two disconnects, history response privacy and exact saved event counts after
  a real server restart. Native83168 exited0 and its isolated Mongo container
  was removed. Evidence logs: `/tmp/eidolon-compat-session-160140207/server.log`
  and `/tmp/eidolon-compat-session-2290200519/server.log`. This covers read/session
  behavior, not the still-unimplemented mutations or actual phone input.
- That test caught and fixed a restart incompatibility: the character journal
  reader now delegates only the real `admin-activity` directory to its own reader.
  Impostor files/symlinks still fail closed. Focused tests cover corruption,
  private file mode, bounded batches, shared-volume recovery, Mongo outages,
  local-disk failure, more than one startup batch and unchanged resume expiry.
  Focused session/journal tests also pass under Go's race detector, including
  concurrent capture and replay; client UI tests8pass and lint/diff checks pass.

## Next required implementation

1. Confirmed canonical item creation, bounded Gold grants and validated teleport
   operations. No mutation buttons or handlers exist yet. Implement account-work
   ownership, stale-session rejection, exact targets, inventory/Gold/instance/
   walkability validation and durable idempotency together with a recoverable
   character/receipt/audit journal. Do not bolt unsafe grants onto the read handler.
2. Remaining full-gate failure/concurrency/restart and disposable two-account
   connected acceptance, backup/restore and safe live read-only smoke.
3. Package/deploy only when the batch is ready. Use the user-approved Luna watcher
   for the exact CI run, then verify actual live client/server identities.

## Separate Rootheart acceptance result

Fresh raid18833 on83a85c60 is terminal failure: the formation correction got past
the previous entry failure and through assault combat. All five survived, each
with206Gold; Fighter/Wizard/Rogue dealt14686/6888/4738 damage and the two Clerics
healed928/1019. A later DemonOrc remained at560HP for60seconds; all damage dealers
lost verified hover acquisition despite nearby positions. The retained log is
`/tmp/eidolon-earth-raid-20260919-r2-eoZkxr/run.log`. Do not restart blindly:
inspect target occlusion/acquisition and the captured approach geometry first.
No boss or crystal-repair completion was accepted. Owned API/Mongo containers
were absent after cleanup. The private save is not permission to bypass the
user's unchanged15-minute instance logout rule.
