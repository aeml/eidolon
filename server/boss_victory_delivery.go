package main

import (
	"encoding/json"
	"errors"
	"maps"
	"reflect"
	"slices"
	"sync"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type bossVictoryStore interface {
	directTradeCharacterStore
	GetBossVictory(string) (*database.BossVictoryRecord, error)
	PrepareBossVictory(database.BossVictoryOperation) (*database.BossVictoryRecord, error)
	CompleteBossVictory(string, string) (*database.BossVictoryRecord, error)
	PendingBossVictories(string, string, int) ([]database.BossVictoryRecord, error)
}

var bossVictories bossVictoryStore

type bossVictorySavePending struct {
	op      database.BossVictoryOperation
	summary game.RewardSummaryEvent
}

// Save/admission fence and feedback only. The immutable shared store owns
// entitlement; the full character and existing filesystem journal own effects.
var bossVictoryPendingSaves = struct {
	sync.Mutex
	accounts map[string]bossVictorySavePending
}{accounts: map[string]bossVictorySavePending{}}

func bossVictoryPendingFor(username string) (bossVictorySavePending, bool) {
	bossVictoryPendingSaves.Lock()
	defer bossVictoryPendingSaves.Unlock()
	entry, found := bossVictoryPendingSaves.accounts[username]
	return entry, found
}

func setBossVictoryPending(username string, entry bossVictorySavePending) {
	bossVictoryPendingSaves.Lock()
	defer bossVictoryPendingSaves.Unlock()
	bossVictoryPendingSaves.accounts[username] = entry
}

func clearBossVictoryPending(username, id string) {
	bossVictoryPendingSaves.Lock()
	defer bossVictoryPendingSaves.Unlock()
	if entry, found := bossVictoryPendingSaves.accounts[username]; found && entry.op.ID == id {
		delete(bossVictoryPendingSaves.accounts, username)
	}
}

// Prepare FIRST, before any private effect or cleared checkpoint. Unknown
// preparation never falls back to a new roll. One failed account does not
// block another member's original claim. No all-party locks span database IO.
// This coordinator deliberately does NOT terminalize the shared operation:
// original public drops must cross their recovery barrier before completion.
func prepareAndDeliverBossVictoryCharacters(proposal database.BossVictoryOperation, allowPrepare bool) (database.BossVictoryOperation, error) {
	if bossVictories == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		return proposal, errors.New("boss victory persistence unavailable")
	}
	if err := proposal.Validate(); err != nil {
		return proposal, err
	}
	record, err := bossVictories.GetBossVictory(proposal.ID)
	if err != nil {
		return proposal, err
	}
	if record == nil {
		if !allowPrepare || (world != nil && world.BossVictoryPlanConfirmed(proposal.ID)) {
			return proposal, database.ErrBossVictoryConflict
		}
		record, err = bossVictories.PrepareBossVictory(proposal)
		if err != nil {
			if !errors.Is(err, database.ErrBossVictoryConflict) {
				return proposal, err
			}
			record, err = bossVictories.GetBossVictory(proposal.ID)
			if err != nil {
				return proposal, err
			}
		}
	}
	if record == nil || record.Validate() != nil || record.ID != proposal.ID {
		return proposal, database.ErrBossVictoryConflict
	}
	op := record.BossVictoryOperation
	if world != nil {
		if err := world.RetainConfirmedBossVictoryPlan(op); err != nil {
			return op, err
		}
		if err := world.ConfirmBossVictoryProgress(op); err != nil {
			return op, err
		}
	}
	var failures []error
	// Validate even terminal receipt owners: never overwrite missing saved
	// proof with an older live image or manufacture a terminal grant.
	for _, participant := range op.Participants {
		unlock := lockCharacterWork(participant.Username)
		_, err := deliverBossVictoryRecipientLocked(op, participant.Username)
		unlock()
		if err != nil {
			failures = append(failures, err)
		}
	}
	return op, errors.Join(failures...)
}

func deliverBossVictoryRecipientLocked(op database.BossVictoryOperation, username string) (bool, error) {
	participant, eligible := database.BossVictoryRecipientFor(op, username)
	if !eligible || bossVictories == nil || op.Validate() != nil {
		return false, database.ErrBossVictoryConflict
	}
	if previous, found := bossVictoryPendingFor(username); found && previous.op.ID != op.ID {
		if _, err := deliverBossVictoryRecipientLocked(previous.op, username); err != nil {
			return false, err
		}
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return false, err
	}
	record, err := bossVictories.GetBossVictory(op.ID)
	if err != nil {
		return false, err
	}
	if record == nil || record.Validate() != nil || record.ID != op.ID || record.Fingerprint != op.Fingerprint {
		return false, database.ErrBossVictoryConflict
	}
	saved, err := bossVictories.GetDirectTradeCharacter(username, username)
	if err != nil {
		return false, err
	}
	if saved == nil || saved.Name != username {
		return false, database.ErrBossVictoryConflict
	}
	previous, pending := bossVictoryPendingFor(username)
	if database.BossVictoryCharacterReceiptMatches(saved, op) {
		var live *game.Entity
		if world != nil {
			live = world.GetEntityCopy(participant.PlayerID)
		}
		if live != nil && (live.Name != username || live.ItemDeliveryReceipts[op.ID] != op.Fingerprint) {
			return false, database.ErrBossVictoryConflict
		}
		clearBossVictoryPending(username, op.ID)
		if pending {
			// The strongly saved image is the acknowledgement, never a fresh
			// live bag which may contain a newer still-unconfirmed award.
			bag, err := bossVictorySavedInventory(saved)
			if live != nil {
				// DB bags compact empty slots. Preserve the live slot layout
				// only when its owned contents match confirmed storage. If a
				// newer award arrived during IO, save that complete capture first.
				bag, err = json.Marshal(live.Inventory)
				if err == nil && !reflect.DeepEqual(databaseItems(live.Inventory, true), saved.Inventory) {
					latest := characterSnapshotForSave(username, live)
					if _, err = projectBossVictorySnapshot(latest, op); err == nil {
						err = persistCharacterSnapshot(username, latest)
					}
					if err == nil {
						saved = latest
					}
				}
			}
			if err != nil {
				setBossVictoryPending(username, previous)
				return false, err
			}
			notifyBossVictorySaved(op, previous.summary, bag, saved, live != nil)
		}
		return pending, nil
	}
	if record.State == database.BossVictoryComplete {
		return false, database.ErrBossVictoryConflict
	}
	if _, err := projectBossVictorySnapshot(saved, op); err != nil {
		return false, err // Validate saved run shape before live value mutation.
	}
	var progression game.ExperienceRewardReceipt
	var found, changed bool
	var character *database.Character
	var bag []byte
	if world != nil {
		found, progression, changed, err = world.ApplyBossVictoryCharacterEffect(participant.PlayerID, op)
		if err != nil {
			return false, err
		}
		if found {
			entity := world.GetEntityCopy(participant.PlayerID)
			if entity == nil || entity.Name != username || entity.ItemDeliveryReceipts[op.ID] != op.Fingerprint {
				return false, database.ErrBossVictoryConflict
			}
			character = characterSnapshotForSave(username, entity)
			bag, err = json.Marshal(entity.Inventory)
			if err != nil {
				return false, err
			}
		}
	}
	if !found {
		character = saved
		progression, changed, err = applyOfflineBossVictory(character, op)
		if err != nil {
			return false, err
		}
	}
	if _, err := projectBossVictorySnapshot(character, op); err != nil {
		// A live applied image MUST be fenced even if its saved run is corrupt.
		if found {
			setBossVictoryPending(username, bossVictorySavePending{op: op})
		}
		return false, err
	}
	summary := game.BossVictoryRewardSummary(op, participant, progression, character.PendingBossLoot)
	if pending && previous.op.ID == op.ID {
		summary = previous.summary
	}
	setBossVictoryPending(username, bossVictorySavePending{op: op, summary: summary})
	if err := persistCharacterSnapshot(username, character); err != nil {
		return false, err
	}
	clearBossVictoryPending(username, op.ID)
	if changed || pending {
		notifyBossVictorySaved(op, summary, bag, character, found)
	}
	return changed || pending, nil
}

func bossVictorySavedInventory(character *database.Character) ([]byte, error) {
	items := make([]game.Item, len(character.Inventory))
	for i, item := range character.Inventory {
		items[i] = gameItemFromDatabaseExact(item)
	}
	return json.Marshal(items)
}

func notifyBossVictorySaved(op database.BossVictoryOperation, summary game.RewardSummaryEvent, bag []byte, character *database.Character, live bool) {
	if world == nil {
		return
	}
	if world.Economy != nil {
		world.Economy.RecordSource("combat_rewards", summary.Gold)
	}
	if !live {
		return
	}
	if client := getClientByPlayerID(summary.PlayerID); client != nil {
		client.sendSafe(createMessage(MsgInventory, bag))
	}
	if world.OnEvent != nil {
		world.OnEvent("reward_summary", summary)
		if op.BossType == "UmbraPrime" {
			world.OnEvent("weekly_raid_complete", game.WeeklyRaidCompletionEvent{PlayerID: summary.PlayerID, InstanceID: op.InstanceID, CompletedAt: op.CreatedAt})
		}
	}
	if world.OnQuestUpdate != nil {
		quests := make([]game.Quest, len(character.Quests))
		for index, quest := range character.Quests {
			quests[index] = questFromDatabase(quest)
		}
		world.OnQuestUpdate(summary.PlayerID, quests)
	}
}

func projectBossVictorySnapshot(character *database.Character, op database.BossVictoryOperation) (bool, error) {
	resume := character.DungeonProgress
	if resume == nil || resume.InstanceID != op.InstanceID {
		return false, nil // Do not rewrite a newer unrelated run.
	}
	if op.RoomIndex >= len(resume.Rooms) || op.RoomIndex >= len(resume.Layout.Rooms) || resume.Layout.Rooms[op.RoomIndex].Type != "boss" ||
		resume.DungeonType != op.DungeonType || resume.RunLevel != op.RunLevel || (resume.Difficulty != op.Difficulty && !(resume.Difficulty == "" && op.Difficulty == "normal")) {
		return false, database.ErrBossVictoryConflict
	}
	progress := &resume.Rooms[op.RoomIndex]
	changed := !progress.Explored || !progress.Cleared || !progress.Rewarded
	progress.Explored, progress.Cleared, progress.Rewarded = true, true, true
	return changed, nil
}

func applyOfflineBossVictory(character *database.Character, op database.BossVictoryOperation) (game.ExperienceRewardReceipt, bool, error) {
	initialLevel := character.Level
	entity, err := hydrateOfflineRewardCharacter(character)
	if err != nil {
		return game.ExperienceRewardReceipt{}, false, err
	}
	entity.PendingBossLoot = slices.Clone(character.PendingBossLoot)
	entity.WeeklyRaidCompletions = maps.Clone(character.WeeklyRaidCompletions)
	for _, quest := range character.Quests {
		entity.Quests = append(entity.Quests, questFromDatabase(quest))
	}
	receipt, changed, err := entity.ApplyBossVictoryCharacterEffect(op)
	if err != nil || !changed {
		return receipt, changed, err
	}
	projectOfflineRewardCharacter(character, entity, initialLevel)
	character.PendingBossLoot = slices.Clone(entity.PendingBossLoot)
	character.WeeklyRaidCompletions = maps.Clone(entity.WeeklyRaidCompletions)
	// Only kill counters change. Keep all exact saved definition, quote and
	// future fields rather than projecting a fresh whole quest definition.
	for i := range character.Quests {
		character.Quests[i].Count = entity.Quests[i].Count
	}
	return receipt, true, nil
}

// Packet admission is cheap when no effect has failed to save; it never polls
// the shared reward collection on every movement or skill packet.
func recoverAccountBossVictoriesLocked(username string) error {
	entry, found := bossVictoryPendingFor(username)
	if !found {
		return nil
	}
	_, err := deliverBossVictoryRecipientLocked(entry.op, username)
	return err
}

// Authenticated account recovery drains all original claims before hydration.
// Unlike separate room awards, full bags retain boss items and do not refuse
// earned Gold, XP or quest credit. Public-drop completion remains separate.
func recoverColdAccountBossVictoriesLocked(username string) error {
	if bossVictories == nil {
		return nil
	}
	if err := recoverAccountBossVictoriesLocked(username); err != nil {
		return err
	}
	after := ""
	for {
		page, err := bossVictories.PendingBossVictories(username, after, 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			return nil
		}
		for _, record := range page {
			if record.Validate() != nil || record.State != database.BossVictoryPending || record.ID <= after {
				return database.ErrBossVictoryConflict
			}
			after = record.ID
			if _, err := deliverBossVictoryRecipientLocked(record.BossVictoryOperation, username); err != nil {
				return err
			}
		}
	}
}
