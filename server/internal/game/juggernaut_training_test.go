package game

import (
	"fmt"
	"maps"
	"math"
	"testing"
)

func TestJuggernautTrainingPurchasesCapsAndImmutableSave(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Juggernaut Charge"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points, spent := p.TalentPoints, 0
	for _, id := range []string{"FTR_17", "FTR_18"} {
		for rank := 1; rank <= 5; rank++ {
			if _, ok, reason := w.PerformUnlockTalent(p.ID, id); !ok {
				t.Fatalf("%s rank%d purchase failed: %s", id, rank, reason)
			}
			spent++
			if p.TalentRanks[id] != rank || p.TalentPoints != points-spent {
				t.Fatal("purchase changed rank identity or one-point cost")
			}
		}
		if _, ok, _ := w.PerformUnlockTalent(p.ID, id); ok || p.TalentPoints != points-spent {
			t.Fatal("sixth purchase spent a point")
		}
	}
	p.TalentRanks = map[string]int{"FTR_17": 999, "FTR_18": 999, "FTR_33": -1, "FTR_38": -1, "CLR_17": 5}
	ranks := maps.Clone(p.TalentRanks)
	p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
	target.BaseStats = Stats{Vitality: 1000}
	var event AbilityEvent
	w.OnEvent = func(kind string, value interface{}) {
		if e, ok := value.(AbilityEvent); kind == "ability" && ok {
			event = e
		}
	}
	if !w.PerformAbility(p.ID, target.X, target.Z, "", "Juggernaut Charge").Accepted {
		t.Fatal("cast rejected")
	}
	if 10000-target.Health != 72 || math.Abs(event.Radius-11) > 1e-8 || !maps.Equal(ranks, p.TalentRanks) {
		t.Fatalf("cap/foreign rank/immutable save failed: damage=%d radius=%v ranks=%v", 10000-target.Health, event.Radius, p.TalentRanks)
	}
}

func TestJuggernautPaidDamageAndAreaTraining(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, generic := range []int{0, 5} {
			t.Run(fmt.Sprintf("rank%d/generic%d", rank, generic), func(t *testing.T) {
				w, p, center := directSkillWallFixture("Fighter", true)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{"Juggernaut Charge"}
				p.TalentRanks = map[string]int{"FTR_17": rank, "FTR_18": rank, "FTR_33": generic, "FTR_38": generic}
				p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
				center.BaseStats = Stats{Vitality: 1000}
				// A full open floor avoids unrelated wall exclusions at the trained edge.
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 50, Height: 50}}}})
				radius := 10 * (1 + .02*float64(rank) + .05*float64(generic))
				add := func(id string, distance float64) *Entity {
					target := &Entity{ID: id, Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X, Z: p.Z + distance,
						Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000, BaseStats: Stats{Vitality: 1000}}
					w.AddEntity(target)
					return target
				}
				edge, outside := add("jugg-edge", radius+.499), add("jugg-outside", radius+.501)
				var event *AbilityEvent
				damageEvents := map[string]int{}
				w.OnEvent = func(kind string, payload interface{}) {
					if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
						event = &e
					}
					if e, ok := payload.(DamageEvent); kind == "damage" && ok && e.SourceID == p.ID {
						damageEvents[e.TargetID]++
					}
				}
				mana := p.Mana
				result := w.PerformAbility(p.ID, p.X+1, p.Z, "", "Juggernaut Charge")
				if !result.Accepted || p.Mana != mana-30 || result.CooldownRemaining <= 0 {
					t.Fatalf("paid control failed: %+v", result)
				}
				want := int(math.Floor(60*(1+.04*float64(rank)+.02*float64(generic)) + 1e-9))
				for _, target := range []*Entity{center, edge} {
					if 10000-target.Health != want || target.MaxHealth != 10000 || !target.Slowed || target.SlowFactor != .6 || target.Threat[p.ID] != float64(want) || damageEvents[target.ID] != 1 {
						t.Errorf("%s damage=%d slow=%v factor=%v threat=%v receipts=%d want=%d", target.ID, 10000-target.Health, target.Slowed, target.SlowFactor, target.Threat[p.ID], damageEvents[target.ID], want)
					}
				}
				if outside.Health != 10000 || outside.Slowed || damageEvents[outside.ID] != 0 {
					t.Fatal("outside target affected")
				}
				if event == nil || math.Abs(event.Radius-radius) > 1e-8 || event.Arc != 2*math.Pi || event.TargetX != p.X || event.TargetZ != p.Z {
					t.Errorf("missing accepted self-centered shape: %+v", event)
				}
			})
		}
	}
}

func TestJuggernautTrainedWallImmunityAndCritical(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		for _, immune := range []bool{false, true} {
			t.Run(fmt.Sprintf("door%v/immune%v", doorway, immune), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Fighter", doorway)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{"Juggernaut Charge"}
				p.TalentRanks = map[string]int{"FTR_17": 5, "FTR_18": 5, "FTR_33": 5, "FTR_38": 5}
				p.Damage, p.Stats.Strength, p.Mana, p.CritChanceBonus = 50, 10, p.MaxMana, 1
				target.CCImmune = immune
				target.BaseStats = Stats{Vitality: 1000}
				if !w.PerformAbility(p.ID, target.X, target.Z, "", "Juggernaut Charge").Accepted {
					t.Fatal("cast rejected")
				}
				want := 0
				if doorway {
					want = 156
				}
				if 10000-target.Health != want || target.Slowed != (doorway && !immune) {
					t.Fatalf("damage=%d want=%d slow=%v", 10000-target.Health, want, target.Slowed)
				}
			})
		}
	}
}
