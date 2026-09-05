package main

import (
	"encoding/json"
	"log"
	"sort"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func broadcastTime() {
	// For game timer, maybe just send seconds elapsed since server start or a specific game time
	// Let's send current Unix timestamp
	now := time.Now().Unix()
	payload, _ := json.Marshal(map[string]int64{"time": now})
	msg := Message{
		Type:    "time",
		Payload: payload,
	}
	data, _ := json.Marshal(msg)
	broadcast <- BroadcastMessage{Type: "time", Data: data}
}

func saveAllPlayers() {
	// Create a snapshot of active sessions to avoid holding the lock during DB operations
	var clientsToSave []*Client
	sessionsMu.Lock()
	for _, client := range activeSessions {
		clientsToSave = append(clientsToSave, client)
	}
	sessionsMu.Unlock()

	for _, client := range clientsToSave {
		savePlayer(client)
	}
}

func savePlayer(client *Client) {
	if db == nil || world == nil || client == nil || client.playerID == "" || client.username == "" {
		return
	}

	entity := world.GetEntityCopy(client.playerID)
	if entity == nil {
		return
	}
	saveCharacterDB(client, entity)
}

func saveCharacterDB(client *Client, entity *game.Entity) {
	char := characterSnapshot(client.username, entity, time.Now())
	if entity.InstanceID != "" {
		if snapshot, ok := world.GetDungeonResumeSnapshot(entity.InstanceID); ok {
			char.DungeonProgress = dungeonResumeToDatabase(snapshot)
		}
	}
	if err := db.SaveCharacter(client.username, char); err != nil {
		log.Printf("Failed to save character for %s: %v", client.username, err)
	} else {
		log.Printf("Saved character for %s (Inv: %d, Equip: %d)", client.username, len(char.Inventory), len(char.Equipment))
	}
}

func dungeonResumeToDatabase(snapshot game.DungeonResumeSnapshot) *database.CharacterDungeonResume {
	persisted := &database.CharacterDungeonResume{
		InstanceID:            snapshot.ID,
		PartyID:               snapshot.PartyID,
		CreatedAt:             snapshot.CreatedAt,
		Difficulty:            string(snapshot.Difficulty),
		DungeonType:           snapshot.DungeonType,
		RunLevel:              snapshot.RunLevel,
		CurrentRoomIndexValue: snapshot.CurrentRoomIndexValue,
		Rooms:                 make([]database.DungeonRoomProgress, len(snapshot.Rooms)),
	}
	for _, room := range snapshot.Layout.Rooms {
		persisted.Layout.Rooms = append(persisted.Layout.Rooms, database.DungeonRoomSnapshot{
			X: room.X, Z: room.Z, Width: room.Width, Height: room.Height,
			Type: room.Type, Hook: room.Hook, Pacing: room.Pacing, Color: room.Color,
		})
	}
	for _, rect := range snapshot.Layout.WalkRects {
		persisted.Layout.WalkRects = append(persisted.Layout.WalkRects, database.DungeonWalkRectSnapshot{
			X: rect.X, Z: rect.Z, Width: rect.Width, Height: rect.Height,
			Kind: rect.Kind, RoomIndex: rect.RoomIndex,
		})
	}
	for _, corridor := range snapshot.Layout.Corridors {
		persisted.Layout.Corridors = append(persisted.Layout.Corridors, database.DungeonCorridorSnapshot{
			FromRoomIndex: corridor.FromRoomIndex, ToRoomIndex: corridor.ToRoomIndex,
			Width: corridor.Width, WalkRectIndices: append([]int(nil), corridor.WalkRectIndices...),
		})
	}
	for i, progress := range snapshot.Rooms {
		persisted.Rooms[i] = database.DungeonRoomProgress{
			Explored: progress.Explored,
			Cleared:  progress.Cleared,
			Rewarded: progress.Rewarded,
		}
	}
	return persisted
}

func dungeonResumeFromDatabase(persisted *database.CharacterDungeonResume) game.DungeonResumeSnapshot {
	if persisted == nil {
		return game.DungeonResumeSnapshot{}
	}
	snapshot := game.DungeonResumeSnapshot{
		ID:                    persisted.InstanceID,
		PartyID:               persisted.PartyID,
		CreatedAt:             persisted.CreatedAt,
		Difficulty:            game.DungeonDifficulty(persisted.Difficulty),
		DungeonType:           persisted.DungeonType,
		RunLevel:              persisted.RunLevel,
		CurrentRoomIndexValue: persisted.CurrentRoomIndexValue,
		Rooms:                 make([]game.DungeonRoomProgress, len(persisted.Rooms)),
	}
	for _, room := range persisted.Layout.Rooms {
		snapshot.Layout.Rooms = append(snapshot.Layout.Rooms, game.DungeonRoom{
			X: room.X, Z: room.Z, Width: room.Width, Height: room.Height,
			Type: room.Type, Hook: room.Hook, Pacing: room.Pacing, Color: room.Color,
		})
	}
	for _, rect := range persisted.Layout.WalkRects {
		snapshot.Layout.WalkRects = append(snapshot.Layout.WalkRects, game.DungeonWalkRect{
			X: rect.X, Z: rect.Z, Width: rect.Width, Height: rect.Height,
			Kind: rect.Kind, RoomIndex: rect.RoomIndex,
		})
	}
	for _, corridor := range persisted.Layout.Corridors {
		snapshot.Layout.Corridors = append(snapshot.Layout.Corridors, game.DungeonCorridor{
			FromRoomIndex: corridor.FromRoomIndex, ToRoomIndex: corridor.ToRoomIndex,
			Width: corridor.Width, WalkRectIndices: append([]int(nil), corridor.WalkRectIndices...),
		})
	}
	for i, progress := range persisted.Rooms {
		snapshot.Rooms[i] = game.DungeonRoomProgress{
			Explored: progress.Explored,
			Cleared:  progress.Cleared,
			Rewarded: progress.Rewarded,
		}
	}
	return snapshot
}

func characterSnapshot(username string, entity *game.Entity, savedAt time.Time) *database.Character {
	// Normalize talent ranks before persisting (class-only IDs; clamped ranks).
	// Derive a stable legacy unlocked_talents list (rank > 0) for backwards compatibility.
	normalizedRanks := make(map[string]int, len(entity.TalentRanks))
	unlockedTalents := make([]string, 0)
	for tid, r := range entity.TalentRanks {
		nr, ok := game.NormalizeTalentRank(entity.SubType, tid, r)
		if !ok {
			continue
		}
		cid, ok := game.CanonicalizeTalentID(entity.SubType, tid)
		if !ok {
			continue
		}
		normalizedRanks[cid] = nr
		unlockedTalents = append(unlockedTalents, cid)
	}
	sort.Strings(unlockedTalents)
	resonanceRanks := make(map[string]int, len(entity.ResonanceRanks))
	for trait, rank := range entity.ResonanceRanks {
		resonanceRanks[trait] = rank
	}

	// Update DB character
	char := &database.Character{
		Name:            username,
		Class:           entity.SubType,
		Level:           entity.Level,
		XP:              entity.Experience,
		ResonanceLevel:  entity.ResonanceLevel,
		ResonanceXP:     entity.ResonanceXP,
		ResonancePoints: entity.ResonancePoints,
		ResonanceRanks:  resonanceRanks,
		Gold:            entity.Gold,
		X:               entity.X,
		Y:               entity.Y,
		Z:               entity.Z,
		InstanceID:      entity.InstanceID,
		LastLogout:      savedAt,
		Stats: database.Stats{
			Vitality:     entity.BaseStats.Vitality,
			Strength:     entity.BaseStats.Strength,
			Dexterity:    entity.BaseStats.Dexterity,
			Intelligence: entity.BaseStats.Intelligence,
			Wisdom:       entity.BaseStats.Wisdom,
		},
		SkillPoints:     entity.SkillPoints,
		SelectedBranch:  entity.SelectedBranch,
		UnlockedSkills:  entity.UnlockedSkills,
		SkillRunes:      entity.SkillRunes,
		UnlockedTalents: unlockedTalents,
		TalentRanks:     normalizedRanks,
		// Social
		PartyID: entity.PartyID,
	}

	char.Inventory = databaseItems(entity.Inventory, true)
	char.Stash = databaseItems(entity.Stash, false)
	char.Buyback = databaseItems(entity.Buyback, false)
	char.Equipment = make(map[string]database.Item, len(entity.Equipment))
	for slot, item := range entity.Equipment {
		char.Equipment[slot] = databaseItem(item)
	}
	// Convert Game Quests to DB Quests
	if len(entity.Quests) > 0 {
		char.Quests = make([]database.Quest, len(entity.Quests))
		for i, q := range entity.Quests {
			char.Quests[i] = database.Quest{
				ID:                 q.ID,
				Type:               q.Type,
				Target:             q.Target,
				Count:              q.Count,
				MaxCount:           q.MaxCount,
				RewardXP:           q.RewardXP,
				RewardGold:         q.RewardGold,
				GrantedGold:        q.GrantedGold,
				GrantedXP:          q.GrantedXP,
				GrantedResonanceXP: q.GrantedResonanceXP,
				Completed:          q.Completed,
				Accepted:           q.Accepted,
				Title:              q.Title,
				Description:        q.Description,
				Lore:               q.Lore,
				Category:           q.Category,
				Chapter:            q.Chapter,
				ObjectiveText:      q.ObjectiveText,
			}
		}
	}
	char.LastDailyQuest = entity.LastDailyQuest

	return char
}

func databaseItems(items []game.Item, omitEmpty bool) []database.Item {
	result := make([]database.Item, 0, len(items))
	for _, item := range items {
		if omitEmpty && item.ID == "" {
			continue
		}
		result = append(result, databaseItem(item))
	}
	return result
}

func databaseItem(item game.Item) database.Item {
	return database.Item{
		ID:               item.ID,
		Name:             item.Name,
		Type:             string(item.Type),
		Rarity:           string(item.Rarity),
		Slot:             item.Slot,
		Level:            item.Level,
		Value:            item.Value,
		Icon:             item.Icon,
		Description:      item.Description,
		Stats:            item.Stats,
		Stack:            item.Stack,
		MaxStack:         item.MaxStack,
		Potency:          item.Potency,
		Sockets:          item.Sockets,
		Gems:             socketedGemsToDatabase(item.Gems),
		SetID:            item.SetID,
		UniqueEffect:     item.UniqueEffect,
		GemType:          string(item.GemType),
		GemQuality:       string(item.GemQuality),
		StatScaleVersion: item.StatScaleVersion,
	}
}

func gameItemFromDatabase(item database.Item) game.Item {
	converted := game.Item{
		ID:               item.ID,
		Name:             item.Name,
		Type:             game.ItemType(item.Type),
		Rarity:           game.ItemRarity(item.Rarity),
		Slot:             item.Slot,
		Level:            item.Level,
		Value:            item.Value,
		Icon:             item.Icon,
		Description:      item.Description,
		Stats:            item.Stats,
		Stack:            item.Stack,
		MaxStack:         item.MaxStack,
		Potency:          item.Potency,
		Sockets:          item.Sockets,
		Gems:             socketedGemsFromDatabase(item.Gems),
		SetID:            item.SetID,
		UniqueEffect:     item.UniqueEffect,
		GemType:          game.GemType(item.GemType),
		GemQuality:       game.GemQuality(item.GemQuality),
		StatScaleVersion: item.StatScaleVersion,
	}
	game.NormalizeItemStatScale(&converted)
	return converted
}
