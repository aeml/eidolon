package game

import (
	"fmt"
	"math"
	"testing"
)

func TestBladeStormSweepsBeforeWallButNeverIntoDisconnectedRoom(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("blade-wall", "Rogue")
	p.X, p.Z, p.InstanceID = 60000, 60000, "blade-wall"
	w.AddEntity(p)
	w.SetPlayerLevel(p.ID, 100)
	p.UnlockedSkills = []string{"Blade Storm"}
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{
		{X: p.X, Z: p.Z, Width: 20, Height: 8}, {X: p.X, Z: p.Z + 8, Width: 20, Height: 4},
	}}})
	before := &Entity{ID: "blade-before-wall", Type: TypeEnemy, State: "IDLE", X: p.X, Z: p.Z + 2,
		InstanceID: p.InstanceID, Health: 10000, MaxHealth: 10000}
	behind := &Entity{ID: "blade-behind-wall", Type: TypeEnemy, State: "IDLE", X: p.X, Z: p.Z + 7,
		InstanceID: p.InstanceID, Health: 10000, MaxHealth: 10000}
	w.AddEntity(before)
	w.AddEntity(behind)
	if result := w.PerformAbility(p.ID, p.X, p.Z+100, "", "Blade Storm"); !result.Accepted {
		t.Fatalf("cast rejected: %+v", result)
	}
	shots := 0
	for _, shot := range w.Entities {
		if shot.OwnerID != p.ID || shot.Type != TypeProjectile {
			continue
		}
		shots++
		deferred := &deferredActions{}
		w.updateEntity(shot, 1, nil, deferred)
		if math.Abs(shot.Z-p.Z-4) > 1e-8 || len(deferred.removals) != 1 {
			t.Fatalf("wall did not end flight: z=%v removals=%v", shot.Z, deferred.removals)
		}
	}
	if shots != 5 || before.Health == 10000 || behind.Health != 10000 {
		t.Fatalf("shots%d beforeHP%d behindHP%d", shots, before.Health, behind.Health)
	}
}

func TestBladeStormPaidAreaClipsFlightAndSweepsIntermediateTargets(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, generic := range []int{0, 5} {
			t.Run(fmt.Sprintf("rank%d/generic%d", rank, generic), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("blade-area", "Rogue")
				p.X, p.Z, p.InstanceID = 60000, 60000, "blade-area"
				w.AddEntity(p)
				w.SetPlayerLevel(p.ID, 100)
				p.UnlockedSkills = []string{"Blade Storm"}
				for id, count := range map[string]int{"ROG_34": rank, "ROG_38": generic} {
					for i := 0; i < count; i++ {
						if _, ok, reason := w.PerformUnlockTalent(p.ID, id); !ok {
							t.Fatal(reason)
						}
					}
				}
				radius := 10 * (1 + .03*float64(rank)) // ROG_38 is damage-only.
				var cast AbilityEvent
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "ability" {
						cast = value.(AbilityEvent)
					}
				}
				mana := p.Mana
				if result := w.PerformAbility(p.ID, p.X, p.Z+100, "", "Blade Storm"); !result.Accepted || mana-p.Mana != 30 {
					t.Fatalf("paid cast: %+v", result)
				}
				if math.Abs(cast.Radius-radius) > 1e-8 || math.Abs(cast.Arc-math.Pi/2) > 1e-8 {
					t.Errorf("shape=%+v want radius%v arc90deg", cast, radius)
				}
				var shots []*Entity
				for _, entity := range w.Entities {
					if entity.OwnerID == p.ID && entity.Type == TypeProjectile {
						shots = append(shots, entity)
					}
				}
				if len(shots) != 5 {
					t.Fatalf("shots=%d want5", len(shots))
				}
				middle := &Entity{ID: "blade-middle", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
					X: p.X, Z: p.Z + 5, InstanceID: p.InstanceID, Health: 10000, MaxHealth: 10000}
				outside := &Entity{ID: "blade-outside", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
					X: p.X, Z: p.Z + radius + 2, InstanceID: p.InstanceID, Health: 10000, MaxHealth: 10000}
				w.AddEntity(middle)
				w.AddEntity(outside)
				p.TalentRanks = map[string]int{} // Flight keeps the purchased cast's snapshot.
				for _, shot := range shots {
					deferred := &deferredActions{}
					w.updateEntity(shot, 1, nil, deferred)
					if len(deferred.removals) != 1 || deferred.removals[0] != shot.ID {
						t.Fatalf("bounded flight did not expire: %+v", deferred.removals)
					}
					if distance := math.Hypot(shot.X-p.X, shot.Z-p.Z); math.Abs(distance-radius) > 1e-8 {
						t.Errorf("flight=%v want%v", distance, radius)
					}
				}
				if middle.Health == 10000 || outside.Health != 10000 {
					t.Fatalf("intermediate HP%d/outside HP%d", middle.Health, outside.Health)
				}
			})
		}
	}
}
