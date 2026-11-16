# Automatic administrator VIP and monthly EP

User confirmed September 20: automatic administrator VIP includes **access plus
100 EP per month**. Verified delivered in Alpha1.9.24 atd1e707e3:
CI35500889856 passed and independent public identity/readiness checks agree.
The focused/connected allowance evidence below is separate from this read-only
delivery check; no production balances or roles were changed for verification.

## Policy and implementation

- Resolve the administrator role from the trusted account role repository on
  membership refresh. Bootstrap names, client flags and EP ownership do not count.
- Administrators receive the current UTC calendar month's 100 EP when their
  entitlement is refreshed (login/resume or VIP interaction). Do not infer past
  administrator months from today's role; there is no historical-role record.
- A normal VIP membership starting in the same calendar month fulfills that
  month's allowance instead of stacking with it. Both receipt identities are
  retained, regardless of which entitlement arrives first. Future or revoked
  memberships cannot block the current admin allowance.
- Persist wallet and entitlement receipts together using existing full-character
  journal recovery. Receipt-only changes must also be saved. Spending EP,
  reconnecting, or removing/reinstating the role cannot restore a claimed grant.
- Role removal stops automatic access on refresh, without confiscating earned EP
  or denying separately valid normal membership. Repository/save failures fail
  closed for access; pending grants recover before confirmation.
- EP remains cosmetic-only outside EP casino wagers; no Gold conversion, power
  rewards, payment integration, paid subscription record or permanent VIP flag.

## Focused verification

Coverage includes monthly rollover, role removal/reinstatement, role lookup
failure, normal membership/admin ordering, future/revoked periods, receipt-only
persistence, pending-save recovery, receipt mismatch/overflow, no repeat writes,
and unchanged Gold/stats/XP. Existing VIP journal-reopen coverage is retained.

Targeted command (from `server/`):

```bash
go test ./ ./internal/database -run 'Test(AdministratorVIP|VIPMembership|VIPAllowance|VIPPeriods|VIPExpiry)' -count=1
```

Result: PASS (`eidolon-server` 0.817s; database 0.029s). Whitespace checks pass.

Connected verification also passes in the expanded casino's disposable-database
test: a real administrator socket with no paid VIP period receives 100 EP, enters
through the upstairs guard, wagers EP at baccarat alongside a normal VIP, and
reconnects after a server restart without a second allowance. The two-game socket
suite completed in 133.479s; its temporary database was removed afterward. No
production account was changed.

The complete expanded casino still needs its own game, layout and deployment
verification. This focused allowance change does not close those requirements.
