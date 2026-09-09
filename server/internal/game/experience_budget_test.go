package game

import "testing"

func TestCandidateCombatExperienceBudgets(t *testing.T) {
	for level := 1; level <= 100; level++ {
		threshold := 100 + 25*(level-1)*(level-1)
		for _, rank := range []struct {
			boss, elite bool
			percent     int
		}{{false, false, 10}, {false, true, 20}, {true, false, 35}, {true, true, 35}} {
			budget := combatExperienceBudget(level, 0, rank.boss, rank.elite)
			if budget != threshold*rank.percent/100 {
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
	if got := combatExperienceBudget(100, 30, true, false); got != 7393 {
		t.Fatalf("selected run level must own boss budget: %d", got)
	}
	if got := combatExperienceBudget(1, 100, false, false); got != 10 {
		t.Fatalf("run level must not inflate an ordinary level-one target: %d", got)
	}
}
