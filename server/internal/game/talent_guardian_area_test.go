package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestGuardianEmbraceAreaFollowsCastSnapshotAtRealTicks(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("rank%d/scale%v/outside%v", rank, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("guardian-caster", "Cleric")
					p.InstanceID, p.X, p.Y, p.Z = "qa-guardian-area", 60000, 40, 60000
					p.Level, p.Stats.Wisdom, p.Health = 100, 10, 100
					p.TalentRanks = map[string]int{"CLR_34": rank}
					p.UnlockedSkills = []string{"Guardian Embrace"}
					w.AddEntity(p)
					radius := 10 * (1 + .03*float64(rank))
					ally := newTestPlayer("guardian-edge", "Wizard")
					ally.InstanceID, ally.Scale, ally.X, ally.Z, ally.Health = p.InstanceID, scale, p.X+radius+1.25*scale-.01, p.Z, 100
					if outside {
						ally.X += .02
					}
					w.AddEntity(ally)
					var cast *AbilityEvent
					heals := 0
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							cast = &event
						}
						if event, ok := payload.(HealEvent); kind == "heal" && ok && event.TargetID == ally.ID {
							heals += event.Amount
						}
					}
					if !w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Guardian Embrace").Accepted {
						t.Fatal("cast rejected")
					}
					if cast == nil || math.Abs(cast.Radius-radius) > 1e-8 || cast.Arc != 2*math.Pi || cast.TargetX != p.X || cast.TargetZ != p.Z {
						t.Errorf("incorrect accepted aura: %+v", cast)
					}
					// Reallocation after casting must not silently resize a live aura.
					p.TalentRanks = nil
					for _, snapshot := range []*Entity{w.GetEntityCopy(p.ID), w.copyEntity(p)} {
						if !snapshot.GuardianEmbraceActive || math.Abs(snapshot.GuardianEmbraceRadius-radius) > 1e-8 || !snapshot.GuardianEmbraceEndTime.Equal(p.GuardianEmbraceEndTime) {
							t.Fatal("snapshot lost active aura geometry/time")
						}
					}
					w.updateEntity(p, 0, nil, &deferredActions{})
					want := 40
					if outside {
						want = 0
					}
					if ally.Health != 100+want || heals != want {
						t.Fatalf("first tick hp=%d event=%d want=%d", ally.Health, heals, want)
					}
					// It follows the caster spatially without rebuilding the world grid.
					oldX, oldZ := p.X, p.Z
					p.X -= 40
					w.Grid.Update(p, oldX, oldZ)
					p.LastGuardianEmbraceTick = time.Now().Add(-time.Second)
					w.updateEntity(p, 0, nil, &deferredActions{})
					if heals != want {
						t.Fatal("old cast center kept healing after caster moved")
					}
					p.GuardianEmbraceEndTime = time.Now().Add(-time.Second)
					w.updateEntity(p, 0, nil, &deferredActions{})
					if p.GuardianEmbraceActive || heals != want {
						t.Fatal("expired aura still active")
					}
					if w.GetEntityCopy(p.ID).GuardianEmbraceRadius != 0 {
						t.Fatal("expired snapshot retained radius")
					}
				})
			}
		}
	}
}

func TestGuardianEmbraceTickProtectsHostilesDeadAndOtherInstances(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("guardian-support", "Cleric")
	p.InstanceID, p.Level, p.Stats.Wisdom = "qa-guardian-support", 100, 10
	p.TalentRanks, p.UnlockedSkills = map[string]int{"CLR_34": 5}, []string{"Guardian Embrace"}
	w.AddEntity(p)
	for _, tc := range []struct {
		id              string
		kind            EntityType
		state, instance string
	}{
		{"ally", TypePlayer, "IDLE", p.InstanceID},
		{"summon", TypeNPC, "IDLE", p.InstanceID},
		{"enemy", TypeEnemy, "IDLE", p.InstanceID},
		{"dead", TypePlayer, "DEAD", p.InstanceID},
		{"elsewhere", TypePlayer, "IDLE", "qa-guardian-elsewhere"},
		{"opponent", TypePlayer, "IDLE", p.InstanceID},
	} {
		e := newTestPlayer(tc.id, "Wizard")
		e.Type, e.State, e.InstanceID, e.X, e.Health = tc.kind, tc.state, tc.instance, 12.2, 100
		w.AddEntity(e)
	}
	w.PvP.Matches["guardian-pvp"] = &PvPMatch{ID: "guardian-pvp", Status: PvPMatchActive, TeamA: []string{p.ID}, TeamB: []string{"opponent"}}
	w.PvP.MatchByPlayer[p.ID], w.PvP.MatchByPlayer["opponent"] = "guardian-pvp", "guardian-pvp"
	if !w.PerformAbility(p.ID, 0, 0, "", "Guardian Embrace").Accepted {
		t.Fatal("cast rejected")
	}
	w.updateEntity(p, 0, nil, &deferredActions{})
	for _, id := range []string{"ally", "summon"} {
		if w.GetEntity(id).Health != 140 {
			t.Errorf("%s did not receive the ranked tick", id)
		}
	}
	for _, id := range []string{"enemy", "dead", "elsewhere", "opponent"} {
		if w.GetEntity(id).Health != 100 {
			t.Errorf("%s must not receive healing", id)
		}
	}
}
