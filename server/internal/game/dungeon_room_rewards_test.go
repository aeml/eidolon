package game

import (
	"testing"
	"time"
)

func TestMarkDungeonRoomClearedAwardsNonBossRoomsOnce(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-1",
		Type:          TypePlayer,
		Level:         40,
		MaxExperience: 100,
	}
	w.AddEntity(player)

	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	instanceID := "instance-room-rewards"
	w.InstanceLayouts[instanceID] = &DungeonInstance{
		ID:                instanceID,
		Layout:            layout,
		Difficulty:        DifficultyNormal,
		DungeonType:       "verdant_bastion_catacombs",
		RunLevel:          40,
		RoomState:         NewDungeonRoomState(layout),
		PlayerRoomSummary: map[string]DungeonRoomSummary{},
	}
	w.Entities[player.ID].InstanceID = instanceID

	w.UpdateDungeonRoomProgress(player.ID, 100, 0)

	rewards := make([]DungeonRoomClearRewardEvent, 0)
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType != "room_clear_reward" {
			return
		}
		rewards = append(rewards, data.(DungeonRoomClearRewardEvent))
	}

	w.MarkDungeonRoomCleared(instanceID, 0)
	if len(rewards) != 0 {
		t.Fatalf("expected no room-clear reward for start room, got %d", len(rewards))
	}
	if player.Experience != 0 || player.Gold != 0 {
		t.Fatalf("expected no rewards for start room, got xp=%d gold=%d", player.Experience, player.Gold)
	}

	w.MarkDungeonRoomCleared(instanceID, 1)
	if len(rewards) != 1 {
		t.Fatalf("expected one room-clear reward event, got %d", len(rewards))
	}
	if rewards[0].PlayerID != player.ID {
		t.Fatalf("expected room-clear reward for %s, got %s", player.ID, rewards[0].PlayerID)
	}
	if rewards[0].RoomIndex != 1 {
		t.Fatalf("expected reward for room 1, got %d", rewards[0].RoomIndex)
	}
	if rewards[0].ObjectiveRoomIndex != 2 {
		t.Fatalf("expected boss room as next objective, got %d", rewards[0].ObjectiveRoomIndex)
	}
	if rewards[0].Title == "" || rewards[0].Hint == "" {
		t.Fatalf("expected room-clear reward to include title and hint, got %+v", rewards[0])
	}
	if player.Experience <= 0 || player.Gold <= 0 {
		t.Fatalf("expected non-boss room clear to award xp and gold, got xp=%d gold=%d", player.Experience, player.Gold)
	}

	xpAfterFirstClear := player.Experience
	goldAfterFirstClear := player.Gold

	w.MarkDungeonRoomCleared(instanceID, 1)
	w.MarkDungeonRoomCleared(instanceID, 2)

	if len(rewards) != 1 {
		t.Fatalf("expected exactly one room-clear reward after duplicate and boss clears, got %d", len(rewards))
	}
	if player.Experience != xpAfterFirstClear || player.Gold != goldAfterFirstClear {
		t.Fatalf("expected duplicate/boss clears not to grant extra rewards, got xp=%d gold=%d", player.Experience, player.Gold)
	}
}

func TestMarkDungeonRoomClearedEmitsEventRewardsForEliteAndNormalRooms(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-1",
		Type:          TypePlayer,
		Level:         60,
		MaxExperience: 100,
	}
	w.AddEntity(player)

	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	instanceID := "instance-room-events"
	w.InstanceLayouts[instanceID] = &DungeonInstance{
		ID:                instanceID,
		Layout:            layout,
		Difficulty:        DifficultyHeroic,
		DungeonType:       "tempest_spire",
		RunLevel:          60,
		RoomState:         NewDungeonRoomState(layout),
		PlayerRoomSummary: map[string]DungeonRoomSummary{},
	}
	w.Entities[player.ID].InstanceID = instanceID

	rewards := make([]DungeonRoomClearRewardEvent, 0)
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "room_clear_reward" {
			rewards = append(rewards, data.(DungeonRoomClearRewardEvent))
		}
	}

	w.MarkDungeonRoomCleared(instanceID, 1)
	w.MarkDungeonRoomCleared(instanceID, 2)

	if len(rewards) != 2 {
		t.Fatalf("expected 2 room-clear reward events, got %d", len(rewards))
	}
	if rewards[0].RoomType != "elite" {
		t.Fatalf("expected first event to be elite, got %s", rewards[0].RoomType)
	}
	if rewards[0].Hint == "" || rewards[1].Hint == "" {
		t.Fatalf("expected room-clear events to include hint text, got %+v %+v", rewards[0], rewards[1])
	}
	if rewards[0].Title == rewards[1].Title {
		t.Fatalf("expected elite and normal room rewards to have distinct titles, got %q", rewards[0].Title)
	}
	if rewards[0].Gold <= rewards[1].Gold || rewards[0].XP <= rewards[1].XP {
		t.Fatalf("expected elite room rewards to exceed normal room rewards, got elite=%+v normal=%+v", rewards[0], rewards[1])
	}
}

func TestMarkDungeonRoomClearedAppliesHookRewardsAndHints(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-1",
		Type:          TypePlayer,
		Level:         55,
		Health:        400,
		MaxHealth:     1000,
		Mana:          120,
		MaxMana:       300,
		MaxExperience: 100,
	}
	w.AddEntity(player)

	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "chest"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite", Hook: "elite_ambush"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "shrine"},
			{X: 400, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	instanceID := "instance-room-hook-rewards"
	w.InstanceLayouts[instanceID] = &DungeonInstance{
		ID:                instanceID,
		Layout:            layout,
		Difficulty:        DifficultyHeroic,
		DungeonType:       "tempest_spire",
		RunLevel:          55,
		RoomState:         NewDungeonRoomState(layout),
		PlayerRoomSummary: map[string]DungeonRoomSummary{"player-1": {}},
	}
	w.Entities[player.ID].InstanceID = instanceID

	rewards := make([]DungeonRoomClearRewardEvent, 0)
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "room_clear_reward" {
			rewards = append(rewards, data.(DungeonRoomClearRewardEvent))
		}
	}

	w.MarkDungeonRoomCleared(instanceID, 1)
	if rewards[0].Hint != "Treasure secured — cash in before the boss" {
		t.Fatalf("expected chest hint, got %q", rewards[0].Hint)
	}
	if rewards[0].RoomHook != "chest" {
		t.Fatalf("expected chest hook metadata, got %+v", rewards[0])
	}
	if player.Health != 400 || player.Mana != 120 {
		t.Fatalf("expected chest room not to restore resources, got health=%d mana=%d", player.Health, player.Mana)
	}

	w.MarkDungeonRoomCleared(instanceID, 2)
	if rewards[1].Gold <= rewards[0].Gold || rewards[1].XP <= rewards[0].XP {
		t.Fatalf("expected ambush room to pay more than chest room, got chest=%+v ambush=%+v", rewards[0], rewards[1])
	}
	if rewards[1].Hint != "Ambush survived — momentum and spoils increased" {
		t.Fatalf("expected ambush hint, got %q", rewards[1].Hint)
	}
	if rewards[1].RoomType != "elite" {
		t.Fatalf("expected elite room type for ambush, got %q", rewards[1].RoomType)
	}

	w.MarkDungeonRoomCleared(instanceID, 3)
	if player.Health != 700 || player.Mana != 210 {
		t.Fatalf("expected shrine to restore 30%% health/mana, got health=%d mana=%d", player.Health, player.Mana)
	}
	if rewards[2].Hint != "Shrine restored your strength for the next push" {
		t.Fatalf("expected shrine hint, got %q", rewards[2].Hint)
	}
	if rewards[2].BuffName != "Sanctuary" || rewards[2].BuffDurationSeconds != 8 || rewards[2].DamageReductionPct != 25 {
		t.Fatalf("expected shrine reward buff metadata, got %+v", rewards[2])
	}
	if !player.SanctuaryDamageReduction {
		t.Fatalf("expected shrine to grant temporary damage reduction buff")
	}
}

func TestMarkDungeonRoomClearedHookLootRewardsPopulateCountsAndInventory(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-1",
		Type:          TypePlayer,
		Level:         65,
		Health:        900,
		MaxHealth:     1000,
		Mana:          250,
		MaxMana:       300,
		MaxExperience: 100,
		Inventory:     make([]Item, MaxInventorySize),
	}
	w.AddEntity(player)

	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "chest"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite", Hook: "elite_ambush"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	instanceID := "instance-room-hook-loot"
	w.InstanceLayouts[instanceID] = &DungeonInstance{
		ID:                instanceID,
		Layout:            layout,
		Difficulty:        DifficultyHeroic,
		DungeonType:       "tempest_spire",
		RunLevel:          65,
		RoomState:         NewDungeonRoomState(layout),
		PlayerRoomSummary: map[string]DungeonRoomSummary{"player-1": {}},
	}
	w.Entities[player.ID].InstanceID = instanceID

	rewards := make([]DungeonRoomClearRewardEvent, 0)
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "room_clear_reward" {
			rewards = append(rewards, data.(DungeonRoomClearRewardEvent))
		}
	}

	w.MarkDungeonRoomCleared(instanceID, 1)
	if rewards[0].RoomHook != "chest" {
		t.Fatalf("expected chest hook in reward, got %q", rewards[0].RoomHook)
	}
	if rewards[0].GemCount != 1 || rewards[0].ItemCount != 0 {
		t.Fatalf("expected chest reward to include exactly one gem, got %+v", rewards[0])
	}
	if player.Inventory[0].ID == "" || player.Inventory[0].Type != ItemGem {
		t.Fatalf("expected chest reward gem added to inventory, got %+v", player.Inventory[0])
	}

	w.MarkDungeonRoomCleared(instanceID, 2)
	if rewards[1].RoomHook != "elite_ambush" {
		t.Fatalf("expected ambush hook in reward, got %q", rewards[1].RoomHook)
	}
	if rewards[1].ItemCount != 1 || rewards[1].GemCount != 0 {
		t.Fatalf("expected ambush reward to include exactly one item, got %+v", rewards[1])
	}
	if player.Inventory[1].ID == "" || player.Inventory[1].Type == ItemGem {
		t.Fatalf("expected ambush reward item added to inventory, got %+v", player.Inventory[1])
	}
}

func TestMarkDungeonRoomClearedShrineBuffExpiresAfterDuration(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-1",
		Type:          TypePlayer,
		Level:         55,
		Health:        700,
		MaxHealth:     1000,
		Mana:          200,
		MaxMana:       300,
		MaxExperience: 100,
		InstanceID:    "instance-shrine-buff-expiry",
		State:         "IDLE",
	}
	w.AddEntity(player)

	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "shrine"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	instanceID := "instance-shrine-buff-expiry"
	w.InstanceLayouts[instanceID] = &DungeonInstance{
		ID:                instanceID,
		Layout:            layout,
		Difficulty:        DifficultyNormal,
		DungeonType:       "verdant_bastion_catacombs",
		RunLevel:          55,
		RoomState:         NewDungeonRoomState(layout),
		PlayerRoomSummary: map[string]DungeonRoomSummary{"player-1": {}},
	}

	w.MarkDungeonRoomCleared(instanceID, 1)
	if !player.SanctuaryDamageReduction {
		t.Fatalf("expected shrine buff to be active immediately after room clear")
	}

	player.SanctuaryEndTime = time.Now().Add(-1 * time.Second)
	w.Update(0.016)
	if player.SanctuaryDamageReduction {
		t.Fatalf("expected shrine buff to expire after duration")
	}
}
