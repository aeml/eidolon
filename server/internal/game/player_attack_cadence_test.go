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
