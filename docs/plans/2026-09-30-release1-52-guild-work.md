# Alpha 1.52 guild transfer work

September 30, 2026. Alpha 1.51 is independently accepted; its receipt is merged
into this candidate. Alpha 1.52.0 is packaged locally with cumulative login patch
notes. Ordinary bank handlers now use the durable transfer protocol below. The
candidate was normally pushed and is independently accepted live. Exact CI,
public identity and changed-asset evidence are in the
[acceptance receipt](2026-09-30-release1-52-acceptance.md).

## Completed foundations

Character escrow now stages item additions before committing any bag changes,
rejects Gold overflow and protected story items, and never uses hidden bag slots.
Immutable transfer intents retain the first planned item, amount and expected
guild/character revisions. Unique pending-intent indexes serialize accounts and
guilds; guild effects use version checks and one bounded receipt/audit entry.
Guild-only application deliberately leaves the transfer pending.

The new character-side application likewise changes the wallet or visible bag
only once, recording a bounded revision and fingerprint in the same mutation.
Ordinary hydration, complete snapshots and entity copies retain those private
fields. Full saves use the existing durable character journal, not a second
financial persistence system. Recovery reconciles unresolved saves before
reading offline state, and verifies durable receipts before acknowledging a
volatile live marker. A confirmed replay does not overwrite later live progress.
Exact saved item payloads retain legacy stats, potency, sockets and gems without
ordinary hydration's stat rescaling. Unrelated quests, resources, rest, equipment
and EP remain intact.

Schema 16 adds the bank-intent indexes and fences older writers that would erase
the new receipts. It does not backfill balances or grant items. This schema is
local candidate code, not a production migration.

A durable guild reservation now validates the saved bank version, membership,
withdrawal permission and bank capacity before any character effect. All guild
replacement/deletion writers and membership acceptance use the same version and
unreserved predicate. Rank, leadership, departure, calendar, message and legacy
bank operations therefore cannot invalidate an unsettled transfer. Presence
still updates during the hold; ordinary presence and terminal release advance
the version so stale full-guild snapshots cannot overwrite it. Only terminal
intents can release their own hold, and retries cannot clear a later transfer's
reservation. An indexed recovery query also finds terminal holds left behind
by a stop between completion and release.

The settlement coordinator now reads the durable first plan, reserves the
guild, journals the complete character effect, applies the guild effect, freezes
the terminal outcome and releases only that operation's hold. It rejects only
after confirming neither side changed. Unknown acknowledgements and partial
effects remain pending; no financial rollback or compensating refund is used.
Permanent terminal requests remain harmless after later transfers replace the
bounded character/guild markers.

Startup drains pending intents and terminal holds. Runtime recovery processes
at most 50 identities per pass, including ambiguous insertions and lost replies,
and stops at the first outage. An account-local cache avoids Mongo queries for
ordinary unrelated movement. Login, join, resume, normal dispatch and admin
actor/target admission now use that recovery gate. These are local candidate
hooks, now also used by the ordinary bank handlers.

## Normal bank and guild interface

Deposit and withdrawal handlers look up the immutable request before planning
against current balances, membership or bag contents. A new request saves the
complete live baseline before recording its intent. They then use the two-sided
coordinator, never compensating refunds or unconfirmed queued saves. Structured
results distinguish pending, complete, rejected and invalid requests. Recovery
also notifies the active client and refreshes inventory and guild state only
after durable settlement.

The bank generates one nonce per transfer, retains the exact action/payload in
account-scoped session storage, disables new transfers while pending and offers
an explicit same-request retry. Reloads restore it; unrelated state pushes and
stale acknowledgements cannot clear it. Invalid input is rejected locally and
rechecked by the server. Existing clients without request identifiers must
refresh rather than silently using the old financial path.

Leave, disband, kick, rank changes, leadership transfer and inactive-leader claims
now have named consequence confirmations. Fresh roster state invalidates a
captured confirmation, including stale DOM callbacks. Existing server authority,
invitation consent/block checks, calendar versioning and RSVP controls remain.
Audit entries show actors, targets, time and actual previous/new ranks without
interpreting player text as HTML. No economy rates, EP rules, progression,
equipment stats, saves or public-access policy are changed.

## Scoped verification

- Game escrow/application/copy race checks passed in 4.256 seconds, including
  concurrent identical replay, stale receipts, partial-stack/full-bag rejection,
  exact payload preservation and disconnected character recovery.
- Character persistence and affected administration recovery checks passed in
  6.967 seconds. Four real-Mongo cases cover Gold debit and exact item delivery,
  each with failure before commit and lost acknowledgement after commit. They
  reopen both the repository and the actual filesystem journal, clear process
  failure memory, retain the original save receipt and verify unchanged complete
  gameplay state. The intent remains pending: this is character-side durability,
  not proof of complete two-sided financial settlement.
- Migration/catalog and guild intent/application race checks passed in
  2.925 seconds. Schema 16 is idempotent; both account and guild serialization
  indexes are unique and restricted to pending intents.
- The expanded reservation/guild/calendar/migration race selection passed in
  2.696 seconds. It covers 13 fenced mutation paths, last-member deletion,
  reservation versus governance through separate repositories, 20 identical
  reservation executors, repository reopen, terminal-hold discovery, bounded
  release replay, later-hold isolation and presence preservation. A first
  acquisition/apply run exposed a concurrent receipt timing gap; recheck the
  exact receipt after reservation recovery rather than returning a false stale
  error. No assertion or permission requirement was weakened.
- Character recovery and affected persistence/administration checks were
  repeated after the storage changes and passed in 6.224 seconds, including
  the four disposable real-Mongo save-failure cases.
- The two-sided real-Mongo matrix covers all ten before/after durability
  boundaries for Gold deposits, plus character/guild acknowledgement loss for
  the other three transfer actions. Reopening repository and filesystem journal
  preserves full saved state, exact items, one audit and terminal replay. Further
  cases cover unapplied rejection, partial-effect recovery, account identity and
  old-request replay after newer transfers. The combined settlement/scheduler
  race selection passed in 25.423 seconds, including startup discovery from an
  empty process cache for pending character effects and terminal guild holds.
- Scheduler race checks passed in 1.466 seconds: 73 holds drain at startup,
  runtime stops at 50, uncertain insertion results reconcile, missing confirmed
  records stay blocked, and busy/conflicting requests cannot block unrelated
  accounts. Production dispatch blocks movement and administrator target grants
  until hold release, then readmits movement. The existing affected admin,
  protocol, login, join and resume selection passed in 18.585 seconds.

- The normal-handler matrix passed in 9.294 seconds through actual message
  admission, baseline saves, first intent insertion and settlement for all four
  actions. Lost acknowledgements at insertion, character save, guild application,
  terminal completion and reservation release recover after repository/journal
  reopen and empty process caches. Exact items, one audit, conserved funds and
  unchanged unrelated gameplay state are checked. Normal full saves intentionally
  compact empty bag slots and update the logout clock; the separate offline
  recovery tests retain their exact-slot/time assertions.
- Request/scheduler race checks passed in 1.834 seconds. Guild permission,
  ownership, inactive succession, departure and reservation checks passed in
  2.389 seconds, including denied operations leaving bank/audit/version intact.
  Persistence comparisons use authoritative database reads to account for BSON
  millisecond timestamp precision, while separately asserting actual new ranks.
- Seven scoped JavaScript suites passed 366 checks in 5.749 seconds. Native
  System Chrome passed the two desktop/phone-policy bank cases in 34.4 seconds:
  pending controls, same-payload retry, actual reload restoration, terminal
  acknowledgement and destructive-action cancel/confirm. The phone-policy
  confirmation screenshot was visually reviewed for readable controls and no
  horizontal clipping. These prepared UI fixtures are not authenticated
  multiplayer or physical-phone playtests.
- Mandatory browser discovery assigns all 243 cases exactly once. Scoped lint
  passed. A new mandatory Go CI step runs the disposable real-Mongo bank recovery
  selection before other fixtures, using the job-owned loopback Mongo service.
  No unchanged campaign or soak was added.
- Final version, mandatory financial-CI-step and browser-plan/coverage/sharding
  checks passed: four suites, 343 checks, 3.028 seconds. All changed runtime and
  deployment metadata report Alpha 1.52.0; cumulative earlier notes remain.

The combined bank selection exposed deliberately incomplete character-only test
records leaking into startup-recovery tests. Their pending-state assertion is
preserved; cleanup now removes only each exact disposable fixture after its test.
Production startup still fails closed for unconfirmed partial effects. The full
bank, inbound-message and registered-handler race selection then passed against
a fresh disposable Mongo database in 43.193 seconds, including the original
character-only pending assertions and complete startup/normal-handler recovery.

The private Mongo containers, including the final loopback verification lab,
were stopped and their disposable data removed.
No production accounts or privileged infrastructure changed. These durations
describe test execution, not runtime performance or capacity. Markdown evidence
was inspected as source; no rendered-document preview is claimed.

## Release acceptance

Candidate files were explicitly committed; a fresh fetch/merge immediately
before the normal push preserved remote changes. Exact CI and independent
public frontend/backend/document/changed-asset checks passed. This milestone's
accepted deployment does not establish beta readiness or real-player validation.
