package game

import (
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"testing"
)

func TestShieldSlamPaidDamageTraining(t *testing.T) {
	data, err := os.ReadFile("testdata/shield_slam_damage.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name   string
		Ranks  map[string]int
		Damage int
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, rune := range []string{"", "shieldslam_concussion", "shieldslam_reverberation", "shieldslam_fortify"} {
			t.Run(fmt.Sprintf("%s/%s", tc.Name, rune), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("trained-slam", "Fighter")
				p.Level, p.InstanceID = 100, "trained-slam-scene"
				p.TalentRanks, p.UnlockedSkills = tc.Ranks, []string{"Shield Slam"}
				p.SkillRunes = map[string]string{"Shield Slam": rune}
				p.RecalculateStats()
				p.Mana = p.MaxMana
				// Shared 65-damage input budget isolates the talent consumer from
				// already-tested equipment/growth formulas. No dispatch bypass.
				p.Damage, p.Stats.Strength = 50, 10
				w.AddEntity(p)
				target := &Entity{ID: "trained-slam-target", Type: TypeEnemy, InstanceID: p.InstanceID,
					X: 2, State: "IDLE", Health: 1000, MaxHealth: 1000, Scale: 1}
				w.AddEntity(target)
				mana := p.Mana
				ranks := maps.Clone(p.TalentRanks)
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam")
				if !result.Accepted || p.Mana != mana-25 {
					t.Fatalf("paid cast failed: %+v", result)
				}
				want := tc.Damage
				if rune == "shieldslam_reverberation" {
					want *= 2
				}
				if target.Health != 1000-want || target.Threat[p.ID] != float64(want)*2 {
					t.Fatalf("damage=%d threat=%v wantDamage=%d", 1000-target.Health, target.Threat[p.ID], want)
				}
				if rune == "shieldslam_fortify" && p.ArcaneShieldHP != want {
					t.Fatalf("fortify=%d want%d", p.ArcaneShieldHP, want)
				}
				if !maps.Equal(p.TalentRanks, ranks) {
					t.Fatal("cast mutated saved ranks")
				}
			})
		}
	}
}
