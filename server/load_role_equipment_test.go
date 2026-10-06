package main

import (
	"errors"
	"fmt"
	"testing"

	"eidolon-server/internal/game"
)

// Explicit disposable starting gear, not a player reward or runtime grant.
// Select suitable normally generated rolls; never rewrite their stats/budgets.
func preparedRoleEquipment(class string, level int, generate func(game.AdminItemSpec) ([]game.Item, error)) (map[string]game.Item, error) {
	var primary, weapon, offhand string
	armor := []string{"silk-hood", "robes", "silk-skirt", "sandals", "silk-gloves", "velvet-mantle", "silk-sash"}
	rings := []string{"gold-ring", "silver-ring"}
	switch class {
	case "Fighter":
		primary, weapon, offhand = "strength", "iron-sword", "wooden-shield"
		rings[0] = "ruby-ring"
	case "Cleric":
		primary, weapon, offhand = "wisdom", "cleric-mace", "wooden-shield"
	case "Rogue":
		primary, weapon, offhand = "dexterity", "steel-dagger", "steel-dagger"
		armor = []string{"leather-cap", "leather-tunic", "leather-pants", "leather-boots", "leather-gloves", "reinforced-spaulders", "studded-belt"}
	case "Wizard":
		primary, weapon, offhand = "intelligence", "wooden-staff", "spell-tome"
	default:
		return nil, errors.New("unsupported prepared class")
	}
	if level < 30 || level > 100 || generate == nil {
		return nil, errors.New("invalid prepared equipment inputs")
	}
	if class == "Fighter" || class == "Cleric" {
		armor = []string{"iron-helm", "plate-mail", "plate-greaves", "iron-boots", "iron-gauntlets", "steel-pauldrons", "plated-girdle"}
	}
	ids := append([]string{weapon}, armor...)
	ids = append(ids, rings...)
	ids = append(ids, offhand)
	equipment := make(map[string]game.Item, len(ids))
	for index, id := range ids {
		rarity := game.RarityUncommon
		if index%2 == 0 || index == len(ids)-1 {
			rarity = game.RarityRare
		}
		var item game.Item
		found := false
		for attempt := 0; attempt < 128; attempt++ {
			items, err := generate(game.AdminItemSpec{Item: id, Rarity: rarity, Level: level, Quantity: 1})
			if err != nil {
				return nil, err
			}
			if len(items) != 1 {
				return nil, errors.New("invalid generated equipment batch")
			}
			if items[0].Stats[primary] > 0 {
				item, found = items[0], true
				break
			}
		}
		if !found {
			return nil, errors.New("no suitable normal equipment roll within preparation bound")
		}
		slot := item.Slot
		if index == len(ids)-1 {
			slot = "offHand"
		}
		if slot == "ring" {
			slot = "ring1"
			if _, exists := equipment[slot]; exists {
				slot = "ring2"
			}
		}
		if _, exists := equipment[slot]; exists {
			return nil, errors.New("duplicate prepared equipment slot")
		}
		equipment[slot] = item
	}
	return equipment, nil
}

func TestPreparedRoleEquipmentUsesLegalNaturalClassFocusedUncommonRareItems(t *testing.T) {
	for index, class := range []string{"Fighter", "Cleric", "Rogue", "Wizard"} {
		for _, level := range []int{30, 60, 100} {
			t.Run(fmt.Sprintf("%s/%d", class, level), func(t *testing.T) {
				equipment, err := preparedRoleEquipment(class, level, game.GenerateAdminItems)
				if err != nil || len(equipment) != 11 {
					t.Fatal("could not prepare declared normal role gear", err)
				}
				world := game.NewWorld(nil)
				t.Cleanup(world.StopBackground)
				player := &game.Entity{ID: "prepared-role", Type: game.TypePlayer, SubType: class, Level: level, Equipment: map[string]game.Item{}}
				world.AddEntity(player)
				primary := []string{"strength", "wisdom", "dexterity", "intelligence"}[index]
				seen := map[string]bool{}
				for slot, item := range equipment {
					if item.ID == "" || seen[item.ID] || item.Level != level || item.Stats[primary] <= 0 || item.StatScaleVersion != game.ItemStatScaleVersion || item.Rarity != game.RarityUncommon && item.Rarity != game.RarityRare || item.Potency != 0 {
						t.Fatal("wrong class focus, scale, rarity, level, identity or potency")
					}
					seen[item.ID] = true
					player.Inventory = append(player.Inventory, item)
					if _, ok := world.PerformEquip(player.ID, item.ID, slot); !ok {
						t.Fatal("production class/slot rules rejected role item", class, slot)
					}
				}
				if len(player.Equipment) != 11 {
					t.Fatal("not every prepared item actively equipped")
				}
				if class == "Rogue" && equipment["offHand"].Type != game.ItemWeapon {
					t.Fatal("Rogue offhand is not a weapon")
				}
			})
		}
	}
}

func TestPreparedRoleEquipmentRefusesInvalidInputsAndBoundsUnsuitedRolls(t *testing.T) {
	for _, class := range []string{"", "unknown"} {
		if _, err := preparedRoleEquipment(class, 30, game.GenerateAdminItems); err == nil {
			t.Fatal("unknown class accepted")
		}
	}
	for _, level := range []int{0, 29, 101} {
		if _, err := preparedRoleEquipment("Fighter", level, game.GenerateAdminItems); err == nil {
			t.Fatal("invalid level accepted")
		}
	}
	calls := 0
	_, err := preparedRoleEquipment("Fighter", 30, func(game.AdminItemSpec) ([]game.Item, error) {
		calls++
		return []game.Item{{Stats: map[string]int{"wisdom": 1}}}, nil
	})
	if err == nil || calls != 128 {
		t.Fatal("unsuitable roll selection unbounded or invented stats")
	}
	_, err = preparedRoleEquipment("Fighter", 30, func(game.AdminItemSpec) ([]game.Item, error) { return nil, errors.New("synthetic generator failure") })
	if err == nil {
		t.Fatal("generation failure hidden")
	}
}
