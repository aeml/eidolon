package forging

import "testing"

func TestPotencyCostsFitOrdinaryInventoryAndRetainEarlyPrices(t *testing.T) {
	want := []int{1, 2, 4, 8, 16, 32, 64, 128, 256, 320, 448, 640,
		896, 1216, 1600, 2048, 2560, 3136, 3776, 4480}
	for rank, price := range want {
		if got := PotencyCost(rank); got != price || got > 5000 {
			t.Fatalf("rank %d: cost %d, want %d (at most five normal stacks)", rank, got, price)
		}
	}
	for _, invalid := range []int{-1, 20, 100} {
		if PotencyCost(invalid) != 0 {
			t.Fatalf("invalid potency %d has a quote", invalid)
		}
	}
}
