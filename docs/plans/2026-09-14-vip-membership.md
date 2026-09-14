# Trusted VIP membership and monthly EP — Alpha 1.9.6 batch

This batch combines Veyra's implemented cosmetic vendor with trusted membership
records and the approved **100 EP per VIP membership month**. Billing remains
excluded. No production account was granted VIP or EP during implementation.

## Membership and allowance rules

- Membership comes from the account's `vip_periods`, not a client flag, EP
  ownership, an inventory item, a chat command or a public provisioning endpoint.
- One record represents one actual membership/billing month with explicit UTC
  start and exclusive end boundaries. Accept 27–32 day periods (including real
  month/DST variations), reject overlap and non-month periods. Identity derives
  from those boundaries, so retries/timezone spellings cannot create duplicates.
- Each non-revoked period grants exactly100EP when its start has passed, once.
  On login/resume or wallet refresh, deliver unclaimed earned months, including
  periods spent offline. Future months do not pay early. Do not replace the
  100EP/month policy with a client-selected value or add other VIP power perks.
- EP and a permanent VIPAllowanceReceipts entry save in the same full-character
  journal transaction. Pending saves must recover even if the live receipt already
  exists; read-only membership refreshes do not repeatedly write a character save.
- Expiry is exclusive. Revocation prevents access/new grants, but leaves already
  issued EP/owned cosmetics intact. Repository failure clears cached eligibility.
  Eligibility is refreshed from the account repository, never restored from a
  character's claimed VIP flag or blindly trusted client state.
- Only membership status, private balances and allowance results go to the owner.
  No changes to Gold, stats, gear, progression or the public Gold casino.

## Operator-only provisioning (not checkout)

From a checkout's `server/` directory, preview a verified membership period:

```bash
go run ./cmd/vip-period --username ACCOUNT --start 2026-09-14T00:00:00Z --end 2026-10-14T00:00:00Z
```

This default performs no database connection/write. Only after verifying the
account's authorized membership, use the same command with `--apply` and a
privately configured `MONGO_URI`. Do not put database credentials on the command
line or manufacture periods as test rewards on production accounts. The atomic
account update rejects overlapping months even with concurrent operator runs.

To revoke an existing period, preview `--username ACCOUNT --revoke PERIOD_ID`,
then explicitly add `--apply`. This revokes membership access, not the EP or
cosmetics already issued. No payment, subscription price, chargeback integration
or real-money purchase flow is provided by these commands.

## Evidence

- Focused server tests: calendar/timezone identity, offline catch-up, future and
  revoked periods, boundary expiry, forged/overlapping periods, integer overflow,
  private snapshots, unchanged Gold/power, no repeat writes, pending-save retry,
  reopened-journal recovery, ignored client-supplied membership and source failure.
- Disposable loopback Mongo: eight concurrent provisions produce one month;
  overlap rejected, adjacent renewal accepted, revocation persists and cannot be
  undone by replay. PASS0.684s. Owned container eidolon-vip-qa-20260914 was removed;
  host networking with loopback-only bind did not create browser-disrupting bridges.
- Operator command preview exercised without --apply: no database connection.
- Updated wallet/VIP UI unit and version/vendor checks268PASS2.054s. Wallet browser
  fixtures390/1440 bothPASS8.1s with membership text and usable confirmation.
  Reuse the vendor's212client tests and2browser passes; no broad local reruns/soak.
- Go build and focused lint/whitespace checks pass. Version/login/patch notes
  packaged as1.9.6; not yet verified deployed at this document's creation.

## Remaining scope and rollback

The VIP floor and EP-only multiplayer casino games are STILL NOT IMPLEMENTED.
Next work must use trusted membership on entry and every new wager, allow existing
funded hands to settle safely, and ensure100EP wagers return onlyEP. The existing
guard/floor lock is not completion. Payments stay excluded.

Retain EP, EPExchangeReceipts, VIPAllowanceReceipts and AppearanceCollection in
every future save/rollback build. Predating servers may overwrite these fields.
Wallet/receipts currently follow the game's single-character-per-account model;
migrate account ownership before enabling additional characters or class resets.
