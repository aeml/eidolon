package game

import (
	"encoding/json"
	"math"
	"os"
	"slices"
	"testing"
	"time"
)

type branchRuneContract struct {
	Skill, Rune                             string
	Mana, Damage                            int
	Cooldown, Radius, Stun, Speed, Duration float64
	ResetTeleport, ResetGravity             bool
}

func branchRuneContracts(t *testing.T) []branchRuneContract {
	t.Helper()
	data, err := os.ReadFile("testdata/wizard_branch_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []branchRuneContract
	if err := json.Unmarshal(data, &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}
func TestWizardBranchRunesActualPaidCasts(t *testing.T) {
	for _, row := range branchRuneContracts(t) {
		t.Run(row.Skill+"/"+row.Rune, func(t *testing.T) {
			w, p, target := precisionRuneFixture(t, row.Skill, row.Rune)
			p.SelectedBranch = "A"
			if row.Skill == "Time Warp" {
				p.SelectedBranch = "C"
			}
			p.UnlockedSkills = getSkillsForBranch("Wizard", p.SelectedBranch)
			p.Mana = 100
			p.Cooldowns["Teleport"] = time.Now().Add(12 * time.Second)
			p.Cooldowns["Gravity Well"] = time.Now().Add(20 * time.Second)
			ally := newTestPlayer("branch-ally", "Fighter")
			ally.X, ally.Z, ally.InstanceID = p.X+20, p.Z, p.InstanceID
			ally.Cooldowns["Teleport"] = time.Now().Add(11 * time.Second)
			w.AddEntity(ally)
			before := target.Health
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill); !result.Accepted {
				t.Fatalf("cast: %+v", result)
			}
			if p.Mana != 100-row.Mana {
				t.Fatalf("mana=%d", p.Mana)
			}
			if math.Abs(time.Until(p.Cooldowns[row.Skill]).Seconds()-row.Cooldown) > .1 {
				t.Fatal("cooldown tradeoff lost")
			}
			if row.Skill == "Flame Whip" {
				if before-target.Health != row.Damage || !target.Stunned || math.Abs(time.Until(target.StunEndTime).Seconds()-row.Stun) > .1 {
					t.Fatalf("whip damage=%d stun=%v", before-target.Health, time.Until(target.StunEndTime))
				}
			} else if row.Skill == "Time Warp" {
				if math.Abs(time.Until(p.TimeWarpEndTime).Seconds()-row.Duration) > .1 {
					t.Fatal("haste duration lost")
				}
				if p.Cooldowns["Teleport"].IsZero() != row.ResetTeleport || p.Cooldowns["Gravity Well"].IsZero() != row.ResetGravity {
					t.Fatal("personal reset tradeoff lost")
				}
				if ally.TimeWarpActive != (row.Radius >= 20) || target.TimeWarpActive || ally.Cooldowns["Teleport"].IsZero() {
					t.Fatal("support crossed recipient or cooldown boundary")
				}
			} else {
				var effect *Entity
				for _, e := range w.Entities {
					if e.Type == TypeProjectile && e.OwnerID == p.ID && e.ProjectileSkill == row.Skill {
						effect = e
					}
				}
				if effect == nil || effect.Damage != row.Damage || math.Abs(effect.Radius-row.Radius) > 1e-6 {
					t.Fatalf("effect mismatch: %+v", effect)
				}
				p.SkillRunes = nil
				p.Stats.Intelligence = 999
				if row.Skill == "Flame Tornado" {
					if math.Abs(math.Hypot(effect.VelX, effect.VelZ)-row.Speed) > 1e-6 || math.Abs(effect.Scale-row.Radius/3) > 1e-6 {
						t.Fatal("tornado footprint/flight lost")
					}
				} else {
					if math.Abs(time.Until(effect.ZoneEndTime).Seconds()-row.Duration) > .1 {
						t.Fatal("paid field duration lost")
					}
					w.Update(.05)
					if before-target.Health != row.Damage {
						t.Fatalf("field receiving damage=%d want%d", before-target.Health, row.Damage)
					}
					if ally.Health != ally.MaxHealth {
						t.Fatal("field hit ally")
					}
				}
			}
		})
	}
}
func TestWizardBranchRunesCannotCastWithoutPayment(t *testing.T) {
	for _, row := range branchRuneContracts(t) {
		t.Run(row.Skill+"/"+row.Rune, func(t *testing.T) {
			w, p, target := precisionRuneFixture(t, row.Skill, row.Rune)
			p.UnlockedSkills = []string{row.Skill}
			p.Mana = 0
			before := len(w.Entities)
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill); result.Accepted {
				t.Fatal("unpaid cast accepted")
			}
			if len(w.Entities) != before || target.Health != target.MaxHealth || p.TimeWarpActive {
				t.Fatal("rejected cast applied effects")
			}
		})
	}
}
func TestWizardBindingFlamePreservesLongerStun(t *testing.T) {
	w, p, target := precisionRuneFixture(t, "Flame Whip", "flamewhip_binding")
	p.UnlockedSkills = []string{"Flame Whip"}
	target.Stunned = true
	target.StunEndTime = time.Now().Add(9 * time.Second)
	end := target.StunEndTime
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Flame Whip"); !result.Accepted {
		t.Fatal(result)
	}
	if !target.StunEndTime.Equal(end) {
		t.Fatal("binding shortened existing control")
	}
}

func TestWizardEveryLearnedSkillHasThreeDistinctRuneUnlocks(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for _, skill := range append([]string{"Fireball"}, getSkillsForBranch("Wizard", branch)...) {
			runes := GetRunesForSkill("Wizard", skill)
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

func TestWizardRuneLoadoutRoundTripPreservesEarnedState(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		t.Run(branch, func(t *testing.T) {
			for choice := 0; choice < 3; choice++ {
				w, p := loadoutFixture()
				p.SubType, p.Level, p.SelectedBranch = "Wizard", 100, branch
				p.Gold = 12345
				p.TalentRanks = map[string]int{}
				p.SkillRunes = map[string]string{}
				w.UpdateUnlockedSkills(p)
				bar := getSkillsForBranch("Wizard", branch)[1:]
				for _, skill := range append([]string{"Fireball"}, bar...) {
					p.SkillRunes[skill] = GetRunesForSkill("Wizard", skill)[choice].ID
				}
				if err := w.SaveEquipmentLoadout(p.ID, choice, "Wizard variant", bar); err != nil {
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
				for _, skill := range append([]string{"Fireball"}, bar...) {
					if p.SkillRunes[skill] != GetRunesForSkill("Wizard", skill)[choice].ID {
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

func TestWizardLearnedBranchBreakpointsUseOrdinaryResources(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for i, skill := range getSkillsForBranch("Wizard", branch) {
			t.Run(branch+"/"+skill, func(t *testing.T) {
				w, p, target := precisionRuneFixture(t, skill, "")
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
				spec, _ := getAbilitySpec("Wizard", skill)
				if p.Mana != before-resolveAbilityManaCost(p, skill, spec.ManaCost) {
					t.Fatal("ordinary skill payment diverged")
				}
				for j := i + 1; j < len(getSkillsForBranch("Wizard", branch)); j++ {
					if slices.Contains(p.UnlockedSkills, getSkillsForBranch("Wizard", branch)[j]) {
						t.Fatal("future skill granted early")
					}
				}
			})
		}
	}
}
