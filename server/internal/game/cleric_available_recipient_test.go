package game

import (
	"testing"
	"time"
)

func TestClericCursorSupportSkipsUnavailableAllies(t *testing.T) {
	for _, skill := range []string{"Healing Light", "Divine Intervention"} {
		for _, unavailable := range []string{"disconnected", "zero-health"} {
			t.Run(skill+"/"+unavailable, func(t *testing.T) {
				w := newTestWorld()
				t.Cleanup(w.StopBackground)
				cleric := newTestPlayer("healer", "Cleric")
				cleric.UnlockedSkills = []string{skill}
				cleric.X, cleric.Z = 60000, 60000
				w.AddEntity(cleric)
				missing := newTestPlayer("unavailable", "Fighter")
				missing.X, missing.Z, missing.Health = 60003, 60000, 20
				missing.Disconnected = unavailable == "disconnected"
				if unavailable == "zero-health" {
					missing.Health = 0 // Death receipt/state can lag behind zero HP.
				}
				ally := newTestPlayer("living-ally", "Rogue")
				ally.X, ally.Z, ally.Health = 60004, 60000, 20
				w.AddEntity(missing)
				w.AddEntity(ally)
				before := missing.Health
				result := w.PerformAbility(cleric.ID, missing.X, missing.Z, "", skill)
				if !result.Accepted || ally.Health <= 20 {
					t.Fatalf("cursor support missed living ally: cast=%+v hp=%d", result, ally.Health)
				}
				if missing.Health != before || missing.DivineInterventionActive {
					t.Fatal("support healed/protected an unavailable recipient")
				}
			})
		}
	}
}

func TestClericAreaHealingDoesNotHealUnavailableBystanders(t *testing.T) {
	for _, mode := range []string{"beacon", "mass-revival"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			cleric := newTestPlayer("beacon-healer", "Cleric")
			cleric.UnlockedSkills = []string{"Healing Light"}
			cleric.SkillRunes = map[string]string{"Healing Light": "healinglight_beacon"}
			if mode == "mass-revival" {
				cleric.SkillRunes = nil
				cleric.LastSkillUsed, cleric.LastSkillTime = "Divine Intervention", time.Now()
			}
			cleric.X, cleric.Z = 60000, 60000
			w.AddEntity(cleric)
			for i, state := range []string{"living", "disconnected", "zero-health"} {
				ally := newTestPlayer(state, "Fighter")
				ally.X, ally.Z, ally.Health = 60001+float64(i), 60000, 20
				ally.Disconnected = state == "disconnected"
				if state == "zero-health" {
					ally.Health = 0
				}
				w.AddEntity(ally)
			}
			result := w.PerformAbility(cleric.ID, 60001, 60000, "living", "Healing Light")
			if !result.Accepted || w.Entities["living"].Health <= 20 {
				t.Fatal("beacon missed available recipient")
			}
			if w.Entities["disconnected"].Health != 20 || w.Entities["zero-health"].Health != 0 {
				t.Fatal("area healing healed unavailable bystander")
			}
		})
	}
}
