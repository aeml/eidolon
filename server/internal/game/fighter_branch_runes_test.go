package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"slices"
	"testing"
	"time"
)

func TestFighterBranchRuneBodyEdgesAndAcceptedShapes(t *testing.T) {
	radii := map[string]float64{"Sweeping Strike": 5, "Juggernaut Charge": 10, "Shattering Charge": 16, "Executioner Spin": 6}
	for _, row := range fighterRuneContracts(t) {
		base, ok := radii[row.Skill]
		if !ok {
			continue
		}
		for _, outside := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/outside%v", row.Rune, outside), func(t *testing.T) {
				w, p, target, _ := fighterRuneFixture(t, row)
				radius := base * row.Radius
				oldX, oldZ := target.X, target.Z
				target.X = p.X + radius + entityVisualRadius(target) - .001
				if outside {
					target.X += .002
				}
				w.Grid.Update(target, oldX, oldZ)
				var accepted *AbilityEvent
				w.OnEvent = func(kind string, payload interface{}) {
					if event, ok := payload.(AbilityEvent); kind == "ability" && ok && event.Radius > 0 {
						accepted = &event
					}
				}
				aimX := p.X + 1
				travelling := row.Skill == "Juggernaut Charge" || row.Skill == "Shattering Charge"
				if travelling {
					aimX = p.X
				}
				if result := w.PerformAbility(p.ID, aimX, p.Z, "", row.Skill); !result.Accepted {
					t.Fatal(result)
				}
				if travelling {
					p.SkillRunes = nil
					w.updateEntity(p, .1, nil, &deferredActions{})
				}
				if (target.Health < 10000) != !outside {
					t.Fatal("rune footprint lost", target.Health, radius, outside)
				}
				if row.Skill != "Shattering Charge" && (accepted == nil || math.Abs(accepted.Radius-radius) > 1e-8) {
					t.Fatal("accepted shape disagrees with impact", accepted, radius)
				}
			})
		}
	}
}

type fighterRuneContract struct {
	Skill, Rune                                                   string
	Damage, Radius, Reach, Cooldown, Duration, Root, Slow, Marked float64
	Pull, Share, ResetShattering                                  bool
}

func fighterRuneContracts(t *testing.T) []fighterRuneContract {
	t.Helper()
	data, err := os.ReadFile("testdata/fighter_branch_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []fighterRuneContract
	if err := json.Unmarshal(data, &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}

func fighterRuneFixture(t *testing.T, row fighterRuneContract) (*World, *Entity, *Entity, *Entity) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("fighter-runes", "Fighter")
	p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "fighter-rune-contract"
	p.BaseStats = applyLevelGrowth(InitialPlayerStats(), 100)
	p.BaseStats.Intelligence = 0 // Stable zero-CDR fixture survives buff recalculation.
	p.RecalculateStats()
	p.Damage, p.Stats.Strength, p.Mana, p.CooldownReduction = 100, 40, 100, 0
	p.Health = p.MaxHealth
	p.UnlockedSkills = []string{row.Skill}
	p.SkillRunes = map[string]string{row.Skill: row.Rune}
	target := &Entity{ID: "fighter-rune-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
		X: p.X + 2, Z: p.Z, InstanceID: p.InstanceID, Scale: 1, Health: 10000, MaxHealth: 10000, WeakPointMarked: true}
	ally := newTestPlayer("fighter-rune-ally", "Cleric")
	ally.X, ally.Z, ally.InstanceID = p.X+20, p.Z, p.InstanceID
	w.AddEntity(p)
	w.AddEntity(target)
	w.AddEntity(ally)
	party := w.CreateParty(p.ID)
	party.Members = append(party.Members, ally.ID)
	ally.PartyID = party.ID
	return w, p, target, ally
}

func TestFighterBranchRunesReachPaidCombatAndSupport(t *testing.T) {
	for _, row := range fighterRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target, ally := fighterRuneFixture(t, row)
			if row.Skill != "Shattering Charge" {
				p.Cooldowns["Shattering Charge"] = time.Now().Add(12 * time.Second)
			}
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill)
			if !result.Accepted {
				t.Fatal(result)
			}
			spec, _ := getAbilitySpec("Fighter", row.Skill)
			if p.Mana != 100-spec.ManaCost || math.Abs(time.Until(p.Cooldowns[row.Skill]).Seconds()-spec.Cooldown.Seconds()*row.Cooldown) > .1 {
				t.Fatal("paid economy diverged", result)
			}
			if row.Skill == "Juggernaut Charge" || row.Skill == "Shattering Charge" {
				p.SkillRunes = nil // later equipment changes cannot rewrite a travelling rune
				w.Update(.1)
			}
			base := map[string]int{"Sweeping Strike": 148, "Unbreakable Grip": 140, "Juggernaut Charge": 140, "Shattering Charge": 195, "Executioner Spin": 286}[row.Skill]
			if base > 0 {
				want := int(math.Floor(float64(base) * row.Damage))
				if row.Skill == "Executioner Spin" {
					want = int(math.Floor(float64(want) * row.Marked))
				}
				if 10000-target.Health != want {
					t.Fatalf("damage=%d want%d", 10000-target.Health, want)
				}
			}
			switch row.Skill {
			case "Unbreakable Grip":
				if target.Rooted != (row.Root > 0) {
					t.Fatal("root tradeoff lost")
				}
				if row.Root > 0 && math.Abs(time.Until(target.RootEndTime).Seconds()-row.Root) > .1 {
					t.Fatal("root duration lost")
				}
			case "Juggernaut Charge":
				if target.Slowed != (row.Slow > 0) {
					t.Fatal("slow tradeoff lost")
				}
			case "Shattering Charge":
				if math.Abs(time.Until(target.ArmorReductionEndTime).Seconds()-5*row.Duration) > .1 {
					t.Fatal("captured armor break lost")
				}
			case "Guardian Roar":
				if math.Abs(time.Until(p.GuardianRoarEndTime).Seconds()-10*row.Duration) > .1 || ally.GuardianRoarActive != (15*row.Radius >= 20) {
					t.Fatal("party protection tradeoff lost")
				}
			case "Berserker Edge":
				if math.Abs(time.Until(p.BerserkerModeEndTime).Seconds()-15*row.Duration) > .1 || ally.BerserkerModeActive != (row.Share && 15*row.Radius >= 20) {
					t.Fatal("party fury tradeoff lost")
				}
			case "Last Stand Rampage":
				if math.Abs(time.Until(p.LastStandEndTime).Seconds()-10*row.Duration) > .1 || p.LastStandMultiplier != 2 || p.Cooldowns["Shattering Charge"].IsZero() != row.ResetShattering {
					t.Fatal("rampage choice lost")
				}
			}
		})
	}
}

func TestFighterBranchRuneCooldownRejectionHasNoEffects(t *testing.T) {
	for _, row := range fighterRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target, _ := fighterRuneFixture(t, row)
			p.Cooldowns[row.Skill] = time.Now().Add(time.Second)
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill); result.Accepted {
				t.Fatal("cooldown bypassed")
			}
			if p.Mana != 100 || target.Health != 10000 || p.IsCharging || p.LastStandActive || p.BerserkerModeActive {
				t.Fatal("rejection applied effects")
			}
		})
	}
}

func TestHarpoonGripSelectsMoreDistantTargetWithoutPullingCrushingGrip(t *testing.T) {
	for _, rune := range []string{"grip_harpoon", "grip_impact"} {
		t.Run(rune, func(t *testing.T) {
			w, p, target, _ := fighterRuneFixture(t, fighterRuneContract{Skill: "Unbreakable Grip", Rune: rune})
			oldX, oldZ := target.X, target.Z
			target.X = p.X + 14
			w.Grid.Update(target, oldX, oldZ)
			if rune == "grip_impact" {
				target.X = p.X + 8
				w.Grid.Update(target, p.X+14, target.Z)
			}
			x := target.X
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Unbreakable Grip"); !result.Accepted {
				t.Fatal(result)
			}
			if (target.X != x) != (rune == "grip_harpoon") {
				t.Fatal("pull/range choice lost")
			}
		})
	}
}

func TestFighterEveryLearnedSkillHasThreeDistinctRuneUnlocks(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for _, skill := range append([]string{"Charge"}, getSkillsForBranch("Fighter", branch)...) {
			runes := GetRunesForSkill("Fighter", skill)
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

func TestFighterRuneLoadoutRoundTripPreservesEarnedState(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		t.Run(branch, func(t *testing.T) {
			for choice := 0; choice < 3; choice++ {
				w, p := loadoutFixture()
				p.SubType, p.Level, p.SelectedBranch = "Fighter", 100, branch
				p.Gold = 12345
				p.TalentRanks = map[string]int{}
				p.SkillRunes = map[string]string{}
				w.UpdateUnlockedSkills(p)
				bar := getSkillsForBranch("Fighter", branch)[1:]
				for _, skill := range append([]string{"Charge"}, bar...) {
					p.SkillRunes[skill] = GetRunesForSkill("Fighter", skill)[choice].ID
				}
				if err := w.SaveEquipmentLoadout(p.ID, choice, "Fighter variant", bar); err != nil {
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
				for _, skill := range append([]string{"Charge"}, bar...) {
					if p.SkillRunes[skill] != GetRunesForSkill("Fighter", skill)[choice].ID {
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

func TestFighterLearnedBranchBreakpointsUseOrdinaryResources(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for i, skill := range getSkillsForBranch("Fighter", branch) {
			t.Run(branch+"/"+skill, func(t *testing.T) {
				w, p, target, _ := fighterRuneFixture(t, fighterRuneContract{Skill: skill})
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
				spec, _ := getAbilitySpec("Fighter", skill)
				if p.Mana != before-resolveAbilityManaCost(p, skill, spec.ManaCost) {
					t.Fatal("ordinary skill payment diverged")
				}
				for j := i + 1; j < len(getSkillsForBranch("Fighter", branch)); j++ {
					if slices.Contains(p.UnlockedSkills, getSkillsForBranch("Fighter", branch)[j]) {
						t.Fatal("future skill granted early")
					}
				}
			})
		}
	}
}
