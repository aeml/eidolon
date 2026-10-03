package main

import (
	"errors"
	"maps"
	"slices"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type dungeonRoomRewardStore interface {
	directTradeCharacterStore
	GetDungeonRoomReward(string) (*database.DungeonRoomRewardRecord, error)
	PrepareDungeonRoomReward(database.DungeonRoomRewardOperation) (*database.DungeonRoomRewardRecord, error)
	CompleteDungeonRoomReward(string, string) (*database.DungeonRoomRewardRecord, error)
	PendingDungeonRoomRewards(string, string, int) ([]database.DungeonRoomRewardRecord, error)
}

var dungeonRoomRewards dungeonRoomRewardStore

type roomRewardSavePending struct {
	op    database.DungeonRoomRewardOperation
	event game.DungeonRoomClearRewardEvent
}

// Only failed grant saves fence admission. Unprepared plans have no actor
// effects; full bags are pure refusals and may continue play to make room.
var roomRewardPendingSaves = struct {
	sync.Mutex
	accounts map[string]roomRewardSavePending
}{accounts: map[string]roomRewardSavePending{}}

func roomRewardPendingFor(username string) (roomRewardSavePending, bool) {
	roomRewardPendingSaves.Lock()
	defer roomRewardPendingSaves.Unlock()
	entry, found := roomRewardPendingSaves.accounts[username]
	return entry, found
}

func setRoomRewardPending(username string, entry roomRewardSavePending) {
	roomRewardPendingSaves.Lock()
	defer roomRewardPendingSaves.Unlock()
	roomRewardPendingSaves.accounts[username] = entry
}

// Called from the scene background worker with NO account/scene locks owned.
// Each individual save owns only that account, not all four party members.
func prepareAndDeliverDungeonRoomReward(op database.DungeonRoomRewardOperation) error {
	return deliverDungeonRoomRewardCohort(op, true)
}

func deliverDungeonRoomRewardCohort(op database.DungeonRoomRewardOperation, allowPrepare bool) error {
	if dungeonRoomRewards == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		return errors.New("room reward persistence unavailable")
	}
	if err := op.Validate(); err != nil {
		return err
	}
	record, err := dungeonRoomRewards.GetDungeonRoomReward(op.ID)
	if err != nil {
		return err
	}
	if record == nil {
		if !allowPrepare || (world != nil && world.DungeonRoomRewardPlanConfirmed(op.ID)) {
			return database.ErrDungeonRoomRewardConflict
		}
		record, err = dungeonRoomRewards.PrepareDungeonRoomReward(op)
		if err != nil {
			if !errors.Is(err, database.ErrDungeonRoomRewardConflict) {
				return err
			}
			// Another preparation won this physical room. Resolve its immutable
			// first outcome, never grant this process's losing local rolls.
			record, err = dungeonRoomRewards.GetDungeonRoomReward(op.ID)
			if err != nil {
				return err
			}
		}
	}
	if record == nil || record.Validate() != nil || record.ID != op.ID {
		return database.ErrDungeonRoomRewardConflict
	}
	op = record.DungeonRoomRewardOperation
	if world != nil {
		if err := world.ConfirmDungeonRoomRewardProgress(record.DungeonRoomRewardOperation); err != nil {
			return err
		}
		world.RetainConfirmedDungeonRoomRewardPlan(op)
	}
	var failures []error
	if record.State == database.DungeonRoomRewardPending {
		for _, participant := range record.Participants {
			unlock := lockCharacterWork(participant.Username)
			_, err := deliverDungeonRoomRewardRecipientLocked(record.DungeonRoomRewardOperation, participant.Username)
			unlock()
			if err != nil {
				failures = append(failures, err)
			}
		}
		if len(failures) != 0 {
			return errors.Join(failures...) // Other recipients already progressed.
		}
		record, err = dungeonRoomRewards.CompleteDungeonRoomReward(op.ID, op.Fingerprint)
		if err != nil {
			return err
		}
		if record == nil || record.Validate() != nil || record.State != database.DungeonRoomRewardComplete || record.ID != op.ID || record.Fingerprint != op.Fingerprint {
			return database.ErrDungeonRoomRewardConflict
		}
	}
	if world != nil {
		return world.RetireDungeonRoomRewardPlan(op)
	}
	return nil
}

// Complete journal/save before any ordinary bag/reward feedback. A volatile
// receipt alone is not saved proof; on replay save the latest full live copy.
func deliverDungeonRoomRewardRecipientLocked(op database.DungeonRoomRewardOperation, username string) (bool, error) {
	participant, eligible := database.DungeonRoomRewardRecipientFor(op, username)
	if !eligible || dungeonRoomRewards == nil {
		return false, database.ErrDungeonRoomRewardConflict
	}
	if previous, found := roomRewardPendingFor(username); found && previous.op.ID != op.ID {
		if _, err := deliverDungeonRoomRewardRecipientLocked(previous.op, username); err != nil {
			return false, err
		}
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return false, err
	}
	record, err := dungeonRoomRewards.GetDungeonRoomReward(op.ID)
	if err != nil {
		return false, err
	}
	if record == nil || record.Validate() != nil || record.ID != op.ID || record.Fingerprint != op.Fingerprint {
		return false, database.ErrDungeonRoomRewardConflict
	}
	saved, err := dungeonRoomRewards.GetDirectTradeCharacter(username, username)
	if err != nil {
		return false, err
	}
	if saved == nil || saved.Name != username {
		return false, database.ErrDungeonRoomRewardConflict
	}
	if database.DungeonRoomRewardCharacterReceiptMatches(saved, op) {
		if world != nil {
			if live := world.GetEntityCopy(participant.PlayerID); live != nil && (live.Name != username || live.ItemDeliveryReceipts[op.ID] != op.Fingerprint) {
				return false, database.ErrDungeonRoomRewardConflict // Never overwrite saved proof with a stale live copy.
			}
		}
		previous, pending := roomRewardPendingFor(username)
		clearRoomRewardPending(username, op.ID)
		if pending {
			notifyDungeonRoomRewardSaved(participant.PlayerID, previous.event)
		}
		return pending, nil
	}
	if record.State == database.DungeonRoomRewardComplete {
		return false, database.ErrDungeonRoomRewardConflict
	}
	var progression game.ExperienceRewardReceipt
	var found, changed bool
	var character *database.Character
	var liveEvent game.DungeonRoomClearRewardEvent
	if world != nil {
		progression, found, changed, liveEvent, err = world.ApplyDurableDungeonRoomReward(op, username)
		if err != nil {
			return false, err
		}
		if found {
			entity := world.GetEntityCopy(participant.PlayerID)
			if entity == nil || entity.Name != username || entity.ItemDeliveryReceipts[op.ID] != op.Fingerprint {
				return false, database.ErrDungeonRoomRewardConflict
			}
			character = characterSnapshotForSave(username, entity)
		}
	}
	if !found {
		character = saved
		progression, changed, err = applyOfflineDungeonRoomReward(character, op)
		if err != nil {
			if errors.Is(err, game.ErrDungeonRoomRewardFull) {
				projected, projectionErr := projectDungeonRoomRewardSnapshot(character, op)
				if projectionErr != nil {
					return false, projectionErr
				}
				if projected {
					if saveErr := persistCharacterSnapshot(username, character); saveErr != nil {
						return false, saveErr
					}
				}
			}
			return false, err
		}
		if _, err := projectDungeonRoomRewardSnapshot(character, op); err != nil {
			return false, err
		}
	}
	event := game.DungeonRoomRewardSummary(op, participant, progression)
	if found {
		event = liveEvent
	}
	previous, pending := roomRewardPendingFor(username)
	if pending && previous.op.ID == op.ID {
		event = previous.event // Preserve the original XP-to-cap split on retry.
	}
	if changed || pending {
		setRoomRewardPending(username, roomRewardSavePending{op: op, event: event})
	}
	if err := persistCharacterSnapshot(username, character); err != nil {
		// Even an in-memory receipt replay must be fenced after failed IO.
		setRoomRewardPending(username, roomRewardSavePending{op: op, event: event})
		return false, err
	}
	clearRoomRewardPending(username, op.ID)
	if changed || pending {
		notifyDungeonRoomRewardSaved(participant.PlayerID, event)
	}
	return changed || pending, nil
}

func projectDungeonRoomRewardSnapshot(character *database.Character, op database.DungeonRoomRewardOperation) (bool, error) {
	resume := character.DungeonProgress
	if resume == nil || resume.InstanceID != op.InstanceID {
		return false, nil
	}
	if op.RoomIndex < 0 || op.RoomIndex >= len(resume.Rooms) || op.RoomIndex >= len(resume.Layout.Rooms) || resume.RunLevel != op.RunLevel || resume.DungeonType != op.DungeonType ||
		(resume.Difficulty != op.Difficulty && !(resume.Difficulty == "" && op.Difficulty == "normal")) {
		return false, database.ErrDungeonRoomRewardConflict
	}
	room := resume.Layout.Rooms[op.RoomIndex]
	if room.Type != op.RoomType || room.Hook != op.RoomHook {
		return false, database.ErrDungeonRoomRewardConflict
	}
	progress := &resume.Rooms[op.RoomIndex]
	changed := !progress.Explored || !progress.Cleared || !progress.Rewarded
	progress.Explored, progress.Cleared, progress.Rewarded = true, true, true
	return changed, nil
}

func notifyDungeonRoomRewardSaved(playerID string, event game.DungeonRoomClearRewardEvent) {
	if world == nil {
		return
	}
	if world.Economy != nil {
		world.Economy.RecordSource("dungeon_room_rewards", event.Gold)
	}
	if entity := world.GetEntityCopy(playerID); entity != nil && world.OnEvent != nil {
		if event.BuffName != "" {
			if !entity.SanctuaryDamageReduction || !entity.SanctuaryEndTime.After(time.Now()) {
				event.BuffName, event.BuffDurationSeconds, event.DamageReductionPct = "", 0, 0
			} else {
				event.BuffDurationSeconds = min(8, max(1, int(time.Until(entity.SanctuaryEndTime).Seconds()+.999)))
			}
		}
		sendInventoryForPlayer(playerID)
		world.OnEvent("room_clear_reward", event)
	}
}

func clearRoomRewardPending(username, id string) {
	roomRewardPendingSaves.Lock()
	defer roomRewardPendingSaves.Unlock()
	if entry, found := roomRewardPendingSaves.accounts[username]; found && entry.op.ID == id {
		delete(roomRewardPendingSaves.accounts, username)
	}
}

// Hydrate the complete progression/build inputs, but update ONLY earned
// progression, bag and private receipt on the original saved character.
// Never replace unrelated EP, quests, equipment, rest, locations or metadata.
func applyOfflineDungeonRoomReward(character *database.Character, op database.DungeonRoomRewardOperation) (game.ExperienceRewardReceipt, bool, error) {
	initialLevel := character.Level
	entity := &game.Entity{ID: "player-" + character.Name, Name: character.Name, Type: game.TypePlayer, SubType: character.Class,
		Disconnected: true, State: "IDLE", Health: 1, Level: character.Level, Experience: character.XP, Gold: character.Gold,
		BaseStats:      game.Stats{Strength: character.Stats.Strength, Dexterity: character.Stats.Dexterity, Intelligence: character.Stats.Intelligence, Wisdom: character.Stats.Wisdom, Vitality: character.Stats.Vitality},
		SelectedBranch: character.SelectedBranch, SkillPoints: character.SkillPoints, UnlockedSkills: slices.Clone(character.UnlockedSkills),
		TalentRanks: maps.Clone(character.TalentRanks), SkillRunes: maps.Clone(character.SkillRunes), Equipment: map[string]game.Item{},
		ResonanceLevel: character.ResonanceLevel, ResonanceXP: character.ResonanceXP, ResonancePoints: character.ResonancePoints,
		ResonanceRanks: maps.Clone(character.ResonanceRanks), ItemDeliveryReceipts: cloneItemDeliveryReceipts(character.ItemDeliveryReceipts)}
	if entity.TalentRanks == nil {
		entity.TalentRanks = map[string]int{}
		for _, id := range character.UnlockedTalents {
			if id != "" {
				entity.TalentRanks[id] = 1
			}
		}
		// Match ordinary login's legacy over-budget migration for derived
		// maxima without rewriting the original saved talent fields here.
		if len(entity.TalentRanks) > character.Level/5 {
			entity.TalentRanks = map[string]int{}
		}
	}
	entity.NormalizeTalentRanks()
	for _, item := range character.Inventory {
		entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Stash {
		entity.Stash = append(entity.Stash, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Buyback {
		entity.Buyback = append(entity.Buyback, gameItemFromDatabaseExact(item))
	}
	for slot, item := range character.Equipment {
		entity.Equipment[slot] = gameItemFromDatabaseExact(item)
	}
	progress, err := game.MigrateSavedProgression(character.Level, character.XP, character.ProgressionVersion)
	if err != nil {
		return game.ExperienceRewardReceipt{}, false, err
	}
	entity.ApplySavedProgression(progress)
	if err := restoreCharacterWellRested(entity, character.WellRested); err != nil {
		return game.ExperienceRewardReceipt{}, false, err
	}
	entity.RecalculateStats()
	if err := restoreCharacterResources(entity, character.Resources); err != nil {
		return game.ExperienceRewardReceipt{}, false, err
	}
	receipt, changed, err := entity.ApplyDungeonRoomRewardCharacterEffect(op)
	if err != nil || !changed {
		return receipt, changed, err
	}
	character.Gold, character.Level, character.XP = entity.Gold, entity.Level, entity.Experience
	character.ProgressionVersion = game.CurrentProgressionVersion
	character.ResonanceLevel, character.ResonanceXP, character.ResonancePoints = entity.ResonanceLevel, entity.ResonanceXP, entity.ResonancePoints
	character.Stats = database.Stats{Strength: entity.BaseStats.Strength, Dexterity: entity.BaseStats.Dexterity, Intelligence: entity.BaseStats.Intelligence, Wisdom: entity.BaseStats.Wisdom, Vitality: entity.BaseStats.Vitality}
	character.UnlockedSkills = slices.Clone(entity.UnlockedSkills)
	character.Inventory, character.ItemDeliveryReceipts = databaseItems(entity.Inventory, true), cloneItemDeliveryReceipts(entity.ItemDeliveryReceipts)
	// Level growth may refill a living player's HP. No shrine/offline regen,
	// no new resource format for a legacy character that lacked a snapshot.
	if character.Resources != nil && entity.Level != initialLevel {
		character.Resources = resourceSnapshot(entity)
	}
	return receipt, true, nil
}
