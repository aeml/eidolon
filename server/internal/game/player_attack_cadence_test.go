package game

import (
	"math"
	"testing"
	"time"
)

func TestPlayerBasicAttackCadenceAllClasses(t *testing.T) {
	for _, class := range []string{"Wizard", "Fighter", "Rogue", "Cleric"} {
		p := newTestPlayer("cadence-"+class, class)
		p.BaseStats = Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
		p.Health, p.Mana = 1, 1
		p.RecalculateStats()
		want := 2 / 1.05
		if math.Abs(p.AttackSpeed-want) > 1e-9 || p.AttackCooldown != time.Duration(want*float64(time.Second)) {
			t.Fatalf("%s interval: %v/%v", class, p.AttackSpeed, p.AttackCooldown)
		}
		if p.Damage != 2 || p.Health != 1 || p.Mana != 1 || p.HpRegen != .1 || p.ManaRegen != .1 {
			t.Fatalf("%s cadence changed damage/resources/regen", class)
		}
	}
}

func TestPlayerBasicAttackCadenceMonotonicAndCapped(t *testing.T) {
	previous := math.Inf(1)
	for dex := 0; dex <= 300; dex++ {
		current := playerBasicAttackInterval(dex)
		if current < 1 || current > previous {
			t.Fatalf("invalid interval at %d", dex)
		}
		previous = current
	}
	if playerBasicAttackInterval(199) <= 1 || playerBasicAttackInterval(200) != 1 || playerBasicAttackInterval(-10) != 2 {
		t.Fatal("cadence bounds changed")
	}
}

func TestPlayerBasicAttackCadenceDoesNotChangeEnemyRecalculation(t *testing.T) {
	e := &Entity{Type: TypeEnemy, SubType: "Skeleton", Level: 10,
		BaseStats: Stats{Strength: 15, Dexterity: 9, Vitality: 15}}
	e.RecalculateStats()
	if math.Abs(e.AttackSpeed-5/1.18) > 1e-9 || e.Damage != 30 || e.HpRegen != 0 {
		t.Fatal("enemy cadence/profile changed")
	}
}

func TestPlayerBasicAttackCadenceStillRejectsEarlyAttackRequests(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("cadence-admission", "Wizard")
	p.X, p.Z = 200, 200
	p.RecalculateStats()
	enemy := &Entity{ID: "cadence-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
		X: 205, Z: 200, Health: 100, MaxHealth: 100}
	w.AddEntity(p)
	w.AddEntity(enemy)
	p.LastAttackTime = time.Now().Add(-p.AttackCooldown + 100*time.Millisecond)
	if _, accepted := w.PerformAttack(p.ID, enemy.ID); accepted {
		t.Fatal("early input bypassed authoritative cooldown")
	}
	p.LastAttackTime = time.Now().Add(-p.AttackCooldown - time.Millisecond)
	if _, accepted := w.PerformAttack(p.ID, enemy.ID); !accepted {
		t.Fatal("ready basic attack was not admitted")
	}
	if _, accepted := w.PerformAttack(p.ID, enemy.ID); accepted {
		t.Fatal("repeat input double-attacked")
	}
}

func TestPlayerBasicAttackCadencePreservesExistingHasteMultipliers(t *testing.T) {
	for _, dex := range []int{10, 200} {
		for _, buff := range []struct {
			zeal, warp bool
			factor     float64
		}{{true, false, 1.3}, {false, true, 1.5}, {true, true, 1.3 * 1.5}} {
			p := newTestPlayer("cadence-haste", "Cleric")
			p.BaseStats = Stats{Strength: 10, Dexterity: dex, Intelligence: 10, Wisdom: 10, Vitality: 10}
			p.Health, p.Mana = 1, 1
			p.ZealActive, p.TimeWarpActive = buff.zeal, buff.warp
			p.RecalculateStats()
			want := playerBasicAttackInterval(dex) / buff.factor
			if math.Abs(p.AttackSpeed-want) > 1e-9 || math.Abs(p.AttackCooldown.Seconds()-want) > 1e-8 {
				t.Fatalf("haste no longer applies after base cadence: %v vs %v", p.AttackSpeed, want)
			}
			if p.Health != 1 || p.Mana != 1 || p.HpRegen != .1 || p.ManaRegen != .1 {
				t.Fatal("haste changed resources or passive recovery")
			}
		}
	}
}

func TestPlayerBasicAttackCadencePreservesPerHitPvPDamageAndConsent(t *testing.T) {
	for _, class := range []string{"Wizard", "Fighter", "Rogue", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			p := newTestPlayer("cadence-pvp-source", class)
			p.BaseStats = Stats{Strength: 400, Dexterity: 400, Intelligence: 400, Wisdom: 400, Vitality: 10}
			p.RecalculateStats()
			p.X, p.Z = 300, 200
			target := newTestPlayer("cadence-pvp-target", "Fighter")
			target.X, target.Z, target.Defense = 302, 200, 0
			w := newPvPTestWorld(p, target)
			w.applyAttackImpact(p.ID, target.ID, "", nil, 0)
			if target.Health != 500 {
				t.Fatal("unconsented basic attack caused damage")
			}
			for _, id := range []string{p.ID, target.ID} {
				if err := w.SetOpenWorldPvP(id, true); err != nil {
					t.Fatal(err)
				}
			}
			w.applyAttackImpact(p.ID, target.ID, "", nil, 0)
			if p.Damage != 100 || target.Health != 435 {
				t.Fatalf("cadence changed the actual 65%% PvP impact: base%d targetHP%d", p.Damage, target.Health)
			}
		})
	}
}
