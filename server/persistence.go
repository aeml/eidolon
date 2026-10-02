package main

import (
	"encoding/json"
	"log"
	"maps"
	"sort"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func broadcastPublicEvent() {
	world.UpdatePublicEvent(time.Now())
	payload, _ := json.Marshal(world.PublicEventSnapshot())
	data, _ := json.Marshal(Message{Type: "public_event", Payload: payload})
	enqueueTransientBroadcast(BroadcastMessage{Type: "public_event", Data: data})
}

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
	enqueueTransientBroadcast(BroadcastMessage{Type: "time", Data: data})
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
		savePlayerNow(client)
	}
	if err := retryPendingCharacterSaves(); err != nil {
		log.Printf("Character save retry remains pending: %v", err)
	}
}

func savePlayer(client *Client) {
	// Command handlers may hold this character's work lock. Capture only once
	// the worker owns that lock, never enqueue an already-stale snapshot. One
	// connection has at most one worker and one pending-capture bit, regardless
	// of how many save requests arrive while a write is waiting.
	if db == nil || world == nil || client == nil || client.username == "" {
		return
	}
	client.saveMu.Lock()
	defer client.saveMu.Unlock()
	client.savePending = true
	if client.saveRunning {
		return
	}
	client.saveRunning = true
	if !scheduleCharacterWork(client.runPendingSaves) {
		// Shutdown performs its independent final journal-all pass. Preserve
		// the pending bit/failure signal rather than falsely reporting a save
		// or leaving the connection stuck behind a worker that never started.
		client.saveRunning = false
		noteCharacterSaveFailure(client.username, true)
	}
}

func (client *Client) runPendingSaves() {
	for {
		client.saveMu.Lock()
		if !client.savePending {
			client.saveRunning = false
			client.saveMu.Unlock()
			return
		}
		client.savePending = false
		client.saveMu.Unlock()
		// New requests during capture/commit set savePending again. The next
		// iteration takes a fresh canonical snapshot and rechecks ownership.
		savePlayerNow(client)
	}
}

func savePlayerNow(client *Client) {
	if db == nil || world == nil || client == nil || client.username == "" {
		return
	}
	unlock := lockCharacterWork(client.username)
	defer unlock()
	if !currentCharacterConnection(client) || client.playerID == "" {
		return
	}

	entity := world.GetEntityCopy(client.playerID)
	if entity == nil {
		return
	}
	saveCharacterDB(client, entity)
}

func characterSnapshotForSave(username string, entity *game.Entity) *database.Character {
	char := characterSnapshot(username, entity, time.Now())
	if entity.InstanceID != "" {
		if snapshot, ok := world.GetDungeonResumeSnapshot(entity.InstanceID); ok {
			char.DungeonProgress = dungeonResumeToDatabase(snapshot)
		}
	}
	return char
}

func saveCharacterDB(client *Client, entity *game.Entity) error {
	char := characterSnapshotForSave(client.username, entity)
	if err := persistCharacterSnapshot(client.username, char); err != nil {
		log.Printf("Failed to save character for %s: %v", client.username, err)
		return err
	} else {
		log.Printf("Saved character for %s (Inv: %d, Equip: %d)", client.username, len(char.Inventory), len(char.Equipment))
	}
	return nil
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
		Layout: database.DungeonLayoutSnapshot{
			GenerationSeed:     snapshot.Layout.GenerationSeed,
			GeneratorVersion:   snapshot.Layout.GeneratorVersion,
			GenerationAttempt:  snapshot.Layout.GenerationAttempt,
			GenerationFallback: snapshot.Layout.GenerationFallback,
		},
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
		Layout: game.DungeonLayout{
			GenerationSeed:     persisted.Layout.GenerationSeed,
			GeneratorVersion:   persisted.Layout.GeneratorVersion,
			GenerationAttempt:  persisted.Layout.GenerationAttempt,
			GenerationFallback: persisted.Layout.GenerationFallback,
		},
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
	x, y, z, instanceID := entity.X, entity.Y, entity.Z, entity.InstanceID
	if seat := entity.CasinoSeat; seat != nil && instanceID == game.CasinoInstanceID {
		x, y, z = seat.ExitX, seat.ExitY, seat.ExitZ
	}
	if origin := entity.PvPReturn; origin != nil {
		x, y, z, instanceID = origin.X, origin.Y, origin.Z, origin.InstanceID
	}
	resonanceRanks := make(map[string]int, len(entity.ResonanceRanks))
	for trait, rank := range entity.ResonanceRanks {
		resonanceRanks[trait] = rank
	}

	// Update DB character
	char := &database.Character{
		GuildBankRevision:        entity.GuildBankRevision,
		GuildBankOpID:            entity.GuildBankOpID,
		GuildBankOpFingerprint:   entity.GuildBankOpFingerprint,
		GoldCreditReceipts:       cloneGoldCreditReceipts(entity.GoldCreditReceipts),
		EP:                       entity.EP,
		EPExchangeReceipts:       cloneGoldCreditReceipts(entity.EPExchangeReceipts),
		EPCasinoReceipts:         cloneGoldCreditReceipts(entity.EPCasinoReceipts),
		VIPAllowanceReceipts:     cloneGoldCreditReceipts(entity.VIPAllowanceReceipts),
		ItemDeliveryReceipts:     cloneItemDeliveryReceipts(entity.ItemDeliveryReceipts),
		AdminOperationReceipts:   cloneItemDeliveryReceipts(entity.AdminOperationReceipts),
		WeeklyRaidRewardReceipts: maps.Clone(entity.WeeklyRaidRewardReceipts),
		WeeklyRaidCompletions:    maps.Clone(entity.WeeklyRaidCompletions),
		Resources:                resourceSnapshot(entity),
		WellRested:               wellRestedSnapshot(entity),
		Name:                     username,
		Class:                    entity.SubType,
		Level:                    entity.Level,
		XP:                       entity.Experience,
		ProgressionVersion:       game.CurrentProgressionVersion,
		ResonanceLevel:           entity.ResonanceLevel,
		ResonanceXP:              entity.ResonanceXP,
		ResonancePoints:          entity.ResonancePoints,
		ResonanceRanks:           resonanceRanks,
		Gold:                     entity.Gold,
		X:                        x,
		Y:                        y,
		Z:                        z,
		InstanceID:               instanceID,
		LastLogout:               savedAt,
		Stats: database.Stats{
			Vitality:     entity.BaseStats.Vitality,
			Strength:     entity.BaseStats.Strength,
			Dexterity:    entity.BaseStats.Dexterity,
			Intelligence: entity.BaseStats.Intelligence,
			Wisdom:       entity.BaseStats.Wisdom,
		},
		SkillPoints:          entity.SkillPoints,
		EquipmentLoadouts:    databaseLoadouts(entity.EquipmentLoadouts),
		AppearanceCollection: databaseAppearances(entity.AppearanceCollection),
		Appearances:          databaseAppearances(entity.Appearances),
		SavedHotbar:          append([]string(nil), entity.SavedHotbar...),
		SelectedBranch:       entity.SelectedBranch,
		UnlockedSkills:       entity.UnlockedSkills,
		SkillRunes:           entity.SkillRunes,
		UnlockedTalents:      unlockedTalents,
		TalentRanks:          normalizedRanks,
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
				CollectionVersion:  q.CollectionVersion,
				InvestigationMask:  q.InvestigationMask,
				LegacyOptional:     q.LegacyOptional,
				DropMisses:         q.DropMisses,
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
		ForgeBasis:       item.ForgeBasis.Clone(),
	}
}

func gameItemFromDatabase(item database.Item) game.Item {
	converted := gameItemFromDatabaseExact(item)
	game.NormalizeItemStatScale(&converted)
	return converted
}

// Delivery recovery must not rescale unrelated saved items during an offline
// full-character commit. Ordinary hydration retains its existing normalization.
func gameItemFromDatabaseExact(item database.Item) game.Item {
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
		ForgeBasis:       item.ForgeBasis.Clone(),
	}
	return converted
}
