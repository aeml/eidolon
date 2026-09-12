package game

import (
	"testing"
	"time"
)

func paidSpecialIncomingFortress(t *testing.T, thorns bool) (*World, *Entity) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("fortress-special-incoming", "Fighter")
	p.X, p.Z = 500, 500
	w.AddEntity(p)
	w.SetPlayerLevel(p.ID, 30)
	if thorns {
		w.SetPlayerLevel(p.ID, 70)
		p.SkillRunes = map[string]string{"Iron Fortress": "ironfortress_thorns"}
	}
	p.UnlockedSkills = []string{"Iron Fortress"}
	before := p.Mana
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress"); !result.Accepted || before-p.Mana != 40 {
		t.Fatalf("paid Fortress rejected or wrong cost: %+v", result)
	}
	if p.IronFortressThorns != thorns {
		t.Fatal("paid cast did not retain selected Thorns rune")
	}
	return w, p
}

func TestPaidFortressMitigatesEnvironmentalHazardReceipts(t *testing.T) {
	for _, expired := range []bool{false, true} {
		t.Run(map[bool]string{false: "active", true: "expired"}[expired], func(t *testing.T) {
			w, p := paidSpecialIncomingFortress(t, false)
			if expired {
				p.IronFortressEndTime = time.Now().Add(-time.Second)
			}
			hazard := &Hazard{ID: "fortress-hazard", HazardType: HazardLavaPool, X: p.X, Z: p.Z,
				Radius: 5, DamagePct: .1, TickInterval: 1}
			w.Hazards = map[string]*Hazard{hazard.ID: hazard}
			var events []HazardDamageEvent
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "hazard_damage" {
					events = append(events, value.(HazardDamageEvent))
				}
			}
			before := p.Health
			want := int(float64(p.MaxHealth) * .1)
			if !expired {
				want = want * 80 / 100
			}
			w.processHazardDamage(1, []*Entity{p})
			if before-p.Health != want || len(events) != 1 || events[0].Damage != want {
				t.Fatalf("hazard HP loss=%d receipts=%+v want%d", before-p.Health, events, want)
			}
		})
	}
}

func TestPaidFortressMitigatesReflectionWithoutRecursiveRetaliation(t *testing.T) {
	for _, expired := range []bool{false, true} {
		t.Run(map[bool]string{false: "active", true: "expired"}[expired], func(t *testing.T) {
			w, p := paidSpecialIncomingFortress(t, true)
			if expired {
				p.IronFortressEndTime = time.Now().Add(-time.Second)
			}
			defender := &Entity{ID: "reflecting-enemy", Type: TypeEnemy, Health: 100, MaxHealth: 100, State: "IDLE"}
			w.AddEntity(defender)
			var events []DamageEvent
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "damage" {
					events = append(events, value.(DamageEvent))
				}
			}
			before, want := p.Health, 100
			if !expired {
				want = 80
			}
			w.applyImpactReflection(p, defender, 100, p.InstanceID, false)
			if before-p.Health != want || len(events) != 1 || events[0].Amount != want || events[0].Kind != "reflect" || defender.Health != 100 {
				t.Fatalf("reflection HP loss=%d receipts=%+v defenderHP=%d want%d", before-p.Health, events, defender.Health, want)
			}
		})
	}
}
