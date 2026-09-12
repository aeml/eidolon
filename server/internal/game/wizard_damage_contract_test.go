package game

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestWizardDamageContractReachesActualPaidCasts(t *testing.T) {
	data, err := os.ReadFile("testdata/wizard_damage.json")
	if err != nil {
		t.Fatal(err)
	}
	var profiles []struct {
		Skill, ID, Kind           string
		Base, Intelligence, Count int
	}
	if err := json.Unmarshal(data, &profiles); err != nil {
		t.Fatal(err)
	}
	if len(profiles) != 9 {
		t.Fatal("expected all nine named damaging Masteries")
	}
	for _, profile := range profiles {
		for _, rank := range []int{0, 1, 5} {
			for _, focused := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/rank%d/focus%v", profile.Skill, rank, focused), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("wizard-damage-contract", "Wizard")
					p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "wizard-contract"
					p.Stats.Intelligence, p.Mana = 40, 10000
					p.UnlockedSkills = []string{profile.Skill}
					p.TalentRanks = map[string]int{profile.ID: rank}
					if focused {
						p.SpellFocusActive, p.SpellFocusMultiplier = true, 3
						p.SpellFocusEndTime = time.Now().Add(15 * time.Second)
					}
					w.AddEntity(p)
					target := &Entity{ID: "wizard-contract-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
						X: p.X, Z: p.Z + 4, InstanceID: p.InstanceID, Scale: 1, Health: 100000, MaxHealth: 100000}
					w.AddEntity(target)
					initialHealth := target.Health
					result := w.PerformAbility(p.ID, target.X, target.Z, "", profile.Skill)
					if !result.Accepted || p.Mana >= 10000 {
						t.Fatalf("unpaid/rejected cast: %+v", result)
					}
					factor := 1 + .04*float64(rank)
					if focused {
						factor *= 3
					}
					want := int(float64(profile.Base+profile.Intelligence*40) * factor)
					if profile.Kind == "instant" {
						if got := initialHealth - target.Health; got != want {
							t.Fatalf("actual hit %d want %d", got, want)
						}
					} else {
						count := 0
						for _, entity := range w.Entities {
							if entity.OwnerID != p.ID || entity.Damage <= 0 {
								continue
							}
							count++
							if entity.Damage != want {
								t.Errorf("spawned damage %d want %d", entity.Damage, want)
							}
						}
						if count != profile.Count {
							t.Fatalf("spawned %d effects want %d", count, profile.Count)
						}
					}
					if focused && p.SpellFocusActive {
						t.Fatal("accepted damage did not consume Focus")
					}
				})
			}
		}
	}
}
