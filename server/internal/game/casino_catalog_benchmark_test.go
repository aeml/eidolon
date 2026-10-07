package game

import (
	"fmt"
	"testing"
	"time"
)

func BenchmarkCasinoTableLookup(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		table, ok := CasinoTableByID("public-slots-earth")
		if !ok || len(table.Seats) != 1 {
			b.Fatal("existing slot cabinet lost")
		}
	}
}

func BenchmarkCasinoGameKindLookup(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		if !IsCasinoPokerTable("public-poker") || !IsCasinoBlackjackTable("vip-blackjack-fire") {
			b.Fatal("existing table kind lost")
		}
	}
}

// Actual generated world,100 current players/60 normal public seat claims.
// Static presence-only CPU/allocation comparison; no sockets, wagers, update
// contention, saved-state, active raid/event or production headroom acceptance.
func BenchmarkCasinoPresenceCurrentPopulation100(b *testing.B) {
	w := NewWorld(nil)
	b.Cleanup(w.StopBackground)
	type seatChoice struct {
		table CasinoTable
		seat  int
	}
	var choices []seatChoice
	for _, table := range CasinoTables() {
		if table.Floor == "public" {
			for seat := range table.Seats {
				choices = append(choices, seatChoice{table, seat})
			}
		}
	}
	if len(choices) < 60 {
		b.Fatal("normal public seats missing")
	}
	now := time.Now()
	for index := 0; index < 100; index++ {
		player := &Entity{ID: fmt.Sprintf("presence-profile-%d", index), Name: "Fixture",
			Type: TypePlayer, State: "IDLE", Health: 100, MaxHealth: 100, Z: 200}
		if index < 60 {
			choice := choices[index]
			position := choice.table.Seats[choice.seat]
			player.InstanceID, player.X, player.Z = CasinoInstanceID, position.ExitX, position.ExitZ
		}
		w.AddEntity(player)
		if index < 60 {
			choice := choices[index]
			if _, err := w.TakeCasinoSeat(player.ID, choice.table.ID, choice.seat, now); err != nil {
				b.Fatal("ordinary seat claim failed", err)
			}
		}
	}
	b.ReportAllocs()
	for b.Loop() {
		presence := w.CasinoPresenceFor("presence-profile-0", now)
		if len(presence.Occupants) != 60 || presence.YourSeat == nil || len(presence.Preparation) != len(casinoTableCatalog) {
			b.Fatal("normal current presence changed")
		}
	}
	b.ReportMetric(float64(len(w.Entities)), "world-actors")
}
