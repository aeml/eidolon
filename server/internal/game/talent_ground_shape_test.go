package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"
	"testing"
	"time"
)

func TestGroundTalentPlacementAndActualArea(t *testing.T) {
	data, err := os.ReadFile("testdata/ground_talent_shape.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name, Skill, Rune           string
		Range, Radius, VisualRadius float64
		Ranks                       map[string]int
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, outside := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/outside=%v", tc.Name, outside), func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("ground-talents", "Wizard")
				p.Level, p.X, p.Z, p.TalentRanks = 100, 60000, 60000, tc.Ranks
				p.UnlockedSkills = []string{tc.Skill}
				p.SkillRunes = map[string]string{tc.Skill: tc.Rune}
				w.AddEntity(p)
				e := &Entity{ID: "ground-edge", Type: TypeEnemy, State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 4, X: p.X + tc.Range, Z: p.Z + tc.VisualRadius + 5 - .01}
				if outside {
					e.Z += .02
				}
				w.AddEntity(e)
				var cast *AbilityEvent
				var impact *ProjectileImpactEvent
				w.OnEvent = func(kind string, payload interface{}) {
					if v, ok := payload.(AbilityEvent); kind == "ability" && ok {
						cast = &v
					}
					if v, ok := payload.(ProjectileImpactEvent); kind == "projectile_impact" && ok {
						impact = &v
					}
				}
				if r := w.PerformAbility(p.ID, p.X+100, p.Z, "", tc.Skill); !r.Accepted {
					t.Fatal(r)
				}
				if cast == nil || math.Abs(cast.TargetX-p.X-tc.Range) > 1e-8 || math.Abs(cast.Radius-tc.VisualRadius) > 1e-8 || math.Abs(cast.Arc-2*math.Pi) > 1e-8 {
					t.Fatalf("wrong accepted placement/shape %+v", cast)
				}
				if tc.Skill != "Gravity Well" {
					var effect *Entity
					for _, candidate := range w.Entities {
						if candidate.Type == TypeProjectile && candidate.OwnerID == p.ID && math.Abs(candidate.X-cast.TargetX) < 1e-8 && math.Abs(candidate.Z-cast.TargetZ) < 1e-8 {
							effect = candidate
							break
						}
					}
					if effect == nil || math.Abs(effect.Radius-tc.Radius) > 1e-8 {
						t.Fatalf("missing/incorrect stored radius: %+v", effect)
					}
					if tc.Skill == "Inferno Cataclysm" && math.Abs(effect.Scale-tc.Radius/5) > 1e-8 {
						t.Fatal("zone replication lost its radius")
					}
					effect.LastAttackTime = time.Now().Add(-time.Second)
					w.updateEntity(effect, .05, []*Entity{p}, &deferredActions{})
					if tc.Skill == "Meteor Drop" && (impact == nil || math.Abs(impact.Radius-tc.VisualRadius) > 1e-8) {
						t.Fatal("actual impact lost cast-time radius")
					}
				}
				// Gravity Well recalculates slowed target stats; compare with the
				// original HP, not the fixture's subsequently recomputed MaxHealth.
				if (e.Health < 10000) != !outside {
					t.Fatalf("actual area miss/hit mismatch hp=%d outside=%v", e.Health, outside)
				}
			})
		}
	}
}

func TestMeteorApocalypseKeepsTalentRadiusSnapshot(t *testing.T) {
	w, p, _ := directSkillWallFixture("Wizard", false)
	p.Level, p.TalentRanks = 100, map[string]int{"WIZ_38": 5}
	p.UnlockedSkills = []string{"Meteor Drop"}
	p.SkillRunes = map[string]string{"Meteor Drop": "meteor_apocalypse"}
	telegraphs := make(chan TelegraphEvent, 10)
	w.OnEvent = func(kind string, payload interface{}) {
		if v, ok := payload.(TelegraphEvent); kind == "telegraph" && ok {
			telegraphs <- v
		}
	}
	if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Meteor Drop"); !r.Accepted {
		t.Fatal(r)
	}
	// Allocations can change before delayed meteors arrive; their radius must
	// remain the value captured by the original accepted cast.
	w.Mu.Lock()
	p.Mu.Lock()
	p.TalentRanks = nil
	p.Mu.Unlock()
	w.Mu.Unlock()
	t.Cleanup(func() { w.Mu.Lock(); p.Mu.Lock(); p.State = "DEAD"; p.Mu.Unlock(); w.Mu.Unlock() })
	for i := 0; i < 6; i++ {
		select {
		case event := <-telegraphs:
			want := 29.04
			if i > 0 {
				want *= .7
			}
			if math.Abs(event.Radius-want) > 1e-8 {
				t.Fatalf("telegraph %d lost snapshot: %v want %v", i, event.Radius, want)
			}
		case <-time.After(8 * time.Second):
			t.Fatal("normal delayed meteor never arrived")
		}
	}
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	count := 0
	for _, projectile := range w.Entities {
		if projectile.OwnerID != p.ID || projectile.SubType != "Meteor" {
			continue
		}
		count++
		want := 17.6
		if strings.Contains(projectile.ID, "-apoc-") {
			want *= .7
		}
		if math.Abs(projectile.Radius-want) > 1e-8 {
			t.Fatal("projectile lost snapshot")
		}
		if _, _, blocked := w.firstDungeonWallHit(p.InstanceID, p.X, p.Z, projectile.X, projectile.Z); blocked {
			t.Fatal("scatter crossed dungeon wall")
		}
	}
	if count != 6 {
		t.Fatalf("got %d meteors", count)
	}
}
