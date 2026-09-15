package game

import "testing"

func TestChargeImpactDamageDoublesOnlyCanonicalCharge(t *testing.T) {
	for _, testCase := range []struct {
		name, skill, runeID string
		targetX             float64
		talents             map[string]int
		wantDamage          int
	}{
		{name: "base", skill: "Charge", targetX: 28, wantDamage: 390},
		{name: "unstoppable", skill: "Charge", runeID: "charge_unstoppable", targetX: 28, wantDamage: 390},
		{name: "shockwave", skill: "Charge", runeID: "charge_shockwave", targetX: 28, wantDamage: 390},
		{name: "maximum momentum", skill: "Charge", runeID: "charge_momentum", targetX: 42, wantDamage: 780},
		{name: "charge talents", skill: "Charge", targetX: 28, talents: map[string]int{"FTR_01": 5, "FTR_38": 5}, wantDamage: 506},
		{name: "shattering exclusion", skill: "Shattering Charge", targetX: 28, wantDamage: 195},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			world := newTestWorld()
			defer world.StopBackground()
			fighter := newTestPlayer("charge-damage-source", "Fighter")
			fighter.X, fighter.Z = 50000, 50000
			fighter.Level = 100
			fighter.Damage = 100
			fighter.CritChanceBonus = 0
			fighter.Mana = 1000
			fighter.UnlockedSkills = []string{testCase.skill}
			fighter.SkillRunes = map[string]string{testCase.skill: testCase.runeID}
			fighter.TalentRanks = testCase.talents
			target := &Entity{ID: "charge-damage-target", Type: TypeEnemy, X: fighter.X + testCase.targetX,
				Z: fighter.Z, State: "IDLE", Health: 10000, MaxHealth: 10000}
			world.AddEntity(fighter)
			world.AddEntity(target)

			result := world.PerformAbility(fighter.ID, target.X, target.Z, target.ID, testCase.skill)
			if !result.Accepted {
				t.Fatalf("%s cast rejected: %+v", testCase.skill, result)
			}
			world.Update(1)
			if got := target.MaxHealth - target.Health; got != testCase.wantDamage {
				t.Fatalf("%s damage=%d want=%d", testCase.skill, got, testCase.wantDamage)
			}
		})
	}
}
