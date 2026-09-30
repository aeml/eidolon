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

The private loopback Mongo container was stopped; its disposable data was removed.
No production accounts, economy rates or privileged infrastructure changed.
These durations describe test execution, not runtime performance or capacity.

## Required before release

Reserve and fence the guild before applying character effects; guard governance
and all legacy bank writers against unresolved transfers. Wire immutable intent
lookup, both-side settlement, account admission/recovery, request identifiers,
acknowledgements and UI retries. Verify failure boundaries through the normal
production handlers, without compensating writes that can silently fail.

Finish the rank/permission, invitation, succession, calendar, audit and
destructive-confirmation review. Then package the version and cumulative notes,
fetch/merge remote changes and use ordered CI/public acceptance after 1.50 and
1.51. Do not infer complete settlement, live rollout or beta readiness from these
component checks.
