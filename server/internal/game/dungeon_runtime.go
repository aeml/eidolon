package game

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"
)

func (w *World) CreateDungeon(partyID string, dungeonType string, difficulty DungeonDifficulty, runLevel int) string {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	// A party owns at most one live dungeon. Re-entry resumes its authoritative
	// room state; only an explicit reset or the empty-instance timeout creates a
	// fresh run. This closes an orphan-instance and repeat-reward abuse path.
	for id, inst := range w.dungeonInstancesSnapshot() {
		inst.Mu.RLock()
		matchesParty := inst.PartyID == partyID
		expired := matchesParty && !inst.EmptySince.IsZero() && time.Since(inst.EmptySince) > 5*time.Minute
		inst.Mu.RUnlock()
		if !matchesParty {
			continue
		}
		if expired {
			w.cleanupInstanceLocked(id)
			continue
		}
		return id
	}

	// Default to normal if not specified
	if difficulty == "" {
		difficulty = DifficultyNormal
	}

	instanceID := fmt.Sprintf("dungeon_%s_%d_%d", partyID, time.Now().UnixNano(), rand.Intn(10000))

	if runLevel == 0 {
		runLevel = DungeonUnlockLevel
	}

	dungeon := &DungeonInstance{
		ID:                instanceID,
		PartyID:           partyID,
		CreatedAt:         time.Now(),
		EmptySince:        time.Now(),
		Difficulty:        difficulty,
		DungeonType:       dungeonType,
		RunLevel:          runLevel,
		PlayerRoomSummary: make(map[string]DungeonRoomSummary),
	}
	// Register before generation so shared enemy builders can read the selected
	// run level while they create encounters.
	w.storeDungeonInstance(instanceID, dungeon)
	buildLayout := func(generator func(string, DungeonDifficulty) DungeonLayout) DungeonLayout {
		const maxLayoutAttempts = 8
		cleanupGeneratedEntities := func() {
			toRemove := []string{}
			for id, entity := range w.Entities {
				if entity.InstanceID == instanceID {
					toRemove = append(toRemove, id)
				}
			}
			for _, id := range toRemove {
				if entity, ok := w.Entities[id]; ok {
					w.Grid.Remove(entity)
					delete(w.Entities, id)
				}
			}
		}
		var lastLayout DungeonLayout
		var lastErr error
		for attempt := 0; attempt < maxLayoutAttempts; attempt++ {
			lastLayout = generator(instanceID, difficulty)
			lastErr = ValidateDungeonLayout(lastLayout)
			if lastErr == nil {
				assignDungeonRoomHooks(&lastLayout)
				return lastLayout
			}
			cleanupGeneratedEntities()
		}
		log.Printf("CreateDungeon: failed to generate valid %s layout for instance %s after %d attempts: %v", dungeonType, instanceID, maxLayoutAttempts, lastErr)
		layout := fallbackDungeonLayout(dungeonType)
		assignDungeonRoomHooks(&layout)
		return layout
	}

	if dungeonType == "verdant_bastion_catacombs" {
		layout := buildLayout(w.generateVerdantBastionLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.storeDungeonInstance(instanceID, dungeon)
	} else if dungeonType == "molten_core" {
		layout := buildLayout(w.generateMoltenCoreLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.storeDungeonInstance(instanceID, dungeon)
	} else if dungeonType == "tempest_spire" {
		layout := buildLayout(w.generateTempestSpireLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.storeDungeonInstance(instanceID, dungeon)
	} else if dungeonType == "abyssal_well" {
		layout := buildLayout(w.generateAbyssalWellLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
	} else if dungeonType == "umbral_nexus" {
		layout := buildLayout(w.generateUmbralNexusLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
	} else if dungeonType == "weekly_raid" {
		layout := buildLayout(w.generateWeeklyRaidLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
	} else if _, elementalRaid := ElementalRaidDefinitionForType(dungeonType); elementalRaid {
		layout := buildLayout(func(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
			return w.generateElementalRaidLayout(instanceID, difficulty, dungeonType)
		})
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
	} else {
		// Default Crypt
		// Generate a simple layout for the crypt too, so we have a start point
		layout := fallbackDungeonLayout(dungeonType)
		assignDungeonRoomHooks(&layout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.storeDungeonInstance(instanceID, dungeon)

		// Spawn Dungeon Entities (Example: 20 Skeletons)
		for i := 0; i < 20; i++ {
			x := (rand.Float64() * 40) - 20
			z := (rand.Float64() * 40) - 20
			w.spawnEnemyInInstance("Skeleton", x, z, instanceID, difficulty)
		}
	}

	return instanceID
}

func (w *World) ResetDungeon(partyID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	for id, inst := range w.dungeonInstancesSnapshot() {
		inst.Mu.RLock()
		matchesParty := inst.PartyID == partyID
		inst.Mu.RUnlock()
		if matchesParty {
			w.cleanupInstanceLocked(id)
			return
		}
	}
}

func (w *World) GetDungeonStatus(partyID string) (bool, float64) {
	for _, inst := range w.dungeonInstancesSnapshot() {
		inst.Mu.RLock()
		if inst.PartyID == partyID {
			timeLeft := 0.0
			if !inst.EmptySince.IsZero() {
				elapsed := time.Since(inst.EmptySince)
				if elapsed >= 5*time.Minute {
					inst.Mu.RUnlock()
					return false, 0
				}
				timeLeft = (5 * time.Minute).Seconds() - elapsed.Seconds()
			}
			inst.Mu.RUnlock()
			return true, timeLeft
		}
		inst.Mu.RUnlock()
	}
	return false, 0
}

func (w *World) GetInstanceLayout(instanceID string) (DungeonLayout, bool) {
	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return DungeonLayout{}, false
	}
	inst.Mu.RLock()
	defer inst.Mu.RUnlock()
	return cloneDungeonLayout(inst.Layout), true
}

// GetInstanceDifficulty returns the difficulty of a dungeon instance
func (w *World) GetInstanceDifficulty(instanceID string) DungeonDifficulty {
	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return DifficultyNormal
	}
	inst.Mu.RLock()
	defer inst.Mu.RUnlock()
	return inst.Difficulty
}

// GetInstanceType returns the dungeon type of an instance
func (w *World) GetInstanceType(instanceID string) string {
	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return ""
	}
	inst.Mu.RLock()
	defer inst.Mu.RUnlock()
	return inst.DungeonType
}

func (w *World) getInstanceRunLevelUnsafe(instanceID string) int {
	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return DungeonUnlockLevel
	}
	inst.Mu.RLock()
	defer inst.Mu.RUnlock()
	if inst.RunLevel <= 0 {
		return DungeonUnlockLevel
	}
	return inst.RunLevel
}

func (w *World) GetInstanceRunLevel(instanceID string) int {
	return w.getInstanceRunLevelUnsafe(instanceID)
}

func (w *World) UpdateDungeonRoomProgress(playerID string, x, z float64) {
	w.Mu.RLock()
	player, ok := w.Entities[playerID]
	w.Mu.RUnlock()
	if !ok {
		return
	}
	player.Mu.RLock()
	instanceID := player.InstanceID
	player.Mu.RUnlock()
	if instanceID == "" {
		return
	}
	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return
	}
	inst.Mu.Lock()
	defer inst.Mu.Unlock()
	if inst.RoomState == nil {
		return
	}
	inst.RoomState.MarkExploredAt(x, z)
	inst.PlayerRoomSummary[playerID] = withDungeonSummaryContext(inst.RoomState.Summary(x, z), inst.Difficulty, inst.RunLevel)
}

// markDungeonRoomClearedIfDefeated connects authoritative combat deaths to the
// room progression/reward system. Enemy spawn positions are used instead of
// current positions because a chased enemy can die in a corridor or a later
// room without changing which encounter owns it.
func (w *World) markDungeonRoomClearedIfDefeated(instanceID, defeatedEnemyID string, spawnX, spawnZ float64) bool {
	if instanceID == "" {
		return false
	}

	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return false
	}
	inst.Mu.RLock()
	if inst.RoomState == nil {
		inst.Mu.RUnlock()
		return false
	}
	layout := cloneDungeonLayout(inst.Layout)
	roomIndex := inst.RoomState.CurrentRoomIndexForPosition(spawnX, spawnZ)
	if roomIndex < 0 || roomIndex >= len(layout.Rooms) || layout.Rooms[roomIndex].Type == "start" {
		inst.Mu.RUnlock()
		return false
	}
	inst.Mu.RUnlock()

	w.Mu.RLock()
	candidates := make([]*Entity, 0)
	for id, entity := range w.Entities {
		if id == defeatedEnemyID || entity == nil {
			continue
		}
		candidates = append(candidates, entity)
	}
	w.Mu.RUnlock()

	for _, entity := range candidates {
		entity.Mu.RLock()
		isLivingEncounterEnemy := entity.Type == TypeEnemy &&
			entity.InstanceID == instanceID &&
			entity.State != "DEAD" &&
			entity.Health > 0
		candidateSpawnX := entity.SpawnX
		candidateSpawnZ := entity.SpawnZ
		entity.Mu.RUnlock()
		if !isLivingEncounterEnemy {
			continue
		}

		candidateRoomIndex := -1
		for idx, room := range layout.Rooms {
			halfW := room.Width / 2
			halfH := room.Height / 2
			if candidateSpawnX >= room.X-halfW && candidateSpawnX <= room.X+halfW &&
				candidateSpawnZ >= room.Z-halfH && candidateSpawnZ <= room.Z+halfH {
				candidateRoomIndex = idx
				break
			}
		}
		if candidateRoomIndex == roomIndex {
			return false
		}
	}

	w.MarkDungeonRoomCleared(instanceID, roomIndex)
	return true
}

func (w *World) MarkDungeonRoomCleared(instanceID string, roomIndex int) {
	// Snapshot entity pointers before taking the instance lock. The lock order is
	// world/registry -> instance -> entity; instance code must never reacquire the
	// world lock while holding an instance lock.
	w.Mu.RLock()
	entities := make([]*Entity, 0, len(w.Entities))
	for _, entity := range w.Entities {
		entities = append(entities, entity)
	}
	w.Mu.RUnlock()

	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return
	}
	inst.Mu.Lock()
	if inst.RoomState == nil {
		inst.Mu.Unlock()
		return
	}
	if roomIndex < 0 || roomIndex >= len(inst.Layout.Rooms) || roomIndex >= len(inst.RoomState.Rooms) {
		inst.Mu.Unlock()
		return
	}

	room := inst.Layout.Rooms[roomIndex]
	progress := inst.RoomState.Rooms[roomIndex]
	if progress.Cleared {
		inst.Mu.Unlock()
		return
	}

	inst.RoomState.MarkRoomCleared(roomIndex)
	for playerID := range inst.PlayerRoomSummary {
		inst.PlayerRoomSummary[playerID] = withDungeonSummaryContext(inst.RoomState.Summary(0, 0), inst.Difficulty, inst.RunLevel)
	}
	roomsCleared := 0
	eliteRoomsCleared := 0
	totalRooms := 0
	totalEliteRooms := 0
	for idx, layoutRoom := range inst.Layout.Rooms {
		if layoutRoom.Type == "start" {
			continue
		}
		totalRooms++
		if layoutRoom.Type == "elite" {
			totalEliteRooms++
		}
		if idx < len(inst.RoomState.Rooms) && inst.RoomState.Rooms[idx].Cleared {
			roomsCleared++
			if layoutRoom.Type == "elite" {
				eliteRoomsCleared++
			}
		}
	}

	shouldReward := room.Type != "start" && room.Type != "boss" && !progress.Rewarded
	playerRewards := make([]DungeonRoomClearRewardEvent, 0)
	if shouldReward {
		inst.RoomState.Rooms[roomIndex].Rewarded = true
		objectiveRoomIndex := inst.RoomState.ObjectiveRoomIndex()
		rewardScale := 1.0
		if room.Type == "elite" {
			rewardScale = 1.5
		}
		if room.Hook == "chest" {
			rewardScale += 0.35
		}
		if room.Hook == "elite_ambush" {
			rewardScale += 0.45
		}
		for _, entity := range entities {
			if entity == nil {
				continue
			}
			entity.Mu.Lock()
			if entity.Type != TypePlayer || entity.InstanceID != instanceID || entity.State == "DEAD" {
				entity.Mu.Unlock()
				continue
			}
			rewardMultiplier := resonanceRewardMultiplier(entity)
			xpReward := int(float64(max(50, inst.RunLevel*10)) * rewardScale * rewardMultiplier)
			goldReward := int(float64(max(25, inst.RunLevel*3)) * rewardScale * rewardMultiplier)
			itemCount := 0
			gemCount := 0
			heartCount := 0
			healthRestored := 0
			manaRestored := 0
			if room.Hook == "shrine" {
				healthRestored = max(1, int(float64(entity.MaxHealth)*0.30))
				manaRestored = max(1, int(float64(entity.MaxMana)*0.30))
				entity.Health = min(entity.MaxHealth, entity.Health+healthRestored)
				entity.Mana = min(entity.MaxMana, entity.Mana+manaRestored)
				entity.SanctuaryDamageReduction = true
				entity.SanctuaryEndTime = time.Now().Add(8 * time.Second)
			}
			if room.Hook == "chest" {
				if gem := GenerateRandomGemByLevel(max(20, inst.RunLevel), false); gem != nil {
					if entity.AddItemToInventory(*gem) == 0 {
						gemCount = 1
					}
				}
			}
			if room.Hook == "elite_ambush" {
				if loot := GenerateEliteLoot(max(20, inst.RunLevel)); loot != nil {
					if entity.AddItemToInventory(*loot) == 0 {
						itemCount = 1
					}
				}
			}
			awardRoomExperienceLocked(entity, xpReward)
			entity.Gold += goldReward
			w.Economy.RecordSource("dungeon_room_rewards", goldReward)
			playerRewards = append(playerRewards, buildDungeonRoomClearRewardSummary(entity.ID, roomIndex, objectiveRoomIndex, goldReward, xpReward, itemCount, gemCount, heartCount, inst.DungeonType, inst.Difficulty, room.Type, room.Hook, healthRestored, manaRestored))
			entity.Mu.Unlock()
		}
	}
	inst.Mu.Unlock()

	if w.OnEvent != nil {
		for _, reward := range playerRewards {
			w.OnEvent("room_clear_reward", reward)
		}
	}
}

func (w *World) GetDungeonRoomSummary(instanceID string, playerID string) (DungeonRoomSummary, bool) {
	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return DungeonRoomSummary{}, false
	}
	inst.Mu.RLock()
	defer inst.Mu.RUnlock()
	if inst.RoomState == nil {
		return DungeonRoomSummary{}, false
	}
	if summary, ok := inst.PlayerRoomSummary[playerID]; ok {
		return withDungeonSummaryContext(summary, inst.Difficulty, inst.RunLevel), true
	}
	return withDungeonSummaryContext(inst.RoomState.Summary(0, 0), inst.Difficulty, inst.RunLevel), true
}

func fallbackDungeonLayout(dungeonType string) DungeonLayout {
	startX, startZ := 0.0, 0.0
	switch dungeonType {
	case "verdant_bastion_catacombs":
		startX, startZ = 20000.0, 20000.0
	case "molten_core":
		startX, startZ = 30000.0, 20000.0
	case "tempest_spire":
		startX, startZ = 40000.0, 20000.0
	case "abyssal_well":
		startX, startZ = 50000.0, 20000.0
	case "umbral_nexus":
		startX, startZ = 60000.0, 20000.0
	case "weekly_raid":
		startX, startZ = 70000.0, 20000.0
	case "earth_crystal_raid":
		startX, startZ = 80000.0, 20000.0
	case "water_crystal_raid":
		startX, startZ = 90000.0, 20000.0
	case "fire_crystal_raid":
		startX, startZ = 100000.0, 20000.0
	case "air_crystal_raid":
		startX, startZ = 110000.0, 20000.0
	}

	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: startX, Z: startZ, Width: 40, Height: 40, Type: "start"})
	return layout
}

// generateUmbralNexusLayout is the fifth production dungeon. Its compact,
// deterministic route deliberately exercises the same layout, room-hook,
// scaling, persistence, and reward seams as the four regional dungeons.
func (w *World) generateUmbralNexusLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	const originX, originZ = 60000.0, 20000.0
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: originX, Z: originZ, Width: 130, Height: 130, Type: "start", Color: 0x171022})
	bosses := []string{"DissonantHerald", "NullArchitect", "EidolonDevourer"}
	for index, boss := range bosses {
		roomZ := originZ - float64(index*400+180)
		roomType := "normal"
		if index == 1 {
			roomType = "elite"
		}
		appendDungeonRoomAndConnect(&layout, DungeonRoom{X: originX + float64((index%2)*90-45), Z: roomZ, Width: 105, Height: 105, Type: roomType, Color: 0x241634}, canonicalDungeonCorridorWidth)
		for mob := 0; mob < 4; mob++ {
			subType := "DissonantShade"
			if roomType == "elite" {
				subType = "MemoryReaver"
			}
			w.spawnDungeonEnemyInInstance(subType, layout.Rooms[len(layout.Rooms)-1].X+float64(mob*3-5), roomZ, instanceID, difficulty, roomType == "elite")
		}
		bossZ := roomZ - 180
		appendDungeonRoomAndConnect(&layout, DungeonRoom{X: originX, Z: bossZ, Width: 145 + float64(index*15), Height: 145 + float64(index*15), Type: "boss", Color: 0x0d0915}, canonicalDungeonCorridorWidth)
		w.spawnBossInInstance(boss, originX, bossZ, instanceID, difficulty)
	}
	return layout
}

func (w *World) generateWeeklyRaidLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	const originX, originZ = 70000.0, 20000.0
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: originX, Z: originZ, Width: 170, Height: 170, Type: "start", Color: 0x12091e})
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: originX, Z: originZ - 240, Width: 260, Height: 260, Type: "boss", Color: 0x08040d}, canonicalDungeonCorridorWidth*2)
	w.spawnBossInInstance("UmbraPrime", originX, originZ-240, instanceID, difficulty)
	return layout
}

func (w *World) generateVerdantBastionLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (e.g., 20000, 20000)
	offsetX := 20000.0
	offsetZ := 20000.0

	// Start Room
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 120, Height: 120, Type: "start", Color: 0x444444})

	// Boss milestones use the shared run-level curve plus the per-boss depth
	// modifiers in enemy_balance.go.
	bosses := []string{"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel"}

	currentX := offsetX
	currentZ := offsetZ

	// Use a deterministic seed based on instanceID hash if possible,
	// but for now we just use global rand since we store the layout.

	for _, boss := range bosses {
		// Generate 1-2 intermediate rooms (Reduced from 2-3 to prevent "endless" feel)
		numIntermediate := 1 + rand.Intn(2)

		// Calculate Target Z based on required spacing
		// We need enough space for the Z-shaped corridor segments to be longer than the wall offsets.
		// Room Half Height (60) + Corridor Half Width (20) = 80 offset.
		// We need vertical segment > 80.
		// Vertical segment is stepZ / 2.
		// So stepZ must be > 160.
		// Reduced from 250 to 180 to make corridors shorter and less tedious.
		stepZ := -180.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			// Move North
			nextZ := currentZ + stepZ
			// Random East/West offset (-80 to 80)
			offset := (rand.Float64() * 160) - 80
			// Avoid small offsets that cause Z-shape corner overlap in client generation
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			// Add Room
			roomType := "normal"
			if rand.Float64() < 0.3 {
				roomType = "elite"
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 100, Height: 100, Type: roomType, Color: 0x333333,
			}, canonicalDungeonCorridorWidth)

			// Spawn Mobs
			if roomType == "elite" {
				// Spawn Elite
				w.spawnEnemyInInstance("DemonOrc", nextX, nextZ, instanceID, difficulty) // Placeholder Elite
			} else {
				// Spawn Trash
				for k := 0; k < 3; k++ {
					ox := (rand.Float64() * 10) - 5
					oz := (rand.Float64() * 10) - 5
					w.spawnEnemyInInstance("Skeleton", nextX+ox, nextZ+oz, instanceID, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		// Place Boss Room
		// Re-center X slightly towards the dungeon center (20000) to keep dungeon from drifting too far
		// Pull it back 50% towards 20000.
		currentX = 20000.0 + (currentX-20000.0)*0.5
		currentZ = targetZ

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: 120, Height: 120, Type: "boss", Color: 0x222222,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss, currentX, currentZ, instanceID, difficulty)
	}

	return layout
}

// generateMoltenCoreLayout creates the Fire Dungeon layout (Level 80-90)
// Location: X: -2400, Z: 200 (Fire Realm)
// 5 Bosses: Cindermaw, Scorched Twins, Forgemaster Pyrax, Obsidian Guardian, Lord Infernax
func (w *World) generateMoltenCoreLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (Fire dungeon at 30000, 20000)
	offsetX := 30000.0
	offsetZ := 20000.0

	// Start Room (Lava-themed entrance)
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 140, Height: 140, Type: "start", Color: 0x8B0000})

	// Molten Core Bosses (5 bosses)
	bosses := []string{"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax"}

	currentX := offsetX
	currentZ := offsetZ

	// Fire-themed trash mobs for the dungeon
	fireTrash := []string{"MagmaGolem", "ScorchedWraith", "InfernalBehemoth"}

	for i, boss := range bosses {
		// Generate 1-2 intermediate rooms between bosses
		numIntermediate := 1 + rand.Intn(2)
		stepZ := -200.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			nextZ := currentZ + stepZ
			offset := (rand.Float64() * 160) - 80
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			roomType := "normal"
			if rand.Float64() < 0.35 {
				roomType = "elite"
			}

			// Lava-themed room colors
			roomColor := 0x4a0000
			if roomType == "elite" {
				roomColor = 0x6a0000
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 110, Height: 110, Type: roomType, Color: roomColor,
			}, canonicalDungeonCorridorWidth)

			// Spawn Fire Realm Mobs
			if roomType == "elite" {
				// Spawn Elite fire enemy
				w.spawnFireDungeonEnemy("InfernalBehemoth", nextX, nextZ, instanceID, true, difficulty)
			} else {
				// Spawn 3-4 trash mobs
				numTrash := 3 + rand.Intn(2)
				for k := 0; k < numTrash; k++ {
					ox := (rand.Float64() * 15) - 7.5
					oz := (rand.Float64() * 15) - 7.5
					trashType := fireTrash[rand.Intn(len(fireTrash))]
					w.spawnFireDungeonEnemy(trashType, nextX+ox, nextZ+oz, instanceID, false, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		// Place Boss Room
		currentX = 30000.0 + (currentX-30000.0)*0.5
		currentZ = targetZ

		// Boss room is larger and darker
		bossRoomSize := 140.0
		if i == len(bosses)-1 {
			bossRoomSize = 180.0 // Final boss room is biggest
		}

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: bossRoomSize, Height: bossRoomSize, Type: "boss", Color: 0x2a0000,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss, currentX, currentZ, instanceID, difficulty)
	}

	return layout
}

// generateTempestSpireLayout creates the Air Dungeon layout (Level 80-90)
// Location: X: 2400, Z: 200 (Air Realm)
// 5 Bosses: Windshear, Stormcallers, Roc Matriarch, Thunderlord Kaelix, Zephyrion
func (w *World) generateTempestSpireLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (Air dungeon at 40000, 20000)
	offsetX := 40000.0
	offsetZ := 20000.0

	// Start Room (Storm-themed entrance)
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 140, Height: 140, Type: "start", Color: 0x1a1a4a})

	// Tempest Spire Bosses (5 bosses)
	bosses := []string{"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion"}

	currentX := offsetX
	currentZ := offsetZ

	// Air-themed trash mobs for the dungeon
	airTrash := []string{"StormHarpy", "CloudElemental", "ThunderRoc"}

	for i, boss := range bosses {
		// Generate 1-2 intermediate rooms between bosses
		numIntermediate := 1 + rand.Intn(2)
		stepZ := -200.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			nextZ := currentZ + stepZ
			offset := (rand.Float64() * 160) - 80
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			roomType := "normal"
			if rand.Float64() < 0.35 {
				roomType = "elite"
			}

			// Storm-themed room colors
			roomColor := 0x1a1a3a
			if roomType == "elite" {
				roomColor = 0x2a2a5a
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 110, Height: 110, Type: roomType, Color: roomColor,
			}, canonicalDungeonCorridorWidth)

			// Spawn Air Realm Mobs
			if roomType == "elite" {
				// Spawn Elite air enemy
				w.spawnAirDungeonEnemy("TempestGiant", nextX, nextZ, instanceID, true, difficulty)
			} else {
				// Spawn 3-4 trash mobs
				numTrash := 3 + rand.Intn(2)
				for k := 0; k < numTrash; k++ {
					ox := (rand.Float64() * 15) - 7.5
					oz := (rand.Float64() * 15) - 7.5
					trashType := airTrash[rand.Intn(len(airTrash))]
					w.spawnAirDungeonEnemy(trashType, nextX+ox, nextZ+oz, instanceID, false, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		// Place Boss Room
		currentX = 40000.0 + (currentX-40000.0)*0.5
		currentZ = targetZ

		// Boss room is larger
		bossRoomSize := 140.0
		if i == len(bosses)-1 {
			bossRoomSize = 180.0 // Final boss room is biggest
		}

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: bossRoomSize, Height: bossRoomSize, Type: "boss", Color: 0x0a0a2a,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss, currentX, currentZ, instanceID, difficulty)
	}

	return layout
}

// generateAbyssalWellLayout creates the Water Dungeon layout (Level 60-70)
// Location: X: 0, Z: -1400 (Water Realm center)
// 5 Bosses: Tiderend Leviathan, Drowned Choir, Abyssal Goliath, Maelstrom Warden, Thalorath
func (w *World) generateAbyssalWellLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (Water dungeon at 50000, 20000)
	offsetX := 50000.0
	offsetZ := 20000.0

	// Start Room (Abyssal-themed entrance)
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 130, Height: 130, Type: "start", Color: 0x0a2a4a})

	// Abyssal Well Bosses (5 bosses)
	bosses := []string{"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath"}

	currentX := offsetX
	currentZ := offsetZ

	// Water-themed trash mobs for the dungeon
	waterTrash := []string{"AquaGolem", "Siren", "FrostGuardian"}

	for i, boss := range bosses {
		// Generate 1-2 intermediate rooms between bosses
		numIntermediate := 1 + rand.Intn(2)
		stepZ := -190.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			nextZ := currentZ + stepZ
			offset := (rand.Float64() * 160) - 80
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			roomType := "normal"
			if rand.Float64() < 0.35 {
				roomType = "elite"
			}

			roomColor := 0x0a3555
			if roomType == "elite" {
				roomColor = 0x0f4466
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 110, Height: 110, Type: roomType, Color: roomColor,
			}, canonicalDungeonCorridorWidth)

			if roomType == "elite" {
				w.spawnDungeonEnemyInInstance("FrostGuardian", nextX, nextZ, instanceID, difficulty, true)
			} else {
				numTrash := 3 + rand.Intn(2)
				for k := 0; k < numTrash; k++ {
					ox := (rand.Float64() * 15) - 7.5
					oz := (rand.Float64() * 15) - 7.5
					trashType := waterTrash[rand.Intn(len(waterTrash))]
					w.spawnDungeonEnemyInInstance(trashType, nextX+ox, nextZ+oz, instanceID, difficulty, false)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		currentX = 50000.0 + (currentX-50000.0)*0.5
		currentZ = targetZ

		bossRoomSize := 140.0
		if i == len(bosses)-1 {
			bossRoomSize = 175.0
		}

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: bossRoomSize, Height: bossRoomSize, Type: "boss", Color: 0x061a2a,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss, currentX, currentZ, instanceID, difficulty)
	}

	return layout
}

// spawnFireDungeonEnemy spawns a fire-themed enemy in the Molten Core dungeon
func (w *World) spawnFireDungeonEnemy(subType string, x, z float64, instanceID string, isElite bool, difficulty DungeonDifficulty) {
	runLevel := w.getInstanceRunLevelUnsafe(instanceID)
	rank := dungeonRankTrash
	if isElite {
		rank = dungeonRankElite
	}
	profile := dungeonEnemyCombatProfile(subType, runLevel, difficulty, rank, 3.0)
	enemyID := fmt.Sprintf("%s-%s-%d", subType, instanceID, rand.Intn(10000))
	if isElite {
		enemyID = fmt.Sprintf("elite-%s-%s-%d", subType, instanceID, rand.Intn(10000))
	}

	enemy := &Entity{
		ID:             enemyID,
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		Level:          runLevel,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      profile.BaseStats,
		Health:         profile.Health,
		MaxHealth:      profile.MaxHealth,
		Damage:         profile.Damage,
		State:          "IDLE",
		BaseSpeed:      profile.Speed,
		Speed:          profile.Speed,
		AttackSpeed:    profile.AttackSpeed,
		AttackCooldown: profile.AttackCooldown,
		Scale:          1.2,
	}
	w.Entities[enemy.ID] = enemy
	w.Grid.Add(enemy)
}

// spawnAirDungeonEnemy spawns an air-themed enemy in the Tempest Spire dungeon
func (w *World) spawnAirDungeonEnemy(subType string, x, z float64, instanceID string, isElite bool, difficulty DungeonDifficulty) {
	runLevel := w.getInstanceRunLevelUnsafe(instanceID)
	rank := dungeonRankTrash
	if isElite {
		rank = dungeonRankElite
	}
	profile := dungeonEnemyCombatProfile(subType, runLevel, difficulty, rank, 3.5)
	enemyID := fmt.Sprintf("%s-%s-%d", subType, instanceID, rand.Intn(10000))
	if isElite {
		enemyID = fmt.Sprintf("elite-%s-%s-%d", subType, instanceID, rand.Intn(10000))
	}

	enemy := &Entity{
		ID:             enemyID,
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		Level:          runLevel,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      profile.BaseStats,
		Health:         profile.Health,
		MaxHealth:      profile.MaxHealth,
		Damage:         profile.Damage,
		State:          "IDLE",
		BaseSpeed:      profile.Speed,
		Speed:          profile.Speed,
		AttackSpeed:    profile.AttackSpeed,
		AttackCooldown: profile.AttackCooldown,
		Scale:          1.1,
	}
	w.Entities[enemy.ID] = enemy
	w.Grid.Add(enemy)
}

func (w *World) spawnBossInInstance(subType string, x, z float64, instanceID string, difficulty DungeonDifficulty) {
	runLevel := w.getInstanceRunLevelUnsafe(instanceID)
	profile := dungeonEnemyCombatProfile(subType, runLevel, difficulty, dungeonRankBoss, 2.5)

	boss := &Entity{
		ID:             fmt.Sprintf("%s-%s", subType, instanceID),
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		Level:          runLevel,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      profile.BaseStats,
		Health:         profile.Health,
		MaxHealth:      profile.MaxHealth,
		State:          "IDLE",
		BaseSpeed:      profile.Speed,
		Speed:          profile.Speed,
		AttackSpeed:    profile.AttackSpeed,
		AttackCooldown: profile.AttackCooldown,
		Scale:          4.0,
		Damage:         profile.Damage,
	}
	if subType == "UmbraPrime" {
		boss.Name = "Malachar, the Dark King"
	} else if _, elementalRaid := ElementalRaidDefinitionForType(w.GetInstanceType(instanceID)); elementalRaid {
		boss.Name = elementalRaidBossName(subType)
	}
	w.Entities[boss.ID] = boss
	w.Grid.Add(boss)
}

func (w *World) spawnEnemyInInstance(subType string, x, z float64, instanceID string, difficulty DungeonDifficulty) {
	// Verdant's DemonOrc path is the legacy elite-room wrapper. Other dungeon
	// families call the explicit ranked helper so a subtype may appear as both
	// trash and elite without changing its loot identity.
	w.spawnDungeonEnemyInInstance(subType, x, z, instanceID, difficulty, subType == "DemonOrc")
}

func (w *World) spawnDungeonEnemyInInstance(subType string, x, z float64, instanceID string, difficulty DungeonDifficulty, isElite bool) {
	runLevel := w.getInstanceRunLevelUnsafe(instanceID)
	rank := dungeonRankTrash
	if isElite {
		rank = dungeonRankElite
	}
	profile := dungeonEnemyCombatProfile(subType, runLevel, difficulty, rank, 3.0)

	enemyID := fmt.Sprintf("%s-%s-%d", subType, instanceID, rand.Intn(10000))
	if isElite {
		enemyID = fmt.Sprintf("elite-%s-%s-%d", subType, instanceID, rand.Intn(10000))
	}

	enemy := &Entity{
		ID:             enemyID,
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		Level:          runLevel,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      profile.BaseStats,
		Health:         profile.Health,
		MaxHealth:      profile.MaxHealth,
		Damage:         profile.Damage,
		State:          "IDLE",
		BaseSpeed:      profile.Speed,
		Speed:          profile.Speed,
		AttackSpeed:    profile.AttackSpeed,
		AttackCooldown: profile.AttackCooldown,
		Scale:          1.0,
	}
	w.Entities[enemy.ID] = enemy
	w.Grid.Add(enemy)
}

func (w *World) EnterInstance(playerID string, instanceID string) error {
	w.Mu.Lock()

	player, ok := w.Entities[playerID]
	if !ok {
		w.Mu.Unlock()
		return fmt.Errorf("player not found")
	}

	w.Grid.Remove(player)

	oldInstanceID := player.InstanceID
	log.Printf("EnterInstance: Player %s moving from '%s' to '%s'", playerID, oldInstanceID, instanceID)
	delete(w.PlayerHazardTicks, playerID)
	player.QAHazardInspectionEndTime = time.Time{}
	player.QAHealthRegenPausedUntil = time.Time{}
	player.InstanceID = instanceID

	// Set Spawn Position based on Dungeon Layout
	startX, startZ := 0.0, 0.0
	if strings.HasPrefix(instanceID, "dungeon_") {
		if inst, ok := w.getDungeonInstance(instanceID); ok {
			inst.Mu.RLock()
			if len(inst.Layout.Rooms) > 0 {
				startX = inst.Layout.Rooms[0].X
				startZ = inst.Layout.Rooms[0].Z
			} else {
				fallback := fallbackDungeonLayout(inst.DungeonType)
				startX = fallback.Rooms[0].X
				startZ = fallback.Rooms[0].Z
			}
			inst.Mu.RUnlock()
		}
	}
	player.X = startX
	player.Z = startZ
	player.TargetX = startX
	player.TargetZ = startZ

	w.Grid.Add(player)

	// Handle Old Instance (Leaving)
	if strings.HasPrefix(oldInstanceID, "dungeon_") {
		w.checkAndResetDungeonLocked(oldInstanceID)
	}

	// Handle New Instance (Entering)
	if strings.HasPrefix(instanceID, "dungeon_") {
		if inst, ok := w.getDungeonInstance(instanceID); ok {
			inst.Mu.Lock()
			inst.EmptySince = time.Time{} // Reset empty timer
			if inst.RoomState != nil {
				inst.RoomState.MarkExploredAt(startX, startZ)
				inst.PlayerRoomSummary[playerID] = withDungeonSummaryContext(inst.RoomState.Summary(startX, startZ), inst.Difficulty, inst.RunLevel)
			}
			inst.Mu.Unlock()
		}
	}
	w.Mu.Unlock()

	if strings.HasPrefix(instanceID, "dungeon_") {
		w.ensureRestoredCrystalRepair(instanceID, playerID)
	}

	return nil
}

func (w *World) cleanupInstanceLocked(instanceID string) {
	w.RepairMu.Lock()
	delete(w.CrystalRepairs, instanceID)
	w.RepairMu.Unlock()

	w.InstanceMu.Lock()
	delete(w.InstanceLayouts, instanceID)
	w.InstanceMu.Unlock()

	toRemove := []string{}
	for id, e := range w.Entities {
		if e.InstanceID == instanceID {
			toRemove = append(toRemove, id)
		}
	}

	for _, id := range toRemove {
		if e, ok := w.Entities[id]; ok {
			w.Grid.Remove(e)
			delete(w.Entities, id)
		}
	}
}

func (w *World) checkAndResetDungeonLocked(instanceID string) {
	// Check if any players remain
	hasPlayers := false
	for _, e := range w.Entities {
		if e.Type == TypePlayer && e.InstanceID == instanceID {
			hasPlayers = true
			break
		}
	}

	if !hasPlayers {
		// Mark as empty
		if inst, ok := w.getDungeonInstance(instanceID); ok {
			inst.Mu.Lock()
			inst.EmptySince = time.Now()
			inst.Mu.Unlock()
		}
	}
}

func (w *World) IsLocationInDungeon(instanceID string, x, z float64) bool {
	instance, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return false
	}
	instance.Mu.RLock()
	defer instance.Mu.RUnlock()
	if len(instance.Layout.WalkRects) == 0 {
		if instance.Layout.Rooms == nil {
			return true // Default open dungeon
		}
		for _, r := range instance.Layout.Rooms {
			halfW := r.Width / 2
			halfH := r.Height / 2
			if x >= r.X-halfW && x <= r.X+halfW && z >= r.Z-halfH && z <= r.Z+halfH {
				return true
			}
		}
		return false
	}

	return isPointInDungeonLayout(instance.Layout, x, z)
}
