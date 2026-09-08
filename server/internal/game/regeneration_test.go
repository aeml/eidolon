package game

import (
	"math"
	"testing"
	"time"
)

func TestPassiveRegenerationFractionalTicks(t *testing.T) {
	for _, stat := range []int{1, 10, 73, 100, 251} {
		e := &Entity{Type: TypePlayer, Level: 1, State: "IDLE", Health: 1, Mana: 0,
			BaseStats: Stats{Vitality: stat, Wisdom: stat, Intelligence: 1000}}
		e.RecalculateStats()
		if math.Abs(e.HpRegen-float64(stat)*.01) > 1e-9 || math.Abs(e.ManaRegen-float64(stat)*.01) > 1e-9 {
			t.Fatalf("stat%d: wrong per-stat regeneration", stat)
		}
		e.MaxHealth = 10000
		for tick := 1; tick <= 100; tick++ {
			e.regenerateLocked(time.Now())
			want := stat * tick / 100
			if e.Health != 1+want || e.Mana != want {
				t.Fatalf("stat%d tick%d: hp%d mana%d expected gain%d", stat, tick, e.Health, e.Mana, want)
			}
		}
	}
}

func TestPassiveRegenerationDoesNotBankWhileFullDeadOrPaused(t *testing.T) {
	now := time.Now()
	e := &Entity{State: "IDLE", Health: 99, MaxHealth: 100, Mana: 99, MaxMana: 100,
		HpRegen: .6, ManaRegen: .6}
	e.regenerateLocked(now)
	e.regenerateLocked(now)
	if e.Health != 100 || e.Mana != 100 || e.hpRegenRemainder != 0 || e.manaRegenRemainder != 0 {
		t.Fatal("cap should discard surplus")
	}
	for i := 0; i < 10; i++ {
		e.regenerateLocked(now)
	}
	e.Health, e.Mana = 50, 50
	e.regenerateLocked(now)
	if e.Health != 50 || e.Mana != 50 {
		t.Fatal("full resource banked regeneration")
	}
	e.State = "DEAD"
	e.regenerateLocked(now)
	if e.Health != 50 || e.Mana != 50 || e.hpRegenRemainder != 0 || e.manaRegenRemainder != 0 {
		t.Fatal("dead actor regenerated")
	}
	e.State, e.Health = "IDLE", 0
	e.regenerateLocked(now)
	if e.Health != 0 || e.Mana != 50 {
		t.Fatal("zero-health actor regenerated")
	}
	e.Health, e.QAHealthRegenPausedUntil = 50, now.Add(time.Minute)
	for i := 0; i < 10; i++ {
		e.regenerateLocked(now)
	}
	if e.Health != 50 || e.Mana != 56 || e.hpRegenRemainder != 0 {
		t.Fatal("health pause affected mana or banked health")
	}
}

func TestPassiveRegenerationUsesRealWorldTick(t *testing.T) {
	w := newTestWorld()
	e := newTestPlayer("regen-tick", "Wizard")
	e.X, e.Z = -1.25, 200
	e.BaseStats = Stats{Vitality: 10, Wisdom: 10, Intelligence: 10}
	e.RecalculateStats()
	e.Health, e.Mana = 50, 50
	e.HpRegen, e.ManaRegen = .1, .1
	w.AddEntity(e)
	for i := 0; i < 9; i++ {
		w.Update(1)
	}
	if e.Health != 50 || e.Mana != 50 {
		t.Fatal("fractional regen applied a whole point too soon")
	}
	w.Update(1)
	if e.Health != 51 || e.Mana != 51 {
		t.Fatalf("world discarded fractional regen: hp%d mana%d", e.Health, e.Mana)
	}
}

func TestPassiveRegenerationPreservesEquipmentBonuses(t *testing.T) {
	e := &Entity{Type: TypePlayer, Level: 1, BaseStats: Stats{Vitality: 10, Wisdom: 10, Intelligence: 10},
		Equipment: map[string]Item{"chest": {UniqueEffect: "regenerative", Stats: map[string]int{"vitality": 10, "wisdom": 10, "manaRegen": 25}}}}
	e.RecalculateStats()
	if math.Abs(e.HpRegen-2.2) > 1e-9 || math.Abs(e.ManaRegen-.25) > 1e-9 {
		t.Fatalf("equipment bonuses changed: hp%f mana%f", e.HpRegen, e.ManaRegen)
	}
}
