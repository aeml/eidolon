# Administration console — work in progress

This is the **Alpha1.9.17 release candidate**, based on Alpha1.9.16. It does not close
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
- Mutation preparation now has ordered multi-account work locks (actor, target
  and teleport destination account), strict confirmed request schemas, and
  actor/request-ID identities with separate canonical payload fingerprints.
  Cross-target/action reuse retains the same identity and therefore must conflict
  in the durable operation store. No client actor, raw coordinates, item stats,
  prices, effects or sockets are accepted. Mutation endpoints are now registered
  with separate4KiB payload ceilings and five-request/ten-second rate limits.
- Canonical item creation uses the existing base-item catalog and normal loot
  stat/rarity formulas: equipment levels1–100, Common through Legendary, quantity
  1–25; Shards/Hearts use their actual Eidolic/level1 definition and1–1000 stack.
  Inventory delivery plans the complete batch on a detached copy and records a
  fingerprint receipt, with no partial stacks, stash spill or ground loot.
  Identical replay cannot recreate consumed items; conflicting contents fail.
  Generated item IDs/rolls must be recorded once in the operation journal, not
  regenerated on retry. These internal helpers do not themselves authorize grants.
- Gold request validation caps one administrative grant at100,000,000 and the
  resulting balance at JavaScript's exact-integer ceiling. No ordinary rewards
  or player economy limits changed. Teleport targets support town or an exact
  other account, with live state, instance and walkability validation.
- Gold/item execution now has a private Mongo operation-intent and replay store.
  First preparation keeps the exact generated item rolls; actor/request-ID reuse
  with a different fingerprint conflicts. Full-character saves carry the effect
  and a private admin receipt together through the existing disk journal. Recovery
  prefers newer live state or flushes the offline journal before reading Mongo.
  Success is acknowledged only after the character commit, immutable outcome,
  audit append and completion marker. A rejected dead/full/balance-invalid grant
  saves no character. Completed replay performs neither another save nor audit.
- Local schema14 adds bounded pending-operation query indexes and fences earlier
  writers that would erase the new character receipts. Completed operation IDs
  and recorded results are permanent deduplication receipts, separate from the
  TTL-controlled browseable history; bulky generated execution plans are removed
  on completion. Structured audit entries now support a bounded operator reason.
  Startup now drains all operations before admission, with bounded50-operation
  runtime passes every5seconds. The actor/target pending cache blocks affected
  command/join/resume work until recovery, without querying Mongo for ordinary
  unaffected movement. Lost insertion/completion replies are resolved without
  waiting for the player to reconnect. Missing confirmed intents fail closed;
  failed preparations with no stored intent are safely forgotten. An audit-only
  denied request cannot block the account it names.
- Gold, item and teleport handlers now acquire actor/recipient/destination work
  locks in global order, recheck current socket ownership and the durable role,
  reconcile pending work and save before returning a final success. Exact
  requests replay the stored outcome; conflicting payloads are rejected. Valid
  denials are durable/idempotent too. Item delivery refreshes the recipient bag.
- Teleports support administrator-to-player, player-to-administrator and town;
  arbitrary third-party-to-third-party moves are not exposed. Both endpoints
  must be online, alive and available. Party-instance boundaries, PvP/trade/seated
  state and VIP guard entry remain enforced. A nearby clear landing is selected
  and revalidated before moving, with a new movement context, saved receipt and
  authoritative scene notification. Resources, cooldowns and equipment are not
  reset. Offline recovery acknowledges saved teleports but never starts an
  unapplied one. Completed replay cannot move, revive or resave a character.
- Overworld landing collision data is generated from the actual client town,
  realm structures, blocking trees, entrances and Chronicle-site builders.
  Stash/Trading House/Forge use live transforms of their canonical footprints;
  casino interior/table footprints share actual client definitions. A regression
  test rebuilds and compares the embedded server geometry to catch art drift.
  Dungeon landings use canonical walk rectangles. Scene entry now honors finite
  authoritative height, including upstairs, instead of always forcing ground.
- Panel controls include exact target selection from the online list or account
  field, self selection, canonical item/material limits, Gold and all three
  teleport modes. Review freezes the request and requires explicit confirmation
  and a reason. Pending/uncertain operations retain the exact request ID/payload
  across in-memory reconnects and retries; new changes stay disabled until a
  final result. Revoked roles hide controls; changing accounts discards another
  administrator's local retry. History displays reasons and mutation filters.

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
  behavior, not mutations or actual phone input.
- That test caught and fixed a restart incompatibility: the character journal
  reader now delegates only the real `admin-activity` directory to its own reader.
  Impostor files/symlinks still fail closed. Focused tests cover corruption,
  private file mode, bounded batches, shared-volume recovery, Mongo outages,
  local-disk failure, more than one startup batch and unchanged resume expiry.
  Focused session/journal tests also pass under Go's race detector, including
  concurrent capture and replay; client UI tests8pass and lint/diff checks pass.
- Focused mutation-schema, canonical-item, all-or-nothing inventory and account
  locking tests pass, also with Go's race detector (native28311 exit0). Tests
  include crossed/self account locks, unrelated-account independence, duplicate
  and forged JSON fields, numeric bounds, request replay/conflicts, every base
  item/rarity, full-bag/partial-stack failures and consumed-item retries. This
  does not by itself prove durable mutation execution.
- The grant executor now passes save/audit-failure and process-state-loss tests,
  preserving newer live Gold, resources, equipment, rest and item rolls. Focused
  admin, snapshot and lock tests pass with the race detector (native7854 exit0).
  Real isolated Mongo intent/outcome tests pass (native89401 exit0): concurrent
  identical prepares keep one plan, conflicting fingerprints/outcomes fail,
  audit failure remains recoverable after reopening, completed replay does not
  recreate an expired audit, and completed operations leave the pending queue.
- Real Mongo plus the actual full-character disk journal passes both Gold and
  item recovery (native22481 exit0,0.20seconds), after an injected commit failure
  and reopening both stores. Exact saved receipts, unchanged dungeon logout
  timestamp/resources/rest/gear/EP, one audit with its reason, original item IDs,
  and unchanged save ID on completed replay were verified. This is an internal
  executor/persistence test, not authenticated socket or deployed acceptance.
- Actual built-server recovery passes (native40190 exit0,6.46seconds): a queued
  Gold intent completes before readiness, a runtime item intent delivers to an
  ordinarily logged-in character through the5second loop, and disconnect plus
  process restart preserve both receipts, original item IDs, and one audit each.
  Logs: `/tmp/eidolon-compat-session-2622442516/server.log` and
  `/tmp/eidolon-compat-session-4072265764/server.log`. The disposable Mongo
  container was removed. Intents were inserted as trusted test fixtures, not
  through unfinished admin message handlers; this does not close mutation
  authorization/UI acceptance. Focused scheduler race tests also cover73-entry
  startup drain, runtime batch bounds, ambiguous replies, missing confirmed
  intents, unrelated accounts, denied-request noninterference and concurrent
  target commands.

- New endpoint/game tests pass under Go's race detector (native90597 exit0).
  Additional crossed-account and concurrent duplicate dispatcher checks pass
  (native25695 exit0): one grant/save/audit for duplicate requests and no nested
  actor/target deadlock. New teleport tests exercise clear/occupied landings,
  current town architecture, casino furniture/atrium/guard, private instances,
  moved anchors, stale movement, save/audit failure and offline restart recovery.
- Real production-binary two-account mutation test passes (native99139 exit0,
  7.90seconds): ordinary-account denial, Gold, canonical Rare items, all three
  teleport modes, recipient inventory notification, complete saved state and
  exact receipt/audit replay after process restart. Logs:
  `/tmp/eidolon-compat-session-3255918323/server.log` and
  `/tmp/eidolon-compat-session-3701933296/server.log`.
  The first attempt correctly exposed a test-baseline error: shutdown performs
  its own final save. The corrected test compares replay against the saved
  post-shutdown identity, not the earlier disconnect identity. No server save
  behavior was relaxed. This is socket acceptance, not a browser-to-live-server
  mutation run or a production change.
- 18 panel/component tests plus24 scene-containment tests pass (native4759 exit0),
  including frozen confirmation, numeric limits, account-derived endpoints,
  timeout/reconnect retry identity, role revocation and text-only rendering.
  Geometry/CasinoController/containment32checks also pass (native35349 exit0).
  Changed-file lint passes. Three Chrome presentation tests now include actual
  review/confirm/material controls at1280x720,390x844,844x390 (native58104 exit0,
  22.3seconds); portrait confirmation screenshot was visually inspected. These
  remain synthetic responses, not actual-phone or authenticated-browser proof.
- Isolated Mongo archive restore preserves all14collections, documents and
  indexes, including schema14,12operation receipts,20audit events and4disposable
  accounts. Archive: `/tmp/eidolon-admin-endpoints-LVGTQA/admin-endpoints.archive.gz`.
  Current binary's read-only preflight accepts14. The exact existing production
  image's read-only preflight rejects14 because it supports12, before writes.
  This is the intended rollback fence; never deploy that older writer against
  the upgraded database. The fixture contains both initial and corrected test
  attempts, hence four accounts and twelve operations. The owned disposable
  database container was removed after the archive was verified; production
  data and services were not changed. Final endpoint/teleport/build-receipt
  focused race checks pass as well (native51340 exit0).
- Authenticated rendered acceptance passes (native89594 exit0,29.53seconds;
  browser26.4seconds) against the actual race-enabled server and disposable Mongo:
  two browser accounts, role-gated launcher, online-player selection, review and
  confirmation for Gold and two Rare items, recipient replication, all three
  teleport modes, fresh movement contexts and visible player scenes. Ordinary
  account access stays hidden; saved characters and exactly one successful audit
  per operation were checked after server shutdown. Log:
  `/tmp/eidolon-compat-session-127141019/server.log`. The first browser attempt
  used a raw-server rarity string where the hydrated client holds a rarity
  object; only that observation was corrected. No grant behavior was changed.
  This covers actual desktop browser controls, not actual-phone dungeon/party QA.
- Alpha1.9.17 cumulative in-game notes and all runtime versions are synchronized.
  The three admin layout cases are now part of the regular CI interface stage.

## Remaining release work

1. Preserve the completed authenticated rendered controls/scene evidence.
   Admission rejection responses preserve
   the mutation request ID without inventing a final stored decision.
   Reuse the passing focused/socket/restart evidence instead of rerunning old
   soaks or campaign matrices for this panel.
2. Publish the packaged cumulative patch notes and synchronized versions, preserve the
   consistent pre-upgrade backup including private journals, and verify the
   deployed role panel with a safe read-only smoke. Production mutations are
   not required. The broad1.10 campaign/raid/mobile scope remains open.
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
