package game

import "testing"

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
