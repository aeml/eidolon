package game

import (
	"fmt"
	"testing"
)

func TestEquipmentHealthReductionCapsOnlyExcessAfterAllBonuses(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, rested := range []bool{false, true} {
			for _, state := range []string{"full", "depleted", "dead"} {
				t.Run(fmt.Sprintf("%s/rested%t/%s", class, rested, state), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("health-cap", class)
					w.AddEntity(p)
					w.SetPlayerLevel(p.ID, 30)
					if rested {
						p.WellRestedSeconds = 60
					}
					p.RecalculateStats()
					p.Inventory = make([]Item, MaxInventorySize)
					p.Inventory[0] = Item{ID: "health-armor", Name: "Health armor", Type: ItemArmor, Slot: "chest",
						Level: 30, Stack: 1, StatScaleVersion: ItemStatScaleVersion, Stats: map[string]int{"vitality": 20, "intelligence": 20}}
					beforeHP, beforeMP := p.Health, p.Mana
					if _, ok := w.PerformEquip(p.ID, "health-armor", "chest"); !ok {
						t.Fatal("ordinary equip rejected")
					}
					if p.Health != beforeHP || p.Mana != beforeMP {
						t.Fatal("equipping higher maxima restored current resources")
					}
					p.Health, p.Mana = p.MaxHealth, p.MaxMana
					if state == "depleted" {
						p.Health, p.Mana = 23, 17
					} else if state == "dead" {
						p.Health, p.Mana, p.State = 0, 0, "DEAD"
					}
					previousHP, previousMP := p.Health, p.Mana
					if _, ok := w.PerformUnequip(p.ID, "chest", "health-armor"); !ok {
						t.Fatal("ordinary unequip rejected")
					}
					wantHP, wantMP := min(previousHP, p.MaxHealth), min(previousMP, p.MaxMana)
					copy := w.GetEntityCopy(p.ID)
					if copy.Health != wantHP || copy.Mana != wantMP {
						t.Fatalf("immediate authoritative resources %d/%d mana%d/%d; want%d/%d", copy.Health, copy.MaxHealth, copy.Mana, copy.MaxMana, wantHP, wantMP)
					}
					if state == "dead" && p.State != "DEAD" {
						t.Fatal("equipment resurrected the character")
					}
					if _, ok := w.PerformEquip(p.ID, "health-armor", "chest"); !ok {
						t.Fatal("ordinary re-equip rejected")
					}
					if p.Health != wantHP || p.Mana != wantMP {
						t.Fatal("equipment cycle refilled resources")
					}
				})
			}
		}
	}
}

func TestHealthCapUsesFinalTalentAndRestedMaximumWithoutProgressiveLoss(t *testing.T) {
	p := newTestPlayer("final-health-cap", "Fighter")
	p.Level, p.WellRestedSeconds = 100, 60
	p.TalentRanks = map[string]int{"FTR_31": 5, "FTR_34": 5}
	p.RecalculateStats()
	p.Health, p.Mana = p.MaxHealth, p.MaxMana
	health, mana := p.Health, p.Mana
	for i := 0; i < 5; i++ {
		p.RecalculateStats()
		if p.Health != health || p.Mana != mana {
			t.Fatal("unchanged final bonuses progressively lost resources")
		}
	}
	delete(p.TalentRanks, "FTR_34")
	p.RecalculateStats()
	if p.MaxHealth >= health || p.Health != p.MaxHealth {
		t.Fatal("removing a maximum-health bonus retained excess health")
	}
}
