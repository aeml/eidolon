package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidShieldBasicImpactUsesFinalOutgoingBudget(t *testing.T) {
	for _, tc := range []struct {
		name         string
		crit         float64
		damage, want int
	}{
		{"ordinary", 0, 50, 26}, {"critical", 1, 50, 52}, {"burst capped", 0, 10000, 175},
	} {
		for _, shielded := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/shielded%v", tc.name, shielded), func(t *testing.T) {
				w, source, defender := abilityDefenseDuel(t, "Fighter", "basic", "arcaneshield_reflective")
				source.Damage, source.CritChanceBonus = tc.damage, tc.crit
				source.AttackCooldown = 100 * time.Millisecond
				if !shielded {
					defender.ArcaneShieldActive = false
				}
				if _, accepted := w.PerformAttack(source.ID, defender.ID); !accepted {
					t.Fatal("ordinary attack rejected")
				}
				w.backgroundWork.SealWhenIdle()
				if !shielded {
					if defender.Health != 500-tc.want || source.Health != 500 {
						t.Fatalf("unshielded control wrong: defender=%d source=%d", defender.Health, source.Health)
					}
					return
				}
				if defender.Health != 500 || defender.ArcaneShieldHP != 600-tc.want || defender.ArcaneShieldAbsorbed != tc.want || source.Health != 500-tc.want*30/100 {
					t.Fatalf("shield used wrong outgoing budget: hp=%d capacity=%d absorbed=%d source=%d wantDamage=%d", defender.Health, defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed, source.Health, tc.want)
				}
			})
		}
	}
}

func TestPaidAbilityGearReflectionUsesOnlyHPDamage(t *testing.T) {
	for _, shielded := range []bool{false, true} {
		t.Run(fmt.Sprint(shielded), func(t *testing.T) {
			w, source, defender := abilityDefenseDuel(t, "Fighter", "Shield Slam", "")
			defender.ArcaneShieldActive = shielded
			// Prepared receiving equipment effects; cast and impact are ordinary.
			defender.ActiveUniqueEffects = []string{"thorns"}
			defender.ActiveSetBonuses = map[string]map[string]int{"bulwark": {"damageReflect": 5}}
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Shield Slam"); !result.Accepted {
				t.Fatal("paid slam rejected")
			}
			wantHP, wantSource := 458, 494 //42HP damage:4 unique thorns +2 set reflect.
			if shielded {
				wantHP, wantSource = 500, 500
			}
			if defender.Health != wantHP || source.Health != wantSource {
				t.Fatalf("wrong HP-damage reflection: defender=%d source=%d", defender.Health, source.Health)
			}
		})
	}
}

func TestPaidIronFortressThornsReflectsAbilityHPDamageWhileActive(t *testing.T) {
	for _, mode := range []string{"active", "expired", "invulnerable"} {
		t.Run(mode, func(t *testing.T) {
			source, defender := newTestPlayer("thorns-attacker", "Wizard"), newTestPlayer("thorns-fighter", "Fighter")
			source.Level, defender.Level = 100, 100
			source.UnlockedSkills, defender.UnlockedSkills = []string{"Flame Whip"}, []string{"Iron Fortress"}
			source.Stats.Intelligence = 20
			defender.SkillRunes = map[string]string{"Iron Fortress": "ironfortress_thorns"}
			w := newPvPTestWorld(source, defender)
			t.Cleanup(w.StopBackground)
			challenge, err := w.RequestDuel(source.ID, defender.ID)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := w.RespondDuel(defender.ID, challenge.RequesterID, true); err != nil {
				t.Fatal(err)
			}
			for i, p := range []*Entity{source, defender} {
				x, z := p.X, p.Z
				p.X, p.Z = float64(i*2), 0
				p.InvulnerableEndTime = time.Now().Add(-time.Second)
				w.Grid.Update(p, x, z)
			}
			if result := w.PerformAbility(defender.ID, defender.X, defender.Z, "", "Iron Fortress"); !result.Accepted || !defender.IronFortressThorns {
				t.Fatal("paid Thorns rune cast failed")
			}
			if mode == "expired" {
				defender.IronFortressEndTime = time.Now().Add(-time.Second)
			}
			if mode == "invulnerable" {
				defender.InvulnerableEndTime = time.Now().Add(time.Minute)
			}
			health, sourceHP := defender.Health, source.Health
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Flame Whip"); !result.Accepted {
				t.Fatal("paid hostile whip failed")
			}
			damage := health - defender.Health
			if mode != "invulnerable" && damage < 5 {
				t.Fatal("positive strike control missing")
			}
			want := sourceHP
			if mode == "active" {
				want -= damage / 5
			}
			if source.Health != want || (mode == "invulnerable" && damage != 0) {
				t.Fatalf("Thorns reflected protected/expired/wrong damage: mode=%s hpDamage=%d source=%d want=%d", mode, damage, source.Health, want)
			}
		})
	}
}

func TestDarkKingSlamAppliesEidolonAidBeforeShield(t *testing.T) {
	for _, tc := range []struct{ phase, bossHP, outgoing int }{{1, 10000, 160}, {2, 7400, 180}, {3, 4900, 200}} {
		t.Run(fmt.Sprint(tc.phase), func(t *testing.T) {
			p := newTestPlayer("eidolon-aid-defender", "Wizard")
			p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dark-slam"
			p.Health, p.MaxHealth, p.Defense, p.Stats.Intelligence = 1000, 1000, 0, 10
			p.UnlockedSkills = []string{"Arcane Shield"}
			w := newPvPTestWorld(p)
			t.Cleanup(w.StopBackground)
			if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Arcane Shield"); !result.Accepted || p.ArcaneShieldHP != 150 {
				t.Fatal("paid shield rejected")
			}
			boss := &Entity{ID: "king-slam", Type: TypeEnemy, SubType: "UmbraPrime", Level: 100,
				X: 60001, Z: 60000, SpawnX: 60001, SpawnZ: 60000, InstanceID: p.InstanceID,
				Scale: 4, State: "IDLE", Health: tc.bossHP, MaxHealth: 10000, Damage: 200, RaidPhase: tc.phase}
			w.AddEntity(boss)
			w.updateEntity(boss, .033, []*Entity{p}, &deferredActions{})
			if boss.LastSpecialAttack.IsZero() {
				t.Fatal("real AI did not admit slam")
			}
			w.backgroundWork.SealWhenIdle()
			if p.Health != 1000-(tc.outgoing-150) || p.ArcaneShieldActive || p.ArcaneShieldHP != 0 {
				t.Fatalf("phase%d aid/absorption wrong: hp=%d shield=%d", tc.phase, p.Health, p.ArcaneShieldHP)
			}
		})
	}
}
