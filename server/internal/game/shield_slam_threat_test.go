package game

import (
	"fmt"
	"testing"
)

func TestShieldSlamTankThreatUsesActualDamageWithoutChangingHits(t *testing.T) {
	for _, rune := range []string{"", "shieldslam_concussion", "shieldslam_reverberation", "shieldslam_fortify"} {
		for _, scale := range []float64{1, 4} {
			for _, immune := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/body%v/immune%v", rune, scale, immune), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("slam-tank", "Fighter")
					p.Level, p.InstanceID, p.X, p.Z = 100, "slam-threat", 60000, 60000
					p.BaseStats = InitialPlayerStats()
					p.UnlockedSkills, p.SkillRunes = []string{"Shield Slam"}, map[string]string{"Shield Slam": rune}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					want := p.Damage + int(float64(p.Stats.Strength)*1.5)
					if rune == "shieldslam_reverberation" {
						want *= 2
					}
					boss := &Entity{ID: "slam-boss", Type: TypeEnemy, SubType: "RootboundWarden", InstanceID: p.InstanceID,
						State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: scale, CCImmune: immune, X: p.X + 3, Z: p.Z,
						Threat: map[string]float64{"damage-role": float64(want) * 1.5}}
					w.AddEntity(boss)
					mana := p.Mana
					result := w.PerformAbility(p.ID, boss.X, boss.Z, boss.ID, "Shield Slam")
					if !result.Accepted || p.Mana != mana-25 {
						t.Fatalf("paid slam rejected: %+v", result)
					}
					if got := boss.MaxHealth - boss.Health; got != want {
						t.Fatalf("damage changed: got%d want%d", got, want)
					}
					if got := boss.Threat[p.ID]; got != float64(want)*2 {
						t.Fatalf("tank threat=%v want%v", got, float64(want)*2)
					}
					if want > 0 && boss.Threat[p.ID] <= boss.Threat["damage-role"] {
						t.Fatal("shield branch could not overtake ordinary damage threat")
					}
					if boss.Stunned == immune {
						t.Fatal("threat change altered CC immunity")
					}
					if rune == "shieldslam_fortify" && p.ArcaneShieldHP != want {
						t.Fatal("threat must not increase Fortify absorption")
					}
				})
			}
		}
	}
}

func TestShieldSlamThreatDoesNotReachUnhitTargets(t *testing.T) {
	for _, excluded := range []string{"wall", "outside", "behind", "dead", "other-instance", "friendly"} {
		t.Run(excluded, func(t *testing.T) {
			w, p, enemy := directSkillWallFixture("Fighter", excluded != "wall")
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 30, []string{"Shield Slam"}
			p.Mana = p.MaxMana
			w.Grid.Remove(enemy)
			if excluded == "outside" {
				enemy.X = p.X + 40
			}
			if excluded == "behind" {
				enemy.X = p.X - 3
			}
			if excluded == "dead" {
				enemy.State = "DEAD"
			}
			if excluded == "other-instance" {
				enemy.InstanceID = "other-slam"
			}
			if excluded == "friendly" {
				enemy.Type = TypePlayer
				enemy.SubType = "Cleric"
			}
			w.Grid.Add(enemy)
			health := enemy.Health
			result := w.PerformAbility(p.ID, p.X+10, p.Z, "", "Shield Slam")
			if !result.Accepted {
				t.Fatalf("paid cone rejected: %+v", result)
			}
			if enemy.Health != health || enemy.Threat[p.ID] != 0 {
				t.Fatal("unhit target received damage or threat")
			}
		})
	}
}
