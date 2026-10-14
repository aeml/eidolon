package game

import (
	"encoding/json"
	"math"
	"os"
	"slices"
	"testing"
	"time"
)

type clericRuneContract struct {
	Skill, Rune                                                                          string
	Damage, Healing, Health, Radius, Reach, Cooldown, Duration, Slow, SlowDuration, Stun float64
}

func clericRuneContracts(t *testing.T) []clericRuneContract {
	t.Helper()
	data, err := os.ReadFile("testdata/cleric_branch_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []clericRuneContract
	if err = json.Unmarshal(data, &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}
func clericRuneFixture(t *testing.T, row clericRuneContract) (*World, *Entity, *Entity, *Entity) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("cleric-runes", "Cleric")
	p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "cleric-rune-contract"
	p.BaseStats = applyLevelGrowth(InitialPlayerStats(), 100)
	p.BaseStats.Intelligence = 0
	p.RecalculateStats()
	p.Damage, p.Stats.Wisdom, p.Mana, p.CooldownReduction = 100, 40, 200, 0
	p.Health = p.MaxHealth
	p.UnlockedSkills = []string{row.Skill}
	p.SkillRunes = map[string]string{row.Skill: row.Rune}
	target := &Entity{ID: "cleric-rune-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", X: p.X + 2, Z: p.Z, InstanceID: p.InstanceID, Scale: 1, Health: 10000, MaxHealth: 10000}
	ally := newTestPlayer("cleric-rune-ally", "Fighter")
	ally.X, ally.Z, ally.InstanceID = p.X+2, p.Z, p.InstanceID
	ally.Health, ally.MaxHealth = 1000, 10000
	w.AddEntity(p)
	w.AddEntity(target)
	w.AddEntity(ally)
	return w, p, target, ally
}
func TestClericBranchRunesReachPaidEffects(t *testing.T) {
	for _, row := range clericRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target, ally := clericRuneFixture(t, row)
			p.Cooldowns["Spirit Guardians"] = time.Now().Add(12 * time.Second)
			if row.Skill == "Purifying Wave" {
				ally.Poisoned = true
				ally.PoisonEndTime = time.Now().Add(10 * time.Second)
			}
			if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill); !r.Accepted {
				t.Fatal(r)
			}
			spec, _ := getAbilitySpec("Cleric", row.Skill)
			if p.Mana != 200-spec.ManaCost || math.Abs(time.Until(p.Cooldowns[row.Skill]).Seconds()-spec.Cooldown.Seconds()*row.Cooldown) > .15 {
				t.Fatal("economy", p.Mana, time.Until(p.Cooldowns[row.Skill]))
			}
			closeTime := func(deadline time.Time, seconds float64) {
				t.Helper()
				if math.Abs(time.Until(deadline).Seconds()-seconds) > .15 {
					t.Fatalf("duration %v wanted%v", time.Until(deadline), seconds)
				}
			}
			switch row.Skill {
			case "Guardian Embrace":
				closeTime(p.GuardianEmbraceEndTime, 10*row.Duration)
				if p.GuardianEmbraceRadius != 10*row.Radius {
					t.Fatal("radius")
				}
				p.SkillRunes = nil
				w.updateEntity(p, 0, nil, &deferredActions{})
				if ally.Health != 1000+int(math.Floor(100*row.Healing)) {
					t.Fatal("captured healing", ally.Health)
				}
			case "Purifying Wave":
				if 10000-target.Health != int(math.Floor(60*row.Damage)) || ally.Poisoned {
					t.Fatal("pulse/cleanse", target.Health)
				}
				closeTime(target.SlowEndTime, row.SlowDuration)
			case "Spirit Guardians Boost":
				closeTime(p.SpiritEndTime, 10*row.Duration)
				if p.SpiritRadius != 20*row.Radius {
					t.Fatal("radius")
				}
				p.SkillRunes = nil
				w.updateEntity(p, 0, nil, &deferredActions{})
				if 10000-target.Health != int(math.Floor(80*row.Damage)) || target.SlowFactor != row.Slow {
					t.Fatal("captured boosted pulse", target.Health, target.SlowFactor)
				}
			case "Avenging Seraph":
				var seraph *Entity
				for _, e := range w.Entities {
					if e.SubType == "AvengingSeraph" {
						seraph = e
					}
				}
				if seraph == nil || seraph.Damage != int(math.Floor(130*row.Damage)) || seraph.MaxHealth != int(math.Floor(900*row.Health)) || math.Abs(seraph.SummonDuration.Seconds()-15*row.Duration) > .001 {
					t.Fatal("summon plan", seraph)
				}
			case "Blessing of Resolve":
				closeTime(ally.BlessingResolveEndTime, 20*row.Duration)
				if ally.BlessingResolvePower != 1 {
					t.Fatal("potency changed")
				}
			case "Blessing of Zeal":
				closeTime(ally.ZealEndTime, 8*row.Duration)
				if ally.ZealPower != 1 || !p.Cooldowns["Spirit Guardians"].IsZero() {
					t.Fatal("personal reset/potency")
				}
			case "Mark of Weakness":
				closeTime(target.MarkWeaknessEndTime, 10*row.Duration)
				if target.MarkWeaknessFactor != .2 || effectiveAbilityRange(p, row.Skill, 15) != 15*row.Reach {
					t.Fatal("mark/range")
				}
			case "Heaven's Trumpet":
				if 10000-target.Health != int(math.Floor(120*row.Damage)) || target.MarkWeaknessFactor != .5 {
					t.Fatal("damage/weakness", target.Health)
				}
				closeTime(target.StunEndTime, row.Stun)
				closeTime(target.MarkWeaknessEndTime, 5*row.Duration)
			}
		})
	}
}
func TestClericBranchRuneRejectionSpendsAndResetsNothing(t *testing.T) {
	for _, row := range clericRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target, _ := clericRuneFixture(t, row)
			before := len(w.Entities)
			p.Cooldowns[row.Skill] = time.Now().Add(time.Second)
			p.Cooldowns["Spirit Guardians"] = time.Now().Add(time.Second)
			if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill); r.Accepted {
				t.Fatal("cooldown bypass")
			}
			if p.Mana != 200 || target.Health != 10000 || len(w.Entities) != before || p.SpiritsActive || p.GuardianEmbraceActive || p.Cooldowns["Spirit Guardians"].IsZero() {
				t.Fatal("rejection effects")
			}
		})
	}
}

func TestClericEveryLearnedSkillHasThreeDistinctRuneUnlocks(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for _, skill := range append([]string{"Spirit Guardians"}, getSkillsForBranch("Cleric", branch)...) {
			runes := GetRunesForSkill("Cleric", skill)
			if len(runes) != 3 {
				t.Fatalf("%s has %d choices", skill, len(runes))
			}
			seen := map[int]bool{}
			for _, r := range runes {
				if seen[r.UnlockLevel] {
					t.Fatal("duplicate unlock")
				}
				seen[r.UnlockLevel] = true
			}
			if !seen[50] || !seen[70] || !seen[90] {
				t.Fatal("rune journey changed")
			}
		}
	}
}

func TestClericRuneLoadoutRoundTripPreservesEarnedState(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		t.Run(branch, func(t *testing.T) {
			for choice := 0; choice < 3; choice++ {
				w, p := loadoutFixture()
				p.SubType, p.Level, p.SelectedBranch = "Cleric", 100, branch
				p.Gold = 12345
				p.TalentRanks = map[string]int{}
				p.SkillRunes = map[string]string{}
				w.UpdateUnlockedSkills(p)
				bar := getSkillsForBranch("Cleric", branch)[1:]
				for _, skill := range append([]string{"Spirit Guardians"}, bar...) {
					p.SkillRunes[skill] = GetRunesForSkill("Cleric", skill)[choice].ID
				}
				if err := w.SaveEquipmentLoadout(p.ID, choice, "Cleric variant", bar); err != nil {
					t.Fatal(err)
				}
				encoded, err := json.Marshal(p.EquipmentLoadouts[choice])
				if err != nil {
					t.Fatal(err)
				}
				var restored EquipmentLoadout
				if err := json.Unmarshal(encoded, &restored); err != nil {
					t.Fatal(err)
				}
				p.EquipmentLoadouts[choice] = restored
				beforeGold, beforeXP, beforeMana, beforeHP := p.Gold, p.Experience, p.Mana, p.Health
				p.SkillRunes = map[string]string{}
				if _, err := w.ApplyEquipmentLoadout(p.ID, choice); err != nil {
					t.Fatal(err)
				}
				for _, skill := range append([]string{"Spirit Guardians"}, bar...) {
					if p.SkillRunes[skill] != GetRunesForSkill("Cleric", skill)[choice].ID {
						t.Fatal("rune lost on saved build restore")
					}
				}
				if p.Gold != beforeGold || p.Experience != beforeXP || p.Mana != beforeMana || p.Health != beforeHP {
					t.Fatal("rune-only restore changed earned value/resources")
				}
			}
		})
	}
}

func TestClericLearnedBranchBreakpointsUseOrdinaryResources(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for i, skill := range getSkillsForBranch("Cleric", branch) {
			t.Run(branch+"/"+skill, func(t *testing.T) {
				w, p, target, ally := clericRuneFixture(t, clericRuneContract{Skill: skill})
				if skill == "Healing Light" || skill == "Divine Intervention" {
					target = ally
				}
				p.SelectedBranch = branch
				p.Level = max(1, 10*i)
				p.BaseStats = applyLevelGrowth(InitialPlayerStats(), p.Level)
				p.SkillRunes = nil
				p.TalentRanks = nil
				p.RecalculateStats()
				p.Health = p.MaxHealth
				p.Mana = p.MaxMana
				w.UpdateUnlockedSkills(p)
				before := p.Mana
				if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
					t.Fatalf("ordinary level%d cast failed: %+v", p.Level, result)
				}
				spec, _ := getAbilitySpec("Cleric", skill)
				if p.Mana != before-resolveAbilityManaCost(p, skill, spec.ManaCost) {
					t.Fatal("ordinary skill payment diverged")
				}
				for j := i + 1; j < len(getSkillsForBranch("Cleric", branch)); j++ {
					if slices.Contains(p.UnlockedSkills, getSkillsForBranch("Cleric", branch)[j]) {
						t.Fatal("future skill granted early")
					}
				}
			})
		}
	}
}

func TestClericDistantMarkUsesActualTargetRange(t *testing.T) {
	for _, runeID := range []string{"", "weakness_distant"} {
		for _, outside := range []bool{false, true} {
			w, p, target, _ := clericRuneFixture(t, clericRuneContract{Skill: "Mark of Weakness", Rune: runeID})
			x := p.X + 22.5 + entityVisualRadius(target) - .001
			if outside {
				x += .002
			}
			oldX := target.X
			target.X = x
			w.Grid.Update(target, oldX, target.Z)
			accepted := runeID != "" && !outside
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Mark of Weakness")
			if result.Accepted != accepted || target.MarkWeakness != accepted {
				t.Fatalf("range %q/%t: %+v mark=%t", runeID, outside, result, target.MarkWeakness)
			}
			wantMana := 200
			if accepted {
				wantMana -= 30
			}
			if p.Mana != wantMana || p.Cooldowns["Mark of Weakness"].IsZero() == accepted {
				t.Fatal("target admission economy")
			}
		}
	}
}

func TestClericSpiritTrainingAndLegacyRunesReachPulse(t *testing.T) {
	for _, boosted := range []bool{false, true} {
		skill, talent, raw := "Spirit Guardians", "CLR_01", 51
		if boosted {
			skill, talent, raw = "Spirit Guardians Boost", "CLR_15", 81
		}
		w, p, target, ally := clericRuneFixture(t, clericRuneContract{Skill: skill})
		p.Stats.Wisdom = 41
		p.TalentRanks = map[string]int{talent: 5}
		p.SkillRunes["Spirit Guardians"] = "spirits_vengeful"
		p.ActiveSetBonuses = map[string]map[string]int{"divine": {"spiritGuardiansHeal": 1}}
		if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill); !r.Accepted {
			t.Fatal(r)
		}
		p.SkillRunes = nil
		w.updateEntity(p, 0, nil, &deferredActions{})
		want := int(math.Floor(math.Floor(float64(raw)*1.2) * 1.5))
		if 10000-target.Health != want || ally.Health != 1018 {
			t.Fatal("trained vengeful pulse", boosted, target.Health, ally.Health, want)
		}
	}
}

func TestClericBoostRespectsControlAndCapturesSanctuary(t *testing.T) {
	for _, mode := range []string{"immune", "stronger"} {
		w, p, target, _ := clericRuneFixture(t, clericRuneContract{Skill: "Spirit Guardians Boost"})
		p.SkillRunes["Spirit Guardians"] = "spirits_sanctuary"
		target.CCImmune = mode == "immune"
		deadline := time.Now().Add(9 * time.Second)
		if mode == "stronger" {
			target.Slowed, target.SlowFactor, target.SlowEndTime = true, .7, deadline
		}
		if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Spirit Guardians Boost"); !r.Accepted {
			t.Fatal(r)
		}
		p.SkillRunes = nil
		w.updateEntity(p, 0, nil, &deferredActions{})
		if !p.SanctuaryDamageReduction || p.SpiritGuardiansRuneID != "spirits_sanctuary" || target.Health >= 10000 {
			t.Fatal("captured Sanctuary or pulse")
		}
		if mode == "immune" && target.Slowed || mode == "stronger" && (target.SlowFactor != .7 || target.SlowEndTime != deadline) {
			t.Fatal("control overwritten")
		}
	}
}
