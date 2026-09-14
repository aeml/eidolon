package database

import "testing"

const exchangeTestID = "01234567-89ab-4cde-8fab-0123456789ab"

func TestEPExchangeIsOneWayAndIdempotent(t *testing.T) {
	gold, ep := 3*GoldPerEP, 7
	var receipts map[string]int
	if applied, err := ApplyEPExchange(&gold, &ep, &receipts, exchangeTestID, 2); err != nil || !applied || gold != GoldPerEP || ep != 9 {
		t.Fatalf("exchange: gold=%d ep=%d applied=%v err=%v", gold, ep, applied, err)
	}
	// The replay succeeds even when the remaining Gold cannot fund it again.
	if applied, err := ApplyEPExchange(&gold, &ep, &receipts, exchangeTestID, 2); err != nil || applied || gold != GoldPerEP || ep != 9 {
		t.Fatal("duplicate exchange changed either wallet", err)
	}
	if _, err := ApplyEPExchange(&gold, &ep, &receipts, exchangeTestID, 1); err == nil || gold != GoldPerEP || ep != 9 {
		t.Fatal("receipt reused with changed quantity")
	}
}

func TestEPExchangeRejectsInvalidAmountsAndOverflowWithoutMutation(t *testing.T) {
	maxInt := int(^uint(0) >> 1)
	for _, tc := range []struct {
		gold, ep, amount int
		id               string
	}{
		{GoldPerEP, 2, -1, exchangeTestID}, {GoldPerEP, 2, 0, exchangeTestID},
		{GoldPerEP - 1, 2, 1, exchangeTestID}, {maxInt, 2, maxInt/GoldPerEP + 1, exchangeTestID},
		{GoldPerEP, maxInt, 1, exchangeTestID}, {GoldPerEP, -1, 1, exchangeTestID},
		{GoldPerEP, 2, 1, ""}, {GoldPerEP, 2, 1, "$invalid.receipt"},
	} {
		gold, ep := tc.gold, tc.ep
		var receipts map[string]int
		if _, err := ApplyEPExchange(&gold, &ep, &receipts, tc.id, tc.amount); err == nil || gold != tc.gold || ep != tc.ep || len(receipts) != 0 {
			t.Fatalf("invalid exchange mutated wallets: %+v", tc)
		}
	}
}
