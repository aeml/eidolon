package game

import "testing"

func TestDarkKingHealthBudgetIncludesMandatoryMythicScaling(t *testing.T) {
	profile := dungeonEnemyCombatProfile("UmbraPrime", 100, DifficultyMythic, dungeonRankBoss, 2.5)
	if profile.Health != 570000 || profile.MaxHealth != 570000 {
		t.Fatalf("finale health must include the actual Mythic scaling: %+v", profile)
	}
	if dungeonBossBalances["UmbraPrime"].DamageMultiplier != 1.55 {
		t.Fatal("health pacing must not silently weaken incoming attacks")
	}
	for phase, hp := range []int{570000, 427500, 285000, 142500} {
		if got := darkKingPhase(hp, profile.MaxHealth); got != phase+1 {
			t.Fatalf("phase at %dHP: got%d want%d", hp, got, phase+1)
		}
	}
}
