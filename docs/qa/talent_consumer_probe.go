package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import (
	"fmt"
	"math"
	"math/rand"
	"os"
	"testing"
	"time"
)

// Baseline crowd-control lifecycle must work before additional duration ranks
// can be accepted. These casts use real handlers; only the later deadline is
// advanced to exercise expiry without a wall-clock sleep.
func TestPendingTalentEnemyRootAndSlowLifecycle(t *testing.T) {
	for _, tc := range []struct{ class, skill, runeID string }{
		{"Wizard", "Gravity Well", "gravitywell_blackhole"},
		{"Fighter", "Juggernaut Charge", ""},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("control-caster", tc.class)
			p.Level, p.InstanceID, p.X, p.Z = 100, "qa-control-lifecycle", 60000, 60000
			p.BaseStats = InitialPlayerStats()
			p.UnlockedSkills = []string{tc.skill}
			p.SkillRunes = map[string]string{tc.skill: tc.runeID}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			w.AddEntity(p)
			e := &Entity{ID: "control-enemy", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				State: "IDLE", Level: 30, BaseStats: InitialPlayerStats(), Health: 10000, MaxHealth: 10000,
				X: p.X + 8, Z: p.Z, SpawnX: p.X + 8, SpawnZ: p.Z, Scale: 1, Radius: 1.25, Speed: 8, BaseSpeed: 8}
			w.AddEntity(e)
			mana := p.Mana
			result := w.PerformAbility(p.ID, e.X, e.Z, "", tc.skill)
			root := tc.skill == "Gravity Well"
			if !result.Accepted || p.Mana >= mana || !e.Slowed || e.SlowFactor <= 0 || e.Rooted != root || e.Health >= 10000 {
				t.Fatalf("paid damaging control failed: accepted=%v slow=%v factor=%v root=%v hp=%d", result.Accepted, e.Slowed, e.SlowFactor, e.Rooted, e.Health)
			}
			x, z := e.X, e.Z
			w.updateEntity(e, .25, []*Entity{p}, &deferredActions{})
			wantMove := 8 * (1 - e.SlowFactor) * .25
			if root {
				wantMove = 0
			}
			if moved := math.Hypot(e.X-x, e.Z-z); math.Abs(moved-wantMove) > 1e-6 {
				t.Errorf("active crowd control moved=%v want=%v", moved, wantMove)
			}
			e.RootEndTime, e.SlowEndTime = time.Now().Add(-time.Millisecond), time.Now().Add(-time.Millisecond)
			x, z = e.X, e.Z
			w.updateEntity(e, .25, []*Entity{p}, &deferredActions{})
			if e.Rooted || e.Slowed || e.SlowFactor != 0 || math.Abs(e.Speed-8) > 1e-6 {
				t.Errorf("expired control retained: root=%v slow=%v factor=%v speed=%v", e.Rooted, e.Slowed, e.SlowFactor, e.Speed)
			}
			if moved := math.Hypot(e.X-x, e.Z-z); math.Abs(moved-2) > 1e-6 {
				t.Errorf("post-expiry normal pursuit moved=%v want=2", moved)
			}
		})
	}
}

// Duration definitions are percentage-based, although the older Fighter copy
// describes flat stun seconds/armor penetration. This probes the server-defined
// benefit, not a claim that those descriptions already match the implementation.
func TestPendingTalentFighterShieldSlamDuration(t *testing.T) {
	for _, talent := range []string{"FTR_30", "FTR_37"} {
		for _, runeID := range []string{"", "shieldslam_concussion"} {
			for _, rank := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rune%s/rank%d", talent, runeID, rank), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("slam-duration-caster", "Fighter")
					p.Level, p.InstanceID, p.X, p.Z = 100, "qa-slam-duration", 60000, 60000
					p.BaseStats = InitialPlayerStats()
					p.UnlockedSkills = []string{"Shield Slam"}
					p.TalentRanks = map[string]int{talent: rank}
					p.SkillRunes = map[string]string{"Shield Slam": runeID}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					target := &Entity{ID: "slam-duration-enemy", Type: TypeEnemy, InstanceID: p.InstanceID,
						State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 1, X: p.X + 2, Z: p.Z}
					w.AddEntity(target)
					base := 1500 * time.Millisecond
					if runeID != "" {
						base += time.Second
					}
					def, ok := talentDefForID("Fighter", talent)
					if !ok || def.PerRank.SkillDuration <= 0 {
						t.Fatal("duration definition missing")
					}
					want := time.Duration(math.Round(float64(base) * (1 + float64(rank)*def.PerRank.SkillDuration)))
					mana, started := p.Mana, time.Now()
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam")
					finished := time.Now()
					if !result.Accepted || p.Mana != mana-25 || !p.Cooldowns["Shield Slam"].After(started) ||
						!target.Stunned || target.Health >= target.MaxHealth {
						t.Fatalf("paid damaging/stunning control failed: accepted=%v mana=%d stunned=%v hp=%d", result.Accepted, p.Mana, target.Stunned, target.Health)
					}
					if target.StunEndTime.Before(started.Add(want)) || target.StunEndTime.After(finished.Add(want)) {
						t.Errorf("rank%d duration=%v..%v want=%v after rune; ordinary hit and stun succeeded", rank,
							target.StunEndTime.Sub(finished), target.StunEndTime.Sub(started), want)
					}
				})
			}
		}
	}

}

// Executioner Spin's paid server strike must consume the same advertised area
// bonuses as Guardian Roar. Paired targets stay at one point in the trained
// annulus; the untrained control must miss and the trained strike must hit.
func TestPendingTalentExecutionerSpinArea(t *testing.T) {
	for _, talent := range []string{"FTR_24", "FTR_33", "FTR_38"} {
		for _, scale := range []float64{1, 4} {
			for _, rank := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/body%v/rank%d", talent, scale, rank), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("spin-area-caster", "Fighter")
					p.Level, p.InstanceID, p.X, p.Z = 100, "qa-spin-area-probe", 60000, 60000
					p.BaseStats = InitialPlayerStats()
					p.UnlockedSkills, p.TalentRanks = []string{"Executioner Spin"}, map[string]int{talent: rank}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					target := &Entity{ID: "spin-area-enemy", Type: TypeEnemy, InstanceID: p.InstanceID,
						State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: scale,
						X: p.X + 6.3 + 1.25*scale, Z: p.Z}
					w.AddEntity(target)
					control := &Entity{ID: "spin-near-control", Type: TypeEnemy, InstanceID: p.InstanceID,
						State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 1, X: p.X + 2, Z: p.Z}
					w.AddEntity(control)
					mana := p.Mana
					result := w.PerformAbility(p.ID, p.X, p.Z, "", "Executioner Spin")
					if !result.Accepted || p.Mana != mana-40 {
						t.Fatalf("ordinary paid spin failed: %+v mana=%d before=%d", result, p.Mana, mana)
					}
					if control.Health >= control.MaxHealth {
						t.Fatal("nearby positive damage control failed")
					}
					damaged := target.Health < target.MaxHealth
					if damaged != (rank > 0) {
						t.Errorf("rank%d body%v target at%v damaged=%v; want%v", rank, scale, target.X-p.X, damaged, rank > 0)
					}
				})
			}
		}
	}
}

// Lineholder Instinct explicitly promises3% AoE radius per rank. Confirm its
// utility consumer with real paid casts, not a definition/helper-only check.
// Keep this diagnostic outside the passing release suite until the handler and
// client footprint are repaired together.
func TestPendingTalentFighterGuardianRoarArea(t *testing.T) {
	for _, scale := range []float64{1, 4} {
		for _, rank := range []int{0, 5} {
			t.Run(fmt.Sprintf("body%v/rank%d", scale, rank), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("roar-area-caster", "Fighter")
				p.Level, p.InstanceID, p.X, p.Z = 30, "qa-roar-area-probe", 60000, 60000
				p.UnlockedSkills, p.TalentRanks = []string{"Guardian Roar"}, map[string]int{"FTR_33": rank}
				p.RecalculateStats()
				p.Mana = p.MaxMana
				w.AddEntity(p)
				ally := newTestPlayer("roar-area-ally", "Cleric")
				// Same annulus position in the paired rank-zero/rank-five casts.
				// Base15 plus body padding excludes it; trained17.25 includes it.
				ally.InstanceID, ally.Scale, ally.X, ally.Z = p.InstanceID, scale, p.X+16+1.25*scale, p.Z
				w.AddEntity(ally)
				before := p.Mana
				result := w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar")
				if !result.Accepted || p.Mana != before-35 || !p.GuardianRoarActive {
					t.Fatalf("ordinary paid roar/self buff failed: %+v mana=%d before=%d", result, p.Mana, before)
				}
				if ally.GuardianRoarActive != (rank > 0) {
					t.Errorf("rank%d body%v ally at%v buffed=%v; want%v", rank, scale, ally.X-p.X, ally.GuardianRoarActive, rank > 0)
				}
				if ally.GuardianRoarActive && !ally.GuardianRoarEndTime.Equal(p.GuardianRoarEndTime) {
					t.Fatal("party buff did not inherit its caster's deadline")
				}
			})
		}
	}
}

// This isolated diagnostic process uses a fixed production RNG roll to compare
// actual casts, not a statistical sample or a replacement damage implementation.
// No parallel subtests: reseeding the process-global RNG is deliberate here.
func TestPendingTalentSkillCriticalChance(t *testing.T) {
	debug := os.Getenv("GODEBUG")
	if debug != "" {
		debug += ","
	}
	t.Setenv("GODEBUG", debug+"randseednop=0")
	const equipmentCrit = .55
	for _, tc := range []struct{ class, skill, talent string }{
		{"Rogue", "Backstab", "ROG_04"},
		{"Rogue", "Backstab", "ROG_32"},
		{"Wizard", "Flame Whip", "WIZ_39"},
		{"Fighter", "Shield Slam", "FTR_39"},
	} {
		t.Run(tc.talent+"/"+tc.skill, func(t *testing.T) {
			damage := make(map[string]int)
			for _, build := range []struct {
				name      string
				rank      int
				equipment float64
			}{
				{"untrained", 0, equipmentCrit},
				{"trained", 5, equipmentCrit},
				{"equipment-control", 0, .65},
			} {
				w := newTestWorld()
				p := newTestPlayer("critical-probe-caster", tc.class)
				p.InstanceID, p.Level = "qa-critical-consumer", 100
				p.TalentRanks = map[string]int{tc.talent: build.rank}
				p.UnlockedSkills = []string{tc.skill}
				p.RecalculateStats()
				p.Mana, p.Damage, p.CritChanceBonus = p.MaxMana, 100, build.equipment
				p.Rotation = math.Pi // Avoid Backstab's independent behind-target bonus.
				target := newTestPlayer("critical-probe-target", "Skeleton")
				target.Type, target.InstanceID, target.X = TypeEnemy, p.InstanceID, 2
				target.Health, target.MaxHealth, target.Defense = 10000, 10000, 0
				w.AddEntity(p)
				w.AddEntity(target)
				bonus := p.GetSkillBonus(tc.skill).SkillCritChance
				rand.Seed(1)
				roll := rand.Float64()
				wantCrit := build.name != "untrained"
				if (roll < build.equipment+bonus) != wantCrit {
					t.Fatalf("invalid paired fixture: roll=%v equipment=%v rank=%d bonus=%v", roll, build.equipment, build.rank, bonus)
				}
				beforeHP, beforeMana := target.Health, p.Mana
				rand.Seed(1)
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
				damage[build.name] = beforeHP - target.Health
				if !result.Accepted || damage[build.name] <= 0 || p.Mana >= beforeMana {
					t.Fatalf("ordinary paid cast failed: %+v damage=%d mana=%d before=%d", result, damage[build.name], p.Mana, beforeMana)
				}
				t.Logf("%s rank=%d roll=%.6f equipment=%.2f skillBonus=%.2f actualDamage=%d", build.name, build.rank, roll, build.equipment, bonus, damage[build.name])
			}
			if damage["equipment-control"] != 2*damage["untrained"] {
				t.Fatalf("equipment-only critical control failed: %v", damage)
			}
			if damage["trained"] != 2*damage["untrained"] {
				t.Errorf("fixed roll crosses only trained critical threshold: rank0=%d rank5=%d; want trained damage %d", damage["untrained"], damage["trained"], 2*damage["untrained"])
			}
		})
	}
}

// These promoted Cleric consumers now pass ordinary cast/tick and observer
// coverage in the 1.0.40 candidate. Retain these paired historical controls.
func TestPendingTalentClericConeAndHealingAreas(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		t.Run(variant, func(t *testing.T) {
			for _, rank := range []int{0, 5} {
				w := newTestWorld()
				p := newTestPlayer("probe-area", "Cleric")
				p.InstanceID = "qa-cleric-area-probe"
				p.Level = 100
				p.Stats.Wisdom = 10
				p.TalentRanks["CLR_34"] = rank
				skill, radius := "Healing Light", 5.0
				target := newTestPlayer("probe-target", "Wizard")
				target.InstanceID, target.Radius = p.InstanceID, 1.25
				target.Health = target.MaxHealth / 2
				switch variant {
				case "Radiant Strike":
					skill, radius, target.Type = variant, 3, TypeEnemy
				case "Beacon":
					p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
				case "Mass Revival":
					// Isolate this consumer; normal cross-branch access is not proven.
					p.ActiveCombo = "healing_light_party"
					radius = 20
				}
				p.UnlockedSkills = []string{skill}
				target.X = radius*1.10 + target.Radius
				w.AddEntity(p)
				w.AddEntity(target)
				before := target.Health
				// Self target anchors Beacon; the cone faces +X.
				result := w.PerformAbility(p.ID, target.X, 0, p.ID, skill)
				applied := target.Health > before
				if variant == "Radiant Strike" {
					applied = target.Health < before
				}
				if !result.Accepted || applied != (rank > 0) {
					t.Errorf("rank=%d accepted=%t effectAt%vm=%t; want %t", rank, result.Accepted, target.X, applied, rank > 0)
				}
			}
		})
	}
}

// Use normal branch selection and real combo dispatch, rather than granting an
// ActiveCombo flag. Rank-zero effects distinguish accessible combos from broken
// trained geometry; accepted events must describe the actual area as well.
func TestPendingTalentClericAcceptedAreas(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		for _, rank := range []int{0, 1, 5} {
			t.Run(fmt.Sprintf("%s/rank%d", variant, rank), func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("accepted-area-caster", "Cleric")
				p.InstanceID, p.X, p.Z = "qa-accepted-cleric-area", 60000, 60000
				p.Level, p.Stats.Wisdom, p.TalentRanks = 100, 10, map[string]int{"CLR_34": rank}
				w.AddEntity(p)
				skill, branch, base, arc := "Healing Light", "A", 5.0, 2*math.Pi
				anchorX, anchorZ, targetID := p.X, p.Z, p.ID
				if variant == "Radiant Strike" {
					skill, branch, base, arc, targetID = variant, "B", 3, 2*math.Pi/3, ""
				} else if variant == "Beacon" {
					p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
					primary := newTestPlayer("beacon-primary", "Wizard")
					primary.InstanceID, primary.X, primary.Z = p.InstanceID, p.X+8, p.Z
					w.AddEntity(primary)
					anchorX, anchorZ, targetID = primary.X, primary.Z, primary.ID
				} else {
					base = 20
				}
				if _, ok := w.PerformSelectBranch(p.ID, branch); !ok {
					t.Fatal("normal branch selection rejected")
				}
				radius := base * (1 + .03*float64(rank))
				edge := newTestPlayer("accepted-area-edge", "Wizard")
				edge.InstanceID, edge.X, edge.Z = p.InstanceID, anchorX+radius+1.25-.01, anchorZ
				edge.Health = edge.MaxHealth / 2
				if variant == "Radiant Strike" {
					edge.Type = TypeEnemy
				}
				w.AddEntity(edge)
				if variant == "Mass Revival" {
					if !w.PerformAbility(p.ID, p.X, p.Z, p.ID, "Divine Intervention").Accepted {
						t.Fatal("normal combo opener rejected")
					}
					// Only advance the fixture's GCD clock; normal dispatch detects the combo.
					p.LastAbilityTime = time.Now().Add(-time.Second)
				}
				var event *AbilityEvent
				w.OnEvent = func(kind string, payload interface{}) {
					if value, ok := payload.(AbilityEvent); kind == "ability" && ok && value.SkillName == skill {
						event = &value
					}
				}
				before := edge.Health
				cursorX := anchorX
				if variant == "Radiant Strike" {
					cursorX = p.X + 1
				}
				if !w.PerformAbility(p.ID, cursorX, anchorZ, targetID, skill).Accepted {
					t.Fatal("normal selected-branch cast rejected")
				}
				applied := edge.Health > before
				if variant == "Radiant Strike" {
					applied = edge.Health < before
				}
				if !applied {
					t.Errorf("trained edge missed at radius %v (rank %d)", radius, rank)
				}
				if event == nil || math.Abs(event.Radius-radius) > 1e-8 || math.Abs(event.Arc-arc) > 1e-8 {
					t.Errorf("accepted event does not describe radius=%v arc=%v: %+v", radius, arc, event)
				}
				if variant != "Radiant Strike" && event != nil && (event.TargetX != anchorX || event.TargetZ != anchorZ) {
					t.Errorf("accepted healing area has wrong center: %+v", event)
				}
			})
		}
	}
}
