package game

import (
	"slices"
	"time"

	"eidolon-server/internal/database"
)

func cloneDungeonRoomReward(op database.DungeonRoomRewardOperation) database.DungeonRoomRewardOperation {
	op.Participants = slices.Clone(op.Participants)
	for index := range op.Participants {
		op.Participants[index].Items = slices.Clone(op.Participants[index].Items)
	}
	return op
}

// Serialize first capture only, never remote IO. A retry retains win-time
// eligibility and rolls even after a death, disconnect, level-up or movement.
func (w *World) CaptureDungeonRoomReward(instanceID string, roomIndex int) (database.DungeonRoomRewardOperation, error) {
	w.dungeonRoomRewardMu.Lock()
	defer w.dungeonRoomRewardMu.Unlock()
	id := database.DungeonRoomRewardID(instanceID, roomIndex)
	if op, found := w.dungeonRoomRewards[id]; found {
		return cloneDungeonRoomReward(op), nil
	}
	op, err := w.PrepareDungeonRoomReward(instanceID, roomIndex)
	if err != nil {
		return op, err
	}
	if w.dungeonRoomRewards == nil {
		w.dungeonRoomRewards = map[string]database.DungeonRoomRewardOperation{}
	}
	w.dungeonRoomRewards[id] = cloneDungeonRoomReward(op)
	return op, nil
}

func (w *World) PendingDungeonRoomRewardPlans() []database.DungeonRoomRewardOperation {
	w.dungeonRoomRewardMu.Lock()
	defer w.dungeonRoomRewardMu.Unlock()
	plans := make([]database.DungeonRoomRewardOperation, 0, len(w.dungeonRoomRewards))
	for _, op := range w.dungeonRoomRewards {
		plans = append(plans, cloneDungeonRoomReward(op))
	}
	return plans
}

// A fresh process can capture a different local proposal for a restored room.
// The FIRST strongly stored outcome, never that new proposal, owns the room.
func (w *World) RetainConfirmedDungeonRoomRewardPlan(op database.DungeonRoomRewardOperation) {
	w.dungeonRoomRewardMu.Lock()
	defer w.dungeonRoomRewardMu.Unlock()
	if w.dungeonRoomRewards == nil {
		w.dungeonRoomRewards = map[string]database.DungeonRoomRewardOperation{}
	}
	w.dungeonRoomRewards[op.ID] = cloneDungeonRoomReward(op)
	if w.dungeonRoomRewardKnown == nil {
		w.dungeonRoomRewardKnown = map[string]bool{}
	}
	w.dungeonRoomRewardKnown[op.ID] = true
}

func (w *World) DungeonRoomRewardPlanConfirmed(id string) bool {
	w.dungeonRoomRewardMu.Lock()
	defer w.dungeonRoomRewardMu.Unlock()
	return w.dungeonRoomRewardKnown[id]
}

// Only a strongly confirmed shared plan may project progress. Even if the
// scene expired/reset, its individual claims remain independently recoverable.
func (w *World) ConfirmDungeonRoomRewardProgress(op database.DungeonRoomRewardOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	inst, found := w.getDungeonInstance(op.InstanceID)
	if !found {
		return nil
	}
	inst.Mu.Lock()
	defer inst.Mu.Unlock()
	if inst.RoomState == nil || op.RoomIndex >= len(inst.Layout.Rooms) || op.RoomIndex >= len(inst.RoomState.Rooms) ||
		inst.RunLevel != op.RunLevel || inst.DungeonType != op.DungeonType ||
		(string(inst.Difficulty) != op.Difficulty && !(inst.Difficulty == "" && op.Difficulty == "normal")) {
		return ErrDungeonRoomRewardConflict
	}
	room := inst.Layout.Rooms[op.RoomIndex]
	if room.Type != op.RoomType || room.Hook != op.RoomHook {
		return ErrDungeonRoomRewardConflict
	}
	inst.RoomState.MarkRoomCleared(op.RoomIndex)
	inst.RoomState.Rooms[op.RoomIndex].Rewarded = true
	for playerID := range inst.PlayerRoomSummary {
		inst.PlayerRoomSummary[playerID] = withDungeonSummaryContext(inst.RoomState.Summary(0, 0), inst.Difficulty, inst.RunLevel)
	}
	return nil
}

// The shared store must prove all saved receipts before retirement.
func (w *World) RetireDungeonRoomRewardPlan(op database.DungeonRoomRewardOperation) error {
	w.dungeonRoomRewardMu.Lock()
	defer w.dungeonRoomRewardMu.Unlock()
	if previous, found := w.dungeonRoomRewards[op.ID]; found {
		if previous.Fingerprint != op.Fingerprint {
			return ErrDungeonRoomRewardConflict
		}
		delete(w.dungeonRoomRewards, op.ID)
		delete(w.dungeonRoomRewardKnown, op.ID)
	}
	return nil
}

// Caller owns account work. Pin/mutation are atomic against entity expiry;
// callers release these locks before journal/database IO.
func (w *World) ApplyDurableDungeonRoomReward(op database.DungeonRoomRewardOperation, username string) (ExperienceRewardReceipt, bool, bool, DungeonRoomClearRewardEvent, error) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player := w.Entities["player-"+username]
	if player == nil {
		return ExperienceRewardReceipt{}, false, false, DungeonRoomClearRewardEvent{}, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	health, mana := player.Health, player.Mana
	progression, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op)
	participant, _ := database.DungeonRoomRewardRecipientFor(op, username)
	event := DungeonRoomRewardSummary(op, participant, progression)
	if changed && op.RoomHook == "shrine" {
		event.HealthRestored, event.ManaRestored = max(0, player.Health-health), max(0, player.Mana-mana)
		if player.SanctuaryDamageReduction && player.SanctuaryEndTime.After(time.Now()) {
			event.BuffName, event.BuffDurationSeconds, event.DamageReductionPct = "Sanctuary", min(8, max(1, int(time.Until(player.SanctuaryEndTime).Seconds()+.999))), 25
		}
	}
	return progression, true, changed, event, err
}

func DungeonRoomRewardSummary(op database.DungeonRoomRewardOperation, participant database.DungeonRoomRewardRecipient, progression ExperienceRewardReceipt) DungeonRoomClearRewardEvent {
	items, gems := 0, 0
	for _, payload := range participant.Items {
		item, err := decodeGroundItem(payload)
		if err != nil {
			continue
		}
		if item.Type == ItemGem {
			gems++
		} else {
			items++
		}
	}
	event := buildDungeonRoomClearRewardSummary(participant.PlayerID, op.RoomIndex, op.Objective, participant.Gold, participant.XP,
		items, gems, 0, op.DungeonType, DungeonDifficulty(op.Difficulty), op.RoomType, op.RoomHook, 0, 0)
	event.Progression = &progression
	if op.RoomHook == "shrine" {
		// Offline/delayed claims never advertise a fresh eight-second buff.
		event.BuffName, event.BuffDurationSeconds, event.DamageReductionPct = "", 0, 0
		event.Hint = "Shrine secured — your room reward is retained"
	}
	return event
}
