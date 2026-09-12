package game

import (
	"fmt"
	"maps"
	"math"
	"testing"
)

func TestGripTechniquePurchasesAndImmutableCaps(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Unbreakable Grip"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_16"); !ok {
			t.Fatal(reason)
		}
		if p.TalentRanks["FTR_16"] != rank || p.TalentPoints != points-rank {
			t.Fatal("range purchase price/rank changed")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_16"); ok || p.TalentPoints != points-5 {
		t.Fatal("sixth purchase charged")
	}
	p.TalentRanks = map[string]int{"FTR_16": 999, "FTR_33": 5, "FTR_38": 5, "WIZ_16": 5}
	ranks := maps.Clone(p.TalentRanks)
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 50, Height: 50}}}})
	oldX, oldZ := target.X, target.Z
	target.X, target.Z, target.Radius = p.X+11.499, p.Z, .5
	w.Grid.Update(target, oldX, oldZ)
	p.Mana = p.MaxMana
	if !w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Unbreakable Grip").Accepted || !target.Rooted || !maps.Equal(ranks, p.TalentRanks) {
		t.Fatal("bounded trained pull or immutable saved map failed")
	}
}

func TestGripTechniquePaidRangeBoundary(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, outside := range []bool{false, true} {
			for _, explicit := range []bool{false, true} {
				t.Run(fmt.Sprintf("rank%d/outside%v/explicit%v", rank, outside, explicit), func(t *testing.T) {
					w, p, target := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Unbreakable Grip"}
					p.TalentRanks = map[string]int{"FTR_16": rank, "FTR_33": 5, "FTR_38": 5}
					p.Mana = p.MaxMana
					w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 50, Height: 50}}}})
					oldX, oldZ := target.X, target.Z
					distance := 10*(1+.02*float64(rank)) + .499
					if outside {
						distance += .002
					}
					target.X, target.Z, target.Radius = p.X+distance, p.Z, .5
					w.Grid.Update(target, oldX, oldZ)
					tx, tz, mana := target.X, target.Z, p.Mana
					id := ""
					if explicit {
						id = target.ID
					}
					var event *AbilityEvent
					w.OnEvent = func(kind string, value interface{}) {
						if e, ok := value.(AbilityEvent); kind == "ability" && ok {
							event = &e
						}
					}
					result := w.PerformAbility(p.ID, tx, tz, id, "Unbreakable Grip")
					if outside {
						if result.Accepted || p.Mana != mana || target.Rooted || target.X != tx || event != nil {
							t.Fatalf("outside pull consumed or affected: %+v", result)
						}
					} else if !result.Accepted || p.Mana != mana-35 || !target.Rooted || math.Abs(target.X-p.X-2) > 1e-8 || event == nil {
						t.Fatalf("trained body-edge pull failed: %+v distance=%v", result, distance)
					}
				})
			}
		}
	}
}

func TestGripCursorPublishesSelectedTarget(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Unbreakable Grip"}
	p.Mana = p.MaxMana
	tx, tz := target.X, target.Z
	var event AbilityEvent
	w.OnEvent = func(kind string, value interface{}) {
		if e, ok := value.(AbilityEvent); kind == "ability" && ok {
			event = e
		}
	}
	if !w.PerformAbility(p.ID, tx+.25, tz, "", "Unbreakable Grip").Accepted {
		t.Fatal("near-cursor cast rejected")
	}
	if event.TargetID != target.ID || event.TargetX != tx || event.TargetZ != tz {
		t.Fatalf("event aimed at cursor instead of selected enemy: %+v", event)
	}
}

func TestGripCursorSelectsNearestEligibleCenter(t *testing.T) {
	w, p, near := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 50, Height: 50}}}})
	oldX, oldZ := near.X, near.Z
	near.X, near.Z, near.Radius = p.X+4, p.Z, .5
	w.Grid.Update(near, oldX, oldZ)
	far := &Entity{ID: "large-far", Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X + 6, Z: p.Z, Radius: 3, Health: 100, MaxHealth: 100, State: "IDLE"}
	w.AddEntity(far)
	for i := 0; i < 10; i++ {
		if selected := w.findFighterGripTarget(p, p.X+4.1, p.Z, ""); selected != near {
			t.Fatalf("selected farther large enemy: %v", selected)
		}
	}
}
