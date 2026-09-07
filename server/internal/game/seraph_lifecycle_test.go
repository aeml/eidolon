package game

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"
)

func TestSeraphTrainingSharedContract(t *testing.T) {
	data, err := os.ReadFile("testdata/seraph_training.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name      string
		Ranks     map[string]int
		Damage    int
		Duration  float64
		Permanent bool
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			_, p, seraph, _ := paidSeraphFixture(t, tc.Ranks, func(p *Entity) {
				if tc.Permanent {
					p.ActiveSetBonuses = map[string]map[string]int{"crusader": {"permanentSeraph": 1}}
				}
			})
			if seraph.Damage != tc.Damage || seraph.SummonDuration.Seconds() != tc.Duration || !reflect.DeepEqual(p.TalentRanks, tc.Ranks) {
				t.Fatalf("damage %d duration %s ranks %v", seraph.Damage, seraph.SummonDuration, p.TalentRanks)
			}
		})
	}
}

func paidSeraphFixture(t *testing.T, ranks map[string]int, configure ...func(*Entity)) (*World, *Entity, *Entity, *Entity) {
	t.Helper()
	w := newTestWorld()
	p := newTestPlayer("seraph-owner", "Cleric")
	p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dungeon_seraph"
	p.Stats.Wisdom = 10
	p.TalentRanks = ranks
	p.UnlockedSkills = []string{"Avenging Seraph"}
	for _, apply := range configure {
		apply(p)
	}
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 100, Height: 100}}}})
	w.AddEntity(p)
	target := &Entity{ID: "seraph-enemy", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
		X: p.X + 6, Z: p.Z, SpawnX: p.X + 6, SpawnZ: p.Z, Scale: 1, State: "IDLE", Health: 10000, MaxHealth: 10000}
	w.AddEntity(target)
	before := p.Mana
	result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Avenging Seraph")
	if !result.Accepted || p.Mana >= before || result.CooldownRemaining <= 0 {
		t.Fatalf("paid summon failed: %+v", result)
	}
	for _, e := range w.Entities {
		if e.SubType == "AvengingSeraph" && e.OwnerID == p.ID {
			return w, p, e, target
		}
	}
	t.Fatal("accepted summon created no ally")
	return nil, nil, nil, nil
}

func TestSeraphSetDurationIsSnapshottedAndCapped(t *testing.T) {
	w, p, seraph, _ := paidSeraphFixture(t, map[string]int{"CLR_18": 5}, func(p *Entity) {
		p.ActiveSetBonuses = map[string]map[string]int{"crusader": {"permanentSeraph": 1}}
	})
	if seraph.SummonDuration != 300*time.Second {
		t.Fatalf("duration %s", seraph.SummonDuration)
	}
	p.ActiveSetBonuses = nil
	for _, elapsed := range []time.Duration{299 * time.Second, 301 * time.Second} {
		seraph.CreatedAt = time.Now().Add(-elapsed)
		deferred := &deferredActions{}
		w.updateEntity(seraph, .05, nil, deferred)
		if removed := containsPlayer(deferred.removals, seraph.ID); removed != (elapsed > 300*time.Second) {
			t.Fatalf("elapsed %s removed %v", elapsed, removed)
		}
	}
}

func TestSeraphAttackRetainsOwnerModifiersThreatAndEventSource(t *testing.T) {
	w, p, seraph, target := paidSeraphFixture(t, map[string]int{"CLR_17": 5}, func(p *Entity) {
		p.CritChanceBonus, p.HolyDamageBonus = 1, .25
	})
	var damage []DamageEvent
	w.OnEvent = func(kind string, payload interface{}) {
		if kind == "damage" {
			damage = append(damage, payload.(DamageEvent))
		}
	}
	w.updateEntity(seraph, .05, nil, &deferredActions{})
	if target.MaxHealth-target.Health != 210 || target.Threat[p.ID] <= 0 || len(damage) != 1 || damage[0].SourceID != seraph.ID {
		t.Fatalf("lost damage/source/credit: damage=%v threat=%v", damage, target.Threat)
	}
}

func TestSeraphFollowingCannotCrossWallsOrOvershootOwner(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, p, seraph, target := paidSeraphFixture(t, nil)
			target.State = "DEAD"
			p.X += 6
			rects := []DungeonWalkRect{{X: 60000, Z: 60000, Width: 4, Height: 10}, {X: 60006, Z: 60000, Width: 4, Height: 10}}
			if doorway {
				rects = append(rects, DungeonWalkRect{X: 60003, Z: 60000, Width: 4, Height: 4})
			}
			w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
			w.updateEntity(seraph, 1, nil, &deferredActions{})
			if doorway && seraph.X != 60003 || !doorway && (seraph.X < 60001 || seraph.X > 60002) {
				t.Fatalf("doorway %v follow x=%f", doorway, seraph.X)
			}
		})
	}
}

func TestSeraphMasteryAffectsRealSummonAttack(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w, p, seraph, target := paidSeraphFixture(t, map[string]int{"CLR_17": rank})
			want := int(float64(70)*(1+.04*float64(rank)) + 1e-9)
			p.TalentRanks = nil // The summon keeps its cast-time base damage.
			w.updateEntity(seraph, .05, nil, &deferredActions{})
			if got := target.MaxHealth - target.Health; got != want {
				t.Fatalf("rank %d actual damage %d want %d", rank, got, want)
			}
		})
	}
}

func TestSeraphTechniqueSnapshotsLifetime(t *testing.T) {
	for _, tc := range []struct {
		rank, laterRank int
		elapsed         time.Duration
		removed         bool
	}{
		{0, 0, 14 * time.Second, false}, {0, 5, 16 * time.Second, true},
		{5, 0, 16 * time.Second, false}, {5, 5, 17 * time.Second, true},
	} {
		t.Run(fmt.Sprintf("rank%d-later%d-%s", tc.rank, tc.laterRank, tc.elapsed), func(t *testing.T) {
			w, p, seraph, _ := paidSeraphFixture(t, map[string]int{"CLR_18": tc.rank})
			seraph.CreatedAt = time.Now().Add(-tc.elapsed)
			p.TalentRanks = map[string]int{"CLR_18": tc.laterRank}
			deferred := &deferredActions{}
			w.updateEntity(seraph, .05, nil, deferred)
			if got := containsPlayer(deferred.removals, seraph.ID); got != tc.removed {
				t.Fatalf("removed=%v want %v", got, tc.removed)
			}
		})
	}
}

func TestSeraphStopsWhenOwnerCannotContinue(t *testing.T) {
	for _, mode := range []string{"missing", "dead", "disconnected", "other-instance"} {
		t.Run(mode, func(t *testing.T) {
			w, p, seraph, target := paidSeraphFixture(t, nil)
			switch mode {
			case "missing":
				delete(w.Entities, p.ID)
			case "dead":
				p.State = "DEAD"
			case "disconnected":
				p.Disconnected = true
			case "other-instance":
				p.InstanceID = ""
			}
			deferred := &deferredActions{}
			w.updateEntity(seraph, .05, nil, deferred)
			if !containsPlayer(deferred.removals, seraph.ID) || target.Health != target.MaxHealth {
				t.Fatalf("orphan ally remained or attacked: removals=%v hp=%d", deferred.removals, target.Health)
			}
		})
	}
}

func TestSeraphAttackRespectsDungeonWallAndDoorway(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, p, seraph, target := paidSeraphFixture(t, nil)
			rects := []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 4, Height: 10}, {X: target.X, Z: target.Z, Width: 4, Height: 10}}
			if doorway {
				rects = append(rects, DungeonWalkRect{X: p.X + 3, Z: p.Z, Width: 4, Height: 4})
			}
			w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
			w.updateEntity(seraph, .05, nil, &deferredActions{})
			if damaged := target.Health < target.MaxHealth; damaged != doorway {
				t.Fatalf("doorway=%v damage=%d", doorway, target.MaxHealth-target.Health)
			}
		})
	}
}
