package game

import "testing"

func TestGetEntityCopyPreservesAndDetachesPersistentState(t *testing.T) {
	world := NewWorld(nil)
	player := &Entity{
		ID:      "player-snapshot",
		Type:    TypePlayer,
		SubType: "Fighter",
		SkillRunes: map[string]string{
			"Charge": "Fighter_Charge_Rune_A",
		},
		Inventory: []Item{{
			ID:    "inventory-item",
			Stats: map[string]int{"strength": 4},
			Gems: []SocketedGem{{
				Type:    GemRuby,
				Quality: GemChipped,
				Stats:   map[string]int{"strength": 10},
			}},
		}},
		Stash:   []Item{{ID: "stash-item", Stats: map[string]int{"vitality": 3}}},
		Buyback: []Item{{ID: "buyback-item", Stats: map[string]int{"wisdom": 2}}},
		Equipment: map[string]Item{
			"mainHand": {ID: "equipped-item", Stats: map[string]int{"damage": 5}},
		},
	}
	world.AddEntity(player)

	snapshot := world.GetEntityCopy(player.ID)
	if snapshot == nil {
		t.Fatal("snapshot is nil")
	}
	if snapshot.SkillRunes["Charge"] == "" || len(snapshot.Buyback) != 1 {
		t.Fatalf("persistent state missing from snapshot: runes=%v buyback=%v", snapshot.SkillRunes, snapshot.Buyback)
	}

	player.Mu.Lock()
	player.SkillRunes["Charge"] = "changed"
	player.Inventory[0].Stats["strength"] = 99
	player.Inventory[0].Gems[0].Stats["strength"] = 99
	player.Stash[0].Stats["vitality"] = 99
	player.Buyback[0].Stats["wisdom"] = 99
	equipped := player.Equipment["mainHand"]
	equipped.Stats["damage"] = 99
	player.Equipment["mainHand"] = equipped
	player.Mu.Unlock()

	if snapshot.SkillRunes["Charge"] != "Fighter_Charge_Rune_A" {
		t.Fatalf("snapshot rune map aliases live state: %v", snapshot.SkillRunes)
	}
	if snapshot.Inventory[0].Stats["strength"] != 4 || snapshot.Inventory[0].Gems[0].Stats["strength"] != 10 {
		t.Fatalf("snapshot inventory aliases live state: %+v", snapshot.Inventory[0])
	}
	if snapshot.Stash[0].Stats["vitality"] != 3 || snapshot.Buyback[0].Stats["wisdom"] != 2 {
		t.Fatalf("snapshot storage aliases live state: stash=%+v buyback=%+v", snapshot.Stash, snapshot.Buyback)
	}
	if snapshot.Equipment["mainHand"].Stats["damage"] != 5 {
		t.Fatalf("snapshot equipment aliases live state: %+v", snapshot.Equipment)
	}
}
