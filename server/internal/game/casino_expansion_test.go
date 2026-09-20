package game

import "testing"

func TestExpandedCasinoHasRequestedStationsOnBothFullFloors(t *testing.T) {
	counts := map[string]map[string]int{"public": {}, "vip": {}}
	ids := map[string]bool{}
	for _, table := range CasinoTables() {
		if ids[table.ID] {
			t.Fatal("duplicate table", table.ID)
		}
		ids[table.ID] = true
		counts[table.Floor][table.Game]++
		if (table.Floor == "vip") != (table.Currency == "ep" && table.Y == 8) {
			t.Fatal("wrong floor/currency", table.ID)
		}
		if table.Game == "slots" {
			if _, ok := slotMachine(table.SlotTheme); !ok || len(table.Seats) != 1 {
				t.Fatal("missing machine theme or station", table.ID)
			}
		} else if len(table.Seats) != 6 {
			t.Fatal("missing multiplayer chairs", table.ID)
		}
		for _, seat := range table.Seats {
			if safeZoneAt(initialSafeZones, CasinoInstanceID, seat.ExitX, seat.ExitZ) != "casino" {
				t.Fatal("casino chair outside safe zone", table.ID, seat)
			}
			x, z := constrainCasinoInterior(seat.ExitX, seat.ExitZ)
			if x != seat.ExitX || z != seat.ExitZ || seat.Y != table.Y {
				t.Fatal("unreachable seat exit", table.ID, seat)
			}
		}
	}
	for floor, games := range counts {
		for kind, want := range map[string]int{"blackjack": 4, "poker": 4, "roulette": 2, "baccarat": 4, "slots": 32} {
			if games[kind] != want {
				t.Fatal(floor, kind, games[kind], want)
			}
		}
	}
	for _, point := range [][2]float64{{0, 150}, {-45, 190}, {45, 105}, {52, 204}} {
		x, z := constrainCasinoVIPInterior(point[0], point[1], 0, 104)
		if x != point[0] || z != point[1] {
			t.Fatal("VIP floor still limited to a balcony", point)
		}
	}
}

func TestExpandedCasinoRetainsFundedRetiredBlackjackRecovery(t *testing.T) {
	if _, exists := CasinoTableByID("public-blackjack-water"); exists {
		t.Fatal("retired fifth public blackjack table is still seatable")
	}
	found := false
	for _, table := range CasinoBlackjackRecoveryTables() {
		if table.ID == "public-blackjack-water" {
			found = table.Currency == "gold"
		}
	}
	if !found {
		t.Fatal("retired table lost pending money recovery")
	}
}
