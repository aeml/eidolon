package main

import (
	"errors"
	"maps"
	"strings"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type weeklyRaidRewardStore interface {
	PrepareWeeklyRaidReward(string, time.Time) (*database.WeeklyRaidLockout, error)
	UnpreparedWeeklyRaidRewards() ([]database.WeeklyRaidLockout, error)
	PendingWeeklyRaidRewards() ([]database.WeeklyRaidLockout, error)
	FinishWeeklyRaidReward(string, string) error
	DeferWeeklyRaidReward(string, string, time.Time) error
	GetWeeklyRaidCharacter(string, string) (*database.Character, error)
}

var weeklyRaidRewards weeklyRaidRewardStore

// Journal the recorded combat completion before the first entitlement write.
// Clear it only after Mongo either records an entitlement or confirms an old
// fulfilled lockout. The character outbox survives the initial database outage.
func prepareRecordedWeeklyRaidCompletion(entry database.WeeklyRaidLockout) (*database.WeeklyRaidLockout, error) {
	username := strings.TrimPrefix(entry.PlayerID, "player-")
	if weeklyRaidRewards == nil || username == "" || username == entry.PlayerID || entry.CompletedAt.IsZero() ||
		entry.Week != database.CurrentRaidWeek(entry.CompletedAt) {
		return nil, errors.New("invalid recorded weekly completion")
	}
	unlock := lockCharacterWork(username)
	defer unlock()
	var character *database.Character
	var entity *game.Entity
	if world != nil {
		entity = world.GetEntityCopy(entry.PlayerID)
	}
	live := entity != nil
	if live {
		character = characterSnapshotForSave(username, entity)
		if _, recorded := character.WeeklyRaidCompletions[entry.Week]; !recorded {
			return nil, nil
		}
		if err := persistCharacterSnapshot(username, character); err != nil {
			return nil, err
		}
	} else {
		if err := retryPendingCharacterSaveLocked(username); err != nil {
			return nil, err
		}
		var err error
		character, err = weeklyRaidRewards.GetWeeklyRaidCharacter(username, username)
		if err != nil {
			return nil, err
		}
		if character == nil {
			return nil, errors.New("weekly completion character unavailable")
		}
		if _, recorded := character.WeeklyRaidCompletions[entry.Week]; !recorded {
			return nil, nil
		}
	}
	// Use the first recorded kill time, not the replay time across a UTC week.
	prepared, err := weeklyRaidRewards.PrepareWeeklyRaidReward(entry.PlayerID, character.WeeklyRaidCompletions[entry.Week])
	if err != nil {
		return nil, err
	}
	if live {
		world.ClearWeeklyRaidCompletion(entry.PlayerID, entry.Week)
		entity = world.GetEntityCopy(entry.PlayerID)
		if entity == nil {
			// Expiry may remove the world entity independently of account IO.
			// Its completion snapshot/entitlement is already recorded: retry
			// through offline hydration, never persist a stale/nil live copy.
			return nil, errors.New("weekly completion recipient expired during preparation")
		}
		character = characterSnapshotForSave(username, entity)
	} else {
		delete(character.WeeklyRaidCompletions, entry.Week)
	}
	if err := persistCharacterSnapshot(username, character); err != nil {
		return nil, err
	}
	return prepared, nil
}

// The durable entitlement remains pending until the entire character grant
// and its receipt are saved. The existing journal handles uncertain saves.
// Per-account locking serializes this with reconnects, commands and autosaves.
func deliverWeeklyRaidReward(entry database.WeeklyRaidLockout) (game.WeeklyRaidRewardReceipt, bool, error) {
	var receipt game.WeeklyRaidRewardReceipt
	username := strings.TrimPrefix(entry.PlayerID, "player-")
	if weeklyRaidRewards == nil || username == "" || username == entry.PlayerID || entry.Week == "" || !entry.DeliveryPending {
		return receipt, false, errors.New("invalid pending weekly entitlement")
	}
	unlock := lockCharacterWork(username)
	defer unlock()
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		return receipt, false, errors.New("weekly character persistence unavailable")
	}
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return receipt, false, err
	}
	granted := false
	offline := false
	var character *database.Character
	if world != nil && world.GetEntityCopy(entry.PlayerID) != nil {
		receipt, granted = world.GrantWeeklyRaidRewardForWeek(entry.PlayerID, entry.Week)
		entity := world.GetEntityCopy(entry.PlayerID)
		if entity == nil || !entity.WeeklyRaidRewardReceipts[entry.Week] {
			return receipt, false, errors.New("weekly recipient unavailable or ineligible")
		}
		character = characterSnapshotForSave(username, entity)
	} else {
		offline = true
		var err error
		character, err = weeklyRaidRewards.GetWeeklyRaidCharacter(username, username)
		if err != nil {
			return receipt, false, err
		}
		if character == nil || character.Name != username {
			return receipt, false, errors.New("weekly character unavailable")
		}
		entity := &game.Entity{Type: game.TypePlayer, Level: character.Level, Gold: character.Gold,
			ResonanceLevel: character.ResonanceLevel, ResonanceXP: character.ResonanceXP, ResonancePoints: character.ResonancePoints,
			WeeklyRaidRewardReceipts: maps.Clone(character.WeeklyRaidRewardReceipts)}
		for _, item := range character.Inventory {
			entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
		}
		// Saved bags may omit unused trailing slots. Offline delivery must have
		// the same visible capacity as normal login, not treat a short bag as full.
		for len(entity.Inventory) < game.MaxInventorySize {
			entity.Inventory = append(entity.Inventory, game.Item{})
		}
		receipt, granted = entity.ApplyWeeklyRaidRewardForWeek(entry.Week)
		if !entity.WeeklyRaidRewardReceipts[entry.Week] {
			return receipt, false, errors.New("weekly character cannot accept its reward yet")
		}
		character.Gold = entity.Gold
		character.ResonanceLevel, character.ResonanceXP, character.ResonancePoints = entity.ResonanceLevel, entity.ResonanceXP, entity.ResonancePoints
		character.Inventory = databaseItems(entity.Inventory, true)
		character.WeeklyRaidRewardReceipts = maps.Clone(entity.WeeklyRaidRewardReceipts)
	}
	if granted {
		if err := persistCharacterSnapshot(username, character); err != nil {
			return receipt, false, err
		}
		if offline && world != nil && world.Economy != nil {
			world.Economy.RecordSource("weekly_raid", receipt.Gold)
		}
	}
	if err := weeklyRaidRewards.FinishWeeklyRaidReward(entry.PlayerID, entry.Week); err != nil {
		return receipt, false, err
	}
	return receipt, granted, nil
}

func recoverPendingWeeklyRaidRewards() error {
	if weeklyRaidRewards == nil {
		return nil
	}
	var failures []error
	// A coalesced request contains no individual event payload. Discover live
	// outboxes first: they may not yet be in Mongo, or may belong to a player
	// whose socket has gone away. Existing preparation journals the complete
	// character before its first entitlement write, using the recorded kill time.
	preparationFailed := false
	if world != nil {
		for _, completion := range world.PendingWeeklyRaidCompletions() {
			if _, err := prepareRecordedWeeklyRaidCompletion(database.WeeklyRaidLockout{
				PlayerID: completion.PlayerID, Week: database.CurrentRaidWeek(completion.CompletedAt),
				CompletedAt: completion.CompletedAt, DeliveryPending: true,
			}); err != nil {
				failures = append(failures, err)
				preparationFailed = true
				break // Leave remaining outboxes intact; don't multiply write timeouts.
			}
		}
	}
	completions, err := weeklyRaidRewards.UnpreparedWeeklyRaidRewards()
	if err != nil {
		failures = append(failures, err)
	} else if !preparationFailed {
		for _, completion := range completions {
			if _, err := prepareRecordedWeeklyRaidCompletion(completion); err != nil {
				failures = append(failures, err)
				// Do not multiply timeouts during an outage, but still attempt
				// delivery of entitlements which were already recorded.
				break
			}
		}
	}
	entries, err := weeklyRaidRewards.PendingWeeklyRaidRewards()
	if err != nil {
		return errors.Join(append(failures, err)...)
	}
	for _, entry := range entries {
		receipt, granted, err := deliverWeeklyRaidReward(entry)
		if err != nil {
			failures = append(failures, err)
			if deferred := weeklyRaidRewards.DeferWeeklyRaidReward(entry.PlayerID, entry.Week, time.Now().Add(time.Minute)); deferred != nil {
				return errors.Join(append(failures, deferred)...)
			} // Stop on database outage rather than multiplying timeouts.
			continue
		}
		notifyWeeklyRaidReward(entry.PlayerID, receipt, granted)
	}
	return errors.Join(failures...)
}

func notifyWeeklyRaidReward(playerID string, receipt game.WeeklyRaidRewardReceipt, granted bool) {
	if client := getClientByPlayerID(playerID); client != nil {
		if granted {
			client.sendSystemChat(weeklyRaidRewardMessage(receipt))
		}
		sendInventoryForPlayer(playerID)
		sendEndgameState(client)
	}
}
