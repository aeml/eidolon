package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"
)

func TestPurifyingWaveTalentedAreaAndAcceptedShape(t *testing.T) {
	data, err := os.ReadFile("testdata/purifying_area.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name   string
		Ranks  map[string]int
		Radius float64
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/scale=%v/outside=%v", tc.Name, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("wave-caster", "Cleric")
					p.InstanceID, p.X, p.Y, p.Z = "qa-wave-area", 60000, 40, 60000
					p.Level, p.TalentRanks, p.UnlockedSkills = 100, tc.Ranks, []string{"Purifying Wave"}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					p.Bleeding = true
					w.AddEntity(p)
					ally := newTestPlayer("wave-ally", "Wizard")
					ally.InstanceID, ally.Scale, ally.X, ally.Z = p.InstanceID, scale, p.X+tc.Radius+1.25*scale-.01, p.Z
					if outside {
						ally.X += .02
					}
					ally.Bleeding, ally.Poisoned, ally.Slowed, ally.Stunned, ally.Rooted = true, true, true, true, true
					ally.WeakPointMarked, ally.MarkWeakness = true, true
					ally.BleedDamage, ally.PoisonDamage = 4, 4
					ally.BleedSourceID, ally.PoisonSourceID = "hostile", "hostile"
					ally.BleedEndTime, ally.PoisonEndTime = time.Now().Add(time.Minute), time.Now().Add(time.Minute)
					w.AddEntity(ally)
					var cast *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							cast = &event
						}
					}
					before := p.Mana
					result := w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Purifying Wave")
					if !result.Accepted || p.Mana != before-30 || p.Bleeding {
						t.Fatalf("cast/cost/self cleanse failed: %+v mana=%d before=%d", result, p.Mana, before)
					}
					if cast == nil || math.Abs(cast.Radius-tc.Radius) > 1e-8 || math.Abs(cast.Arc-2*math.Pi) > 1e-8 || cast.TargetX != p.X || cast.TargetZ != p.Z {
						t.Fatalf("wrong self-centered accepted footprint: %+v", cast)
					}
					for name, retained := range map[string]bool{"bleed": ally.Bleeding, "poison": ally.Poisoned, "slow": ally.Slowed, "stun": ally.Stunned, "root": ally.Rooted, "weak-point": ally.WeakPointMarked, "weakness": ally.MarkWeakness} {
						if retained != outside {
							t.Errorf("%s retained=%v outside=%v", name, retained, outside)
						}
					}
					if !outside && (ally.BleedDamage != 0 || ally.PoisonDamage != 0 || ally.BleedSourceID != "" || ally.PoisonSourceID != "" || !ally.BleedEndTime.IsZero() || !ally.PoisonEndTime.IsZero()) {
						t.Fatal("cleanse retained damage metadata")
					}
				})
			}
		}
	}
}

func TestPurifyingWaveProtectsHostilesDeadActorsAndOtherInstances(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("wave-caster", "Cleric")
	p.InstanceID, p.Level, p.UnlockedSkills, p.TalentRanks = "qa-wave-relationships", 100, []string{"Purifying Wave"}, map[string]int{"CLR_34": 5}
	w.AddEntity(p)
	for _, tc := range []struct {
		name            string
		kind            EntityType
		state, instance string
	}{
		{"ally", TypePlayer, "IDLE", p.InstanceID},
		{"summon", TypeNPC, "IDLE", p.InstanceID},
		{"enemy", TypeEnemy, "IDLE", p.InstanceID},
		{"dead", TypePlayer, "DEAD", p.InstanceID},
		{"elsewhere", TypePlayer, "IDLE", "qa-elsewhere"},
	} {
		e := newTestPlayer(tc.name, "Wizard")
		e.Type, e.State, e.InstanceID, e.X, e.Bleeding = tc.kind, tc.state, tc.instance, 10.2, true
		w.AddEntity(e)
	}
	// Actual PvP enemies are players too; type-only support checks are insufficient.
	opponent := newTestPlayer("wave-opponent", "Rogue")
	opponent.InstanceID, opponent.Bleeding = p.InstanceID, true
	w.AddEntity(opponent)
	w.PvP.Matches["wave-pvp"] = &PvPMatch{ID: "wave-pvp", Status: PvPMatchActive, TeamA: []string{p.ID}, TeamB: []string{opponent.ID}}
	w.PvP.MatchByPlayer[p.ID], w.PvP.MatchByPlayer[opponent.ID] = "wave-pvp", "wave-pvp"
	if !w.PerformAbility(p.ID, 0, 0, "", "Purifying Wave").Accepted {
		t.Fatal("cast rejected")
	}
	for _, id := range []string{"ally", "summon"} {
		if w.GetEntity(id).Bleeding {
			t.Errorf("%s was not cleansed", id)
		}
	}
	for _, id := range []string{"enemy", "dead", "elsewhere", "wave-opponent"} {
		if !w.GetEntity(id).Bleeding {
			t.Errorf("%s must not be cleansed", id)
		}
	}
}
