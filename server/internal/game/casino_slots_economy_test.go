package game

import (
	"math"
	mathrand "math/rand"
	"os"
	"testing"
)

// Opt-in release tuning, not part of every CI run. Samples complete paid cycles
// including all earned free spins and bonuses. This estimates, not proves, RTP;
// production still uses crypto/rand, never this reproducible audit source.
func TestSlotEconomyReview(t *testing.T) {
	if os.Getenv("EIDOLON_SLOT_ECONOMY_REVIEW") != "1" {
		t.Skip("one-off slot payout review")
	}
	const cycles = 50000
	matched := false
	for i, machine := range SlotMachines() {
		if theme := os.Getenv("EIDOLON_SLOT_ECONOMY_THEME"); theme != "" && theme != machine.Theme {
			continue
		}
		matched = true
		rng := mathrand.New(mathrand.NewSource(190013 + int64(i)))
		draw := func(limit int) (int, error) { return rng.Intn(limit), nil }
		session, _ := NewSlotSession(machine.Theme)
		sum, squares := 0.0, 0.0
		spins, jackpots, maximum := 0, 0, 0
		for cycle := 0; cycle < cycles; cycle++ {
			returned, featureSpins := 0, 0
			spin := func() {
				next, _, err := proposeSlotSpin(*session, 20, draw)
				if err != nil {
					t.Fatal(err)
				}
				session = next
				returned += next.Last.Payout
				spins++
				featureSpins++
				for _, stage := range next.Last.Stages {
					if stage.Jackpot {
						jackpots++
					}
				}
			}
			spin()
			for session.Bonus || session.FreeSpins > 0 {
				if featureSpins > 10000 {
					t.Fatal("nonterminating feature")
				}
				if session.Bonus {
					next, reward, err := ProposeSlotBonus(*session, 0)
					if err != nil {
						t.Fatal(err)
					}
					session = next
					returned += reward
				} else {
					spin()
				}
			}
			maximum = max(maximum, returned)
			ratio := float64(returned) / 20
			sum += ratio
			squares += ratio * ratio
		}
		mean := sum / cycles
		variance := (squares - sum*sum/cycles) / (cycles - 1)
		margin := 1.96 * math.Sqrt(variance/cycles)
		t.Logf("theme=%s paid_cycles=%d total_spins=%d sampled_return=%.4f approximate_95CI=[%.4f,%.4f] jackpots=%d maximum_observed_cycle_return=%dGold", machine.Theme, cycles, spins, mean, mean-margin, mean+margin, jackpots, maximum)
	}
	if !matched {
		t.Fatal("unknown slot economy review theme")
	}
}
