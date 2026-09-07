package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
)

func TestClericImmediateTrainedAreas(t *testing.T) {
	data, err := os.ReadFile("testdata/cleric_immediate_area.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Skill  string
		Rank   int
		Radius float64
		Cost   int
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/rank%d/body%v/outside%v", tc.Skill, tc.Rank, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("area-caster", "Cleric")
					p.InstanceID, p.X, p.Y, p.Z = "qa-cleric-immediate", 60000, 40, 60000
					p.Level, p.TalentRanks, p.UnlockedSkills = 100, map[string]int{"CLR_34": tc.Rank}, []string{tc.Skill}
					p.Stats.Wisdom = 10
					w.AddEntity(p)
					target := newTestPlayer("area-target", "Wizard")
					target.BaseStats = Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
					target.Equipment["chest"] = Item{Stats: map[string]int{"defense": 10}}
					target.RecalculateStats()
					target.InstanceID, target.X, target.Z, target.Scale = p.InstanceID, p.X+tc.Radius+1.25*scale-.01, p.Z, scale
					if outside {
						target.X += .02
					}
					if tc.Skill == "Heaven's Trumpet" {
						target.Type = TypeEnemy
					}
					w.AddEntity(target)
					hp, defense, speed, attack := target.Health, target.Defense, target.Speed, target.AttackSpeed
					var accepted *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							accepted = &event
						}
					}
					mana := p.Mana
					if !w.PerformAbility(p.ID, p.X+100, p.Z+100, "", tc.Skill).Accepted || p.Mana != mana-tc.Cost {
						t.Fatal("cast/cost failed")
					}
					if accepted == nil || math.Abs(accepted.Radius-tc.Radius) > 1e-8 || accepted.Arc != 2*math.Pi || accepted.TargetX != p.X || accepted.TargetZ != p.Z {
						t.Errorf("incorrect accepted shape: %+v", accepted)
					}
					applied := false
					switch tc.Skill {
					case "Blessing of Resolve":
						applied = target.BlessingResolveActive && target.Defense > defense
					case "Blessing of Zeal":
						applied = target.ZealActive && target.Speed > speed && target.AttackSpeed < attack
					default:
						applied = target.Health < hp && target.Stunned && target.MarkWeakness
					}
					if applied == outside {
						t.Errorf("effect applied=%v outside=%v", applied, outside)
					}
				})
			}
		}
	}
}

func TestClericImmediateAreasPreserveRelationshipsAndImmunity(t *testing.T) {
	for _, skill := range []string{"Blessing of Resolve", "Blessing of Zeal", "Heaven's Trumpet"} {
		t.Run(skill, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("area-caster", "Cleric")
			p.InstanceID, p.Level, p.TalentRanks, p.UnlockedSkills = "qa-cleric-relationships", 100, map[string]int{"CLR_34": 5}, []string{skill}
			w.AddEntity(p)
			for _, id := range []string{"ally", "summon", "enemy", "immune", "opponent", "dead", "elsewhere"} {
				e := newTestPlayer(id, "Wizard")
				e.InstanceID, e.X = p.InstanceID, 12.2
				if id == "enemy" || id == "immune" {
					e.Type = TypeEnemy
				}
				if id == "immune" {
					e.CCImmune = true
				}
				if id == "summon" {
					e.Type = TypeNPC
				}
				if id == "dead" {
					e.State = "DEAD"
				}
				if id == "elsewhere" {
					e.InstanceID = "qa-elsewhere"
				}
				w.AddEntity(e)
			}
			w.PvP.Matches["area-pvp"] = &PvPMatch{ID: "area-pvp", Status: PvPMatchActive, TeamA: []string{p.ID}, TeamB: []string{"opponent"}}
			w.PvP.MatchByPlayer[p.ID], w.PvP.MatchByPlayer["opponent"] = "area-pvp", "area-pvp"
			if !w.PerformAbility(p.ID, 0, 0, "", skill).Accepted {
				t.Fatal("cast rejected")
			}
			for _, id := range []string{p.ID, "ally", "summon", "enemy", "immune", "opponent", "dead", "elsewhere"} {
				e := w.GetEntity(id)
				want := id == p.ID || id == "ally" || id == "summon"
				applied := e.BlessingResolveActive || e.ZealActive
				if skill == "Heaven's Trumpet" {
					want = id == "enemy" || id == "immune" || id == "opponent"
					applied = e.MarkWeakness
				}
				if applied != want {
					t.Errorf("%s applied=%v want=%v", id, applied, want)
				}
				if id == "immune" && e.Stunned {
					t.Error("stunned immune actor")
				}
			}
		})
	}
}

func TestTrainedTrumpetRetainsDungeonWalls(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		w, p, target := directSkillWallFixture("Cleric", doorway)
		p.Stats.Wisdom = 10
		p.UnlockedSkills, p.TalentRanks = []string{"Heaven's Trumpet"}, map[string]int{"CLR_34": 5}
		hp := target.Health
		if !w.PerformAbility(p.ID, p.X, p.Z, "", "Heaven's Trumpet").Accepted {
			t.Fatal("cast rejected")
		}
		if (target.Health < hp) != doorway || target.MarkWeakness != doorway {
			t.Errorf("doorway=%v damage/weakness crossed cover", doorway)
		}
	}
}
