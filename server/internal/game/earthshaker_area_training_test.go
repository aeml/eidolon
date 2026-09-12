package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestEarthshakerPaidAreaTraining(t *testing.T) {
	for _, runeID := range []string{"", "earthshaker_fissure", "earthshaker_seismic", "earthshaker_aftershock"} {
		for _, rank := range []int{0, 1, 5} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rank%d/generic%d", runeID, rank, generic), func(t *testing.T) {
					w, p, original := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
					p.TalentRanks = map[string]int{"FTR_14": rank, "FTR_33": generic, "FTR_38": generic}
					p.SkillRunes = map[string]string{"Earthshaker": runeID}
					p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
					original.State = "DEAD"
					radius := 6 * (1 + .02*float64(rank) + .05*float64(generic))
					add := func(id string, dx, dz float64) *Entity {
						e := &Entity{ID: id, Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X + dx, Z: p.Z + dz,
							Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
						w.AddEntity(e)
						return e
					}
					center := add("center", 0, 1)
					edge := add("edge", 0, radius+.499)
					outside := add("outside", 0, radius+.501)
					behind := add("behind", 0, -1)
					var lateral, wide *Entity
					if runeID == "earthshaker_fissure" {
						lateral = add("lateral", -radius/4-.499, 1)
						wide = add("wide", -radius/4-.501, 1)
					}
					var event *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
							event = &e
						}
					}
					mana := p.Mana
					result := w.PerformAbility(p.ID, p.X, p.Z+10, "", "Earthshaker")
					if !result.Accepted || p.Mana != mana-40 || center.Health == 10000 {
						t.Fatalf("paid positive control failed: %+v", result)
					}
					if edge.Health == 10000 || outside.Health != 10000 || (behind.Health < 10000) != (runeID != "earthshaker_fissure") {
						t.Errorf("radius=%v edge=%d outside=%d behind=%d", radius, edge.Health, outside.Health, behind.Health)
					}
					if lateral != nil && (lateral.Health == 10000 || wide.Health != 10000) {
						t.Errorf("half-width=%v edge=%d outside=%d", radius/4, lateral.Health, wide.Health)
					}
					if event == nil || math.Abs(event.Radius-radius) > 1e-8 {
						t.Errorf("accepted quake lacks trained radius: %+v", event)
					}
					kind := "circle"
					if runeID == "earthshaker_fissure" {
						kind = "line"
					}
					if event == nil || event.Origin == nil || event.Origin.X != p.X || event.Origin.Z != p.Z ||
						event.ShapeKind != kind || !event.ShapeResolved || event.Phase != "" ||
						event.TargetX != p.X || event.TargetZ != p.Z+1 {
						t.Errorf("accepted footprint lost origin/direction/rune: %+v", event)
					}
				})
			}
		}
	}
}

func TestEarthshakerAreaAftershockRetainsCastRadiusAndOrigin(t *testing.T) {
	w, p, _ := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
	p.TalentRanks = map[string]int{"FTR_14": 5, "FTR_33": 5, "FTR_38": 5}
	p.SkillRunes = map[string]string{"Earthshaker": "earthshaker_aftershock"}
	p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
	x, z := p.X, p.Z
	add := func(id string) *Entity {
		e := &Entity{ID: id, Type: TypeEnemy, InstanceID: p.InstanceID, X: x - 20, Z: z,
			Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
		w.AddEntity(e)
		return e
	}
	edge, outside := add("aftershock-area-edge"), add("aftershock-area-outside")
	events := make(chan AbilityEvent, 4)
	w.OnEvent = func(kind string, payload interface{}) {
		if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
			events <- e
		}
	}
	if !w.PerformAbility(p.ID, x, z+10, "", "Earthshaker").Accepted {
		t.Fatal("paid cast rejected")
	}
	<-events // The initial accepted event is synchronous with PerformAbility.
	w.Mu.Lock()
	p.Mu.Lock()
	p.TalentRanks = nil
	oldX, oldZ := p.X, p.Z
	p.X += 100
	w.Grid.Update(p, oldX, oldZ)
	p.Mu.Unlock()
	for i, target := range []*Entity{edge, outside} {
		target.Mu.Lock()
		oldX, oldZ = target.X, target.Z
		target.X = x - (3.5*1.35 + .499 + float64(i)*.002)
		w.Grid.Update(target, oldX, oldZ)
		target.Mu.Unlock()
	}
	w.Mu.Unlock()
	select {
	case event := <-events:
		if event.Phase != "aftershock" || event.ShapeKind != "circle" || math.Abs(event.Radius-4.725) > 1e-8 ||
			event.Origin == nil || event.Origin.X != x || event.Origin.Z != z {
			t.Fatalf("delayed footprint lost cast snapshot: %+v", event)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("missing actual delayed footprint")
	}
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	edge.Mu.RLock()
	defer edge.Mu.RUnlock()
	outside.Mu.RLock()
	defer outside.Mu.RUnlock()
	if edge.Health == 10000 || outside.Health != 10000 {
		t.Fatalf("delayed area edge=%d outside=%d", edge.Health, outside.Health)
	}
}

func TestEarthshakerAreaPurchasesAndZeroAimPreserveFacing(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_14"); !ok {
			t.Fatalf("purchase %d failed: %s", rank, reason)
		}
		if p.TalentRanks["FTR_14"] != rank || p.TalentPoints != points-rank {
			t.Fatal("area purchase changed rank identity or point price")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_14"); ok || p.TalentPoints != points-5 {
		t.Fatal("sixth area purchase spent points")
	}
	p.SkillRunes = map[string]string{"Earthshaker": "earthshaker_fissure"}
	p.Rotation = math.Pi / 2
	p.Damage, p.Mana = 50, p.MaxMana
	var event *AbilityEvent
	w.OnEvent = func(kind string, payload interface{}) {
		if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
			event = &e
		}
	}
	if !w.PerformAbility(p.ID, p.X, p.Z, "", "Earthshaker").Accepted || target.Health == 10000 {
		t.Fatal("paid zero-aim Fissure lost its forward hit")
	}
	if event == nil || event.Origin == nil || math.Abs(event.Radius-6.6) > 1e-8 ||
		math.Abs(event.TargetX-event.Origin.X-1) > 1e-8 || math.Abs(event.TargetZ-event.Origin.Z) > 1e-8 {
		t.Fatalf("zero aim lost trained area or existing heading: %+v", event)
	}
}
