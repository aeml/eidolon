package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
)

func TestRogueBackstabTrainedPositionalRounding(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("rogue-positional-contract", "Rogue")
	p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "rogue-positional-contract"
	p.Damage, p.Mana = 101, 10000
	p.UnlockedSkills = []string{"Backstab"}
	p.TalentRanks = map[string]int{"ROG_03": 5}
	w.AddEntity(p)
	target := &Entity{ID: "rogue-positional-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
		X: p.X, Z: p.Z + 2, InstanceID: p.InstanceID, Scale: 1, Defense: 21, Health: 10000, MaxHealth: 10000}
	w.AddEntity(target)
	result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Backstab")
	if !result.Accepted || p.Mana >= 10000 {
		t.Fatalf("unpaid/rejected cast: %+v", result)
	}
	// int(101 * 1.5 * 1.2) = 181; int(181 * 2.5) - 21 = 431.
	if got := 10000 - target.Health; got != 431 {
		t.Fatalf("actual trained positional hit %d want431", got)
	}
}

func TestRogueDamageContractReachesActualPaidCasts(t *testing.T) {
	data, err := os.ReadFile("testdata/rogue_damage.json")
	if err != nil {
		t.Fatal(err)
	}
	var profiles []struct {
		Skill, ID, Kind   string
		Base, Count       int
		Dexterity, Weapon float64
	}
	if err := json.Unmarshal(data, &profiles); err != nil {
		t.Fatal(err)
	}
	if len(profiles) != 7 {
		t.Fatal("expected seven direct-damage Rogue Masteries, including Tripwire")
	}
	for _, profile := range profiles {
		for _, rank := range []int{0, 1, 5} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rank%d/generic%d", profile.Skill, rank, generic), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("rogue-damage-contract", "Rogue")
					p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "rogue-contract"
					p.Stats.Dexterity, p.Damage, p.Mana = 11, 101, 10000
					p.UnlockedSkills = []string{profile.Skill}
					p.TalentRanks = map[string]int{profile.ID: rank, "ROG_38": generic}
					w.AddEntity(p)
					target := &Entity{ID: "rogue-contract-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
						X: p.X, Z: p.Z + 2, Rotation: math.Pi, InstanceID: p.InstanceID,
						Scale: 1, Health: 10000, MaxHealth: 10000}
					w.AddEntity(target)
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, profile.Skill)
					if !result.Accepted || p.Mana >= 10000 {
						t.Fatalf("unpaid/rejected cast: %+v", result)
					}
					base := float64(profile.Base+int(11*profile.Dexterity)) + 101*profile.Weapon
					want := int(base * (1 + .04*float64(rank) + .02*float64(generic)))
					if profile.Kind == "instant" {
						if got := 10000 - target.Health; got != want {
							t.Fatalf("actual hit %d want %d", got, want)
						}
					} else {
						count := 0
						for _, entity := range w.Entities {
							if entity.OwnerID != p.ID || entity.Type != TypeProjectile {
								continue
							}
							count++
							if entity.Damage != want || entity.ProjectileSkill != profile.Skill {
								t.Errorf("projectile damage %d/skill%s want %d/%s", entity.Damage, entity.ProjectileSkill, want, profile.Skill)
							}
						}
						if count != profile.Count {
							t.Fatalf("spawned %d want %d", count, profile.Count)
						}
					}
				})
			}
		}
	}
}
