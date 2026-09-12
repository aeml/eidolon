package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidUnstoppableArmorReducesActualEnemyAttack(t *testing.T) {
	for _, expired := range []bool{false, true} {
		for _, boss := range []bool{false, true} {
			t.Run(fmt.Sprintf("expired%v/boss%v", expired, boss), func(t *testing.T) {
				w, p, enemy, _ := rawWoundOutgoingFixture(t, "lunge")
				p.SubType, p.UnlockedSkills = "Fighter", []string{"Charge"}
				p.SkillRunes = map[string]string{"Charge": "charge_unstoppable"}
				p.Defense, p.ArmorReduction = 100, 5
				p.Health, p.MaxHealth = 10000, 10000
				p.Stats.Dexterity, p.CritChanceBonus = 0, 0
				p.TalentRanks = nil
				enemy.Damage, enemy.AttackCooldown, enemy.CritChanceBonus = 200, time.Millisecond, 0
				if boss {
					enemy.SubType = "RootboundWarden"
				}
				if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Charge"); !result.Accepted {
					t.Fatalf("paid charge rejected: %+v", result)
				}
				w.updateEntity(p, .1, nil, &deferredActions{})
				if p.IsCharging || p.RuneArmorBuff != .2 || p.CCImmune {
					t.Fatal("Unstoppable did not land")
				}
				if expired {
					p.RuneArmorBuffEndTime = time.Now().Add(-time.Second)
				}
				before := p.Health
				if _, accepted := w.PerformAttack(enemy.ID, p.ID); !accepted {
					t.Fatal("enemy attack rejected")
				}
				w.backgroundWork.SealWhenIdle()
				armor := 115
				if expired {
					armor = 95
				}
				if boss {
					armor /= 2
				}
				if before-p.Health != 200-armor || p.Defense != 100 {
					t.Fatalf("damage=%d want=%d baseArmor=%d", before-p.Health, 200-armor, p.Defense)
				}
			})
		}
	}
}

func TestUnstoppableArmorBackstabConsumer(t *testing.T) {
	for _, expired := range []bool{false, true} {
		for _, eviscerate := range []bool{false, true} {
			t.Run(fmt.Sprintf("expired%v/eviscerate%v", expired, eviscerate), func(t *testing.T) {
				w, rogue, target, _ := rawWoundOutgoingFixture(t, "lunge")
				rogue.UnlockedSkills, rogue.Damage, rogue.CritChanceBonus = []string{"Backstab"}, 200, 0
				rogue.Stats.Dexterity = 0
				rogue.SkillRunes = map[string]string{}
				if eviscerate {
					rogue.SkillRunes["Backstab"] = "backstab_eviscerate"
				}
				rogue.Rotation, target.Rotation = 0, 0
				target.Defense, target.ArmorReduction = 100, 5
				target.RuneArmorBuff, target.RuneArmorBuffEndTime = .2, time.Now().Add(time.Minute)
				if expired {
					target.RuneArmorBuffEndTime = time.Now().Add(-time.Second)
				}
				if result := w.PerformAbility(rogue.ID, target.X, target.Z, target.ID, "Backstab"); !result.Accepted {
					t.Fatalf("paid Backstab rejected: %+v", result)
				}
				armor := 115
				if expired {
					armor = 95
				}
				if eviscerate {
					armor -= armor / 2
				}
				if 10000-target.Health != 750-armor || target.Defense != 100 {
					t.Fatalf("damage=%d want=%d armor=%d", 10000-target.Health, 750-armor, target.Defense)
				}
			})
		}
	}
}

func TestUnstoppableArmorUsesCurrentEquipmentWithoutStacking(t *testing.T) {
	now := time.Now()
	target := &Entity{Defense: 100, ArmorReduction: 5, RuneArmorBuff: .2, RuneArmorBuffEndTime: now.Add(time.Second)}
	if got := effectiveCombatArmorLocked(target, now); got != 115 {
		t.Fatalf("armor=%d", got)
	}
	target.Defense = 200
	if got := effectiveCombatArmorLocked(target, now); got != 235 {
		t.Fatalf("updated armor=%d", got)
	}
	if got := effectiveCombatArmorLocked(target, now.Add(time.Second)); got != 195 {
		t.Fatalf("expired armor=%d", got)
	}
	if target.Defense != 200 {
		t.Fatal("temporary buff mutated equipment armor")
	}
}
