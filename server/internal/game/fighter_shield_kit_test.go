package game

import (
	"testing"
	"time"
)

func TestLearnedShieldFighterFortressRefreshesPaidCounterOnce(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("shield-counter", "Fighter")
	p.Level = 40
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "A")
	p.RecalculateStats()
	p.Mana = p.MaxMana
	until := time.Now().Add(time.Minute)
	p.Cooldowns["Shield Slam"], p.Cooldowns["Whirlwind"] = until, until
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress"); !result.Accepted {
		t.Fatal(result)
	}
	if !p.Cooldowns["Shield Slam"].IsZero() || p.Cooldowns["Whirlwind"] != until || !p.Cooldowns["Iron Fortress"].After(time.Now()) {
		t.Fatal("Fortress refreshed the wrong cooldowns")
	}
	target := &Entity{ID: "counter-target", Type: TypeEnemy, X: p.X + 2, Z: p.Z, State: "IDLE", Health: 10000, MaxHealth: 10000, CCImmune: true}
	w.AddEntity(target)
	// Isolate the hit multiplier after Fortress's ordinary stat rebuild.
	p.Damage, p.Stats.Strength = 50, 10
	mana := p.Mana
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam"); result.Accepted || result.Reason != "global_cooldown" || p.Mana != mana {
		t.Fatal("counter bypassed GCD", result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam"); !result.Accepted {
		t.Fatal(result)
	}
	if target.Health != 10000-97 || target.Stunned || p.Mana != mana-25 || p.ActiveCombo != "" {
		t.Fatal("counter damage, cost, immunity or consumption wrong", target.Health, p.Mana, p.ActiveCombo)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	p.Cooldowns["Shield Slam"] = time.Time{}
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam"); !result.Accepted || target.Health != 10000-97-65 {
		t.Fatal("ordinary follow-up retained counter", result, target.Health)
	}
	// Rejected Fortress cannot reset a newly cooling Shield Slam.
	slamDeadline := p.Cooldowns["Shield Slam"]
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress"); result.Accepted || p.Cooldowns["Shield Slam"] != slamDeadline {
		t.Fatal("rejected guard reset counter")
	}
}
