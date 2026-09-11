package game

import "testing"

func TestExplicitSupportTargetNeverFallsBackAfterBecomingUnavailable(t *testing.T) {
	for _, skill := range []string{"Healing Light", "Divine Intervention"} {
		for _, condition := range []string{"missing", "dead", "zero-health", "disconnected", "other-instance", "distant", "enemy"} {
			t.Run(skill+"/"+condition, func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				caster := newTestPlayer("support-caster", "Cleric")
				caster.UnlockedSkills = []string{skill}
				caster.Health, caster.MaxHealth, caster.Mana = 10, 100, 1000
				w.AddEntity(caster)
				ally := newTestPlayer("chosen-ally", "Fighter")
				ally.X, ally.Health, ally.MaxHealth = 2, 50, 100
				switch condition {
				case "dead":
					ally.State, ally.Health = "DEAD", 0
				case "zero-health":
					ally.Health = 0
				case "disconnected":
					ally.Disconnected = true
				case "other-instance":
					ally.InstanceID = "another-run"
				case "distant":
					ally.X = 1000
				case "enemy":
					ally.Type = TypeEnemy
				}
				if condition != "missing" {
					w.AddEntity(ally)
				}
				health := ally.Health
				// The cursor coordinates now point near the caster, as happens
				// when stale selection/scene input reaches the server late.
				result := w.PerformAbility(caster.ID, 0, 0, ally.ID, skill)
				if result.Accepted || caster.Mana != 1000 || caster.Health != 10 || ally.Health != health ||
					caster.DivineInterventionActive || ally.DivineInterventionActive ||
					!caster.LastAbilityTime.IsZero() || len(caster.Cooldowns) != 0 || caster.LastSkillUsed != "" {
					t.Fatalf("invalid explicit target consumed/redirected support cast: result=%+v mana=%d casterHP=%d allyHP=%d",
						result, caster.Mana, caster.Health, ally.Health)
				}
			})
		}
	}
}

func TestSupportTargetValidationPreservesExplicitSelfAllyAndCursorCasts(t *testing.T) {
	for _, skill := range []string{"Healing Light", "Divine Intervention"} {
		for _, target := range []string{"self", "ally", "cursor"} {
			t.Run(skill+"/"+target, func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				caster := newTestPlayer("self", "Cleric")
				caster.UnlockedSkills = []string{skill}
				caster.Health, caster.MaxHealth, caster.Mana = 10, 100, 1000
				ally := newTestPlayer("ally", "Fighter")
				ally.X, ally.Health, ally.MaxHealth = 2, 10, 100
				w.AddEntity(caster)
				w.AddEntity(ally)
				id, x := target, 0.0
				if target == "cursor" {
					id = ""
				}
				if target == "ally" {
					x = ally.X
				}
				result := w.PerformAbility(caster.ID, x, 0, id, skill)
				if !result.Accepted || caster.Mana >= 1000 || caster.LastAbilityTime.IsZero() {
					t.Fatalf("valid support cast was blocked: %+v", result)
				}
				if target == "ally" && (ally.Health <= 10 || caster.Health != 10) {
					t.Fatal("explicit ally heal targeted someone else")
				}
				if target != "ally" && (caster.Health <= 10 || ally.Health != 10) {
					t.Fatal("self/cursor heal was changed")
				}
			})
		}
	}
}
