package game

import (
	"encoding/json"
	"math"
	"os"
	"sort"
	"strings"
	"testing"
	"time"
)

func TestPaidMeteorRunesSharedOfflineContract(t *testing.T) {
	data, err := os.ReadFile("testdata/meteor_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name, Rune                  string
		Ranks                       map[string]int
		Intelligence, Damage, Count int
		Radius, Scale               float64
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("meteor-caster", "Wizard")
			p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "meteor-contract"
			p.Stats.Intelligence = tc.Intelligence
			p.TalentRanks = tc.Ranks
			p.UnlockedSkills = []string{"Meteor Drop"}
			p.SkillRunes = map[string]string{"Meteor Drop": tc.Rune}
			target := &Entity{ID: "meteor-victim", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", Health: 10000, MaxHealth: 10000,
				X: p.X, Z: p.Z, InstanceID: p.InstanceID, Scale: 1}
			w.AddEntity(p)
			w.AddEntity(target)
			warnings := make(chan TelegraphEvent, 10)
			w.OnEvent = func(kind string, payload interface{}) {
				if event, ok := payload.(TelegraphEvent); kind == "telegraph" && ok {
					warnings <- event
				}
			}
			beforeMana := p.Mana
			started := time.Now()
			if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Meteor Drop"); !r.Accepted || p.Mana != beforeMana-60 {
				t.Fatalf("paid cast rejected: %+v", r)
			}
			p.Mu.Lock()
			p.TalentRanks = nil
			p.SkillRunes = nil
			p.Stats.Intelligence = 1000
			p.Mu.Unlock()
			for i := 0; i < tc.Count; i++ {
				select {
				case warning := <-warnings:
					extra := tc.Count == 6 && i > 0
					radius, delay := tc.Radius, 1.5
					if extra {
						radius *= .7
					}
					if tc.Count == 3 {
						delay += float64(i) * .2
					}
					if math.Abs(warning.Radius-radius) > 1e-8 || math.Abs(warning.Duration-delay) > 1e-8 {
						t.Fatalf("warning mismatch: %+v, radius=%v delay=%v", warning, radius, delay)
					}
					if extra && time.Since(started).Seconds() < float64(i)-.05 {
						t.Fatal("extra meteor launched before its paid cadence")
					}
				case <-time.After(7 * time.Second):
					t.Fatal("accepted meteor never launched")
				}
			}
			// Retire the background owner before examining the completed cast.
			w.StopBackground()
			var meteors []*Entity
			for _, e := range w.Entities {
				if e.OwnerID == p.ID && e.SubType == "Meteor" {
					meteors = append(meteors, e)
				}
			}
			sort.Slice(meteors, func(i, j int) bool { return meteors[i].ID < meteors[j].ID })
			if len(meteors) != tc.Count {
				t.Fatalf("meteors=%d want%d", len(meteors), tc.Count)
			}
			for _, e := range meteors {
				extra := strings.Contains(e.ID, "-apoc-")
				damage, radius, scale := tc.Damage, tc.Radius, tc.Scale
				if extra {
					damage /= 2
					radius *= .7
					scale = .7
				}
				if e.Damage != damage || math.Abs(visualAbilityRadius("Meteor Drop", e.Radius)-radius) > 1e-8 || e.Scale != scale {
					t.Fatalf("paid snapshot mismatch: damage=%d radius=%v scale=%v", e.Damage, e.Radius, e.Scale)
				}
				before := target.Health
				e.LastAttackTime = time.Now().Add(-time.Millisecond)
				deferred := &deferredActions{}
				w.updateEntity(e, .02, nil, deferred)
				if before-target.Health != damage {
					t.Fatalf("actual impact=%d want%d", before-target.Health, damage)
				}
				if len(deferred.removals) != 1 || deferred.removals[0] != e.ID {
					t.Fatal("meteor did not retire after ground impact")
				}
			}
		})
	}
}

func TestPaidMeteorApocalypseCancelsInvalidCaster(t *testing.T) {
	for _, mode := range []string{"dead", "zero-health", "disconnected", "transition", "replacement", "removed", "shutdown"} {
		t.Run(mode, func(t *testing.T) {
			t.Parallel()
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("apocalypse-caster", "Wizard")
			p.Level = 100
			p.X, p.Z = 60000, 60000
			p.InstanceID = "meteor-cancel"
			p.UnlockedSkills = []string{"Meteor Drop"}
			p.SkillRunes = map[string]string{"Meteor Drop": "meteor_apocalypse"}
			w.AddEntity(p)
			warnings := make(chan TelegraphEvent, 10)
			w.OnEvent = func(kind string, payload interface{}) {
				if event, ok := payload.(TelegraphEvent); kind == "telegraph" && ok {
					warnings <- event
				}
			}
			if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Meteor Drop"); !r.Accepted {
				t.Fatal(r)
			}
			<-warnings
			w.Mu.Lock()
			p.Mu.Lock()
			switch mode {
			case "dead":
				p.State = "DEAD"
			case "zero-health":
				p.Health = 0
			case "disconnected":
				p.Disconnected = true
			case "transition":
				p.InstanceID = "another-instance"
			case "replacement":
				next := newTestPlayer(p.ID, "Wizard")
				next.InstanceID = p.InstanceID
				next.X, next.Z = p.X, p.Z
				w.Entities[p.ID] = next
			case "removed":
				delete(w.Entities, p.ID)
			}
			p.Mu.Unlock()
			w.Mu.Unlock()
			if mode == "shutdown" {
				w.StopBackground()
			}
			select {
			case event := <-warnings:
				t.Fatalf("invalid caster launched extra meteor: %+v", event)
			case <-time.After(1250 * time.Millisecond):
			}
		})
	}
}
