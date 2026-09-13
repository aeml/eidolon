package game

import "testing"

func TestGoldBudgetPreservesBossesAndDistinguishesOrdinaryElites(t *testing.T) {
	for _, level := range []int{1, 10, 30, 60, 70, 90, 100} {
		lo, hi := combatGoldBounds(level, false, false)
		if lo != 10 || hi != 2*level+9 {
			t.Fatal("ordinary Gold range mismatch")
		}
		elo, ehi := combatGoldBounds(level, false, true)
		if elo != 2*lo || ehi != 2*hi {
			t.Fatal("elite premium mismatch")
		}
		blo, bhi := combatGoldBounds(level, true, true)
		if blo != 10 || bhi != 10*level+9 {
			t.Fatal("boss purse changed or doubled by elite marker")
		}
	}
	if lo, hi := combatGoldBounds(0, false, false); lo != 0 || hi != 0 {
		t.Fatal("invalid content level pays Gold")
	}
}

func TestGoldHuntBudgetAgainstRespecAndWeeklyReward(t *testing.T) {
	lo, hi := combatGoldBounds(90, false, false)
	hunt := dailyRewardBudget("CycloneAvatar", 100)
	// Before Fortune, difficulty, vendor sales and party distribution. This is
	// purchasing-power arithmetic, not a claim about hours of real play.
	expectedGold := float64(lo+hi)/2*100 + float64(hunt.Gold)
	if expectedGold != 11750 {
		t.Fatalf("unexpected new hunt purse: %.0f", expectedGold)
	}
	resets := expectedGold / float64(respecGoldCost(90, "talents"))
	if resets < 2 || resets > 2.5 {
		t.Fatalf("hunt no longer funds roughly two talent resets: %.2f", resets)
	}
	lo, hi = combatGoldBounds(100, false, false)
	if float64(lo+hi)/2 != 109.5 || ResonanceXPPerLevel != 5_000_000 {
		t.Fatal("Gold target or established Resonance curve changed")
	}
}
