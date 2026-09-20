package game

import (
	"encoding/json"
	"slices"
	"testing"
)

func TestRouletteEverySpotPayoutAndSingleZero(t *testing.T) {
	ids := map[string]bool{}
	for _, spot := range RouletteSpots() {
		if ids[spot.ID] || len(spot.Numbers)*spot.Multiplier != 36 {
			t.Fatal("invalid roulette spot", spot)
		}
		ids[spot.ID] = true
		total := 0
		for n := 0; n <= 36; n++ {
			payout, err := RoulettePayout("ep", []CasinoWager{{spot.ID, 1}}, n)
			want := 0
			if slices.Contains(spot.Numbers, n) {
				want = spot.Multiplier
			}
			if err != nil || payout != want {
				t.Fatal(spot.ID, n, payout, err)
			}
			total += payout
		}
		if total != 36 {
			t.Fatal("unexpected return across all 37 outcomes", spot.ID, total)
		}
	}
	if len(ids) != 157 {
		t.Fatal("incomplete betting board", len(ids))
	}
	for _, spot := range []string{"red", "black", "odd", "even", "low", "high", "dozen-1", "column-1"} {
		if payout, err := RoulettePayout("gold", []CasinoWager{{spot, 100000}}, 0); err != nil || payout != 0 {
			t.Fatal("zero paid outside bet", spot, payout, err)
		}
	}
	for currency, stake := range map[string]int{"gold": 100000, "ep": 100} {
		if payout, err := RoulettePayout(currency, []CasinoWager{{"number:0", stake}}, 0); err != nil || payout != 36*stake {
			t.Fatal("straight payout", payout, err)
		}
	}
	if n, err := RouletteSpin(); err != nil || n < 0 || n > 36 {
		t.Fatal("secure spin", n, err)
	}
}

func TestHouseWagersRejectForgedSpotsCurrencyAndAggregateOverbet(t *testing.T) {
	for _, tc := range []struct {
		kind, currency string
		bets           []CasinoWager
	}{
		{"roulette", "ep", nil}, {"roulette", "ep", []CasinoWager{{"number:37", 1}}},
		{"roulette", "ep", []CasinoWager{{"split:1-5", 1}}}, {"roulette", "ep", []CasinoWager{{"red", 60}, {"black", 60}}},
		{"roulette", "ep", []CasinoWager{{"red", 1}, {"red", 1}}}, {"roulette", "ep", []CasinoWager{{"red", int(^uint(0) >> 1)}}},
		{"roulette", "EP", []CasinoWager{{"red", 1}}}, {"roulette", "gold", []CasinoWager{{"red", -20}}},
		{"baccarat", "ep", []CasinoWager{{"banker", 21}}}, {"baccarat", "ep", []CasinoWager{{"banker", 80}, {"tie", 40}}},
		{"baccarat", "gold", []CasinoWager{{"unknown", 20}}}, {"other", "gold", []CasinoWager{{"red", 20}}},
	} {
		if _, err := ValidateHouseWagers(tc.kind, tc.currency, tc.bets); err == nil {
			t.Fatal("accepted invalid slip", tc)
		}
	}
	if payout, err := RoulettePayout("ep", []CasinoWager{{"red", 1}}, -1); err == nil || payout != 0 {
		t.Fatal("invalid result paid")
	}
}

func TestBaccaratCompleteBankerThirdCardTable(t *testing.T) {
	// Columns: no player third card, then player values 0..9.
	want := []string{"DDDDDDDDDDD", "DDDDDDDDDDD", "DDDDDDDDDDD", "DDDDDDDDDSD", "DSSDDDDDDSS", "DSSSSDDDDSS", "SSSSSSSDDSS", "SSSSSSSSSSS", "SSSSSSSSSSS", "SSSSSSSSSSS"}
	for total, row := range want {
		for column, expected := range row {
			if baccaratBankerDraw(total, column-1) != (expected == 'D') {
				t.Fatal("third-card rule", total, column-1)
			}
		}
	}
}

func TestBaccaratNaturalDrawAndPayouts(t *testing.T) {
	for _, tc := range []struct {
		cards                []int
		winner               string
		player, banker, used int
	}{
		{[]int{3, 2, 3, 3, 9, 9}, "player", 8, 7, 4},
		{[]int{2, 3, 3, 3, 9, 9}, "banker", 7, 8, 4},
		{[]int{3, 3, 3, 3, 9, 9}, "tie", 8, 8, 4},
		{[]int{1, 0, 1, 1, 7, 9}, "banker", 2, 3, 5}, // Player draws eight; banker stays on three.
		{[]int{1, 1, 1, 1, 1, 0}, "player", 6, 5, 6},
		{[]int{2, 0, 2, 1, 0}, "player", 6, 4, 5}, // Player stands, banker draws.
	} {
		r, used, err := dealBaccarat(tc.cards)
		if err != nil || used != tc.used || r.Winner != tc.winner || r.PlayerTotal != tc.player || r.BankerTotal != tc.banker || r.Validate() != nil {
			t.Fatal("deal", tc, r, used, err)
		}
		for _, currency := range []string{"gold", "ep"} {
			for _, spot := range []string{"player", "banker", "tie"} {
				want := 0
				if r.Winner == "tie" {
					if spot == "tie" {
						want = 180
					} else {
						want = 20
					}
				} else if spot == r.Winner {
					if spot == "banker" {
						want = 39
					} else {
						want = 40
					}
				}
				if amount, err := BaccaratPayout(currency, []CasinoWager{{spot, 20}}, r); err != nil || amount != want {
					t.Fatal("payout", currency, spot, amount, want, err)
				}
			}
		}
		encoded, _ := json.Marshal(r)
		var restored BaccaratResult
		if json.Unmarshal(encoded, &restored) != nil || restored.Validate() != nil {
			t.Fatal("result cannot recover")
		}
		restored.PlayerTotal++
		if restored.Validate() == nil {
			t.Fatal("forged total accepted")
		}
	}
	if result, err := NewBaccaratResult(); err != nil || result.Validate() != nil {
		t.Fatal("secure shoe invalid", err)
	}
	if _, _, err := dealBaccarat([]int{0, 0, 0, 0}); err == nil {
		t.Fatal("incomplete mandatory draws accepted")
	}
	if _, _, err := dealBaccarat([]int{-1, 0, 0, 0}); err == nil {
		t.Fatal("invalid card accepted")
	}
	if _, err := BaccaratPayout("ep", []CasinoWager{{"banker", 20}}, nil); err == nil {
		t.Fatal("nil result paid")
	}
}
