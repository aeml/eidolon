# Alpha 1.52 guild transfer work

September 30, 2026. Guild-bank recovery foundations are implemented and verified
locally. Alpha 1.52 is not packaged or deployed; this worktree still reports
Alpha 1.51.0. Existing bank handlers have not been switched to the new protocol.
The milestone remains incomplete.

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
hooks; ordinary bank handlers still use the legacy request path.

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

The private loopback Mongo container was stopped; its disposable data was removed.
No production accounts, economy rates or privileged infrastructure changed.
These durations describe test execution, not runtime performance or capacity.

## Required before release

Wire ordinary bank handlers into immutable intent lookup, request identifiers,
the implemented two-sided settlement, acknowledgements and UI retries. Verify
failure boundaries through the normal
production handlers, without compensating writes that can silently fail.

Finish the rank/permission, invitation, succession, calendar, audit and
destructive-confirmation review. Then package the version and cumulative notes,
fetch/merge remote changes and use ordered CI/public acceptance after 1.50 and
1.51. Component settlement and admission proof are not evidence that the legacy
bank UI uses them, or that 1.52 is deployed or beta-ready.
