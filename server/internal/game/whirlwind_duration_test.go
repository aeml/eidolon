package game

import (
	"sync"
	"testing"
	"time"
)

func TestWhirlwindCastStartsItsAuthoredDuration(t *testing.T) {
	for _, runeID := range []string{"", "whirlwind_extended"} {
		t.Run(runeID, func(t *testing.T) {
			w, player, target := directSkillWallFixture("Fighter", true)
			player.UnlockedSkills = []string{"Whirlwind"}
			player.SkillRunes = map[string]string{"Whirlwind": runeID}
			before := time.Now()
			result := w.PerformAbility(player.ID, target.X, target.Z, "", "Whirlwind")
			if !result.Accepted || !player.WhirlwindActive {
				t.Fatalf("cast must start a sustained spin: %+v active=%v", result, player.WhirlwindActive)
			}
			want := time.Second
			if runeID == "whirlwind_extended" {
				want *= 2
			}
			if got := player.WhirlwindEndTime.Sub(before); got < want || got > want+100*time.Millisecond {
				t.Fatalf("duration=%v, want %v", got, want)
			}
		})
	}
}

func TestWhirlwindPulseBudgetAndIndependentClock(t *testing.T) {
	for _, runeID := range []string{"", "whirlwind_extended"} {
		t.Run(runeID, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			p.UnlockedSkills = []string{"Whirlwind"}
			p.SkillRunes = map[string]string{"Whirlwind": runeID}
			p.LastSpiritTick = time.Now().Add(time.Hour)
			spiritClock := p.LastSpiritTick
			p.Damage, p.Stats.Strength = 200, 20
			target.Health, target.MaxHealth = 10000, 10000
			mana := p.Mana
			w.PerformAbility(p.ID, target.X, target.Z, "", "Whirlwind")
			start, end, total, budget := p.WhirlwindStartTime, p.WhirlwindEndTime, p.WhirlwindTotalTicks, p.WhirlwindDamageBudget
			if budget != 260 || target.Health != 10000-budget/total {
				t.Fatalf("wrong first pulse: budget=%d total=%d health=%d", budget, total, target.Health)
			}
			for i := 1; i < total; i++ {
				before := target.Health
				w.updateWhirlwind(p, start.Add(time.Duration(i)*500*time.Millisecond-time.Nanosecond), nil)
				if target.Health != before {
					t.Fatal("pulse fired early")
				}
				w.updateWhirlwind(p, start.Add(time.Duration(i)*500*time.Millisecond), nil)
			}
			if 10000-target.Health != budget || p.Mana != mana-30 || !p.LastSpiritTick.Equal(spiritClock) {
				t.Fatalf("pulse budget/resources/timer mismatch: damage=%d mana=%d", 10000-target.Health, p.Mana)
			}
			w.updateWhirlwind(p, end, nil)
			if p.WhirlwindActive || p.WhirlwindHitTargets != nil || target.Health != 10000-budget {
				t.Fatal("spin did not expire cleanly")
			}
		})
	}
}

func TestWhirlwindLaterPulsesRecheckRangeAndWalls(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", false)
	p.UnlockedSkills = []string{"Whirlwind"}
	p.SkillRunes = map[string]string{"Whirlwind": "whirlwind_extended"}
	oldX := target.X
	target.X = p.X - 12
	w.Grid.Update(target, oldX, target.Z)
	health := target.Health
	w.PerformAbility(p.ID, target.X, target.Z, "", "Whirlwind")
	start := p.WhirlwindStartTime
	if target.Health != health {
		t.Fatal("out-of-range enemy hit")
	}
	oldX = target.X
	target.X = p.X - 2
	w.Grid.Update(target, oldX, target.Z)
	w.updateWhirlwind(p, start.Add(500*time.Millisecond), nil)
	if target.Health >= health {
		t.Fatal("enemy entering spin was not hit")
	}
	health, oldX = target.Health, target.X
	target.X = p.X + 2
	w.Grid.Update(target, oldX, target.Z)
	w.updateWhirlwind(p, start.Add(time.Second), nil)
	if target.Health != health {
		t.Fatal("later pulse crossed wall")
	}
}

func TestWhirlwindRuneSideEffectsOccurOncePerEnemy(t *testing.T) {
	for _, runeID := range []string{"whirlwind_bloodwhirl", "whirlwind_bladestorm"} {
		t.Run(runeID, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			p.UnlockedSkills = []string{"Whirlwind"}
			p.SkillRunes = map[string]string{"Whirlwind": runeID}
			p.Health = 250
			w.PerformAbility(p.ID, target.X, target.Z, "", "Whirlwind")
			health, x := p.Health, target.X
			if runeID == "whirlwind_bloodwhirl" && health <= 250 {
				t.Fatal("missing first-hit heal")
			}
			w.updateWhirlwind(p, p.WhirlwindStartTime.Add(500*time.Millisecond), nil)
			if p.Health != health || target.X != x {
				t.Fatal("later pulse repeated healing or pull")
			}
		})
	}
}

func TestWhirlwindCancelsWithoutLateDamage(t *testing.T) {
	for _, reason := range []string{"dead", "zero-health", "disconnected", "instance", "expired", "scene-reset"} {
		t.Run(reason, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			p.UnlockedSkills = []string{"Whirlwind"}
			w.PerformAbility(p.ID, target.X, target.Z, "", "Whirlwind")
			now := p.WhirlwindStartTime.Add(500 * time.Millisecond)
			switch reason {
			case "dead":
				p.State = "DEAD"
			case "zero-health":
				p.Health = 0
			case "disconnected":
				p.Disconnected = true
			case "instance":
				p.InstanceID = "elsewhere"
			case "expired":
				now = p.WhirlwindEndTime.Add(time.Second)
			case "scene-reset":
				resetSceneMovementLocked(p)
			}
			health := target.Health
			w.updateWhirlwind(p, now, nil)
			if p.WhirlwindActive || target.Health != health || p.WhirlwindHitTargets != nil {
				t.Fatal("cancelled spin remained active or dealt damage")
			}
		})
	}
}

func TestWhirlwindSnapshotsComboBudget(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	p.SkillRunes = map[string]string{"Whirlwind": "whirlwind_extended"}
	p.Damage, p.Stats.Strength = 200, 20
	p.ActiveCombo = "whirlwind_damage_boost"
	health := target.Health
	if !w.beginWhirlwind(p, time.Now()) {
		t.Fatal("cast rejected")
	}
	start := p.WhirlwindStartTime
	if p.WhirlwindDamageBudget != 390 || p.ActiveCombo != "" {
		t.Fatal("combo not consumed into the cast budget")
	}
	p.Damage = 10000
	for i := 1; i < 4; i++ {
		w.updateWhirlwind(p, start.Add(time.Duration(i)*500*time.Millisecond), nil)
	}
	if health-target.Health != 390 {
		t.Fatalf("budget changed during spin: damage=%d", health-target.Health)
	}
}

func TestWhirlwindParallelFriendlyPlayersDoNotDeadlockOrHitEachOther(t *testing.T) {
	w := newTestWorld()
	players := []*Entity{newTestPlayer("spin-a", "Fighter"), newTestPlayer("spin-b", "Fighter")}
	start := time.Now()
	for i, p := range players {
		p.X, p.Z, p.PartyID = 200+float64(i), 200, "spin-party"
		p.SkillRunes = map[string]string{"Whirlwind": "whirlwind_extended"}
		w.AddEntity(p)
		w.PvP.OpenWorldFlag[p.ID] = true
	}
	enemy := &Entity{ID: "shared-spin-target", Type: TypeEnemy, X: 201, Z: 200, State: "IDLE", Health: 10000, MaxHealth: 10000}
	w.AddEntity(enemy)
	for _, p := range players {
		w.beginWhirlwind(p, start)
	}
	var wg sync.WaitGroup
	for _, p := range players {
		wg.Add(1)
		go func(p *Entity) {
			defer wg.Done()
			for i := 1; i < 4; i++ {
				w.updateWhirlwind(p, start.Add(time.Duration(i)*500*time.Millisecond), nil)
			}
		}(p)
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("concurrent spins deadlocked")
	}
	for _, p := range players {
		if p.Health != p.MaxHealth {
			t.Fatal("party member damaged by spin")
		}
	}
	if enemy.Health != 10000-players[0].WhirlwindDamageBudget-players[1].WhirlwindDamageBudget {
		t.Fatal("parallel spins lost or duplicated damage against a shared enemy")
	}
}

func TestWhirlwindLaterPulseUsesOrdinaryDeathAndRewards(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	p.Damage, p.Stats.Strength = 200, 20
	target.Health, target.MaxHealth, target.Level = 131, 131, 10
	if !w.beginWhirlwind(p, time.Now()) || target.Health != 1 {
		t.Fatal("first pulse must leave the enemy alive")
	}
	w.updateWhirlwind(p, p.WhirlwindStartTime.Add(500*time.Millisecond), nil)
	if target.State != "DEAD" {
		t.Fatal("later pulse did not resolve death")
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		p.Mu.RLock()
		gold := p.Gold
		p.Mu.RUnlock()
		if gold > 0 {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("ordinary kill rewards were not awarded")
}

func TestWhirlwindPulseRunsThroughNormalEntityUpdate(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	// Inject only the helper clock, then exercise the normal update path.
	// No wall-clock sleep or manually forged active-state fields are needed.
	if !w.beginWhirlwind(p, time.Now().Add(-500*time.Millisecond)) {
		t.Fatal("cast rejected")
	}
	health := target.Health
	w.updateEntity(p, 0.05, nil, &deferredActions{})
	if target.Health >= health || p.WhirlwindTickCount != 2 {
		t.Fatal("normal update missed the due pulse")
	}
	copied := w.copyEntity(p)
	if !copied.WhirlwindActive || !copied.WhirlwindEndTime.Equal(p.WhirlwindEndTime) || copied.WhirlwindHitTargets != nil {
		t.Fatal("observer entity copy lost the spin or leaked private target history")
	}
}
