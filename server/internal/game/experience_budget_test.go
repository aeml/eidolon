package game

import "testing"

func TestCandidateCombatExperienceBudgets(t *testing.T) {
	for level := 1; level <= 100; level++ {
		ordinary := ordinaryExperienceBudget(level)
		for _, rank := range []struct {
			boss, elite bool
			xp          int
		}{{false, false, ordinary}, {false, true, ordinary * 3}, {true, false, ordinary * 8}, {true, true, ordinary * 8}} {
			budget := combatExperienceBudget(level, 0, rank.boss, rank.elite)
			if budget != rank.xp {
				t.Fatalf("level %d budget %d", level, budget)
			}
			for _, difficulty := range []float64{1, 2, 4} {
				for _, size := range []int{0, 1, 2, 5} {
					want := int(float64(budget) * difficulty)
					if !rank.boss && size > 1 {
						want = int(float64(budget)*(1+.1*float64(size))*difficulty) / size
					}
					if got := recipientCombatExperience(budget, rank.boss, size, difficulty); got != want {
						t.Fatalf("level=%d size=%d boss=%t: %d != %d", level, size, rank.boss, got, want)
					}
				}
			}
		}
	}
	if got := combatExperienceBudget(100, 30, true, false); got != 520 {
		t.Fatalf("selected run level must own boss budget: %d", got)
	}
	if got := combatExperienceBudget(1, 100, false, false); got != 5 {
		t.Fatalf("run level must not inflate an ordinary level-one target: %d", got)
	}
}

func TestOrdinaryExperienceAnchorsHaveNoRewardCliffs(t *testing.T) {
	for level, want := range map[int]int{-1: 5, 1: 5, 5: 14, 10: 26, 20: 45, 30: 65, 40: 100, 50: 135, 60: 170, 70: 210, 80: 250, 90: 315, 100: 380, 101: 380} {
		if got := ordinaryExperienceBudget(level); got != want {
			t.Fatalf("level%d: %d != %d", level, got, want)
		}
	}
	for level := 2; level <= 100; level++ {
		if ordinaryExperienceBudget(level) < ordinaryExperienceBudget(level-1) {
			t.Fatalf("reward cliff at%d", level)
		}
	}
}
