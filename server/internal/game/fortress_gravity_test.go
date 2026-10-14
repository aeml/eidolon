package game

import "testing"

func TestGravityWellRespectsFortressImmovabilityWithoutGrantingControlImmunity(t *testing.T) {
	for _, rune := range []string{"", "gravitywell_blackhole"} {
		t.Run(rune, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Wizard", true)
			defer w.StopBackground()
			p.UnlockedSkills = []string{"Gravity Well"}
			p.SkillRunes = map[string]string{"Gravity Well": rune}
			p.Mana = 100
			target.IronFortressImmovable = true
			target.Health, target.MaxHealth = 10000, 10000
			x, z := target.X, target.Z
			if result := w.PerformAbility(p.ID, x-2, z, "", "Gravity Well"); !result.Accepted {
				t.Fatal(result)
			}
			if target.X != x || target.Z != z || target.Health >= 10000 || !target.Slowed || target.Rooted != (rune == "gravitywell_blackhole") {
				t.Fatal("Immovable must block displacement only")
			}
		})
	}
}
