package game

import (
	"reflect"
	"testing"
)

func TestLoadoutBuildSwitchUsesClassRulesAndOneRespecPayment(t *testing.T) {
	for class, talent := range map[string]string{"Fighter": "FTR_01", "Rogue": "ROG_01", "Wizard": "WIZ_01", "Cleric": "CLR_01"} {
		t.Run(class, func(t *testing.T) {
			w, p := loadoutFixture()
			p.SubType, p.Level, p.Gold = class, 70, 10000
			p.SelectedBranch = "B"
			p.TalentRanks = map[string]int{talent: 1}
			rune := GetAllRunesForClass(class)[0]
			p.SkillRunes = map[string]string{rune.Skill: rune.ID}
			w.UpdateUnlockedSkills(p)
			bar := []string{p.UnlockedSkills[1], "", p.UnlockedSkills[2], ""}
			if err := w.SaveEquipmentLoadout(p.ID, 1, "Class build", bar); err != nil {
				t.Fatal(err)
			}
			p.SelectedBranch, p.TalentRanks = "A", map[string]int{}
			p.SkillRunes = map[string]string{}
			w.UpdateUnlockedSkills(p)
			cost := LoadoutBuildCost(p, p.EquipmentLoadouts[1])
			if cost != w.GetRespecCost(p.ID, "both") || cost != 6000 {
				t.Fatal("build reset quote diverged from ordinary respec")
			}
			health, mana, skillPoints := p.Health, p.Mana, p.SkillPoints
			if _, err := w.ApplyEquipmentLoadout(p.ID, 1); err == nil {
				t.Fatal("paid reset accepted without confirmation")
			}
			if p.Gold != 10000 || p.SelectedBranch != "A" {
				t.Fatal("unconfirmed reset changed state")
			}
			if _, err := w.ApplyEquipmentLoadout(p.ID, 1, cost); err != nil {
				t.Fatal(err)
			}
			if p.Gold != 4000 || p.SelectedBranch != "B" || p.TalentRanks[talent] != 1 || p.TalentPoints != 13 || !reflect.DeepEqual(p.SavedHotbar, bar) {
				t.Fatal("build failed to restore choices and exact point budget")
			}
			if p.Health != health || p.Mana != mana || p.SkillPoints != skillPoints {
				t.Fatal("build switch invented resources or skill points")
			}
			if p.SkillRunes[rune.Skill] != rune.ID {
				t.Fatal("earned class rune not restored")
			}
			if _, err := w.ApplyEquipmentLoadout(p.ID, 1, cost); err != nil {
				t.Fatal(err)
			}
			if p.Gold != 4000 {
				t.Fatal("replayed apply charged a second reset")
			}
		})
	}
}

func TestLoadoutBuildFailuresDoNotSpendGoldOrChangeEquipment(t *testing.T) {
	for name, corrupt := range map[string]func(*Entity){
		"wrong class talent": func(p *Entity) { p.EquipmentLoadouts[0].Build.TalentRanks = map[string]int{"WIZ_01": 1} },
		"too many points":    func(p *Entity) { p.Level = 1 },
		"overranked talent":  func(p *Entity) { p.EquipmentLoadouts[0].Build.TalentRanks["FTR_01"] = 99 },
		"locked rune": func(p *Entity) {
			p.EquipmentLoadouts[0].Build.SkillRunes = map[string]string{"Charge": "charge_momentum"}
		},
		"wrong class rune": func(p *Entity) {
			p.Level = 100
			p.EquipmentLoadouts[0].Build.SkillRunes = map[string]string{"Fireball": "fireball_explosive"}
		},
		"missing item":    func(p *Entity) { p.Inventory[0] = Item{} },
		"not enough gold": func(p *Entity) { p.Gold = 1 },
	} {
		t.Run(name, func(t *testing.T) {
			w, p := loadoutFixture()
			p.Gold = 10000
			p.EquipmentLoadouts[0].Build = &LoadoutBuild{Branch: "A", TalentRanks: map[string]int{"FTR_01": 1}}
			corrupt(p)
			before := w.GetEntityCopy(p.ID)
			cost := LoadoutBuildCost(p, p.EquipmentLoadouts[0])
			if _, err := w.ApplyEquipmentLoadout(p.ID, 0, cost); err == nil {
				t.Fatal("invalid build switch accepted")
			}
			if p.Gold != before.Gold || p.SelectedBranch != before.SelectedBranch || !reflect.DeepEqual(p.TalentRanks, before.TalentRanks) ||
				!reflect.DeepEqual(p.Equipment, before.Equipment) || !reflect.DeepEqual(p.Inventory, before.Inventory) {
				t.Fatal("failed build was not atomic")
			}
		})
	}
}

func TestLoadoutRestoresOnlyOwnedSkillsWithoutFillingEmptySlots(t *testing.T) {
	p := &Entity{SubType: "Fighter", UnlockedSkills: []string{"Whirlwind"}, SavedHotbar: []string{"", "Whirlwind", "Meteor Drop", "Charge"}}
	if got := RestoredLoadoutHotbar(p); !reflect.DeepEqual(got, []string{"", "Whirlwind", "", "Charge"}) {
		t.Fatalf("invalid restored bar: %v", got)
	}
	p.SavedHotbar = nil
	if RestoredLoadoutHotbar(p) != nil {
		t.Fatal("legacy character's default bar overridden")
	}
	p.SavedHotbar = []string{"", "", "", ""}
	if len(RestoredLoadoutHotbar(p)) != 4 {
		t.Fatal("intentional empty bar lost")
	}
}
