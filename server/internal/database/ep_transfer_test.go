package database

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestEPCasinoTransferReplayAndBounds(t *testing.T) {
	ep, receipts := 100, map[string]int{}
	if err := ApplyEPTransfer(&ep, &receipts, "casino:round:debit", -100); err != nil || ep != 0 {
		t.Fatal("EP debit failed", ep, err)
	}
	if err := ApplyEPTransfer(&ep, &receipts, "casino:round:debit", -100); err != nil || ep != 0 {
		t.Fatal("spent debit replayed", ep, err)
	}
	if err := ApplyEPTransfer(&ep, &receipts, "casino:round:debit", 100); err == nil || ep != 0 {
		t.Fatal("signed receipt could change purpose")
	}
	if err := ApplyEPTransfer(&ep, &receipts, "casino:round:other", -1); !errors.Is(err, ErrInsufficientEP) || len(receipts) != 1 {
		t.Fatal("shortfall changed receipt", err)
	}
	if err := ApplyEPTransfer(&ep, &receipts, "casino:round:return", 250); err != nil || ep != 250 {
		t.Fatal("EP return failed", err)
	}
	ep = 0 // All winnings have since been spent on cosmetics.
	if err := ApplyEPTransfer(&ep, &receipts, "casino:round:return", 250); err != nil || ep != 0 {
		t.Fatal("payout replay created new spending power", err)
	}
	maximum := int(^uint(0) >> 1)
	for _, tc := range []struct{ balance, amount int }{{0, -maximum - 1}, {maximum, 1}, {-1, 1}, {100, 0}} {
		balance, ledger := tc.balance, map[string]int{}
		if ApplyEPTransfer(&balance, &ledger, "casino:round:invalid", tc.amount) == nil || balance != tc.balance || len(ledger) != 0 {
			t.Fatal("unsafe amount mutated EP", tc)
		}
	}
}

func TestCasinoEPRecordCurrencyCannotCrossFloors(t *testing.T) {
	epTables := []string{"vip-blackjack", "vip-poker", "slots:ep:" + strings.Repeat("a", 64) + ":fire"}
	for _, table := range epTables {
		op := BlackjackTransfer{ID: "casino:round:debit", PlayerID: "player-hero", Currency: "ep", Amount: -100, NextState: []byte(`{"phase":"playing"}`)}
		if err := op.ValidateForTable(table); err != nil {
			t.Fatal(table, err)
		}
		op.Currency = "gold"
		if op.ValidateForTable(table) == nil {
			t.Fatal("Gold admitted to VIP table", table)
		}
	}
	for _, table := range []string{"public-blackjack", "public-blackjack-earth", "public-poker", "slots:" + strings.Repeat("b", 64) + ":fire", "vip-unknown", "slots:ep:malformed:fire", ""} {
		op := BlackjackTransfer{ID: "casino:round:debit", PlayerID: "player-hero", Currency: "ep", Amount: -10, NextState: []byte(`{}`)}
		if op.ValidateForTable(table) == nil {
			t.Fatal("EP accepted at Gold/unknown record", table)
		}
	}
	for _, family := range []struct {
		id      string
		maximum int
	}{{"casino:round:return", 1600}, {"casino:poker:round:return", 600}, {"casino:slots:owner:return", 20000}} {
		op := BlackjackTransfer{ID: family.id, PlayerID: "player-hero", Currency: "ep", Amount: family.maximum, NextState: []byte(`{}`)}
		if op.Validate() != nil {
			t.Fatal("legal EP payout rejected", family)
		}
		for _, amount := range []int{family.maximum + 1, -101, 0} {
			op.Amount = amount
			if op.Validate() == nil {
				t.Fatal("EP cap exceeded", family, amount)
			}
		}
	}
}

func TestEPCasinoTransferDoesNotAliasOtherWalletReceipts(t *testing.T) {
	character := Character{Gold: 9876, EP: 100, GoldCreditReceipts: map[string]int{"casino:round:debit": -100}}
	before := Character{Gold: character.Gold, GoldCreditReceipts: map[string]int{"casino:round:debit": -100}}
	if err := ApplyEPTransfer(&character.EP, &character.EPCasinoReceipts, "casino:round:debit", -100); err != nil || character.EP != 0 {
		t.Fatal("EP ledger reused Gold receipt", err)
	}
	if character.Gold != before.Gold || !reflect.DeepEqual(character.GoldCreditReceipts, before.GoldCreditReceipts) {
		t.Fatal("EP wager altered Gold")
	}
}
