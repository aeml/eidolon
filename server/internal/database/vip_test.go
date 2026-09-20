package database

import (
	"testing"
	"time"
)

func vipTestPeriod(t *testing.T, start string) VIPPeriod {
	t.Helper()
	from, err := time.Parse(time.RFC3339, start)
	if err != nil {
		t.Fatal(err)
	}
	p, err := NewVIPPeriod(from, from.AddDate(0, 1, 0))
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestVIPAllowanceOncePerTrustedMembershipMonthIncludingOfflineCatchup(t *testing.T) {
	first := vipTestPeriod(t, "2026-08-14T12:00:00Z")
	second := vipTestPeriod(t, "2026-09-14T12:00:00Z")
	future := vipTestPeriod(t, "2026-10-14T12:00:00Z")
	now := second.StartsAt.Add(time.Hour)
	ep := 7
	var receipts map[string]int
	amount, until, err := ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{future, second, first}, now)
	if err != nil || amount != 200 || ep != 207 || !until.Equal(second.EndsAt) || len(receipts) != 2 {
		t.Fatal("incorrect catchup grant", amount, ep, until, err)
	}
	ep = 0 // Spending must never restore the same month's grant.
	if amount, _, err = ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{first, second, future}, now); err != nil || amount != 0 || ep != 0 {
		t.Fatal("repeated month granted twice", err)
	}
	if amount, until, err = ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{first, second, future}, future.StartsAt); err != nil || amount != 100 || ep != 100 || !until.Equal(future.EndsAt) {
		t.Fatal("next month did not unlock exactly once", err)
	}
}

func TestVIPPeriodsFailClosedForOverlapForgeryOverflowAndRevocation(t *testing.T) {
	base := vipTestPeriod(t, "2026-09-14T00:00:00Z")
	for _, scenario := range []string{"overlap", "forged-id", "short", "overflow", "wrong-receipt"} {
		t.Run(scenario, func(t *testing.T) {
			periods := []VIPPeriod{base}
			ep := 9
			receipts := map[string]int{}
			switch scenario {
			case "overlap":
				periods = append(periods, base)
			case "forged-id":
				periods[0].ID = "free-month"
			case "short":
				periods[0].EndsAt = base.StartsAt.Add(time.Hour)
			case "overflow":
				ep = int(^uint(0)>>1) - 99
			case "wrong-receipt":
				receipts[base.ID] = 999
			}
			before, size := ep, len(receipts)
			if amount, until, err := ApplyVIPAllowance(&ep, &receipts, periods, base.StartsAt); err == nil || amount != 0 || !until.IsZero() || ep != before || len(receipts) != size {
				t.Fatal("invalid membership mutated wallet", err)
			}
		})
	}
	ep := 0
	var receipts map[string]int
	base.Revoked = true
	if amount, until, err := ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{base}, base.StartsAt); err != nil || amount != 0 || !until.IsZero() || ep != 0 {
		t.Fatal("revoked month granted membership/EP", err)
	}
}

func TestVIPExpiryIsExclusiveAndTimezoneCannotCreateAnotherReceipt(t *testing.T) {
	base := vipTestPeriod(t, "2026-09-14T00:00:00Z")
	from, _ := time.Parse(time.RFC3339, "2026-09-13T20:00:00-04:00")
	other, err := NewVIPPeriod(from, from.AddDate(0, 1, 0))
	if err != nil || other.ID != base.ID {
		t.Fatal("timezone changed membership identity", err)
	}
	ep := 0
	receipts := map[string]int{base.ID: 100}
	if _, until, err := ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{base}, base.EndsAt); err != nil || !until.IsZero() || ep != 0 {
		t.Fatal("expired VIP remained active", err)
	}
	if _, err := NewVIPPeriod(base.StartsAt, base.StartsAt.Add(365*24*time.Hour)); err == nil {
		t.Fatal("year treated as a single paid month")
	}
}

func TestAdministratorVIPAllowanceSharesPaidMonthInEitherOrder(t *testing.T) {
	for _, adminFirst := range []bool{false, true} {
		t.Run(map[bool]string{false: "paid-first", true: "admin-first"}[adminFirst], func(t *testing.T) {
			period := vipTestPeriod(t, "2026-09-20T00:00:00Z")
			ep := 0
			var receipts map[string]int
			var initial []VIPPeriod
			if !adminFirst {
				initial = []VIPPeriod{period}
			}
			if amount, _, err := ApplyVIPAllowance(&ep, &receipts, initial, period.StartsAt, adminFirst); err != nil || amount != 100 {
				t.Fatal("initial allowance", amount, err)
			}
			// Even role removal before a later paid membership must not duplicate EP.
			if amount, _, err := ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{period}, period.StartsAt, !adminFirst); err != nil || amount != 0 || ep != 100 {
				t.Fatal("membership sources stacked", amount, ep, err)
			}
			if receipts[period.ID] != 100 || receipts["vip-admin-2026-09"] != 100 {
				t.Fatal("both entitlement receipts must be retained", receipts)
			}
			ep = 0
			if amount, _, err := ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{period}, period.StartsAt, true); err != nil || amount != 0 || ep != 0 {
				t.Fatal("spending restored allowance", amount, err)
			}
		})
	}
}

func TestAdministratorVIPFutureOrRevokedMembershipDoesNotBlockAllowance(t *testing.T) {
	now := time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)
	for _, revoked := range []bool{false, true} {
		period := vipTestPeriod(t, "2026-09-25T00:00:00Z")
		if revoked {
			period = vipTestPeriod(t, "2026-09-10T00:00:00Z")
			period.Revoked = true
		}
		ep := 0
		var receipts map[string]int
		amount, until, err := ApplyVIPAllowance(&ep, &receipts, []VIPPeriod{period}, now, true)
		if err != nil || amount != 100 || ep != 100 || !until.Equal(time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)) {
			t.Fatal("inactive membership blocked admin entitlement", amount, until, err)
		}
	}
}

func TestAdministratorVIPReceiptAndOverflowFailAtomically(t *testing.T) {
	now := time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)
	for _, invalidReceipt := range []bool{false, true} {
		ep := int(^uint(0)>>1) - 99
		receipts := map[string]int{}
		if invalidReceipt {
			ep = 10
			receipts["vip-admin-2026-09"] = 999
		}
		before, size := ep, len(receipts)
		if _, _, err := ApplyVIPAllowance(&ep, &receipts, nil, now, true); err == nil || ep != before || len(receipts) != size {
			t.Fatal("invalid allowance changed wallet or receipts", err)
		}
	}
}
