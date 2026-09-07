package game

import (
	"math"
	"testing"
)

func TestEffectiveCriticalChanceRanksAndSkillIdentity(t *testing.T) {
	for _, tc := range []struct {
		name, class, skill string
		ranks              map[string]int
		equipment, want    float64
	}{
		{"baseline", "Rogue", "Backstab", nil, .12, .12},
		{"one technique rank", "Rogue", "Backstab", map[string]int{"ROG_04": 1}, .12, .14},
		{"five technique ranks", "Rogue", "Backstab", map[string]int{"ROG_04": 5}, .12, .22},
		{"unrelated technique", "Rogue", "Backstab", map[string]int{"ROG_02": 5}, .12, .12},
		{"technique not basic", "Rogue", "", map[string]int{"ROG_04": 5}, .12, .12},
		{"generic basic", "Rogue", "", map[string]int{"ROG_32": 5, "ROG_39": 5}, .12, .37},
		{"stacked named", "Rogue", "Backstab", map[string]int{"ROG_04": 5, "ROG_32": 5, "ROG_39": 5}, .12, .47},
		{"Fighter generic", "Fighter", "Whirlwind", map[string]int{"FTR_39": 5}, .12, .22},
		{"Wizard generic", "Wizard", "Fireball", map[string]int{"WIZ_39": 5}, .12, .22},
		{"Cleric cross-class ignored", "Cleric", "Radiant Strike", map[string]int{"WIZ_39": 5}, .12, .12},
		{"bad IDs and negative ranks", "Rogue", "Backstab", map[string]int{"ROG_04": -1, "ROG_99": 5}, .12, .12},
		{"capped legacy duplicate", "Rogue", "Backstab", map[string]int{"ROG_4": 99, "ROG_04": 2}, .12, .22},
		{"cap chance", "Rogue", "Backstab", map[string]int{"ROG_04": 5}, .95, 1},
		{"negative equipment", "Rogue", "Backstab", map[string]int{"ROG_04": 5}, -1, .1},
		{"nonfinite equipment", "Rogue", "Backstab", map[string]int{"ROG_04": 5}, math.NaN(), .1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := &Entity{SubType: tc.class, TalentRanks: tc.ranks, CritChanceBonus: tc.equipment}
			if got := effectiveCriticalChance(p, tc.skill); math.Abs(got-tc.want) > 1e-9 {
				t.Fatalf("critical chance=%v want=%v", got, tc.want)
			}
		})
	}
	if effectiveCriticalChance(nil, "Backstab") != 0 {
		t.Fatal("nil attacker gained critical chance")
	}
}

func TestCombatSnapshotPreservesIndependentTalentRanks(t *testing.T) {
	p := &Entity{SubType: "Rogue", TalentRanks: map[string]int{"ROG_04": 5}, CritChanceBonus: .2}
	p.Mu.RLock()
	snapshot := snapshotCombatAttackerLocked(p)
	p.Mu.RUnlock()
	p.TalentRanks["ROG_04"] = 0
	if got := effectiveCriticalChance(snapshot, "Backstab"); math.Abs(got-.3) > 1e-9 {
		t.Fatalf("snapshot lost cast/tick ranks: %v", got)
	}
	snapshot.TalentRanks["ROG_32"] = 5
	if len(p.TalentRanks) != 1 {
		t.Fatal("snapshot aliases live talent map")
	}
}

func TestCriticalCompositionDoesNotAddASecondOrdinaryMultiplier(t *testing.T) {
	p := &Entity{Type: TypePlayer, SubType: "Rogue", CritChanceBonus: .95,
		TalentRanks: map[string]int{"ROG_04": 5}, FireDamageBonus: .5}
	target := &Entity{Type: TypeEnemy, Health: 10000, MaxHealth: 10000}
	for i := 0; i < 20; i++ {
		damage, crit := CalculateFinalDamage(p, target, 100, "fire", "Backstab")
		if damage != 300 || !crit {
			t.Fatalf("expected one critical multiplier then existing fire bonus: damage=%d crit=%v", damage, crit)
		}
	}
	target.Type, target.MaxHealth = TypePlayer, 1000
	if damage, _ := CalculateFinalDamage(p, target, 100, "physical", "Backstab"); damage != 130 {
		t.Fatalf("PvP scaling changed: %d", damage)
	}
	if damage, crit := CalculateFinalDamage(p, target, 0, "physical", "Backstab"); damage != 0 || crit {
		t.Fatalf("zero damage gained a crit: %d %v", damage, crit)
	}
}
