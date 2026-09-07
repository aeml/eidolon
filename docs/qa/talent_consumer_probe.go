package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import "testing"

// Spirit Guardians/Boost now have ordinary cast/tick and observer coverage.
// The remaining Cleric cone and Healing Light area variants still need probing.
func TestPendingTalentClericConeAndHealingAreas(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		t.Run(variant, func(t *testing.T) {
			for _, rank := range []int{0, 5} {
				w := newTestWorld()
				p := newTestPlayer("probe-area", "Cleric")
				p.InstanceID = "qa-cleric-area-probe"
				p.Level = 100
				p.Stats.Wisdom = 10
				p.TalentRanks["CLR_34"] = rank
				skill, radius := "Healing Light", 5.0
				target := newTestPlayer("probe-target", "Wizard")
				target.InstanceID, target.Radius = p.InstanceID, 1.25
				target.Health = target.MaxHealth / 2
				switch variant {
				case "Radiant Strike":
					skill, radius, target.Type = variant, 3, TypeEnemy
				case "Beacon":
					p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
				case "Mass Revival":
					// Isolate this consumer; normal cross-branch access is not proven.
					p.ActiveCombo = "healing_light_party"
					radius = 20
				}
				p.UnlockedSkills = []string{skill}
				target.X = radius*1.10 + target.Radius
				w.AddEntity(p)
				w.AddEntity(target)
				before := target.Health
				// Self target anchors Beacon; the cone faces +X.
				result := w.PerformAbility(p.ID, target.X, 0, p.ID, skill)
				applied := target.Health > before
				if variant == "Radiant Strike" {
					applied = target.Health < before
				}
				if !result.Accepted || applied != (rank > 0) {
					t.Errorf("rank=%d accepted=%t effectAt%vm=%t; want %t", rank, result.Accepted, target.X, applied, rank > 0)
				}
			}
		})
	}
}
