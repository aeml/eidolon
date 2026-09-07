package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"
)

func TestRogueTalentMovementRangeBoundaries(t *testing.T) {
	data, err := os.ReadFile("testdata/rogue_movement_range.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name  string  `json:"name"`
		Skill string  `json:"skill"`
		Rune  string  `json:"rune"`
		Rank  int     `json:"rank"`
		Range float64 `json:"range"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, outside := range []bool{false, true} {
			for _, explicit := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/outside=%v/explicit=%v", tc.Name, outside, explicit), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("rogue-range", "Rogue")
					p.Level, p.TalentRanks["ROG_36"] = 100, tc.Rank
					p.X, p.Z = 60000, 60000
					p.UnlockedSkills, p.SkillRunes = []string{tc.Skill}, map[string]string{tc.Skill: tc.Rune}
					w.AddEntity(p)
					target := &Entity{ID: "rogue-range-target", Type: TypeEnemy, X: p.X, Z: p.Z, Scale: 4,
						Health: 10000, MaxHealth: 10000, State: "IDLE", Rotation: math.Pi / 2}
					delta := -0.01
					if outside {
						delta = 0.01
					}
					target.X += tc.Range + entityVisualRadius(target) + delta
					w.AddEntity(target)
					id := ""
					if explicit {
						id = target.ID
					}
					mana, x, z := p.Mana, p.X, p.Z
					var event *AbilityEvent
					w.OnEvent = func(kind string, value interface{}) {
						if cast, ok := value.(AbilityEvent); kind == "ability" && ok {
							event = &cast
						}
					}
					result := w.PerformAbility(p.ID, target.X, target.Z, id, tc.Skill)
					if outside {
						if result.Accepted || p.X != x || p.Z != z || p.Mana != mana || result.CooldownRemaining != 0 || event != nil || target.Health != 10000 || target.Bleeding || target.Slowed {
							t.Fatalf("outside cast changed state: %+v", result)
						}
						return
					}
					if !result.Accepted || p.Mana >= mana || result.CooldownRemaining <= 0 || event == nil {
						t.Fatalf("inside cast failed: %+v", result)
					}
					moves := tc.Skill != "Backstab" || tc.Rune == "backstab_shadowstep"
					if moves {
						if math.Abs(p.X-(target.X-1.5)) > 1e-8 || math.Abs(p.Z-target.Z) > 1e-8 || p.MoveLockUntil.IsZero() {
							t.Fatal("incorrect behind-target landing")
						}
					} else if p.X != x || p.Z != z {
						t.Fatal("ordinary Backstab moved the caster")
					}
					if (tc.Skill != "Shadow Lunge" || tc.Rune == "shadowlunge_shadow") && target.Health >= 10000 {
						t.Fatal("strike/clone failed to damage target")
					}
					if tc.Rune == "shadowlunge_cripple" && !target.Slowed {
						t.Fatal("cripple lost its slow")
					}
					if (tc.Skill == "Shadow Strike" || tc.Skill == "Shadow Lunge") && (!target.Bleeding || target.BleedSourceID != p.ID || target.BleedDamage <= 0 || target.BleedEndTime.IsZero()) {
						t.Fatal("movement strike did not apply its promised bleed")
					}
				})
			}
		}
	}
}

func TestShadowLungeBleedPrimesDeathSpiral(t *testing.T) {
	damages := make([]int, 2)
	for index, prime := range []bool{false, true} {
		w := newTestWorld()
		p := newTestPlayer("lunge-finisher", "Rogue")
		p.Level, p.Stats.Dexterity = 100, 20
		p.X, p.Z = 50000, 50000
		p.UnlockedSkills = []string{"Shadow Lunge", "Death Spiral"}
		w.AddEntity(p)
		target := &Entity{ID: "finisher-target", Type: TypeEnemy, X: p.X + 2, Z: p.Z, Scale: 1, State: "IDLE", Health: 10000, MaxHealth: 10000}
		w.AddEntity(target)
		if prime {
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shadow Lunge"); !result.Accepted {
				t.Fatal(result)
			}
			if !target.Bleeding || target.BleedDamage != 20 || target.BleedSourceID != p.ID {
				t.Fatal("lunge did not prime the expected bleed")
			}
			// This unit fixture advances only the independent global-cooldown
			// timestamp; production clocks/cooldown policy remain unchanged.
			p.LastAbilityTime = time.Now().Add(-time.Second)
		}
		before := target.Health
		if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Death Spiral"); !result.Accepted {
			t.Fatal(result)
		}
		damages[index] = before - target.Health
		if target.Bleeding || target.BleedDamage != 0 || target.BleedSourceID != "" {
			t.Fatal("finisher failed to consume its bleed")
		}
	}
	if damages[1]-damages[0] != 10 {
		t.Fatalf("lunge did not provide the Dexterity/2 finisher bonus: %v", damages)
	}
}

func TestShadowLungeBleedActuallyTicksOnEnemy(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("lunge-tick-owner", "Rogue")
	p.Level, p.Stats.Dexterity = 100, 20
	p.X, p.Z = 50000, 50000
	p.UnlockedSkills = []string{"Shadow Lunge"}
	w.AddEntity(p)
	target := &Entity{ID: "lunge-tick-enemy", Type: TypeEnemy, SubType: "Skeleton", X: p.X + 2, Z: p.Z,
		SpawnX: p.X + 2, SpawnZ: p.Z, Health: 10000, MaxHealth: 10000, State: "IDLE", Scale: 1}
	w.AddEntity(target)
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shadow Lunge"); !result.Accepted {
		t.Fatal(result)
	}
	var ticks []DamageEvent
	w.OnEvent = func(kind string, payload interface{}) {
		if event, ok := payload.(DamageEvent); kind == "damage" && ok && event.Kind == "bleed" {
			ticks = append(ticks, event)
		}
	}
	w.updateEntity(target, .05, []*Entity{p}, &deferredActions{})
	if target.Health != 9980 || len(ticks) != 1 || ticks[0].SourceID != p.ID || ticks[0].TargetID != target.ID || ticks[0].Amount != 20 {
		t.Fatalf("enemy bleed did not tick with attribution: health=%v ticks=%+v", target.Health, ticks)
	}
	w.updateEntity(target, .05, []*Entity{p}, &deferredActions{})
	if target.Health != 9980 || len(ticks) != 1 {
		t.Fatal("bleed ticked twice within one second")
	}
	target.BleedEndTime = time.Now().Add(-time.Second)
	w.updateEntity(target, .05, []*Entity{p}, &deferredActions{})
	if target.Bleeding || target.BleedSourceID != "" || target.Health != 9980 {
		t.Fatal("expired bleed remained active or damaged again")
	}
}

func TestRankedRogueMovementKeepsWallsAndLanding(t *testing.T) {
	for _, spec := range []struct {
		skill, rune string
		distance    float64
	}{
		{"Backstab", "backstab_shadowstep", 4},
		{"Shadow Lunge", "", 12.5},
		{"Shadow Lunge", "shadowlunge_extended", 18.25},
		{"Shadow Strike", "", 12.5},
	} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/doorway=%v", spec.skill, spec.rune, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Rogue", doorway)
				p.Level, p.TalentRanks["ROG_36"] = 100, 5
				p.UnlockedSkills, p.SkillRunes = []string{spec.skill}, map[string]string{spec.skill: spec.rune}
				oldX := target.X
				target.X, target.Rotation = p.X+spec.distance, math.Pi/2
				w.Grid.Update(target, oldX, target.Z)
				mana, x, z := p.Mana, p.X, p.Z
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, spec.skill)
				if !doorway {
					if result.Accepted || p.Mana != mana || p.X != x || p.Z != z || result.CooldownRemaining != 0 || target.Health != 10000 || target.Bleeding {
						t.Fatalf("ranked movement bypassed wall: %+v", result)
					}
				} else if !result.Accepted || math.Abs(p.X-(target.X-1.5)) > 1e-8 || math.Abs(p.Z-target.Z) > 1e-8 {
					t.Fatalf("ranked movement failed through doorway: %+v, position=%v,%v", result, p.X, p.Z)
				}
			})
		}
	}
}
