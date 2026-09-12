package game

import (
	"testing"
	"time"
)

func TestGuardianRoarReceivingProtection(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		name                      string
		active                    bool
		end                       time.Time
		shield, damage, remaining int
	}{
		{"active", true, now.Add(time.Second), 0, 70, 0},
		{"inactive", false, now.Add(time.Second), 0, 100, 0},
		{"expired", true, now, 0, 100, 0},
		{"no deadline", true, time.Time{}, 0, 100, 0},
		{"small shield", true, now.Add(time.Second), 50, 20, 0},
		{"large shield", true, now.Add(time.Second), 100, 0, 30},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := &Entity{Type: TypePlayer, GuardianRoarActive: tc.active, GuardianRoarEndTime: tc.end,
				ArcaneShieldActive: tc.shield > 0, ArcaneShieldHP: tc.shield, ArcaneShieldEndTime: now.Add(time.Minute)}
			got := resolveImpactDefenseLocked(p, 100, now)
			if got.damage != tc.damage || p.ArcaneShieldHP != tc.remaining {
				t.Fatalf("damage/shield %d/%d want %d/%d", got.damage, p.ArcaneShieldHP, tc.damage, tc.remaining)
			}
		})
	}
	p := &Entity{Type: TypePlayer, GuardianRoarActive: true, GuardianRoarEndTime: now.Add(time.Second),
		IronFortressActive: true, IronFortressEndTime: now.Add(time.Second)}
	if got := resolveImpactDefenseLocked(p, 101, now).damage; got != 56 {
		t.Fatalf("stacking %d want56", got)
	}
}

func TestPaidGuardianRoarProtectsCasterAndPartyWithoutArmorApproximation(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("roar-protection-caster", "Fighter")
	p.InstanceID, p.X, p.Z = "roar-protection", 60000, 60000
	w.AddEntity(p)
	w.SetPlayerLevel(p.ID, 100)
	p.Equipment = map[string]Item{"chest": {Stats: map[string]int{"defense": 100}}}
	p.RecalculateStats()
	p.UnlockedSkills = []string{"Guardian Roar"}
	p.Mana = p.MaxMana
	ally := newTestPlayer("roar-protection-ally", "Cleric")
	ally.InstanceID, ally.X, ally.Z = p.InstanceID, p.X+1, p.Z
	w.AddEntity(ally)
	party := w.CreateParty(p.ID)
	if err := w.JoinParty(party.ID, ally.ID); err != nil {
		t.Fatal(err)
	}
	armor, mana := p.Defense, p.Mana
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar"); !result.Accepted || mana-p.Mana != 35 {
		t.Fatalf("paid cast %+v", result)
	}
	if p.Defense != armor {
		t.Fatalf("Roar must reduce incoming damage, not substitute armor: %d want%d", p.Defense, armor)
	}
	if !ally.GuardianRoarEndTime.Equal(p.GuardianRoarEndTime) {
		t.Fatal("party deadline lost")
	}
	for _, target := range []*Entity{p, ally} {
		enemy := &Entity{ID: "enemy-" + target.ID, Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
			X: target.X + 1, Z: target.Z, State: "IDLE", Health: 10000, MaxHealth: 10000, Damage: 200, Scale: 1}
		w.AddEntity(enemy)
		before := target.Health
		w.applyAttackImpact(enemy.ID, target.ID, p.InstanceID, nil, 0)
		want := max(1, 200-target.Defense) * 70 / 100
		if before-target.Health != want {
			t.Fatalf("%s real hit%d want%d", target.ID, before-target.Health, want)
		}
	}
}

func TestPaidGuardianRoarHazardAndReflection(t *testing.T) {
	for _, expired := range []bool{false, true} {
		for _, kind := range []string{"hazard", "reflection"} {
			t.Run(kind+"/"+map[bool]string{false: "active", true: "expired"}[expired], func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("roar-special", "Fighter")
				p.X, p.Z = 500, 500
				w.AddEntity(p)
				w.SetPlayerLevel(p.ID, 100)
				p.UnlockedSkills = []string{"Guardian Roar"}
				mana := p.Mana
				if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar"); !r.Accepted || mana-p.Mana != 35 {
					t.Fatalf("unpaid cast %+v", r)
				}
				if expired {
					p.GuardianRoarEndTime = time.Now().Add(-time.Second)
				}
				before, want, receipt := p.Health, 100, -1
				if kind == "hazard" {
					hazard := &Hazard{ID: "roar-hazard", HazardType: HazardLavaPool, X: p.X, Z: p.Z, Radius: 5, DamagePct: .1, TickInterval: 1}
					w.Hazards = map[string]*Hazard{hazard.ID: hazard}
					want = int(float64(p.MaxHealth) * .1)
					w.OnEvent = func(kind string, v interface{}) {
						if kind == "hazard_damage" {
							receipt = v.(HazardDamageEvent).Damage
						}
					}
					w.processHazardDamage(1, []*Entity{p})
				} else {
					defender := &Entity{ID: "reflector", Type: TypeEnemy, State: "IDLE", Health: 100, MaxHealth: 100}
					w.AddEntity(defender)
					w.OnEvent = func(kind string, v interface{}) {
						if kind == "damage" {
							receipt = v.(DamageEvent).Amount
						}
					}
					w.applyImpactReflection(p, defender, 100, p.InstanceID, false)
					if defender.Health != 100 {
						t.Fatal("reflection recursively retaliated")
					}
				}
				if !expired {
					want = want * 70 / 100
				}
				if before-p.Health != want || receipt != want {
					t.Fatalf("loss%d receipt%d want%d", before-p.Health, receipt, want)
				}
			})
		}
	}
}
