package game

import (
	"fmt"
	"math/rand"
	"os"
	"testing"
)

func TestPaidTripwireCannotTriggerAcrossDungeonWall(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("trip-wall-owner", "Rogue")
	p.X, p.Z, p.InstanceID = 60000, 60000, "trip-wall"
	w.AddEntity(p)
	w.SetPlayerLevel(p.ID, 100)
	p.UnlockedSkills = []string{"Tripwire"}
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{
		{X: p.X, Z: p.Z, Width: .4, Height: 5}, {X: p.X + .5, Z: p.Z, Width: .2, Height: 5},
	}}})
	target := &Entity{ID: "trip-wall-target", Type: TypeEnemy, State: "IDLE", InstanceID: p.InstanceID,
		X: p.X + .5, Z: p.Z, Health: 10000, MaxHealth: 10000}
	w.AddEntity(target)
	if result := w.PerformAbility(p.ID, p.X+5, p.Z, "", "Tripwire"); !result.Accepted {
		t.Fatal(result)
	}
	shots := 0
	for _, trap := range w.Entities {
		if trap.OwnerID != p.ID || trap.SubType != "Tripwire" {
			continue
		}
		shots++
		deferred := &deferredActions{}
		w.updateEntity(trap, .016, nil, deferred)
		if len(deferred.removals) != 0 {
			t.Fatal("wall consumed untriggered trap")
		}
	}
	if shots != 1 || target.Health != 10000 || target.Rooted {
		t.Fatalf("shots%d hp%d rooted%v", shots, target.Health, target.Rooted)
	}
}

func TestPaidTripwireMasteryAndTechniqueReachActualTrigger(t *testing.T) {
	t.Setenv("GODEBUG", os.Getenv("GODEBUG")+",randseednop=0")
	for _, mastery := range []int{0, 1, 5} {
		for _, technique := range []int{0, 1, 5} {
			t.Run(fmt.Sprintf("mastery%d/technique%d", mastery, technique), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("trip-owner", "Rogue")
				p.X, p.Z, p.InstanceID = 60000, 60000, "trip-damage"
				w.AddEntity(p)
				w.SetPlayerLevel(p.ID, 100)
				p.UnlockedSkills = []string{"Tripwire"}
				for id, count := range map[string]int{"ROG_23": mastery, "ROG_24": technique} {
					for i := 0; i < count; i++ {
						if _, ok, reason := w.PerformUnlockTalent(p.ID, id); !ok {
							t.Fatal(reason)
						}
					}
				}
				p.Stats.Dexterity, p.CritChanceBonus = 100, .60
				target := &Entity{ID: "trip-victim", Type: TypeEnemy, State: "IDLE", InstanceID: p.InstanceID,
					X: p.X + .5, Z: p.Z, Health: 10000, MaxHealth: 10000}
				w.AddEntity(target)
				mana := p.Mana
				if result := w.PerformAbility(p.ID, p.X+5, p.Z, "", "Tripwire"); !result.Accepted || mana-p.Mana != 25 {
					t.Fatalf("unpaid cast: %+v", result)
				}
				var trap *Entity
				for _, e := range w.Entities {
					if e.OwnerID == p.ID && e.SubType == "Tripwire" {
						trap = e
					}
				}
				if trap == nil {
					t.Fatal("accepted cast created no trap")
				}
				if trap.ProjectileSkill != "Tripwire" {
					t.Errorf("trap lost skill identity: %q", trap.ProjectileSkill)
				}
				rand.Seed(1)
				deferred := &deferredActions{}
				w.updateEntity(trap, .016, nil, deferred)
				want := int(120 * (1 + .04*float64(mastery)))
				if technique > 0 {
					want *= 2
				}
				if damage := 10000 - target.Health; damage != want {
					t.Errorf("damage%d want%d", damage, want)
				}
				if !target.Rooted || len(deferred.removals) != 1 {
					t.Fatalf("root/removal: %v %v", target.Rooted, deferred.removals)
				}
			})
		}
	}
}
