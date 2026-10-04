package game

import (
	"reflect"
	"sync"
	"testing"
)

func TestCasinoCatalogMatchesAuthoredGeometryAndIsDetached(t *testing.T) {
	expected := buildCasinoTables()
	actual := CasinoTables()
	if !reflect.DeepEqual(actual, expected) {
		t.Fatal("cached catalogue changed authored order, geometry or rules")
	}
	for _, want := range expected {
		got, ok := CasinoTableByID(want.ID)
		if !ok || !reflect.DeepEqual(got, want) || IsCasinoPokerTable(want.ID) != (want.Game == "poker") || IsCasinoBlackjackTable(want.ID) != (want.Game == "blackjack") {
			t.Fatal("indexed lookup changed existing table or game kind")
		}
		got.Seats[0].X += 999
		got.Name = "mutated caller"
	}
	actual[0].Seats[0].X += 999
	actual[0].ID = "mutated caller"
	actual = append(actual, CasinoTable{ID: "injected"})
	if !reflect.DeepEqual(CasinoTables(), expected) {
		t.Fatal("returned catalogue/lookup aliases authoritative geometry")
	}
	for _, id := range []string{"", "private/session-text", "public-blackjack-water", "injected"} {
		if got, ok := CasinoTableByID(id); ok || !reflect.DeepEqual(got, CasinoTable{}) || IsCasinoPokerTable(id) || IsCasinoBlackjackTable(id) {
			t.Fatal("unknown/retired furniture admitted as active table")
		}
	}
	recovery := CasinoBlackjackRecoveryTables()
	recovery[0].Seats[0].X += 999
	if !reflect.DeepEqual(CasinoTables(), expected) || recovery[len(recovery)-1].ID != "public-blackjack-water" {
		t.Fatal("recovery catalogue lost retired funded table or aliases live geometry")
	}
}

func TestCasinoCatalogConcurrentLookupCopiesStayIndependent(t *testing.T) {
	expected, ok := CasinoTableByID("public-poker")
	if !ok {
		t.Fatal("missing poker table")
	}
	var workers sync.WaitGroup
	for worker := 0; worker < 8; worker++ {
		workers.Go(func() {
			for i := 0; i < 100; i++ {
				got, ok := CasinoTableByID(expected.ID)
				if !ok || !reflect.DeepEqual(got, expected) {
					t.Error("concurrent caller changed another lookup")
					return
				}
				got.Seats[0].X += 999
			}
		})
	}
	workers.Wait()
}
