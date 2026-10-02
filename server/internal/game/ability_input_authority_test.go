package game

import (
	"math"
	"testing"
	"time"
)

func TestAbilityAdmissionRejectsInvalidCoordinatesBeforeCommit(t *testing.T) {
	inputs := []struct {
		name string
		x, z float64
	}{
		{"nan-x", math.NaN(), 1},
		{"nan-z", 1, math.NaN()},
		{"infinite-x", math.Inf(1), 1},
		{"infinite-z", 1, math.Inf(-1)},
		{"overflow-x", math.MaxFloat64, 1},
		{"overflow-z", 1, -math.MaxFloat64},
		{"json-finite-overflow-x", 1e39, 1},
		{"json-finite-overflow-z", 1, -1e39},
	}
	for class, skills := range selectableAbilityContract() {
		for _, skill := range skills {
			for _, input := range inputs {
				t.Run(class+"/"+skill+"/"+input.name, func(t *testing.T) {
					player := newTestPlayer("invalid-caster", class)
					player.UnlockedSkills = []string{skill}
					player.ActiveCombo = "preserved-combo"
					player.ActiveComboEndTime = time.Now().Add(time.Minute)
					comboEnd := player.ActiveComboEndTime
					w := newPvPTestWorld(player)
					events := 0
					w.OnEvent = func(string, interface{}) { events++ }
					result := w.PerformAbility(player.ID, input.x, input.z, "", skill)
					if result.Accepted || result.Reason != "invalid_target" {
						t.Fatalf("invalid target not rejected at admission: %+v", result)
					}
					if player.Mana != 200 || player.Health != 500 || len(player.Cooldowns) != 0 ||
						!player.LastAbilityTime.IsZero() || player.LastSkillUsed != "" || !player.LastSkillTime.IsZero() ||
						player.ActiveCombo != "preserved-combo" || player.ActiveComboEndTime != comboEnd ||
						player.X != 0 || player.Z != 0 || player.State != "IDLE" || len(w.Entities) != 1 || events != 0 {
						t.Fatal("invalid target spent resources, moved an actor, changed combo/cast state or published effects")
					}
				})
			}
		}
	}
}
