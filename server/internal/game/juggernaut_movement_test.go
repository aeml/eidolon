package game

import "testing"

func TestLearnedJuggernautTravelsBeforeOneLandingShockwave(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("juggernaut-travel", "Fighter")
	p.Level = 40
	p.RecalculateStats()
	p.Health, p.Mana = p.MaxHealth, p.MaxMana
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "B")
	p.Damage, p.Stats.Strength = 50, 10
	p.ChargeRuneID = "charge_momentum"
	originX, originZ := p.X, p.Z
	e := &Entity{ID: "landing-enemy", Type: TypeEnemy, X: p.X + 18, Z: p.Z,
		State: "IDLE", Health: 10000, MaxHealth: 10000, BaseStats: Stats{Vitality: 1000}}
	w.AddEntity(e)
	var events []AbilityEvent
	w.OnEvent = func(kind string, value interface{}) {
		if event, ok := value.(AbilityEvent); ok && kind == "ability" {
			events = append(events, event)
		}
	}
	if result := w.PerformAbility(p.ID, p.X+100, p.Z, "", "Juggernaut Charge"); !result.Accepted {
		t.Fatal(result)
	}
	if p.X != originX || !p.IsCharging || p.ChargeTargetX != originX+10 || p.ChargeRuneID != "" || e.Health != 10000 {
		t.Fatal("cast moved, hit early, or inherited a starter rune")
	}
	if len(events) != 1 || events[0].Radius != 0 {
		t.Fatal("early impact footprint", events)
	}
	w.updateEntity(p, .1, nil, &deferredActions{})
	if p.X != originX+5 || e.Health != 10000 || !p.IsCharging {
		t.Fatal("travel skipped or hit early")
	}
	w.updateEntity(p, .1, nil, &deferredActions{})
	if p.X != originX+10 || p.Z != originZ || p.IsCharging || e.Health != 9940 || !e.Slowed || e.SlowFactor != .6 {
		t.Fatal("wrong landing or hit", p.X, e.Health, e.Slowed)
	}
	if len(events) != 2 || events[1].TargetX != p.X || events[1].Radius != 10 {
		t.Fatal("landing footprint missing", events)
	}
	w.updateEntity(p, .1, nil, &deferredActions{})
	if e.Health != 9940 || len(events) != 2 {
		t.Fatal("repeated landing")
	}
}

func TestJuggernautRecallCancelsPendingLanding(t *testing.T) {
	w, p, enemy, _ := rawWoundOutgoingFixture(t, "lunge")
	p.SubType, p.UnlockedSkills = "Fighter", []string{"Juggernaut Charge"}
	if result := w.PerformAbility(p.ID, p.X+10, p.Z, "", "Juggernaut Charge"); !result.Accepted {
		t.Fatal(result)
	}
	deadline, hp := p.Cooldowns["Juggernaut Charge"], enemy.Health
	if err := w.PerformRecall(p.ID); err != nil {
		t.Fatal(err)
	}
	w.updateEntity(p, 1, nil, &deferredActions{})
	if p.IsCharging || p.ChargeSkillName != "" || enemy.Health != hp || p.Cooldowns["Juggernaut Charge"] != deadline {
		t.Fatal("recall retained travel/impact or refunded cooldown")
	}
}
