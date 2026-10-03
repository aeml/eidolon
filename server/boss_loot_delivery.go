package main

import (
	"encoding/json"
	"errors"
	"slices"
	"sort"
	"strings"
	"sync"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

var bossLootCharacters directTradeCharacterStore

// Presentation only. Value is in the whole live character and real filesystem
// save journal, never in this map. Account work locks serialize each entry.
type bossLootFeedback struct {
	collected int
	summaries []game.RewardSummaryEvent
	weekly    []game.WeeklyRaidCompletionEvent
}

var bossLootPending = struct {
	sync.Mutex
	accounts map[string]bossLootFeedback
}{accounts: map[string]bossLootFeedback{}}

var bossLootRecovery = struct {
	sync.Mutex
	after string
}{}

func pendingBossLootFeedback(username string) (bossLootFeedback, bool) {
	bossLootPending.Lock()
	defer bossLootPending.Unlock()
	entry, found := bossLootPending.accounts[username]
	return entry, found
}

func setPendingBossLootFeedback(username string, entry bossLootFeedback) {
	bossLootPending.Lock()
	defer bossLootPending.Unlock()
	bossLootPending.accounts[username] = entry
}

func clearPendingBossLootFeedback(username string) {
	bossLootPending.Lock()
	delete(bossLootPending.accounts, username)
	bossLootPending.Unlock()
}

// Combat has released all scene/entity locks. Persist the earned whole image
// synchronously before its parent worker can advance the boss-room checkpoint.
// This is a save barrier, NOT a stable physical-boss/cohort replay ledger.
func persistBossRewardFeedback(summary game.RewardSummaryEvent, weekly *game.WeeklyRaidCompletionEvent) error {
	username, valid := strings.CutPrefix(summary.PlayerID, "player-")
	if !valid || username == "" || world == nil {
		return errors.New("invalid boss reward recipient")
	}
	unlock := lockCharacterWork(username)
	defer unlock()
	entry, _ := pendingBossLootFeedback(username)
	entry.summaries = append(entry.summaries, summary)
	if weekly != nil {
		entry.weekly = append(entry.weekly, *weekly)
	}
	setPendingBossLootFeedback(username, entry)
	return recoverLiveBossLootLocked(username, false)
}

// Caller owns the account work lock. A full bag or unsupported original payload
// is a pure refusal, not a login fence. An applied but unconfirmed save IS a
// fence, even if claiming emptied the queue in RAM.
func recoverLiveBossLootLocked(username string, collect bool) error {
	if world == nil {
		return nil
	}
	playerID := "player-" + username
	entity := world.GetEntityCopy(playerID)
	entry, pending := pendingBossLootFeedback(username)
	if entity == nil {
		if pending {
			return errors.New("boss reward recipient unavailable; save remains pending")
		}
		return nil
	}
	if entity.Type != game.TypePlayer || entity.Name != username {
		return errors.New("boss loot character identity conflict")
	}
	if !pending && (!collect || len(entity.PendingBossLoot) == 0) {
		return nil
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return err
	}
	if collect {
		_, count, err := world.CollectPendingBossLoot(playerID, 10)
		if err != nil && !errors.Is(err, game.ErrBossLootUnsupported) && !errors.Is(err, game.ErrGroundItemIdentity) {
			return err
		}
		if count != 0 {
			entry.collected += count
			pending = true
			setPendingBossLootFeedback(username, entry)
		}
	}
	if !pending {
		return nil // No changed value and no pending success feedback: no save.
	}
	entity = world.GetEntityCopy(playerID)
	if entity == nil || entity.Name != username || entity.Type != game.TypePlayer {
		return errors.New("boss loot recipient disappeared before save")
	}
	// Marshal the SAME captured inventory that is saved. Re-reading RAM after IO
	// could acknowledge a concurrent, newer, still-unsaved combat award.
	bag, err := json.Marshal(entity.Inventory)
	if err != nil {
		return err
	}
	if err := persistCharacterSnapshot(username, characterSnapshotForSave(username, entity)); err != nil {
		return err
	}
	clearPendingBossLootFeedback(username)
	if client := getClientByPlayerID(playerID); client != nil {
		client.sendSafe(createMessage(MsgInventory, bag))
	}
	if world.OnEvent != nil {
		for _, summary := range entry.summaries {
			world.OnEvent("reward_summary", summary)
		}
		for _, weekly := range entry.weekly {
			world.OnEvent("weekly_raid_complete", weekly)
		}
	}
	return nil
}

// Authenticated cold recovery, AFTER trade custody reconciliation and BEFORE
// hydration. Change only bag and queue on the original saved image; retain the
// exact run/logout age, equipment, resources, currencies and story progress.
func recoverColdAccountBossLootLocked(username string) error {
	if bossLootCharacters == nil {
		return nil
	}
	if world != nil && world.GetEntityCopy("player-"+username) != nil {
		return recoverLiveBossLootLocked(username, true)
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return err
	}
	character, err := bossLootCharacters.GetDirectTradeCharacter(username, username)
	if err != nil || character == nil {
		return err
	}
	if character.Name != username {
		return errors.New("saved boss loot character identity conflict")
	}
	if len(character.PendingBossLoot) == 0 {
		// Reconciled journal + strong saved read prove the owned post-image.
		// A disconnected socket's presentation is not a durable reward outbox.
		clearPendingBossLootFeedback(username)
		return nil
	}
	state, err := database.DecodeDirectTradeState(character.DirectTradeState)
	if err != nil {
		return err
	}
	if state.Escrow != nil {
		return nil // Orphan trade reconciliation owns the offered bag first.
	}
	player := &game.Entity{PendingBossLoot: slices.Clone(character.PendingBossLoot), Equipment: map[string]game.Item{}}
	for _, item := range character.Inventory {
		player.Inventory = append(player.Inventory, gameItemFromDatabaseExact(item))
	}
	for len(player.Inventory) < game.MaxInventorySize {
		player.Inventory = append(player.Inventory, game.Item{})
	}
	for _, item := range character.Stash {
		player.Stash = append(player.Stash, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Buyback {
		player.Buyback = append(player.Buyback, gameItemFromDatabaseExact(item))
	}
	for slot, item := range character.Equipment {
		player.Equipment[slot] = gameItemFromDatabaseExact(item)
	}
	count, err := player.CollectPendingBossLootLocked(10)
	if errors.Is(err, game.ErrBossLootUnsupported) || errors.Is(err, game.ErrGroundItemIdentity) {
		clearPendingBossLootFeedback(username)
		return nil // Preserve verbatim; do not permanently exclude the owner.
	}
	if err != nil || count == 0 {
		if err == nil {
			clearPendingBossLootFeedback(username)
		}
		return err
	}
	character.Inventory = databaseItems(player.Inventory, false)
	character.PendingBossLoot = slices.Clone(player.PendingBossLoot)
	if err := persistCharacterSnapshot(username, character); err != nil {
		return err
	}
	clearPendingBossLootFeedback(username)
	return nil
}

func recoverAccountBossLootLocked(username string) error {
	if _, pending := pendingBossLootFeedback(username); !pending {
		return nil // No inventory copies, remote or filesystem IO per movement.
	}
	return recoverLiveBossLootLocked(username, false)
}

func retryBossLootAfterBagChangeLocked(client *Client, action string) {
	if bossLootCharacters == nil {
		return
	}
	switch action {
	case MsgInventoryDrop, MsgSell, MsgStashDeposit, MsgEquip, MsgInventoryMove, MsgInventorySort:
	default:
		return
	}
	if err := recoverLiveBossLootLocked(client.username, true); err != nil {
		client.sendError("Your boss loot is retained while its save recovers. Please retry shortly.")
	}
}

// Bounded rotating, non-overlapping retries. Full bags and active trades cannot
// starve later accounts. No remote all-character scan or per-item goroutines.
func recoverPendingBossLoot() error {
	if bossLootCharacters == nil || !bossLootRecovery.TryLock() {
		return nil
	}
	defer bossLootRecovery.Unlock()
	accounts := map[string]bool{}
	if world != nil {
		for _, id := range world.PlayersWithPendingBossLoot() {
			if username, ok := strings.CutPrefix(id, "player-"); ok && username != "" {
				accounts[username] = true
			}
		}
	}
	bossLootPending.Lock()
	for username := range bossLootPending.accounts {
		accounts[username] = true
	}
	bossLootPending.Unlock()
	users := make([]string, 0, len(accounts))
	for username := range accounts {
		users = append(users, username)
	}
	sort.Strings(users)
	start := sort.SearchStrings(users, bossLootRecovery.after)
	for start < len(users) && users[start] <= bossLootRecovery.after {
		start++
	}
	if start == len(users) {
		start = 0
	}
	var failures []error
	for _, username := range users[start:min(start+10, len(users))] {
		unlock := lockCharacterWork(username)
		err := recoverColdAccountBossLootLocked(username)
		unlock()
		bossLootRecovery.after = username
		if err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}
