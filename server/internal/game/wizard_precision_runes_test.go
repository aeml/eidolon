package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"
)

type precisionRuneContract struct {
	Skill, Rune                                       string
	Damage, Count, BarrageCount, Mana                 int
	Range, Radius, Speed, Slow, SlowSeconds, Cooldown float64
	Homing, Pierce                                    bool
}

func precisionContracts(t *testing.T) []precisionRuneContract {
	t.Helper()
	data, err := os.ReadFile("testdata/wizard_precision_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []precisionRuneContract
	if err := json.Unmarshal(data, &rows); err != nil {
		t.Fatal(err)
	}
	if len(rows) != 12 {
		t.Fatal("expected three base spells and their nine rune choices")
	}
	return rows
}

func precisionRuneFixture(t *testing.T, skill, rune string) (*World, *Entity, *Entity) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("precision-rune", "Wizard")
	p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "precision-rune-contract"
	p.Stats.Intelligence, p.Mana, p.MaxMana = 40, 10000, 10000
	p.SelectedBranch, p.UnlockedSkills = "B", getSkillsForBranch("Wizard", "B")
	p.SkillRunes = map[string]string{skill: rune}
	target := &Entity{ID: "precision-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
		X: p.X + 10, Z: p.Z, InstanceID: p.InstanceID, Scale: 1, Health: 100000, MaxHealth: 100000}
	w.AddEntity(p)
	w.AddEntity(target)
	return w, p, target
}

func TestWizardPrecisionRuneContractsReachActualPaidCasts(t *testing.T) {
	for _, row := range precisionContracts(t) {
		for _, barrage := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/barrage%v", row.Skill, row.Rune, barrage), func(t *testing.T) {
				w, p, target := precisionRuneFixture(t, row.Skill, row.Rune)
				if barrage && row.Skill == "Arcane Missiles" {
					requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill) }, "Scorch Beam")
					p.LastAbilityTime = time.Now().Add(-time.Second)
				}
				beforeMana, beforeHP := p.Mana, target.Health
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, row.Skill)
				if !result.Accepted || beforeMana-p.Mana != row.Mana {
					t.Fatalf("payment %+v mana%d", result, p.Mana)
				}
				if cd := time.Until(p.Cooldowns[row.Skill]).Seconds(); math.Abs(cd-row.Cooldown) > .1 {
					t.Fatalf("cooldown %g want %g", cd, row.Cooldown)
				}
				if row.Skill == "Scorch Beam" {
					if got := beforeHP - target.Health; got != row.Damage {
						t.Fatalf("beam damage %d want%d", got, row.Damage)
					}
					if got := effectiveAbilityRange(p, row.Skill, 18); got != row.Range {
						t.Fatalf("reach%g want%g", got, row.Range)
					}
					if target.Slowed != (row.Slow > 0) || target.Slowed && (target.SlowFactor != row.Slow || math.Abs(time.Until(target.SlowEndTime).Seconds()-row.SlowSeconds) > .1) {
						t.Fatal("slow tradeoff failed")
					}
					if target.ArmorReduction != 5 {
						t.Fatal("armor melt lost")
					}
					return
				}
				count := 0
				for _, e := range w.Entities {
					if e.Type != TypeProjectile || e.OwnerID != p.ID || e.ProjectileSkill != row.Skill {
						continue
					}
					count++
					if e.Damage != row.Damage {
						t.Fatalf("projectile damage%d want%d", e.Damage, row.Damage)
					}
					if math.Abs(math.Hypot(e.VelX, e.VelZ)-row.Speed) > 1e-6 {
						t.Fatal("speed differs from paid plan")
					}
					if row.Skill == "Arcane Missiles" && (e.TargetID != "") != row.Homing {
						t.Fatal("homing tradeoff failed")
					}
					if row.Skill == "Dragonfire Lance" && (e.Radius != row.Radius || e.ProjectilePierce != row.Pierce || e.Scale != row.Radius) {
						t.Fatal("lance footprint/piercing differs")
					}
				}
				wantCount := row.Count
				if barrage && row.Skill == "Arcane Missiles" {
					wantCount = row.BarrageCount
				}
				if count != wantCount {
					t.Fatalf("count%d want%d", count, wantCount)
				}
				if p.ActiveCombo != "" {
					t.Fatal("prepared combo was not consumed")
				}
			})
		}
	}
}

func TestWizardLanceRuneFlightStopsOrPiercesAndRetainsPaidChoice(t *testing.T) {
	for _, row := range precisionContracts(t) {
		if row.Skill != "Dragonfire Lance" {
			continue
		}
		t.Run(row.Rune, func(t *testing.T) {
			w, p, first := precisionRuneFixture(t, row.Skill, row.Rune)
			first.X = p.X + 5
			w.Grid.Update(first, p.X+10, p.Z)
			second := &Entity{ID: "second-lance-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", X: p.X + 12, Z: p.Z, InstanceID: p.InstanceID, Scale: 1, Health: 100000, MaxHealth: 100000}
			w.AddEntity(second)
			requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, second.X, second.Z, second.ID, skill) }, row.Skill)
			var projectile *Entity
			for _, e := range w.Entities {
				if e.OwnerID == p.ID && e.ProjectileSkill == row.Skill {
					projectile = e
				}
			}
			if projectile == nil {
				t.Fatal("missing paid lance")
			}
			p.SkillRunes[row.Skill] = "dragonfire_quickfire"
			p.Stats.Intelligence = 999
			for i := 0; i < 100; i++ {
				deferred := &deferredActions{}
				w.updateEntity(projectile, .02, nil, deferred)
				if len(deferred.removals) > 0 {
					break
				}
			}
			if first.Health >= first.MaxHealth || (second.Health < second.MaxHealth) != row.Pierce {
				t.Fatalf("flight first%d second%d piercing%v", first.Health, second.Health, row.Pierce)
			}
			if projectile.Damage != row.Damage {
				t.Fatal("rune change rewrote a paid projectile")
			}
		})
	}
}

func TestWizardLanceSlowFramesHitTheFrontEnemyAndPublishOneTerminalImpact(t *testing.T) {
	for _, row := range precisionContracts(t) {
		if row.Skill != "Dragonfire Lance" {
			continue
		}
		t.Run(row.Rune, func(t *testing.T) {
			w, p, front := precisionRuneFixture(t, row.Skill, row.Rune)
			front.X = p.X + 5
			w.Grid.Update(front, p.X+10, p.Z)
			back := &Entity{ID: "back-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", X: p.X + 12, Z: p.Z, InstanceID: p.InstanceID, Scale: 1, Health: 100000, MaxHealth: 100000}
			w.AddEntity(back)
			var events []ProjectileImpactEvent
			w.OnEvent = func(kind string, payload interface{}) {
				if kind == "projectile_impact" {
					events = append(events, payload.(ProjectileImpactEvent))
				}
			}
			requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, back.X, back.Z, back.ID, skill) }, row.Skill)
			var projectile *Entity
			for _, e := range w.Entities {
				if e.OwnerID == p.ID && e.ProjectileSkill == row.Skill {
					projectile = e
				}
			}
			if projectile == nil {
				t.Fatal("missing paid lance")
			}
			w.updateEntity(projectile, .5, nil, &deferredActions{})
			if front.Health >= front.MaxHealth || (back.Health < back.MaxHealth) != row.Pierce {
				t.Fatalf("slow-frame collision front%d back%d", front.Health, back.Health)
			}
			terminal := 0
			for _, event := range events {
				if event.Terminal {
					terminal++
				}
				if !row.Pierce && (event.TargetID != front.ID || event.X >= front.X || event.X < p.X) {
					t.Fatalf("impact ignored front contact: %+v", event)
				}
			}
			if terminal != 1 {
				t.Fatalf("terminal impacts%d want1", terminal)
			}
			if projectile.ProjectileTravelDistance > 18 {
				t.Fatal("shot exceeded displayed cast range")
			}
		})
	}
}
