package database

import "testing"

func TestDurableGoldCreditIsIdempotentAndRejectsConflicts(t *testing.T) {
	gold := 10
	var receipts map[string]int
	for i := 0; i < 3; i++ {
		if err := ApplyGoldCredit(&gold, &receipts, "refund", 43); err != nil {
			t.Fatal(err)
		}
	}
	if gold != 53 || receipts["refund"] != 43 {
		t.Fatal("duplicate credit")
	}
	for _, test := range []struct {
		id     string
		amount int
	}{{"refund", 44}, {"", 1}, {"bad", 0}, {"bad", -1}} {
		if err := ApplyGoldCredit(&gold, &receipts, test.id, test.amount); err == nil {
			t.Fatal("invalid/conflicting credit accepted")
		}
	}
	gold = int(^uint(0) >> 1)
	if err := ApplyGoldCredit(&gold, &receipts, "overflow", 1); err == nil || receipts["overflow"] != 0 {
		t.Fatal("overflow accepted")
	}
}
