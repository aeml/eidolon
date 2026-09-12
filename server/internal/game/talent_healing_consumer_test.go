package game

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestTalentHealingDefinitions(t *testing.T) {
	data, err := os.ReadFile("testdata/talent_healing.json")
	if err != nil {
		t.Fatal(err)
	}
	var entries []struct {
		ID, Skill string
		PerRank   float64
	}
	if err := json.Unmarshal(data, &entries); err != nil {
		t.Fatal(err)
	}
	if len(entries) != 5 {
		t.Fatal("expected five implemented healing talents")
	}
	for _, entry := range entries {
		def, ok := talentDefForID("Cleric", entry.ID)
		if !ok || def.MaxRank != 5 || def.PerRank.SkillName != entry.Skill || def.PerRank.SkillHealing != entry.PerRank {
			t.Fatalf("healing contract drift for %s: %+v", entry.ID, def)
		}
	}
}

func talentHealingFixture(skill string) (*World, *Entity) {
	w := newTestWorld()
	p := newTestPlayer("talent-healer", "Cleric")
	p.Level = 100
	p.Stats.Wisdom = 10
	p.Health = 100
	p.HealingDoneBonus = 0.2
	p.UnlockedSkills = []string{skill}
	w.AddEntity(p)
	return w, p
}

func TestTalentHealingDirectCasts(t *testing.T) {
	for _, tc := range []struct {
		skill, talent string
		base, ranked  int
	}{
		{"Healing Light", "CLR_03", 72, 86},
		{"Divine Intervention", "CLR_09", 300, 360},
	} {
		for _, rank := range []int{0, 5} {
			t.Run(fmt.Sprintf("%s/rank%d", tc.skill, rank), func(t *testing.T) {
				w, p := talentHealingFixture(tc.skill)
				p.TalentRanks[tc.talent] = rank
				var healed int
				w.OnEvent = func(kind string, data interface{}) {
					if kind == "heal" {
						healed += data.(HealEvent).Amount
					}
				}
				result := w.PerformAbility(p.ID, 0, 0, p.ID, tc.skill)
				want := tc.base
				if rank > 0 {
					want = tc.ranked
				}
				if !result.Accepted || p.Health-100 != want || healed != want {
					t.Fatalf("accepted=%t health delta=%d heal event=%d; want %d", result.Accepted, p.Health-100, healed, want)
				}
			})
		}
	}
}

func TestTalentHealingCompositionAndReceivingModifiers(t *testing.T) {
	for _, tc := range []struct {
		name         string
		ranks        map[string]int
		poison       bool
		health, want int
	}{
		{"generic plus mastery", map[string]int{"CLR_03": 5, "CLR_29": 5, "CLR_39": 5}, false, 100, 104},
		{"unrelated mastery", map[string]int{"CLR_05": 5}, false, 100, 72},
		{"receiving poison", map[string]int{"CLR_03": 5}, true, 100, 43},
		{"overheal event clamp", map[string]int{"CLR_03": 5}, false, 480, 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, p := talentHealingFixture("Healing Light")
			p.TalentRanks, p.Poisoned, p.Health = tc.ranks, tc.poison, tc.health
			var healed int
			w.OnEvent = func(kind string, data interface{}) {
				if kind == "heal" {
					healed += data.(HealEvent).Amount
				}
			}
			result := w.PerformAbility(p.ID, 0, 0, p.ID, "Healing Light")
			if !result.Accepted || p.Health-tc.health != tc.want || healed != tc.want {
				t.Fatalf("accepted=%t health delta=%d event=%d; want %d", result.Accepted, p.Health-tc.health, healed, tc.want)
			}
		})
	}
}

func TestTalentHealingRenewalSnapshotsBonusOnce(t *testing.T) {
	w, p := talentHealingFixture("Healing Light")
	p.Stats.Wisdom = 100
	p.MaxHealth = 2000
	p.TalentRanks["CLR_03"] = 5
	p.SkillRunes = map[string]string{"Healing Light": "healinglight_renewal"}
	if result := w.PerformAbility(p.ID, 0, 0, p.ID, "Healing Light"); !result.Accepted {
		t.Fatal(result)
	}
	// floor(floor(330*1.2)*1.2)=475; five ticks each floor(475/25)=19.
	if p.Health != 575 || p.HealingLightHoTAmount != 19 {
		t.Fatalf("initial health=%d tick=%d", p.Health, p.HealingLightHoTAmount)
	}
	// Existing renewal semantics freeze the cast amount. Do not reapply current
	// gear/talents to its already-modified tick amount after a respec/equip change.
	p.TalentRanks["CLR_03"] = 0
	p.HealingDoneBonus = 0
	for tick := 0; tick < 5; tick++ {
		p.LastHealingLightHoTTick = time.Now().Add(-time.Second)
		w.updateEntity(p, 0, nil, &deferredActions{})
	}
	if p.Health != 670 || p.HealingLightHoTActive || p.HealingLightHoTTicksRemaining != 0 {
		t.Fatalf("renewal health=%d active=%t ticks=%d", p.Health, p.HealingLightHoTActive, p.HealingLightHoTTicksRemaining)
	}
}

func TestTalentHealingGuardianEmbraceTicks(t *testing.T) {
	for _, rank := range []int{0, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w, p := talentHealingFixture("Guardian Embrace")
			p.TalentRanks["CLR_05"] = rank
			ally := newTestPlayer("ally", "Wizard")
			ally.Health = 100
			ally.X = 1
			dead := newTestPlayer("dead", "Wizard")
			dead.State = "DEAD"
			dead.Health = 0
			other := newTestPlayer("other-instance", "Wizard")
			other.InstanceID = "elsewhere"
			other.Health = 100
			for _, target := range []*Entity{ally, dead, other} {
				w.AddEntity(target)
			}
			if result := w.PerformAbility(p.ID, 0, 0, "", "Guardian Embrace"); !result.Accepted {
				t.Fatal(result)
			}
			w.updateEntity(p, 0, nil, &deferredActions{})
			want := 48
			if rank > 0 {
				want = 57
			}
			if p.Health != 100+want || ally.Health != 100+want || dead.Health != 0 || other.Health != 100 {
				t.Fatalf("self=%d ally=%d dead=%d other=%d; expected heal=%d", p.Health, ally.Health, dead.Health, other.Health, want)
			}
		})
	}
}

func TestTalentHealingConsecratedGroundTicks(t *testing.T) {
	for _, rank := range []int{0, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w, p := talentHealingFixture("Consecrated Ground")
			p.TalentRanks["CLR_29"] = rank
			if result := w.PerformAbility(p.ID, 0, 0, "", "Consecrated Ground"); !result.Accepted {
				t.Fatal(result)
			}
			var zone *Entity
			for _, entity := range w.Entities {
				if entity.SubType == "ZoneHoly" && entity.OwnerID == p.ID {
					zone = entity
					break
				}
			}
			if zone == nil {
				t.Fatal("no holy zone created")
			}
			w.updateEntity(zone, 0, nil, &deferredActions{})
			want := 24
			if rank > 0 {
				want = 27
			}
			if p.Health != 100+want {
				t.Fatalf("zone healed %d; want %d", p.Health-100, want)
			}
		})
	}
}

func TestTalentHealingSpiritSetBonus(t *testing.T) {
	for _, skill := range []string{"Spirit Guardians", "Spirit Guardians Boost"} {
		for _, hostile := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/hostile=%t", skill, hostile), func(t *testing.T) {
				w, p := talentHealingFixture(skill)
				p.TalentRanks = map[string]int{"CLR_29": 5, "CLR_39": 5}
				p.ActiveSetBonuses = map[string]map[string]int{"healing-set": {"spiritGuardiansHeal": 1}}
				ally := newTestPlayer("spirit-target", "Wizard")
				ally.Health = 100
				ally.X = 1
				w.AddEntity(ally)
				healed := 0
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "heal" {
						event := value.(HealEvent)
						if event.TargetID == ally.ID {
							healed += event.Amount
						}
					}
				}
				if hostile {
					if err := w.SetOpenWorldPvP(p.ID, true); err != nil {
						t.Fatal(err)
					}
					if err := w.SetOpenWorldPvP(ally.ID, true); err != nil {
						t.Fatal(err)
					}
					if !w.CanDamage(p, ally) {
						t.Fatal("fixture must be opposing flagged players")
					}
				}
				if result := w.PerformAbility(p.ID, 0, 0, "", skill); !result.Accepted {
					t.Fatal(result)
				}
				w.updateEntity(p, 0, nil, &deferredActions{})
				want := 15
				if hostile {
					// Valid opponents take the normal pulse, never the ally set
					// heal. Base20/boosted35 become13/22 after PvP scaling.
					want = -13
					if skill == "Spirit Guardians Boost" {
						want = -22
					}
				}
				if ally.Health != 100+want {
					t.Fatalf("spirit healed %d; want %d", ally.Health-100, want)
				}
				wantHealing := 15
				if hostile {
					wantHealing = 0
				}
				if healed != wantHealing {
					t.Fatalf("spirit heal events=%d want=%d; damage must not conceal healing a hostile player", healed, wantHealing)
				}
			})
		}
	}
}

func TestTalentHealingLightGroupPaths(t *testing.T) {
	for _, combo := range []bool{false, true} {
		t.Run(fmt.Sprint(combo), func(t *testing.T) {
			w, p := talentHealingFixture("Healing Light")
			p.TalentRanks["CLR_03"] = 5
			ally := newTestPlayer("group-ally", "Wizard")
			ally.X, ally.Health = 2, 100
			w.AddEntity(ally)
			if combo {
				p.UnlockedSkills = append(p.UnlockedSkills, "Divine Intervention")
				if result := w.PerformAbility(p.ID, 0, 0, p.ID, "Divine Intervention"); !result.Accepted {
					t.Fatal(result)
				}
				// Advance only the GCD clock after the first real cast; its recorded
				// skill history still activates the normal Mass Revival dispatch.
				p.LastAbilityTime = time.Now().Add(-time.Second)
			} else {
				p.SkillRunes = map[string]string{"Healing Light": "healinglight_beacon"}
			}
			before := p.Health
			if result := w.PerformAbility(p.ID, 0, 0, p.ID, "Healing Light"); !result.Accepted {
				t.Fatal(result)
			}
			if p.Health-before != 86 || ally.Health != 186 {
				t.Fatalf("self=%d ally=%d", p.Health-before, ally.Health-100)
			}
			if combo && p.ActiveCombo != "" {
				t.Fatal("Mass Revival was not consumed")
			}
		})
	}
}

func TestTalentHealingZoneReadsRanksWhileLocked(t *testing.T) {
	w, p := talentHealingFixture("Consecrated Ground")
	if result := w.PerformAbility(p.ID, 0, 0, "", "Consecrated Ground"); !result.Accepted {
		t.Fatal(result)
	}
	var zone *Entity
	for _, entity := range w.Entities {
		if entity.SubType == "ZoneHoly" && entity.OwnerID == p.ID {
			zone = entity
			break
		}
	}
	if zone == nil {
		t.Fatal("no holy zone")
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 1000; i++ {
			p.Mu.Lock()
			p.TalentRanks["CLR_29"] = i % 6
			p.Mu.Unlock()
		}
	}()
	for i := 0; i < 100; i++ {
		zone.LastAttackTime = time.Now().Add(-time.Second)
		w.updateEntity(zone, 0, nil, &deferredActions{})
	}
	<-done
}
