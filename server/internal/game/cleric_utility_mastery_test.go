package game

import "testing"

// Actual paid casts, not only the talent definition: the advertised power
// benefit must reach the buff/debuff recipient without changing its identity.
func TestClericUtilityMasteryImprovesEffect(t *testing.T) {
	for _, tc := range []struct {
		skill, talent string
		cost          int
	}{
		{"Blessing of Resolve", "CLR_19", 35},
		{"Blessing of Zeal", "CLR_21", 35},
		{"Mark of Weakness", "CLR_23", 30},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			type effect struct {
				defense                 int
				speed, attack, weakness float64
			}
			var outcomes [2]effect
			for index, rank := range []int{0, 5} {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("utility-caster", "Cleric")
				p.Level, p.InstanceID, p.X, p.Z = 100, "utility-mastery", 60000, 60000
				p.BaseStats = InitialPlayerStats()
				p.TalentRanks = map[string]int{tc.talent: rank}
				p.UnlockedSkills = []string{tc.skill}
				p.RecalculateStats()
				p.Mana = p.MaxMana
				w.AddEntity(p)
				target := newTestPlayer("utility-recipient", "Fighter")
				target.BaseStats = InitialPlayerStats()
				target.Equipment["chest"] = Item{Stats: map[string]int{"defense": 100}}
				target.RecalculateStats()
				target.InstanceID, target.X, target.Z = p.InstanceID, p.X+2, p.Z
				if tc.skill == "Mark of Weakness" {
					target.Type = TypeEnemy
				}
				w.AddEntity(target)
				beforeDefense, beforeSpeed, beforeAttack := target.Defense, target.Speed, target.AttackSpeed
				mana := p.Mana
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
				if !result.Accepted || p.Mana != mana-tc.cost || result.CooldownRemaining <= 0 {
					t.Fatalf("rank%d paid cast failed: %+v mana%d before%d", rank, result, p.Mana, mana)
				}
				switch tc.skill {
				case "Blessing of Resolve":
					if !target.BlessingResolveActive || target.Defense <= beforeDefense {
						t.Fatal("positive defense control failed")
					}
				case "Blessing of Zeal":
					if !target.ZealActive || target.Speed <= beforeSpeed || target.AttackSpeed >= beforeAttack {
						t.Fatal("positive haste control failed")
					}
				case "Mark of Weakness":
					if !target.MarkWeakness || target.MarkWeaknessFactor <= 0 {
						t.Fatal("positive weakness control failed")
					}
				}
				outcomes[index] = effect{target.Defense, target.Speed, target.AttackSpeed, target.MarkWeaknessFactor}
			}
			base, trained := outcomes[0], outcomes[1]
			improved := trained.defense > base.defense || trained.speed > base.speed || trained.attack < base.attack || trained.weakness > base.weakness
			if !improved {
				t.Fatalf("five Mastery ranks have no stronger effect: baseline%+v trained%+v", base, trained)
			}
		})
	}
}
