package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func (c *Client) dispatchMessage(msg Message) {
	switch msg.Type {
	case MsgRegister:
		var payload AuthPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if err := db.CreateUser(payload.Username, payload.Email, payload.Password); err != nil {
			c.sendError("Registration failed: " + err.Error())
			return
		}
		c.sendError("Registration successful! Please login.")

	case MsgLogin:
		var payload AuthPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		success, err := db.Authenticate(payload.Username, payload.Password)
		if err != nil {
			c.sendError("Login error")
			return
		}
		if !success {
			c.sendError("Invalid credentials")
			return
		}
		c.username = payload.Username

		// Enforce single session
		sessionsMu.Lock()
		if oldClient, ok := activeSessions[c.username]; ok && oldClient != c {
			// Kick old client
			// Use a goroutine to avoid blocking and potential deadlocks if oldClient is stuck
			go func(clientToKick *Client) {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Recovered from kick panic: %v", r)
					}
				}()
				clientToKick.sendError("Logged in from another location")
				// Give a small delay for the message to be sent before closing
				time.Sleep(100 * time.Millisecond)
				clientToKick.conn.Close()
			}(oldClient)
		}
		activeSessions[c.username] = c
		sessionsMu.Unlock()

		// Check for characters
		user, err := db.GetUser(c.username)
		hasCharacter := false
		characterType := ""
		if err == nil && len(user.Characters) > 0 {
			hasCharacter = true
			characterType = user.Characters[0].Class
		}

		// Issue session-resume token
		resumeToken, err := issueResumeToken(c.username)
		if err != nil {
			log.Printf("Failed to issue resume token for %s: %v", c.username, err)
			resumeToken = ""
		}

		// Send success message
		response := map[string]interface{}{
			"message":       "Login successful",
			"hasCharacter":  hasCharacter,
			"characterType": characterType,
			"resumeToken":   resumeToken,
		}
		payloadBytes, _ := json.Marshal(response)

		successMsg := Message{
			Type:    "login_success",
			Payload: payloadBytes,
		}
		data, _ := json.Marshal(successMsg)
		c.sendSafe(data)

	case MsgJoin:
		if c.username == "" {
			log.Printf("MsgJoin failed: User not logged in (Client: %s)", c.conn.RemoteAddr())
			c.sendError("Please login first")
			return
		}
		var payload JoinPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("MsgJoin failed: Invalid payload from %s", c.username)
			return
		}

		// Defensive re-join: clean up previous entity if this client already joined
		if c.playerID != "" {
			log.Printf("Re-join detected for %s (old playerID: %s) – removing stale entity", c.username, c.playerID)
			world.RemoveEntity(c.playerID)
			c.seenIDs = make(map[string]bool)
			c.lastState = make(map[string]*EntitySnapshot)
		}

		log.Printf("Player joining: %s (Class: %s)", c.username, payload.Type)

		// Load user from DB to check for existing character
		user, err := db.GetUser(c.username)
		if err != nil {
			c.sendError("Failed to load user data")
			return
		}

		var char *database.Character
		// Simple logic: Use the first character if it exists, otherwise create one
		// In a real game, we'd have a character selection screen
		if len(user.Characters) > 0 {
			// Find character matching the requested class if possible, or just use the first one
			// For now, let's just use the first one to support persistence
			char = user.Characters[0]
			// If the class doesn't match what they selected in UI, we might want to warn or just use the DB one
			// Let's assume the DB one is authoritative
		} else {
			// Create new character
			char = &database.Character{
				Name:  c.username, // Simple name
				Class: payload.Type,
				Level: 1,
				XP:    0,
				X:     -1.25, // Lanternhold center aisle
				Y:     0,
				Z:     200, // Town Center Z
				Stats: database.Stats{
					Strength:     10,
					Dexterity:    10,
					Intelligence: 10,
					Wisdom:       10,
					Vitality:     10,
				},
			}
			// Save new character to DB
			var err error
			if user.Characters == nil {
				// If characters array is nil/null in DB, use $set to initialize it
				err = db.SetFirstCharacter(c.username, char)
			} else {
				// Otherwise use $push
				err = db.CreateCharacter(c.username, char)
			}

			if err != nil {
				log.Printf("Failed to create character for %s: %v", c.username, err)
				c.sendError("Failed to create character")
				return
			}
		}

		// Create player entity from DB character
		playerID := "player-" + c.username
		c.playerID = playerID

		// Check if player was in an instance and logged out more than 15 minutes ago
		spawnX := char.X
		spawnY := char.Y
		spawnZ := char.Z
		instanceID := char.InstanceID

		if instanceID != "" {
			// Player was in a dungeon instance
			timeSinceLogout := time.Since(char.LastLogout)
			if timeSinceLogout > 15*time.Minute {
				// More than 15 minutes - return to town
				log.Printf("Player %s was in instance %s but logged out %v ago - returning to town", c.username, instanceID, timeSinceLogout)
				spawnX = -1.25 // Town center
				spawnY = 0
				spawnZ = 200
				instanceID = "" // Clear instance
			} else {
				// Less than 15 minutes - check if instance still exists
				_, exists := world.GetInstanceLayout(instanceID)
				if !exists && char.DungeonProgress != nil && char.DungeonProgress.InstanceID == instanceID {
					if err := world.RestoreDungeon(dungeonResumeFromDatabase(char.DungeonProgress)); err != nil {
						log.Printf("Player %s dungeon restore for %s failed: %v", c.username, instanceID, err)
					} else {
						_, exists = world.GetInstanceLayout(instanceID)
						if exists {
							log.Printf("Restored dungeon %s from persisted room state for %s", instanceID, c.username)
						}
					}
				}
				if !exists {
					// Instance no longer exists - return to town
					log.Printf("Player %s was in instance %s but it no longer exists - returning to town", c.username, instanceID)
					spawnX = -1.25
					spawnY = 0
					spawnZ = 200
					instanceID = ""
				} else {
					log.Printf("Player %s reconnecting to instance %s (logged out %v ago)", c.username, instanceID, timeSinceLogout)
				}
			}
		}

		entity := &game.Entity{
			ID:              playerID,
			Name:            c.username,
			Type:            game.TypePlayer,
			SubType:         char.Class,
			X:               spawnX,
			Y:               spawnY,
			Z:               spawnZ,
			InstanceID:      instanceID,
			Health:          char.Stats.Vitality * 10,
			MaxHealth:       char.Stats.Vitality * 10,
			Mana:            char.Stats.Intelligence * 10,
			MaxMana:         char.Stats.Intelligence * 10,
			Level:           char.Level,
			Experience:      char.XP,
			MaxExperience:   game.ExperienceRequiredForLevel(char.Level),
			ResonanceLevel:  char.ResonanceLevel,
			ResonanceXP:     char.ResonanceXP,
			ResonancePoints: char.ResonancePoints,
			ResonanceRanks:  char.ResonanceRanks,
			Gold:            char.Gold,
			State:           "IDLE",
			Damage:          char.Stats.Strength * 2,
			Defense:         0,
			AttackCooldown:  1000 * time.Millisecond,
			Scale:           1.0,
			BaseStats: game.Stats{
				Strength:     char.Stats.Strength,
				Dexterity:    char.Stats.Dexterity,
				Intelligence: char.Stats.Intelligence,
				Wisdom:       char.Stats.Wisdom,
				Vitality:     char.Stats.Vitality,
			},
			SkillPoints:    0,
			SelectedBranch: char.SelectedBranch,
			UnlockedSkills: []string{},
		}
		entity.NormalizeResonanceProgress()

		// Passive talents: ranked map. Migrate legacy unlocked_talents (rank=1) if needed.
		if char.TalentRanks != nil {
			entity.TalentRanks = make(map[string]int, len(char.TalentRanks))
			for k, v := range char.TalentRanks {
				entity.TalentRanks[k] = v
			}
		} else if len(char.UnlockedTalents) > 0 {
			// Legacy migration safety:
			// Older saves may have large unlocked_talents lists that don't map cleanly to the
			// new ranked + budgeted system (1 point per 5 levels). If we blindly convert all
			// legacy unlocked IDs into ranks, players can appear to have 0 available points.
			//
			// If the legacy list exceeds the new budget, start them with a clean slate so
			// they can re-allocate under the new rules.
			budget := 0
			if entity.Level >= 5 {
				budget = entity.Level / 5
			}
			uniq := make(map[string]struct{}, len(char.UnlockedTalents))
			for _, tid := range char.UnlockedTalents {
				if tid == "" {
					continue
				}
				uniq[tid] = struct{}{}
			}
			if len(uniq) > budget {
				log.Printf("Legacy talent migration for %s: %d unlocked_talents exceeds budget %d at level %d; resetting talents to avoid 0 available points", c.username, len(uniq), budget, entity.Level)
				entity.TalentRanks = make(map[string]int)
			} else {
				entity.TalentRanks = make(map[string]int, len(uniq))
				for tid := range uniq {
					entity.TalentRanks[tid] = 1
				}
			}
		}
		// Sanitize ranks: only allow class-specific IDs and clamp to max rank.
		// TalentPoints are derived later during RecalculateStats().
		entity.NormalizeTalentRanks()
		// Helpful debug line for shipping confidence: shows what we loaded from DB.
		log.Printf("Login %s: TalentRanks=%d, TalentPoints=%d (Level=%d)", c.username, len(entity.TalentRanks), entity.TalentPoints, entity.Level)

		// Load Skill Runes
		if char.SkillRunes != nil {
			entity.SkillRunes = make(map[string]string, len(char.SkillRunes))
			for k, v := range char.SkillRunes {
				entity.SkillRunes[k] = v
			}
		}

		// Auto-Unlock Skills based on Level and Branch
		world.UpdateUnlockedSkills(entity)

		log.Printf("Login %s: Level %d, Branch %s, Unlocked %v",
			c.username, entity.Level, entity.SelectedBranch, entity.UnlockedSkills)

		// Convert DB Inventory to Game Inventory
		entity.Inventory = make([]game.Item, game.MaxInventorySize)
		if len(char.Inventory) > 0 {
			log.Printf("Loading inventory for %s: %d items", c.username, len(char.Inventory))
			// Fill slots sequentially for now (since DB doesn't store slot index)
			for i, dbItem := range char.Inventory {
				if i >= game.MaxInventorySize {
					break
				}
				// Fix for old items (Shards/Hearts missing MaxStack)
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
				}
				if name == "Eidolon Heart" {
					dbItem.Icon = "procedural:item:eidolon-heart"
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
				}
				if name == "Eidolon Shard" {
					dbItem.Icon = "procedural:item:eidolon-shard"
				}

				// Fix for old items (Missing Stack count)
				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         maxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Inventory[i] = loadedItem
			}
		}

		// Convert DB Stash to Game Stash
		entity.Stash = make([]game.Item, 0)
		if len(char.Stash) > 0 {
			entity.Stash = make([]game.Item, len(char.Stash))
			for i, dbItem := range char.Stash {
				// Fix for old items
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
				}
				if name == "Eidolon Heart" {
					dbItem.Icon = "procedural:item:eidolon-heart"
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
				}
				if name == "Eidolon Shard" {
					dbItem.Icon = "procedural:item:eidolon-shard"
				}

				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         maxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Stash[i] = loadedItem
			}
		}

		// Convert DB Buyback to Game Buyback
		entity.Buyback = make([]game.Item, 0)
		if len(char.Buyback) > 0 {
			entity.Buyback = make([]game.Item, len(char.Buyback))
			for i, dbItem := range char.Buyback {
				// Fix for old items
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
				}
				if name == "Eidolon Heart" {
					dbItem.Icon = "procedural:item:eidolon-heart"
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
				}
				if name == "Eidolon Shard" {
					dbItem.Icon = "procedural:item:eidolon-shard"
				}

				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         maxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Buyback[i] = loadedItem
			}
		}

		// Convert DB Equipment to Game Equipment
		entity.Equipment = make(map[string]game.Item)
		if len(char.Equipment) > 0 {
			for slot, dbItem := range char.Equipment {
				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}
				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             dbItem.Name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         dbItem.MaxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Equipment[slot] = loadedItem
			}
		}

		// Convert DB Quests to Game Quests
		if len(char.Quests) > 0 {
			entity.Quests = make([]game.Quest, len(char.Quests))
			for i, q := range char.Quests {
				entity.Quests[i] = game.Quest{
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
		entity.LastDailyQuest = char.LastDailyQuest

		// Fix for persistence issue: If we have quests but no date (or zero date), assume they are valid for today to prevent reset
		if len(entity.Quests) > 0 && entity.LastDailyQuest.IsZero() {
			log.Printf("Restoring LastDailyQuest for %s (was zero, setting to Now)", c.username)
			entity.LastDailyQuest = time.Now().UTC()
		}

		entity.RecalculateStats()
		world.AddEntity(entity)

		// Attempt to rejoin the persisted party (0.37.1).
		// The party may no longer exist (all members left / server restart) — fail silently.
		if char.PartyID != "" {
			if err := world.RejoinOrRestoreParty(playerID, char.PartyID); err != nil {
				log.Printf("Party rejoin for %s (party %s) skipped: %v", c.username, char.PartyID, err)
			} else {
				log.Printf("Player %s rejoined party %s on login", c.username, char.PartyID)
			}
		}

		// Generate Daily Quests if needed
		world.GenerateDailyQuests(playerID)
		refreshChatBlocks(c.username)

		sendInitialPlayerState(c, entity, instanceID)
		// Notify online friends that this player has come online (0.38.1).
		go notifyFriendsPresence(c.username, true)

	case MsgEnterDungeon:
		if c.playerID == "" {
			return
		}

		var req struct {
			DungeonType string `json:"dungeonType"`
			Difficulty  string `json:"difficulty"`
			RunLevel    int    `json:"runLevel"`
		}
		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &req)
		}
		dungeonType := req.DungeonType
		if dungeonType == "" {
			dungeonType = "crypt"
		}

		// Parse difficulty
		difficulty := game.DifficultyNormal
		switch req.Difficulty {
		case "heroic":
			difficulty = game.DifficultyHeroic
		case "mythic":
			difficulty = game.DifficultyMythic
		}

		runLevel := req.RunLevel
		if runLevel == 0 {
			runLevel = game.DungeonUnlockLevel
		}
		run, members, err := world.EnterPartyDungeon(c.playerID, dungeonType, difficulty, runLevel)
		if err != nil {
			c.sendError(err.Error())
			return
		}
		sendDungeonEntry(run, members)

	case MsgGetDungeonStatus:
		if c.playerID == "" {
			return
		}

		var statusReq struct {
			DungeonType string `json:"dungeonType"`
		}
		if len(msg.Payload) > 0 {
			_ = json.Unmarshal(msg.Payload, &statusReq)
		}
		player := world.GetEntityCopy(c.playerID)
		if player == nil {
			return
		}

		// Auto-create party for solo players
		if player.PartyID == "" {
			party := world.CreateParty(c.playerID)
			if party != nil {
				broadcastPartyUpdate(party)
				// Update local player copy's PartyID
				player.PartyID = party.ID
			} else {
				// Check if failure was due to race condition (already in party)
				updatedPlayer := world.GetEntityCopy(c.playerID)
				if updatedPlayer != nil && updatedPlayer.PartyID != "" {
					player.PartyID = updatedPlayer.PartyID
				} else {
					// DEBUG: Detailed failure reason
					exists := false
					pid := "nil"
					if updatedPlayer != nil {
						exists = true
						pid = updatedPlayer.PartyID
					}
					c.sendError(fmt.Sprintf("Failed to create party. Exists: %v, PID: %s, ID: %s", exists, pid, c.playerID))
					return
				}
			}
		}

		hasInstance, timeLeft := world.GetDungeonStatus(player.PartyID)

		// Check if leader
		party := world.GetParty(player.PartyID)
		isLeader := false
		if party != nil {
			_, leaderID, _ := party.GetSnapshot()
			isLeader = (leaderID == c.playerID)
		}

		resp := map[string]interface{}{
			"hasInstance":                  hasInstance,
			"timeLeft":                     timeLeft,
			"isLeader":                     isLeader,
			"playerLevel":                  player.Level,
			"maxPlayerLevel":               game.MaxPlayerLevel,
			"dungeonUnlockLevel":           game.DungeonUnlockLevel,
			"endgameDifficultyUnlockLevel": game.EndgameDifficultyUnlockLevel,
			"availableRunLevels":           game.AvailableDungeonRunLevelsForPlayer(player.Level),
		}
		crystalsRestored, darkRealmOpen, darkKingDefeated := game.ChronicleAccessStatus(player)
		resp["crystalsRestored"] = crystalsRestored
		resp["darkRealmOpen"] = darkRealmOpen
		resp["darkKingDefeated"] = darkKingDefeated
		resp["elementalRaidAccess"] = game.ElementalRaidAccessForPlayer(player)
		if statusReq.DungeonType != "" {
			resp["dungeonType"] = statusReq.DungeonType
		}
		if run, exists := world.GetPartyDungeonRun(player.PartyID); exists {
			resp["activeRun"] = run
		}
		payloadBytes, _ := json.Marshal(resp)
		log.Printf("Sending Dungeon Menu to %s: %+v", c.username, resp)
		c.sendSafe(createMessage(MsgGetDungeonStatus, payloadBytes))
		// c.sendError(fmt.Sprintf("Debug: Menu Data Sent. Party: %s, Leader: %v", player.PartyID, isLeader))

	case MsgResetDungeon:
		if c.playerID == "" {
			return
		}
		player := world.GetEntityCopy(c.playerID)
		if player == nil || player.PartyID == "" {
			return
		}

		party := world.GetParty(player.PartyID)
		if party == nil {
			return
		}
		_, leaderID, _ := party.GetSnapshot()
		if leaderID != c.playerID {
			c.sendError("Only the party leader can reset the dungeon.")
			return
		}

		if err := world.ResetDungeon(player.PartyID); err != nil {
			c.sendError(err.Error())
			return
		}
		c.sendSystemChat("Dungeon reset.")

	case MsgResumeSession:
		// Client sends: { "token": "<64-char hex>" }
		var payload struct {
			Token string `json:"token"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil || payload.Token == "" {
			c.sendError("Invalid resume_session payload")
			return
		}

		username, ok := validateAndConsumeResumeToken(payload.Token)
		if !ok {
			c.sendError("Session token invalid or expired. Please log in again.")
			return
		}

		// Clear the disconnected flag; this also returns the live entity pointer.
		playerID := "player-" + username
		entity, ok := world.ClearEntityDisconnected(playerID)
		if !ok {
			// Entity already swept or was never disconnected — fall back to normal login.
			c.sendError("No resumable session found. Please log in and join normally.")
			return
		}

		// Bind this new client to the existing entity.
		c.username = username
		c.playerID = playerID

		sessionsMu.Lock()
		// Kick any stale session for this username (shouldn't exist, but be safe).
		if old, exists := activeSessions[username]; exists && old != c {
			go func(old *Client) {
				defer func() { recover() }()
				old.sendError("Logged in from another location")
				time.Sleep(100 * time.Millisecond)
				old.conn.Close()
			}(old)
		}
		activeSessions[username] = c
		sessionsMu.Unlock()

		// Issue a fresh resume token for the next disconnect.
		newToken, err := issueResumeToken(username)
		if err != nil {
			log.Printf("Failed to re-issue resume token for %s: %v", username, err)
			newToken = ""
		}

		// Notify the client that the session resumed successfully.
		resumeResp := map[string]interface{}{
			"playerID":    playerID,
			"resumeToken": newToken,
		}
		resumePayload, _ := json.Marshal(resumeResp)
		resumeMsg := Message{Type: MsgResumeSession, Payload: resumePayload}
		b, _ := json.Marshal(resumeMsg)
		c.sendSafe(b)

		// Re-send all initial state so the client can repopulate its UI.
		world.GenerateDailyQuests(playerID)
		refreshChatBlocks(c.username)
		instanceID := entity.InstanceID
		sendInitialPlayerState(c, entity, instanceID)

		log.Printf("Session resumed: %s (playerID: %s)", username, playerID)

	case MsgMove:
		if c.playerID == "" {
			return
		}
		var payload MovePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		world.UpdatePlayerMovementWithContext(
			c.playerID, payload.X, payload.Y, payload.Z, payload.Rotation,
			payload.State, payload.Sequence, payload.MovementContext,
		)

	case MsgJump:
		if c.playerID == "" {
			return
		}
		var payload JumpPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		world.StartPlayerJumpWithContext(c.playerID, payload.X, payload.Y, payload.Z, payload.MovementContext)

	case MsgAttack:
		if c.playerID == "" {
			return
		}
		var payload AttackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.PerformAttack(c.playerID, payload.TargetID)
		// Damage is now broadcast via OnEvent("damage") asynchronously

	case MsgPickup:
		if c.playerID == "" {
			return
		}
		var payload PickupPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, reason := world.PerformPickup(c.playerID, payload.LootID)
		if success {
			// Send inventory update to player
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			savePlayer(c)
		} else if reason == "inventory_full" {
			c.sendError("Inventory full")
		}

	case MsgAbility:
		if c.playerID == "" {
			return
		}
		var payload AbilityPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		result := world.PerformAbility(c.playerID, payload.TargetX, payload.TargetZ, payload.TargetID, payload.SkillName)
		resultPayload, _ := json.Marshal(result)
		resultMessage, _ := json.Marshal(Message{Type: MsgAbilityResult, Payload: resultPayload})
		c.sendSafe(resultMessage)

	case MsgChat:
		if c.username == "" {
			return
		}
		var payload ChatPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if handled := c.handleChatCommand(strings.TrimSpace(payload.Message)); handled {
			return
		}
		if handled, err := chatService.HandleModerationCommand(c, strings.TrimSpace(payload.Message)); handled {
			if err != nil {
				c.sendError(err.Error())
			}
			return
		}

		if err := chatService.Send(c, payload); err != nil {
			c.sendError(err.Error())
		}

	case MsgEquip:
		if c.playerID == "" {
			return
		}
		var payload EquipPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformEquip(c.playerID, payload.ItemID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgUnequip:
		if c.playerID == "" {
			return
		}
		var payload UnequipPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformUnequip(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgInventoryDrop:
		var payload InventoryDropPayload
		if c.playerID == "" || json.Unmarshal(msg.Payload, &payload) != nil {
			return
		}
		inventory, err := world.PerformInventoryDrop(c.playerID, payload.Index, payload.ItemID)
		if err != nil {
			c.sendError(err.Error())
			return
		}
		invPayload, _ := json.Marshal(inventory)
		response, _ := json.Marshal(Message{Type: MsgInventory, Payload: invPayload})
		c.sendSafe(response)
		savePlayer(c)

	case MsgInventoryMove:
		if c.playerID == "" {
			return
		}
		var payload InventoryMovePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformInventoryMove(c.playerID, payload.FromIndex, payload.ToIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgInventorySort:
		if c.playerID == "" {
			return
		}

		player, success := world.PerformInventorySort(c.playerID)
		if success {
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgSplitStack:
		if c.playerID == "" {
			return
		}
		var payload SplitStackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformSplitStack(c.playerID, payload.Slot, payload.Amount)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgTradingSearch:
		handleMsgTradingSearch(c, msg)

	case MsgTradingMyAuctions:
		handleMsgTradingMyAuctions(c, msg)

	case MsgTradingCreate:
		handleMsgTradingCreate(c, msg)

	case MsgTradingBid:
		handleMsgTradingBid(c, msg)

	case MsgTradingBuyout:
		handleMsgTradingBuyout(c, msg)

	case MsgTradingCollect:
		handleMsgTradingCollect(c, msg)

	case MsgTradingCancel:
		handleMsgTradingCancel(c, msg)

	case MsgTradeRequest:
		handleDirectTradeRequest(c, msg)

	case MsgTradeOffer:
		handleDirectTradeOffer(c, msg)

	case MsgTradeConfirm:
		handleDirectTradeConfirm(c, msg)

	case MsgTradeCancel:
		handleDirectTradeCancel(c, msg)

	case MsgBuyGamble:
		if c.playerID == "" {
			return
		}
		var payload BuyGamblePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformBuyGamble(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgSell:
		if c.playerID == "" {
			return
		}
		var payload SellPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformSell(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)

			// Send Buyback Update
			buybackPayload, _ := json.Marshal(player.Buyback)
			msgBuyback := Message{
				Type:    MsgBuybackList,
				Payload: buybackPayload,
			}
			bBuyback, _ := json.Marshal(msgBuyback)
			c.sendSafe(bBuyback)
		}

	case MsgBuyback:
		if c.playerID == "" {
			return
		}
		var payload BuybackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformBuyback(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Buyback Update
			buybackPayload, _ := json.Marshal(player.Buyback)
			msgBuyback := Message{
				Type:    MsgBuybackList,
				Payload: buybackPayload,
			}
			bBuyback, _ := json.Marshal(msgBuyback)
			c.sendSafe(bBuyback)
		}

	case MsgPartyInvite:
		handleMsgPartyInvite(c, msg)

	case MsgPartyResponse:
		handleMsgPartyResponse(c, msg)

	case MsgPartyLeave:
		handleMsgPartyLeave(c, msg)

	case MsgPartyKick:
		handleMsgPartyKick(c, msg)

	case MsgPartyPromote:
		handleMsgPartyPromote(c, msg)

	case MsgPartyReadyCheck:
		handleMsgPartyReadyCheck(c, msg)

	case MsgPartyReady:
		handleMsgPartyReady(c, msg)

	case MsgPartyLootRule:
		handleMsgPartyLootRule(c, msg)

	case MsgSocial:
		handleMsgSocial(c, msg)

	case MsgSocialStatus:
		handleMsgSocialStatus(c, msg)

	// ── Friends (0.38) ──────────────────────────────────────────────────────────

	case MsgFriendList:
		handleMsgFriendList(c, msg)

	case MsgFriendRequest:
		handleMsgFriendRequest(c, msg)

	case MsgFriendAccept:
		handleMsgFriendAccept(c, msg)

	case MsgFriendDecline:
		handleMsgFriendDecline(c, msg)

	case MsgFriendRemove:
		handleMsgFriendRemove(c, msg)

	case MsgGuildGet:
		handleMsgGuildGet(c, msg)

	case MsgGuildCreate:
		handleMsgGuildCreate(c, msg)

	case MsgGuildInvite:
		handleMsgGuildInvite(c, msg)

	case MsgGuildRespond:
		handleMsgGuildRespond(c, msg)

	case MsgGuildLeave:
		handleMsgGuildLeave(c, msg)

	case MsgGuildKick:
		handleMsgGuildKick(c, msg)

	case MsgGuildSetRank:
		handleMsgGuildSetRank(c, msg)

	case MsgGuildTransfer:
		handleMsgGuildTransfer(c, msg)

	case MsgGuildSetMOTD:
		handleMsgGuildSetMOTD(c, msg)

	case MsgGuildDisband:
		handleMsgGuildDisband(c, msg)

	case MsgGuildClaimLeader:
		handleMsgGuildClaimLeader(c, msg)

	case MsgGuildBankDeposit:
		handleMsgGuildBankDeposit(c, msg)

	case MsgGuildBankWithdraw:
		handleMsgGuildBankWithdraw(c, msg)

	case MsgGuildLeaderboard:
		handleMsgGuildLeaderboard(c, msg)

	case MsgDuelRequest:
		handleMsgDuelRequest(c, msg)

	case MsgDuelRespond:
		handleMsgDuelRespond(c, msg)

	case MsgArenaQueue:
		handleMsgArenaQueue(c, msg)

	case MsgArenaLeave:
		handleMsgArenaLeave(c, msg)

	case MsgPvPGet:
		handleMsgPvPGet(c, msg)

	case MsgPvPLeaderboard:
		handleMsgPvPLeaderboard(c, msg)

	case MsgPvPFlag:
		handleMsgPvPFlag(c, msg)

	case MsgEndgameGet:
		handleMsgEndgameGet(c, msg)

	case MsgEndgameSpend:
		handleMsgEndgameSpend(c, msg)

	case MsgRaidConvert:
		handleMsgRaidConvert(c, msg)

	case MsgRaidEnter:
		handleMsgRaidEnter(c, msg)

	case MsgRespawn:
		if c.playerID == "" {
			return
		}
		var recovery TownRecoveryPayload
		if len(msg.Payload) > 0 && json.Unmarshal(msg.Payload, &recovery) != nil {
			c.sendError("Invalid recovery request")
			return
		}

		// Check if in instance before respawn resets it
		p := world.GetEntity(c.playerID)
		wasInInstance := p != nil && p.InstanceID != ""

		if err := world.PerformRespawn(c.playerID, recovery.MovementContext); err != nil {
			c.sendError(err.Error())
			return
		}
		sendMovementContext(c)

		if wasInInstance {
			log.Printf("Respawn: Sending return to overworld for %s", c.playerID)
			// Send "return to overworld" message
			resp := map[string]interface{}{
				"instanceId": "",
				"type":       "overworld",
			}
			payloadBytes, _ := json.Marshal(resp)
			msg := Message{
				Type:    MsgEnterInstance,
				Payload: payloadBytes,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			// Auto-revert social status: available (0.37.4)
			autoSetSocialStatus(c, c.playerID, "available")
		}

	case MsgRecall:
		if c.playerID == "" {
			return
		}
		var recovery TownRecoveryPayload
		if len(msg.Payload) > 0 && json.Unmarshal(msg.Payload, &recovery) != nil {
			c.sendError("Invalid recovery request")
			return
		}

		// Check if in instance before recall resets it
		p := world.GetEntity(c.playerID)
		wasInInstance := p != nil && p.InstanceID != ""

		if err := world.PerformRecall(c.playerID, recovery.MovementContext); err != nil {
			c.sendError(err.Error())
			return
		}
		sendMovementContext(c)

		if wasInInstance {
			log.Printf("Recall: Sending return to overworld for %s", c.playerID)
			// Send "return to overworld" message
			resp := map[string]interface{}{
				"instanceId": "",
				"type":       "overworld",
			}
			payloadBytes, _ := json.Marshal(resp)
			msg := Message{
				Type:    MsgEnterInstance,
				Payload: payloadBytes,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			// Auto-revert social status: available (0.37.4)
			autoSetSocialStatus(c, c.playerID, "available")
		}

	case MsgReport:
		var payload ReportPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if err := saveReport(c.username, payload); err != nil {
			c.sendError("Report submission failed")
			return
		}
		c.sendSystemChat("Report submitted successfully.")

	case MsgStashDeposit:
		if c.playerID == "" {
			return
		}
		var payload StashDepositPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformStashDeposit(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Stash Update
			stashPayload, _ := json.Marshal(player.Stash)
			msgStash := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			bStash, _ := json.Marshal(msgStash)
			c.sendSafe(bStash)
		}

	case MsgStashWithdraw:
		if c.playerID == "" {
			return
		}
		var payload StashWithdrawPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformStashWithdraw(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Stash Update
			stashPayload, _ := json.Marshal(player.Stash)
			msgStash := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			bStash, _ := json.Marshal(msgStash)
			c.sendSafe(bStash)
		}

	case MsgRequestQuests:
		if c.playerID == "" {
			return
		}
		player := world.GenerateDailyQuests(c.playerID)
		if player != nil {
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{Type: MsgQuestUpdate, Payload: questPayload}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgAcceptQuest:
		if c.playerID == "" {
			return
		}
		var payload AcceptQuestPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformAcceptQuest(c.playerID, payload.QuestID)
		if !success {
			c.sendError("Speak to the correct quest giver in town to accept an available quest.")
		}
		if success {
			// Send Quest Update
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgCompleteQuest:
		if c.playerID == "" {
			return
		}
		var payload CompleteQuestPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformCompleteQuest(c.playerID, payload.QuestID)
		if !success {
			c.sendError("Return to the correct quest giver with all objectives and required items to complete this quest.")
		}
		if success {
			// Collection turn-ins consume physical items. Publish the authoritative
			// bag before the completion UI can show the next chapter, without
			// reading inventory or quest slices while another action mutates them.
			world.Mu.RLock()
			player.Mu.RLock()
			invPayload, _ := json.Marshal(player.Inventory)
			questPayload, _ := json.Marshal(player.Quests)
			player.Mu.RUnlock()
			world.Mu.RUnlock()
			c.sendSafe(createMessage(MsgInventory, invPayload))
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			sendEndgameState(c)
		}

	case MsgForgeUpgrade:
		if c.playerID == "" {
			return
		}
		var payload ForgeUpgradePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeUpgrade(c.playerID, payload.Slot, payload.Amount)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgePotency:
		if c.playerID == "" {
			return
		}
		var payload ForgePotencyPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgePotency(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeSocket:
		if c.playerID == "" {
			return
		}
		var payload ForgeSocketPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeSocket(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeInsertGem:
		if c.playerID == "" {
			return
		}
		var payload ForgeInsertGemPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeInsertGem(c.playerID, payload.EquipSlot, payload.GemInvIndex, payload.SocketIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			savePlayer(c) // Persist gem insertion
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeCombineGem:
		if c.playerID == "" {
			return
		}
		var payload ForgeCombineGemPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeCombineGems(c.playerID, payload.GemIndices)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			savePlayer(c) // Persist gem combining
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeRemoveGem:
		if c.playerID == "" {
			return
		}
		var payload ForgeRemoveGemPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeRemoveGem(c.playerID, payload.EquipSlot, payload.SocketIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			savePlayer(c) // Persist gem removal
		} else {
			c.sendError(msgStr)
		}

	case MsgSelectBranch:
		requestID, valid := c.buildRequestID(msg)
		if !valid {
			return
		}
		if c.playerID == "" {
			return
		}
		var payload SelectBranchPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success := world.PerformSelectBranch(c.playerID, payload.Branch); success {
			c.sendBuildActionResult(requestID, true, "Specialization selected")
			savePlayer(c) // Persist immediately
		} else {
			c.sendBuildActionResult(requestID, false, "Choose a valid specialization for your character")
		}

	case MsgUnlockSkill:
		if c.playerID == "" {
			return
		}
		var payload UnlockSkillPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success := world.PerformUnlockSkill(c.playerID, payload.SkillName); success {
			savePlayer(c) // Persist immediately
		}

	case MsgUnlockTalent:
		requestID, valid := c.buildRequestID(msg)
		if !valid {
			return
		}
		if c.playerID == "" {
			return
		}
		var payload UnlockTalentPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success, msgStr := world.PerformUnlockTalent(c.playerID, payload.TalentId); success {
			c.sendBuildActionResult(requestID, true, "Talent rank added")
			savePlayer(c) // Persist immediately
		} else {
			c.sendBuildActionResult(requestID, false, msgStr)
		}

	case MsgResetTalents:
		requestID, valid := c.buildRequestID(msg)
		if !valid {
			return
		}
		if c.playerID == "" {
			return
		}
		if _, success, msgStr := world.PerformResetTalents(c.playerID); success {
			c.sendBuildActionResult(requestID, true, "Talent ranks reset")
			savePlayer(c) // Persist immediately
		} else {
			c.sendBuildActionResult(requestID, false, msgStr)
		}

	case MsgRespec:
		if c.playerID == "" {
			return
		}
		var payload RespecPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			c.sendError("Invalid respec payload")
			return
		}
		if player, success, msgStr := world.PerformRespec(c.playerID, payload.RespecType); success {
			// Send Inventory Update (includes gold)
			player.Mu.RLock()
			invPayload, _ := json.Marshal(player.Inventory)
			player.Mu.RUnlock()
			invMsg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(invMsg)
			c.sendSafe(b)
			savePlayer(c) // Persist immediately
		} else {
			c.sendError(msgStr)
		}

	case MsgRespecCost:
		if c.playerID == "" {
			return
		}
		var payload RespecPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			c.sendError("Invalid respec payload")
			return
		}
		cost := world.GetRespecCost(c.playerID, payload.RespecType)
		// Send cost response
		response := map[string]interface{}{
			"type":      payload.RespecType,
			"cost":      cost,
			"canAfford": false,
		}
		if player := world.GetEntity(c.playerID); player != nil {
			player.Mu.RLock()
			response["canAfford"] = player.Gold >= cost
			player.Mu.RUnlock()
		}
		respBytes, _ := json.Marshal(response)
		costMsg := Message{
			Type:    MsgRespecCost,
			Payload: respBytes,
		}
		msgBytes, _ := json.Marshal(costMsg)
		c.sendSafe(msgBytes)

	case MsgSelectRune:
		requestID, valid := c.buildRequestID(msg)
		if !valid {
			return
		}
		if c.playerID == "" {
			return
		}
		var payload struct {
			Skill  string `json:"skill"`
			RuneID string `json:"runeId"` // Empty string to unequip
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			c.sendBuildActionResult(requestID, false, "Invalid rune payload")
			return
		}

		player := world.GetEntity(c.playerID)
		if player == nil {
			return
		}

		player.Mu.Lock()
		// Validate the rune if one is being equipped
		if payload.RuneID != "" {
			runeDef, ok := game.GetRuneDef(payload.RuneID)
			if !ok {
				player.Mu.Unlock()
				c.sendBuildActionResult(requestID, false, "Invalid rune ID")
				return
			}
			// Check level requirement
			if player.Level < runeDef.UnlockLevel {
				player.Mu.Unlock()
				c.sendBuildActionResult(requestID, false, fmt.Sprintf("You need to be level %d to use this rune", runeDef.UnlockLevel))
				return
			}
			// Check that the rune matches the skill
			if runeDef.Skill != payload.Skill {
				player.Mu.Unlock()
				c.sendBuildActionResult(requestID, false, "This rune doesn't work with that skill")
				return
			}
			// Verify player has this skill unlocked
			hasSkill := false
			for _, s := range player.UnlockedSkills {
				if s == payload.Skill {
					hasSkill = true
					break
				}
			}
			if !hasSkill {
				player.Mu.Unlock()
				c.sendBuildActionResult(requestID, false, "You don't have this skill unlocked")
				return
			}
		}

		// Initialize map if needed
		if player.SkillRunes == nil {
			player.SkillRunes = make(map[string]string)
		}

		// Set or clear the rune
		if payload.RuneID == "" {
			delete(player.SkillRunes, payload.Skill)
		} else {
			player.SkillRunes[payload.Skill] = payload.RuneID
		}
		player.Mu.Unlock()

		// Send updated runes to client
		player.Mu.RLock()
		runesPayload, _ := json.Marshal(map[string]interface{}{
			"skillRunes": player.SkillRunes,
		})
		player.Mu.RUnlock()
		runeMsg := Message{
			Type:    MsgSelectRune,
			Payload: runesPayload,
		}
		b, _ := json.Marshal(runeMsg)
		c.sendSafe(b)
		c.sendBuildActionResult(requestID, true, "Rune updated")
		savePlayer(c)

	case MsgGetRunes:
		if c.playerID == "" {
			return
		}
		player := world.GetEntity(c.playerID)
		if player == nil {
			return
		}

		player.Mu.RLock()
		classType := player.SubType
		level := player.Level
		equippedRunes := player.SkillRunes
		player.Mu.RUnlock()

		// Get all available runes for this class
		allRunes := game.GetAllRunesForClass(classType)
		unlockedRunes := game.GetUnlockedRunes(classType, level)

		response := map[string]interface{}{
			"allRunes":      allRunes,
			"unlockedRunes": unlockedRunes,
			"equippedRunes": equippedRunes,
		}
		respBytes, _ := json.Marshal(response)
		runeMsg := Message{
			Type:    MsgGetRunes,
			Payload: respBytes,
		}
		msgBytes, _ := json.Marshal(runeMsg)
		c.sendSafe(msgBytes)
	}
}
