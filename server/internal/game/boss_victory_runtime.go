package game

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"slices"
	"strings"
	"time"

	"eidolon-server/internal/database"
)

// Internal death-pipeline input, not a client request. Members are the existing
// kill-time eligibility snapshot, including downed dungeon party members.
type bossVictoryCapture struct {
	instanceID, bossID, bossType, partyID string
	spawnX, spawnZ, x, z                  float64
	baseGold, baseXP                      int
	isDungeonBoss                         bool
	killedAt                              time.Time
	members                               []*Entity
	loot                                  []*Item
}

func cloneBossVictory(op database.BossVictoryOperation) database.BossVictoryOperation {
	op.Participants = slices.Clone(op.Participants)
	for i := range op.Participants {
		op.Participants[i].Items = slices.Clone(op.Participants[i].Items)
		op.Participants[i].Quests = slices.Clone(op.Participants[i].Quests)
	}
	op.Drops = slices.Clone(op.Drops)
	if op.DungeonClear != nil {
		clear := *op.DungeonClear
		clear.GuildRuns = slices.Clone(clear.GuildRuns)
		op.DungeonClear = &clear
	}
	return op
}

// Retain the first local rolls before an ambiguous prepare. No save or success
// feedback is allowed here. The coordinator replaces a losing proposal with
// the first strongly stored victory for this same physical boss.
func (w *World) captureBossVictory(input bossVictoryCapture) (database.BossVictoryOperation, error) {
	w.bossVictoryMu.Lock()
	defer w.bossVictoryMu.Unlock()
	id := database.BossVictoryID(input.instanceID, input.bossID)
	if previous, found := w.bossVictoryPlans[id]; found {
		return cloneBossVictory(previous), nil
	}
	op := database.BossVictoryOperation{Version: 1, ID: id, InstanceID: input.instanceID, BossID: input.bossID,
		BossType: input.bossType, CreatedAt: input.killedAt.UTC().Truncate(time.Millisecond)}
	inst, found := w.getDungeonInstance(input.instanceID)
	if !found || len(input.members) == 0 || input.baseGold < 0 || input.baseXP < 0 {
		return op, ErrBossVictoryEffectConflict
	}
	inst.Mu.RLock()
	if inst.RoomState == nil {
		inst.Mu.RUnlock()
		return op, ErrBossVictoryEffectConflict
	}
	op.RoomIndex = inst.RoomState.CurrentRoomIndexForPosition(input.spawnX, input.spawnZ)
	validRoom := op.RoomIndex >= 0 && op.RoomIndex < len(inst.Layout.Rooms) && inst.Layout.Rooms[op.RoomIndex].Type == "boss"
	op.RunLevel, op.DungeonType, op.Difficulty = inst.RunLevel, inst.DungeonType, string(inst.Difficulty)
	instanceCreatedAt := inst.CreatedAt
	inst.Mu.RUnlock()
	if !validRoom {
		return op, ErrBossVictoryEffectConflict
	}
	if op.Difficulty == "" {
		op.Difficulty = string(DifficultyNormal)
	}
	var guildClear dungeonGuildClearSnapshot
	if database.BossVictoryFinishesDungeon(op.BossType, op.DungeonType) {
		if instanceCreatedAt.IsZero() || instanceCreatedAt.After(op.CreatedAt) {
			return op, ErrBossVictoryEffectConflict
		}
		op.DungeonClear = &database.BossVictoryDungeonClear{DurationMS: max(1, op.CreatedAt.Sub(instanceCreatedAt).Milliseconds())}
	}
	_, _, lootMultiplier, xpMultiplier := DifficultyMultipliers(DungeonDifficulty(op.Difficulty))
	gold := int(float64(input.baseGold) * lootMultiplier)
	if input.partyID != "" {
		gold = int(float64(input.baseGold)*(1+float64(len(input.members))*.10)*lootMultiplier) / len(input.members)
	}
	xp := recipientCombatExperience(input.baseXP, true, len(input.members), xpMultiplier)
	targets := map[string]bool{input.bossType: true}
	if input.isDungeonBoss {
		targets["DungeonBoss"] = true
	}
	if input.isDungeonBoss && op.Difficulty == string(DifficultyHeroic) {
		targets["DungeonBossHeroic"] = true
	} else if input.isDungeonBoss && op.Difficulty == string(DifficultyMythic) {
		targets["DungeonBossMythic"] = true
	}
	if input.isDungeonBoss {
		switch op.DungeonType {
		case "verdant_bastion_catacombs":
			targets["VerdantBastionBoss"] = true
		case "molten_core":
			targets["MoltenCoreBoss"] = true
		case "tempest_spire":
			targets["TempestSpireBoss"] = true
		case "abyssal_well":
			targets["AbyssalWellBoss"] = true
		}
	}
	for _, member := range input.members {
		if member == nil {
			return op, ErrBossVictoryEffectConflict
		}
		member.Mu.RLock()
		recipient := database.BossVictoryRecipient{Username: member.Name, PlayerID: member.ID}
		valid := member.Type == TypePlayer && member.ID == "player-"+member.Name && member.Level >= 1 && member.Level <= MaxPlayerLevel
		multiplier := resonanceRewardMultiplier(member)
		recipient.Gold, recipient.XP = int(float64(gold)*multiplier), wellRestedKillXP(member, int(float64(xp)*multiplier))
		for _, quest := range member.Quests {
			if quest.Accepted && !quest.Completed && quest.Type == "KILL" && targets[quest.Target] && quest.Count < quest.MaxCount {
				recipient.Quests = append(recipient.Quests, database.BossVictoryKillCredit{QuestID: quest.ID, Target: quest.Target, Amount: 1, Maximum: quest.MaxCount})
			}
		}
		if op.DungeonClear != nil {
			guildClear.addLocked(member)
		}
		member.Mu.RUnlock()
		if !valid {
			return op, ErrBossVictoryEffectConflict
		}
		var privateItems []*Item
		if input.bossType != "UmbraPrime" {
			privateItems = GenerateBossHearts()
			if op.Difficulty == string(DifficultyHeroic) || op.Difficulty == string(DifficultyMythic) {
				if gem := GenerateRandomGem(true, op.Difficulty == string(DifficultyMythic)); gem != nil {
					privateItems = append(privateItems, gem)
				}
			}
			if op.Difficulty == string(DifficultyMythic) {
				if unique := GenerateGuaranteedUniqueEquipment(max(op.RunLevel, 100)); unique != nil {
					privateItems = append(privateItems, unique)
				}
			}
		}
		for _, item := range privateItems {
			payload, err := json.Marshal(item)
			if err != nil {
				return op, err
			}
			recipient.Items = append(recipient.Items, string(payload))
		}
		op.Participants = append(op.Participants, recipient)
	}
	slices.SortFunc(op.Participants, func(a, b database.BossVictoryRecipient) int { return strings.Compare(a.Username, b.Username) })
	if op.DungeonClear != nil {
		event := DungeonCompletionEvent{InstanceID: op.InstanceID, DungeonType: op.DungeonType, Difficulty: DungeonDifficulty(op.Difficulty),
			RunLevel: op.RunLevel, Duration: time.Duration(op.DungeonClear.DurationMS) * time.Millisecond, CompletedAt: op.CreatedAt}
		// The existing leaderboard qualifies only runs up to 24 hours.
		// A slower saved instance still earns its boss reward and dungeon
		// clear; leaderboard eligibility must not strand the whole victory.
		if event.Duration <= 24*time.Hour {
			guildClear.finish(&event)
		}
		op.DungeonClear.GuildRuns = event.GuildRuns
	}
	for _, item := range input.loot {
		if item == nil {
			continue
		}
		payload, err := json.Marshal(item)
		if err != nil {
			return op, err
		}
		op.Drops = append(op.Drops, database.BossVictoryDrop{LootID: fmt.Sprintf("loot-boss-%s-%d", strings.TrimPrefix(id, "bossvictory:"), len(op.Drops)),
			Item: string(payload), PartyID: input.partyID, X: input.x + rand.Float64() - .5, Y: .5, Z: input.z + rand.Float64() - .5,
			AvailableAt: op.CreatedAt, ExpiresAt: op.CreatedAt.Add(time.Minute)})
	}
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	if err := op.Validate(); err != nil {
		return op, err
	}
	if w.bossVictoryPlans == nil {
		w.bossVictoryPlans = map[string]database.BossVictoryOperation{}
	}
	w.bossVictoryPlans[id] = cloneBossVictory(op)
	return op, nil
}

func (w *World) PendingBossVictoryPlans() []database.BossVictoryOperation {
	w.bossVictoryMu.Lock()
	defer w.bossVictoryMu.Unlock()
	plans := make([]database.BossVictoryOperation, 0, len(w.bossVictoryPlans))
	for _, op := range w.bossVictoryPlans {
		plans = append(plans, cloneBossVictory(op))
	}
	return plans
}

func (w *World) RetainConfirmedBossVictoryPlan(op database.BossVictoryOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	w.bossVictoryMu.Lock()
	defer w.bossVictoryMu.Unlock()
	if w.bossVictoryPlans == nil {
		w.bossVictoryPlans = map[string]database.BossVictoryOperation{}
		w.bossVictoryKnown = map[string]bool{}
	}
	if w.bossVictoryKnown == nil {
		w.bossVictoryKnown = map[string]bool{}
	}
	w.bossVictoryPlans[op.ID], w.bossVictoryKnown[op.ID] = cloneBossVictory(op), true
	return nil
}

func (w *World) BossVictoryPlanConfirmed(id string) bool {
	w.bossVictoryMu.Lock()
	defer w.bossVictoryMu.Unlock()
	return w.bossVictoryKnown[id]
}

// Project only the strongly stored encounter's boss-room checkpoint. The
// shared operation, independent of any player's resume, retains unpaid claims.
func (w *World) ConfirmBossVictoryProgress(op database.BossVictoryOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	inst, found := w.getDungeonInstance(op.InstanceID)
	if !found {
		return nil
	}
	inst.Mu.Lock()
	defer inst.Mu.Unlock()
	if inst.RoomState == nil || op.RoomIndex >= len(inst.Layout.Rooms) || op.RoomIndex >= len(inst.RoomState.Rooms) || inst.Layout.Rooms[op.RoomIndex].Type != "boss" ||
		inst.DungeonType != op.DungeonType || inst.RunLevel != op.RunLevel || (string(inst.Difficulty) != op.Difficulty && !(inst.Difficulty == "" && op.Difficulty == "normal")) {
		return ErrBossVictoryEffectConflict
	}
	inst.RoomState.MarkRoomCleared(op.RoomIndex)
	inst.RoomState.Rooms[op.RoomIndex].Rewarded = true
	for playerID := range inst.PlayerRoomSummary {
		inst.PlayerRoomSummary[playerID] = withDungeonSummaryContext(inst.RoomState.Summary(0, 0), inst.Difficulty, inst.RunLevel)
	}
	return nil
}

func (w *World) RetireBossVictoryPlan(op database.BossVictoryOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	w.bossVictoryMu.Lock()
	if previous, found := w.bossVictoryPlans[op.ID]; found {
		if previous.Fingerprint != op.Fingerprint {
			w.bossVictoryMu.Unlock()
			return ErrBossVictoryEffectConflict
		}
		delete(w.bossVictoryPlans, op.ID)
		delete(w.bossVictoryKnown, op.ID)
	}
	w.bossVictoryMu.Unlock()
	// Independent recovery, not only the original death worker, may be the
	// caller which proves complete custody after an unknown acknowledgement.
	w.endDungeonCombatReward(op.BossID)
	return nil
}

func BossVictoryRewardSummary(op database.BossVictoryOperation, participant database.BossVictoryRecipient, progression ExperienceRewardReceipt, queue []string) RewardSummaryEvent {
	hearts := 0
	pending := 0
	var items []*Item
	for _, payload := range participant.Items {
		item, err := decodeGroundItem(payload)
		if err != nil {
			continue
		}
		if slices.Contains(queue, payload) {
			pending++
		}
		if item.Name == "Eidolon Heart" {
			hearts += max(1, item.Stack)
		} else {
			items = append(items, &item)
		}
	}
	summary := buildBossRewardSummary(participant.PlayerID, op.BossType, op.DungeonType, DungeonDifficulty(op.Difficulty), op.RunLevel,
		0, 0, 0, 0, participant.Gold, participant.XP, hearts, items)
	summary.Progression, summary.PendingItemCount = &progression, pending
	return summary
}
