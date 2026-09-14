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
