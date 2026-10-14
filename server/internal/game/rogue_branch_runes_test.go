package game

import (
	"encoding/json"
	"math"
	"os"
	"slices"
	"testing"
	"time"
)

type rogueRuneContract struct {
	Skill, Rune                                                                      string
	Damage, Radius, Reach, Cooldown, Duration, Spread, Root, Slow, Accuracy, Spacing float64
	Count                                                                            int
	Pierce, ResetFan, ResetTripwire                                                  bool
}

func rogueRuneContracts(t *testing.T) []rogueRuneContract {
	t.Helper()
	data, err := os.ReadFile("testdata/rogue_branch_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []rogueRuneContract
	if err = json.Unmarshal(data, &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}
func rogueRuneFixture(t *testing.T, row rogueRuneContract) (*World, *Entity, *Entity) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("rogue-runes", "Rogue")
	p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "rogue-rune-contract"
	p.BaseStats = applyLevelGrowth(InitialPlayerStats(), 100)
	p.BaseStats.Intelligence = 0
	p.RecalculateStats()
	p.Damage, p.Stats.Dexterity, p.Mana, p.CooldownReduction = 100, 40, 100, 0
	p.Health = p.MaxHealth
	p.UnlockedSkills = []string{row.Skill}
	p.SkillRunes = map[string]string{row.Skill: row.Rune}
	target := &Entity{ID: "rogue-rune-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", X: p.X + 2, Z: p.Z, InstanceID: p.InstanceID, Scale: 1, Health: 10000, MaxHealth: 10000}
	w.AddEntity(p)
	w.AddEntity(target)
	return w, p, target
}
func TestRogueBranchRunesReachPaidActions(t *testing.T) {
	for _, row := range rogueRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target := rogueRuneFixture(t, row)
			p.Cooldowns["Fan of Knives"] = time.Now().Add(12 * time.Second)
			if row.Skill != "Tripwire" {
				p.Cooldowns["Tripwire"] = time.Now().Add(12 * time.Second)
			}
			var accepted *AbilityEvent
			w.OnEvent = func(kind string, payload interface{}) {
				if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
					accepted = &e
				}
			}
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill)
			if !result.Accepted {
				t.Fatal(result)
			}
			spec, _ := getAbilitySpec("Rogue", row.Skill)
			if p.Mana != 100-spec.ManaCost || math.Abs(time.Until(p.Cooldowns[row.Skill]).Seconds()-spec.Cooldown.Seconds()*row.Cooldown) > .15 {
				t.Fatal("economy", result)
			}
			closeTime := func(deadline time.Time, seconds float64) {
				t.Helper()
				if math.Abs(time.Until(deadline).Seconds()-seconds) > .15 {
					t.Fatalf("duration %v expected %v", time.Until(deadline), seconds)
				}
			}
			switch row.Skill {
			case "Weak Point Mark":
				closeTime(target.WeakPointEndTime, 10*row.Duration)
				if effectiveAbilityRange(p, row.Skill, 10) != 10*row.Reach {
					t.Fatal("range")
				}
			case "Death Spiral":
				if 10000-target.Health != int(math.Floor(200*row.Damage)) {
					t.Fatal("damage", target.Health)
				}
				if accepted == nil || accepted.Radius != 4*row.Radius {
					t.Fatal("shape", accepted)
				}
			case "Serrated Edges":
				closeTime(p.SerratedEdgesEndTime, 10*row.Duration)
				if p.Cooldowns["Fan of Knives"].IsZero() != row.ResetFan {
					t.Fatal("fan reset")
				}
			case "Poison Coating":
				closeTime(p.PoisonCoatingEndTime, 15*row.Duration)
				if p.Cooldowns["Tripwire"].IsZero() != row.ResetTripwire {
					t.Fatal("trap reset")
				}
			case "Smoke Bomb":
				closeTime(target.SlowEndTime, 5*row.Duration)
				if target.SlowFactor != row.Slow || target.AccuracyReduction != row.Accuracy || accepted == nil || accepted.Radius != 5*row.Radius {
					t.Fatal("smoke shape/effects")
				}
			case "Blade Storm", "Phantom Volley":
				p.SkillRunes = nil
				count := 0
				for _, e := range w.Entities {
					if e.Type != TypeProjectile || e.OwnerID != p.ID {
						continue
					}
					count++
					base := 50
					if row.Skill == "Phantom Volley" {
						base = 105
						if e.ProjectilePierce != row.Pierce {
							t.Fatal("pierce")
						}
					} else {
						if e.ProjectileTravelLimit != 10*row.Radius {
							t.Fatal("travel")
						}
					}
					if e.Damage != int(math.Floor(float64(base)*row.Damage)) {
						t.Fatal("snapshot damage", e.Damage)
					}
				}
				want := 5
				if row.Skill == "Phantom Volley" {
					want = row.Count
				}
				if count != want {
					t.Fatal("projectiles", count, want)
				}
				if row.Skill == "Blade Storm" && (accepted == nil || accepted.Arc != math.Pi/2*row.Spread) {
					t.Fatal("spread", accepted)
				}
			case "Tripwire":
				p.SkillRunes = nil
				var trap *Entity
				for _, e := range w.Entities {
					if e.SubType == "Tripwire" {
						trap = e
					}
				}
				if trap == nil {
					t.Fatal("missing trap")
				}
				w.updateEntity(trap, .01, nil, &deferredActions{})
				if 10000-target.Health != int(math.Floor(60*row.Damage)) {
					t.Fatal("trap damage", target.Health)
				}
				closeTime(target.RootEndTime, row.Root)
			}
		})
	}
}
func TestRogueBranchRuneRejectionSpendsAndResetsNothing(t *testing.T) {
	for _, row := range rogueRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target := rogueRuneFixture(t, row)
			beforeEntities := len(w.Entities)
			p.Cooldowns[row.Skill] = time.Now().Add(time.Second)
			if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill); r.Accepted {
				t.Fatal("accepted rejection")
			}
			if p.Mana != 100 || target.Health != 10000 || p.SerratedEdgesActive || p.PoisonCoatingActive || len(w.Entities) != beforeEntities {
				t.Fatal("rejection effects")
			}
		})
	}
}

func TestRogueEveryLearnedSkillHasThreeDistinctRuneUnlocks(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for _, skill := range append([]string{"Piercing Throw"}, getSkillsForBranch("Rogue", branch)...) {
			runes := GetRunesForSkill("Rogue", skill)
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

func TestRogueRuneLoadoutRoundTripPreservesEarnedState(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		t.Run(branch, func(t *testing.T) {
			for choice := 0; choice < 3; choice++ {
				w, p := loadoutFixture()
				p.SubType, p.Level, p.SelectedBranch = "Rogue", 100, branch
				p.Gold = 12345
				p.TalentRanks = map[string]int{}
				p.SkillRunes = map[string]string{}
				w.UpdateUnlockedSkills(p)
				bar := getSkillsForBranch("Rogue", branch)[1:]
				for _, skill := range append([]string{"Piercing Throw"}, bar...) {
					p.SkillRunes[skill] = GetRunesForSkill("Rogue", skill)[choice].ID
				}
				if err := w.SaveEquipmentLoadout(p.ID, choice, "Rogue variant", bar); err != nil {
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
				for _, skill := range append([]string{"Piercing Throw"}, bar...) {
					if p.SkillRunes[skill] != GetRunesForSkill("Rogue", skill)[choice].ID {
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

func TestRogueLearnedBranchBreakpointsUseOrdinaryResources(t *testing.T) {
	for _, branch := range []string{"A", "B", "C"} {
		for i, skill := range getSkillsForBranch("Rogue", branch) {
			t.Run(branch+"/"+skill, func(t *testing.T) {
				w, p, target := rogueRuneFixture(t, rogueRuneContract{Skill: skill})
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
				spec, _ := getAbilitySpec("Rogue", skill)
				if p.Mana != before-resolveAbilityManaCost(p, skill, spec.ManaCost) {
					t.Fatal("ordinary skill payment diverged")
				}
				for j := i + 1; j < len(getSkillsForBranch("Rogue", branch)); j++ {
					if slices.Contains(p.UnlockedSkills, getSkillsForBranch("Rogue", branch)[j]) {
						t.Fatal("future skill granted early")
					}
				}
			})
		}
	}
}

func TestPendingPhantomArrowsCancelBeforeLaunch(t *testing.T) {
	for _, reason := range []string{"dead", "disconnected", "instance", "replacement", "valid"} {
		t.Run(reason, func(t *testing.T) {
			w, p, target := rogueRuneFixture(t, rogueRuneContract{Skill: "Phantom Volley", Rune: "phantomvolley_barrage"})
			if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Phantom Volley"); !r.Accepted {
				t.Fatal(r)
			}
			var arrow *Entity
			for _, e := range w.Entities {
				if e.ProjectileSkill == "Phantom Volley" {
					arrow = e
					break
				}
			}
			if arrow == nil {
				t.Fatal("no arrow")
			}
			arrow.ProjectileActivationTime = time.Now().Add(-time.Millisecond)
			switch reason {
			case "dead":
				p.Health = 0
			case "disconnected":
				p.Disconnected = true
			case "instance":
				p.InstanceID = "elsewhere"
			case "replacement":
				replacement := newTestPlayer(p.ID, "Rogue")
				replacement.InstanceID = p.InstanceID
				w.Entities[p.ID] = replacement
			}
			actions := &deferredActions{}
			w.updateEntity(arrow, 0, nil, actions)
			if slices.Contains(actions.removals, arrow.ID) != (reason != "valid") {
				t.Fatal("pending arrow lifecycle", reason, actions.removals)
			}
			if reason == "valid" && (!arrow.ProjectileActivationTime.IsZero() || arrow.projectilePendingOwner != nil) {
				t.Fatal("launched arrow still retains pending state")
			}
		})
	}
}
