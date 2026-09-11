package game

import (
	"sync"
	"testing"
	"time"
)

func TestPaidExplosiveShieldUsesHostilityAndReceivingDefenses(t *testing.T) {
	for _, mode := range []string{"ordinary", "reflective receiver", "explosive chain", "invulnerable", "stacked reduction", "burst capped"} {
		t.Run(mode, func(t *testing.T) {
			w, source, defender := abilityDefenseDuel(t, "Wizard", "Flame Whip", "arcaneshield_explosive")
			// Remaining shield/history fixture after a real paid cast; the paid
			// incoming ability is what actually breaks the shield.
			defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed = 20, 80
			if mode == "burst capped" {
				defender.ArcaneShieldAbsorbed = 9980
			}
			defender.CritChanceBonus = 1 // Stored absorption must not reroll a crit.
			defender.PartyID = "defending-party"
			friend, neutral := newTestPlayer("shield-friend", "Fighter"), newTestPlayer("shield-neutral", "Fighter")
			for _, p := range []*Entity{friend, neutral} {
				p.X, p.Z, p.InstanceID = defender.X, defender.Z, defender.InstanceID
				w.AddEntity(p)
			}
			friend.PartyID = defender.PartyID
			if mode == "reflective receiver" || mode == "explosive chain" {
				source.UnlockedSkills = append(source.UnlockedSkills, "Arcane Shield")
				runeID := "arcaneshield_reflective"
				if mode == "explosive chain" {
					runeID = "arcaneshield_explosive"
				}
				source.SkillRunes = map[string]string{"Arcane Shield": runeID}
				if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Arcane Shield"); !result.Accepted || source.ArcaneShieldHP != 150 {
					t.Fatal("receiving paid shield failed")
				}
				source.LastAbilityTime = time.Now().Add(-time.Second)
				if mode == "explosive chain" {
					source.ArcaneShieldHP, source.ArcaneShieldAbsorbed = 20, 80
				}
			}
			if mode == "invulnerable" {
				source.InvulnerableEndTime = time.Now().Add(time.Minute)
			}
			if mode == "stacked reduction" {
				source.ConsecratedSanctuaryEndTime = time.Now().Add(time.Minute)
				source.DivineInterventionGuardian = true
				source.DivineInterventionGuardTime = time.Now().Add(time.Minute)
			}
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Flame Whip"); !result.Accepted {
				t.Fatal("paid shield-breaking hit failed")
			}
			wantSource, wantDefender := 435, 491 //29 incoming;100 stored blast scaled to65 PvP.
			switch mode {
			case "reflective receiver":
				wantSource, wantDefender = 500, 472 //65 absorbed,19 reflected.
				if source.ArcaneShieldHP != 85 || source.ArcaneShieldAbsorbed != 65 {
					t.Fatal("blast bypassed the receiving shield")
				}
			case "explosive chain":
				wantSource, wantDefender = 455, 426 //Two different depleted shields, once each.
				if source.ArcaneShieldActive {
					t.Fatal("second shield did not break")
				}
			case "invulnerable":
				wantSource = 500
			case "stacked reduction":
				wantSource = 478 //65 PvP, then 30% Sanctuary, then 50% Guardian.
			case "burst capped":
				wantSource = 325 //35% of maximum HP, not uncapped stored damage.
			}
			if source.Health != wantSource || defender.Health != wantDefender || defender.ArcaneShieldActive {
				t.Fatalf("wrong explosion chain: source=%d want=%d defender=%d want=%d", source.Health, wantSource, defender.Health, wantDefender)
			}
			if friend.Health != 500 || neutral.Health != 500 {
				t.Fatal("blast hurt party member or neutral player")
			}
		})
	}
}

func TestSimultaneousPaidProjectilesDetonateEachShieldOnce(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "Fireball", "arcaneshield_explosive")
	source.UnlockedSkills = append(source.UnlockedSkills, "Arcane Shield")
	defender.UnlockedSkills = append(defender.UnlockedSkills, "Fireball")
	source.SkillRunes = map[string]string{"Arcane Shield": "arcaneshield_explosive"}
	if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Arcane Shield"); !result.Accepted {
		t.Fatal("second paid shield rejected")
	}
	for _, p := range []*Entity{source, defender} {
		p.ArcaneShieldHP, p.ArcaneShieldAbsorbed = 20, 80
		p.Stats.Intelligence = 10
		p.LastAbilityTime = time.Now().Add(-time.Second)
	}
	var eventMu sync.Mutex
	blasts := map[string]int{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind != "damage" {
			return
		}
		event := data.(DamageEvent)
		if event.Kind == "arcane" {
			eventMu.Lock()
			blasts[event.SourceID]++
			eventMu.Unlock()
		}
	}
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Fireball"); !result.Accepted {
		t.Fatal("first paid fireball rejected")
	}
	if result := w.PerformAbility(defender.ID, source.X, source.Z, source.ID, "Fireball"); !result.Accepted {
		t.Fatal("second paid fireball rejected")
	}
	for i := 0; i < 12; i++ {
		w.Update(.02) // Real parallel projectile processing and reaction flushes.
	}
	w.StopBackground()
	for _, p := range []*Entity{source, defender} {
		if p.Health != 429 || p.ArcaneShieldActive || blasts[p.ID] != 1 {
			t.Fatalf("parallel chain lost/repeated a hit for %s: HP=%d shield=%v blasts=%d", p.ID, p.Health, p.ArcaneShieldActive, blasts[p.ID])
		}
	}
}

func TestPaidShieldExplosionUsesVisibleBodiesAtRadiusEdge(t *testing.T) {
	defender := newTestPlayer("edge-shield-owner", "Wizard")
	defender.Level, defender.X, defender.Z, defender.InstanceID = 100, 60000, 60000, "shield-edge"
	defender.Stats.Intelligence = 10
	defender.UnlockedSkills = []string{"Arcane Shield"}
	defender.SkillRunes = map[string]string{"Arcane Shield": "arcaneshield_explosive"}
	w := newPvPTestWorld(defender)
	t.Cleanup(w.StopBackground)
	if result := w.PerformAbility(defender.ID, defender.X, defender.Z, "", "Arcane Shield"); !result.Accepted {
		t.Fatal("paid edge shield rejected")
	}
	enemies := []*Entity{}
	for i, distance := range []float64{1, 6.5, 7.1} {
		enemy := &Entity{ID: []string{"breaker", "body-on-edge", "outside-body"}[i], Type: TypeEnemy,
			X: defender.X + distance, Z: defender.Z, InstanceID: defender.InstanceID,
			Radius: 1, Health: 10000, MaxHealth: 10000, Damage: 200, State: "IDLE", AttackCooldown: 100 * time.Millisecond}
		w.AddEntity(enemy)
		enemies = append(enemies, enemy)
	}
	if _, accepted := w.PerformAttack(enemies[0].ID, defender.ID); !accepted {
		t.Fatal("real shield-breaking attack rejected")
	}
	w.backgroundWork.SealWhenIdle()
	for i, want := range []int{9850, 9850, 10000} {
		if enemies[i].Health != want {
			t.Fatalf("body-radius check %s: HP=%d want=%d", enemies[i].ID, enemies[i].Health, want)
		}
	}
}

func TestPaidBasicShieldChainCommitsDamageBeforeRetaliation(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "basic", "arcaneshield_explosive")
	source.UnlockedSkills = []string{"Arcane Shield"}
	source.SkillRunes = map[string]string{"Arcane Shield": "arcaneshield_explosive"}
	if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Arcane Shield"); !result.Accepted || source.ArcaneShieldHP != 150 {
		t.Fatal("paid source shield rejected")
	}
	source.ArcaneShieldHP, source.ArcaneShieldAbsorbed = 20, 80
	defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed, defender.Health = 20, 80, 30
	source.Damage, source.AttackCooldown = 50, 100*time.Millisecond
	eliminated := make(chan struct{}, 1)
	w.OnPvPMatchUpdate = func(match *PvPMatch) {
		if containsPlayer(match.Eliminated, defender.ID) {
			select {
			case eliminated <- struct{}{}:
			default:
			}
		}
	}
	if _, accepted := w.PerformAttack(source.ID, defender.ID); !accepted {
		t.Fatal("ordinary shield-breaking swing rejected")
	}
	select {
	case <-eliminated:
	case <-time.After(time.Second):
		t.Fatal("shield chain did not eliminate the defender")
	}
	// Drain the actual attack but stop the later duel restoration; waiting
	// for all scheduled work would correctly return both players at full HP.
	w.StopBackground()
	// The 26-point swing leaves 24 HP. The first blast removes 20 shielding
	// and 45 HP from the attacker; its resulting blast kills the defender.
	// Finishing the original swing must not write damage after that death.
	if source.Health != 455 || defender.Health != 0 || defender.State != "DEAD" || source.ArcaneShieldActive || defender.ArcaneShieldActive {
		t.Fatalf("chain damaged after death or fired twice: source=%d defender=%d/%s", source.Health, defender.Health, defender.State)
	}
}

func TestQueuedShieldExplosionRetainsOriginAndRechecksHostility(t *testing.T) {
	for _, mode := range []string{"moved and recast", "joined party", "round ended", "disconnected"} {
		t.Run(mode, func(t *testing.T) {
			w, source, defender := abilityDefenseDuel(t, "Wizard", "Flame Whip", "arcaneshield_explosive")
			defender.PartyID = "original-party"
			defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed = 20, 80
			ctx := &abilityImpactContext{world: w}
			defender.Mu.Lock()
			ctx.receiveDamageLocked(source.ID, defender, 20, "physical", time.Now())
			defender.Mu.Unlock()
			if source.Health != 500 {
				t.Fatal("reaction executed while impact was locked")
			}
			// Prepared interleaving: move/recast after depletion, before flush.
			// The new shield and new origin are not the older reaction's state.
			defender.X, defender.Z, defender.InstanceID, defender.PartyID = 100, 100, "elsewhere", "new-party"
			defender.ArcaneShieldActive, defender.ArcaneShieldHP = true, 200
			defender.ArcaneShieldRuneID, defender.ArcaneShieldAbsorbed = "arcaneshield_reflective", 0
			defender.ArcaneShieldEndTime = time.Now().Add(time.Minute)
			want := 435
			switch mode {
			case "joined party":
				source.PartyID, want = "original-party", 500
			case "round ended":
				w.PvP.mu.Lock()
				w.PvP.Matches[w.PvP.MatchByPlayer[source.ID]].RoundPending = true
				w.PvP.mu.Unlock()
				want = 500
			case "disconnected":
				source.Disconnected, want = true, 500
			}
			ctx.flush()
			ctx.flush() // A consumed reaction cannot detonate again.
			if source.Health != want || !defender.ArcaneShieldActive || defender.ArcaneShieldHP != 200 || defender.ArcaneShieldAbsorbed != 0 {
				t.Fatalf("queued explosion used new owner state or ignored hostility: source=%d want=%d shield=%d", source.Health, want, defender.ArcaneShieldHP)
			}
		})
	}
}

func TestPaidShieldExplosionRespectsDungeonWalls(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		w, defender, beyond := directSkillWallFixture("Wizard", doorway)
		t.Cleanup(w.StopBackground)
		defender.UnlockedSkills = []string{"Arcane Shield"}
		defender.SkillRunes = map[string]string{"Arcane Shield": "arcaneshield_explosive"}
		defender.Stats.Intelligence = 10
		if result := w.PerformAbility(defender.ID, defender.X, defender.Z, "", "Arcane Shield"); !result.Accepted {
			t.Fatal("paid explosive shield rejected")
		}
		breaker := &Entity{ID: "same-side-breaker", Type: TypeEnemy, InstanceID: defender.InstanceID,
			X: defender.X - 1, Z: defender.Z, State: "IDLE", Damage: 200, Health: 10000, MaxHealth: 10000, AttackCooldown: 100 * time.Millisecond}
		w.AddEntity(breaker)
		if _, accepted := w.PerformAttack(breaker.ID, defender.ID); !accepted {
			t.Fatal("same-side real attack rejected")
		}
		w.backgroundWork.SealWhenIdle()
		if defender.ArcaneShieldActive || breaker.Health != 9850 {
			t.Fatal("shield-break positive control failed")
		}
		want := 10000
		if doorway {
			want = 9850
		}
		if beyond.Health != want {
			t.Fatalf("doorway=%v blast HP=%d want=%d", doorway, beyond.Health, want)
		}
	}
}
