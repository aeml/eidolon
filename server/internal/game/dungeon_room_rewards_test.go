package game

import "testing"

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
