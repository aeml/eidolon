# EP persistence compatibility and recovery

September 14, 2026. Final 1.10 recovery review found a concrete gap: schema 11
was introduced for the guild calendar, before EP wallets and receipts. Releases
1.9.5–1.9.7 still used that schema version. Earlier schema-11 full-character
writers could therefore pass startup compatibility checks and discard EP fields.
A prose warning did not prevent that unsafe rollback.

## Change

Schema **12**, `ep_wallet_and_casino_receipts`, uses the existing migration and
startup guard. It performs no backfill, grant, reset or currency conversion.
Existing EP, allowance/exchange/casino receipts, cosmetic ownership and other
character/account state remain unchanged. Previous schema-11 binaries are
refused before writes. This deliberately fences even recent EP-aware binaries
that still advertise schema 11; a rollback writer must explicitly support the
current format and preserve all fields, not merely use an older release number.

The existing deployment preflight sees 11→12 and takes its consistent backup
before migration: stop the prior writer, retain the exact previous image,
Mongo archive and private journal, then admit the new writer. Failed backup
restarts the unchanged previous API and does not admit the new writer.
Do not lower/delete the production schema marker. Restoring a historical recovery
point is a separate coordinated data/image/journal operation, not an automatic
rollback over post-upgrade player transactions.

## Focused evidence

- New fence contract first failed on schema11, then passed with contiguous
  migration and supported/future-schema checks on schema12 (0.013s).
- Built actual pre-change schema11 and candidate schema12 server executables.
  Disposable loopback Mongo7.0.16 check **PASS1.026s**: read-only preflight,
  rejected future schema13 without writes, idempotent real migration to12,
  schema11 executable refusing both preflight and ordinary startup, exact BSON
  equality for saved Gold/resources/EP/receipts/cosmetics throughout.
  `/tmp/eidolon-ep-schema-guard-20260914.log`.
- Actual backup/restore **PASS21.826s** with owned Compose project
  `eidolon-backup-proof-1789354961807565073`. Authenticated Mongo dump restored
  EP83, monthly receipt100, exchange receipt1, wager debit-18, cosmetic ownership,
  dated VIP membership and pending EP table operation, alongside existing
  resources/Gold/auction receipts, indexes and schema12. Private journal bytes
  and container ownership survived. Injected dump failure restarted the exact
  previous API; successful backup kept it stopped; no-prior-API backup also
  passed. `/tmp/eidolon-ep-backup-restore-20260914.log`.
- The backup API is explicitly a writer stand-in, not a game session. Currency
  replay/game settlement retains the separate existing real Mongo session
  evidence; this check does not pretend to play a casino hand.
- Fixture services now use `network_mode: none`; all DB commands use container
  exec, so no bridge interfaces disturb a concurrent live-browser gate.
- Existing deployment preflight/ordering checks passed0.333s. No production
  account, EP grant, wager, database marker or backup was altered by local QA.

## Delivery

Packaged locally as **Alpha1.9.8**, with cumulative player-facing notes protecting
EP progress and explaining safe upgrades. Login, package/lock, release manifest,
server/container/deploy/CI and isolated-QA defaults are synchronized. Version and
patch-history checks **256PASS2.479s**, full Go build, focused ESLint and whitespace
checks pass. Implementation commit `a881b4a3`; pushed in
**08f020bcba55a187f83bc8ddf5a20980fde88b15** after1.9.7 passed all ten CI jobs
and exact live verification. New CI **34802207933** is in progress; this
correction is not yet verified live.

Do not supersede the active Alpha1.9.8 CI34802207933. The earned campaign,
group raids and remaining 1.10 integration acceptance are still required; this
fix closes a specific recovery defect, not the whole roadmap.
