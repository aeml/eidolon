package game

import (
	"fmt"
	"time"
)

type CrystalRepairState struct {
	InstanceID   string
	RaidType     string
	Element      string
	Crystal      string
	RepairTarget string
	NPCID        string
	Wave         int
	WaveEnemyIDs []string
	Participants []string
	CenterX      float64
	CenterZ      float64
	Completed    bool
	StartedAt    time.Time
}

type CrystalRepairEvent struct {
	InstanceID string `json:"instanceId"`
	RaidType   string `json:"raidType"`
	Element    string `json:"element"`
	Crystal    string `json:"crystal"`
	Stage      string `json:"stage"`
	Wave       int    `json:"wave"`
	TotalWaves int    `json:"totalWaves"`
	Progress   int    `json:"progress"`
	Title      string `json:"title"`
	Dialogue   string `json:"dialogue"`
	Hint       string `json:"hint"`
}

func (w *World) emitCrystalRepair(state *CrystalRepairState, stage string, wave, progress int, title, dialogue, hint string) {
	if w.OnEvent == nil || state == nil {
		return
	}
	w.OnEvent("crystal_repair", CrystalRepairEvent{
		InstanceID: state.InstanceID, RaidType: state.RaidType, Element: state.Element, Crystal: state.Crystal,
		Stage: stage, Wave: wave, TotalWaves: 3, Progress: progress, Title: title, Dialogue: dialogue, Hint: hint,
	})
}

// StartCrystalRepair begins the raid's second finale after every assault room
// and its final boss have been cleared. It is idempotent against duplicate
// death/reward callbacks.
func (w *World) StartCrystalRepair(instanceID, raidType string, participants []string, centerX, centerZ float64) bool {
	definition, ok := ElementalRaidDefinitionForType(raidType)
	if !ok || instanceID == "" {
		return false
	}
	w.RepairMu.Lock()
	if existing := w.CrystalRepairs[instanceID]; existing != nil {
		w.RepairMu.Unlock()
		return false
	}
	state := &CrystalRepairState{
		InstanceID: instanceID, RaidType: raidType, Element: definition.Element, Crystal: definition.Crystal,
		RepairTarget: definition.RepairTarget, NPCID: "crystal-artificer-" + instanceID,
		Participants: append([]string(nil), participants...), CenterX: centerX, CenterZ: centerZ, StartedAt: time.Now().UTC(),
	}
	w.CrystalRepairs[instanceID] = state
	w.RepairMu.Unlock()

	artificer := &Entity{
		ID: state.NPCID, InstanceID: instanceID, Name: "Maelin, Resonance Artificer", Type: TypeNPC, SubType: "CrystalKeeper",
		X: centerX, Y: 0, Z: centerZ, SpawnX: centerX, SpawnZ: centerZ, State: "CHANNELING",
		Level: definition.RequiredLevel, Health: 1000000, MaxHealth: 1000000, Scale: 1.15, CreatedAt: time.Now(),
	}
	w.AddEntity(artificer)
	w.emitCrystalRepair(state, "ritual_start", 0, 0, definition.Crystal+" Repair Vigil",
		"Maelin: The raid opened the chamber. I can restore the crystal, but Malachar's corruption will answer in three waves.",
		"Defend Maelin and clear every attacker. The ritual pauses until each wave is defeated.")
	go w.runCrystalRepair(state)
	return true
}

func (w *World) runCrystalRepair(state *CrystalRepairState) {
	for wave := 1; wave <= 3; wave++ {
		if _, exists := w.getDungeonInstance(state.InstanceID); !exists {
			return
		}
		enemyIDs := w.spawnCrystalRepairWave(state, wave)
		w.RepairMu.Lock()
		state.Wave = wave
		state.WaveEnemyIDs = append([]string(nil), enemyIDs...)
		w.RepairMu.Unlock()
		w.emitCrystalRepair(state, "wave_start", wave, (wave-1)*33,
			fmt.Sprintf("Repair Wave %d of 3", wave),
			fmt.Sprintf("Maelin: Facet %d is aligning. Hold the circle!", wave),
			fmt.Sprintf("Defeat %d attackers before the repair can continue.", len(enemyIDs)))
		if !w.waitForCrystalRepairWave(state.InstanceID, enemyIDs) {
			return
		}
		w.emitCrystalRepair(state, "wave_clear", wave, wave*33,
			fmt.Sprintf("Wave %d Cleared", wave),
			fmt.Sprintf("Maelin: Facet %d holds. The %s is remembering.", wave, state.Crystal),
			"Regroup—the next counterattack is forming.")
	}
	w.completeCrystalRepair(state)
}

func (w *World) spawnCrystalRepairWave(state *CrystalRepairState, wave int) []string {
	definition, _ := ElementalRaidDefinitionForType(state.RaidType)
	runLevel := definition.RequiredLevel
	difficulty := DifficultyNormal
	if instance, ok := w.getDungeonInstance(state.InstanceID); ok {
		instance.Mu.RLock()
		runLevel = instance.RunLevel
		difficulty = instance.Difficulty
		instance.Mu.RUnlock()
	}
	count := 4 + wave*2
	ids := make([]string, 0, count)
	w.Mu.Lock()
	defer w.Mu.Unlock()
	for index := 0; index < count; index++ {
		subType := definition.Trash
		rank := dungeonRankTrash
		if wave >= 2 && index%3 == 0 {
			subType, rank = definition.Elite, dungeonRankElite
		}
		profile := dungeonEnemyCombatProfile(subType, runLevel, difficulty, rank, 4.5)
		x, z := elementalRaidWavePosition(state.CenterX, state.CenterZ, wave, index, count)
		id := fmt.Sprintf("repair-%s-wave-%d-%d", state.InstanceID, wave, index)
		enemy := &Entity{
			ID: id, InstanceID: state.InstanceID, Name: "Dissonant " + splitQuestTarget(subType), Type: TypeEnemy, SubType: subType,
			Level: runLevel, X: x, Y: 0, Z: z, SpawnX: x, SpawnZ: z, BaseStats: profile.BaseStats,
			Health: profile.Health, MaxHealth: profile.MaxHealth, Damage: profile.Damage, State: "IDLE",
			BaseSpeed: profile.Speed, Speed: profile.Speed, AttackSpeed: profile.AttackSpeed, AttackCooldown: profile.AttackCooldown,
			Scale: 1.2, CreatedAt: time.Now(),
		}
		w.Entities[id] = enemy
		w.Grid.Add(enemy)
		ids = append(ids, id)
	}
	return ids
}

func (w *World) waitForCrystalRepairWave(instanceID string, enemyIDs []string) bool {
	ticker := time.NewTicker(350 * time.Millisecond)
	defer ticker.Stop()
	for {
		if _, exists := w.getDungeonInstance(instanceID); !exists {
			return false
		}
		allDefeated := true
		for _, enemyID := range enemyIDs {
			enemy := w.GetEntity(enemyID)
			if enemy == nil {
				continue
			}
			enemy.Mu.RLock()
			living := enemy.InstanceID == instanceID && enemy.State != "DEAD" && enemy.Health > 0
			enemy.Mu.RUnlock()
			if living {
				allDefeated = false
				break
			}
		}
		if allDefeated {
			return true
		}
		<-ticker.C
	}
}

// ensureRestoredCrystalRepair restarts an interrupted Vigil when a persisted
// elemental raid has a cleared guardian room but its repair chapter is not yet
// complete. Wave progress intentionally restarts so no player can receive
// restoration credit without defending a complete three-wave ritual.
func (w *World) ensureRestoredCrystalRepair(instanceID, enteringPlayerID string) {
	instance, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return
	}
	instance.Mu.RLock()
	definition, elemental := ElementalRaidDefinitionForType(instance.DungeonType)
	if !elemental || instance.RoomState == nil || len(instance.Layout.Rooms) == 0 {
		instance.Mu.RUnlock()
		return
	}
	lastIndex := len(instance.Layout.Rooms) - 1
	guardianCleared := lastIndex < len(instance.RoomState.Rooms) &&
		instance.Layout.Rooms[lastIndex].Type == "boss" && instance.RoomState.Rooms[lastIndex].Cleared
	centerX, centerZ := instance.Layout.Rooms[lastIndex].X, instance.Layout.Rooms[lastIndex].Z
	partyID := instance.PartyID
	instance.Mu.RUnlock()
	if !guardianCleared {
		return
	}

	participants := []string{enteringPlayerID}
	w.Mu.RLock()
	if party := w.Parties[partyID]; party != nil {
		party.Mu.RLock()
		participants = append([]string(nil), party.Members...)
		party.Mu.RUnlock()
	}
	allRestored := len(participants) > 0
	for _, playerID := range participants {
		player := w.Entities[playerID]
		if player == nil {
			allRestored = false
			continue
		}
		player.Mu.RLock()
		completed := HasCompletedChronicleQuest(player, definition.RestoredQuest)
		player.Mu.RUnlock()
		if !completed {
			allRestored = false
		}
	}
	w.Mu.RUnlock()
	if !allRestored {
		w.StartCrystalRepair(instanceID, definition.Type, participants, centerX, centerZ)
	}
}

func (w *World) completeCrystalRepair(state *CrystalRepairState) {
	w.RepairMu.Lock()
	if state.Completed {
		w.RepairMu.Unlock()
		return
	}
	state.Completed = true
	w.RepairMu.Unlock()

	if artificer := w.GetEntity(state.NPCID); artificer != nil {
		artificer.Mu.Lock()
		artificer.Name = "Maelin — " + state.Crystal + " Restored"
		artificer.State = "IDLE"
		artificer.Mu.Unlock()
	}
	credited := make([]string, 0, len(state.Participants))
	for _, playerID := range state.Participants {
		player := w.GetEntity(playerID)
		if player == nil {
			continue
		}
		player.Mu.Lock()
		stillParticipating := player.InstanceID == state.InstanceID && !player.Disconnected
		if stillParticipating && w.UpdateChronicleEventProgress(player, "REPAIR", state.RepairTarget) {
			credited = append(credited, player.ID)
		}
		player.Mu.Unlock()
	}
	w.emitCrystalRepair(state, "complete", 3, 100, state.Crystal+" Restored",
		"Maelin: The fracture is closed. Listen—the Eidolon is answering through us, not above us.",
		"The next realm chapter has begun. Open the Journal to read the recovered lore.")

	if instance, ok := w.getDungeonInstance(state.InstanceID); ok && w.OnEvent != nil {
		instance.Mu.RLock()
		event := DungeonCompletionEvent{
			InstanceID: state.InstanceID, DungeonType: state.RaidType, Difficulty: instance.Difficulty,
			RunLevel: instance.RunLevel, Duration: max(time.Millisecond, time.Since(instance.CreatedAt)), Participants: credited,
		}
		instance.Mu.RUnlock()
		w.OnEvent("dungeon_complete", event)
	}
}
