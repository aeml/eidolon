package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

// Shared outcome/character acknowledgements are modeled; the BSON filesystem
// journal is real. Actual Mongo, socket death and SIGKILL acceptance are later
// integration gates, not claims made by these targeted coordinator tests.
type bossVictoryRecoveryStore struct {
	*tradeRecoveryStore
	victories map[string]database.BossVictoryRecord
}

func cloneBossVictoryRecord(record database.BossVictoryRecord) *database.BossVictoryRecord {
	payload, err := bson.Marshal(record)
	if err != nil {
		panic(err)
	}
	var result database.BossVictoryRecord
	if err := bson.Unmarshal(payload, &result); err != nil {
		panic(err)
	}
	return &result
}

func (store *bossVictoryRecoveryStore) GetBossVictory(id string) (*database.BossVictoryRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.reads++
	if record, found := store.victories[id]; found {
		return cloneBossVictoryRecord(record), nil
	}
	return nil, nil
}

func (store *bossVictoryRecoveryStore) PrepareBossVictory(op database.BossVictoryOperation) (*database.BossVictoryRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.prepareCalls++
	if store.failPrepareBefore {
		store.failPrepareBefore = false
		return nil, errors.New("prepare rejected")
	}
	if record, found := store.victories[op.ID]; found {
		if record.Fingerprint != op.Fingerprint {
			return nil, database.ErrBossVictoryConflict
		}
		return cloneBossVictoryRecord(record), nil
	}
	record := database.BossVictoryRecord{BossVictoryOperation: op, State: database.BossVictoryPending}
	store.victories[op.ID] = *cloneBossVictoryRecord(record)
	if store.failPrepareAfter {
		store.failPrepareAfter = false
		return nil, errors.New("prepare applied, acknowledgement lost")
	}
	return cloneBossVictoryRecord(record), nil
}

func (store *bossVictoryRecoveryStore) CompleteBossVictory(id, fingerprint string) (*database.BossVictoryRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.completeCalls++
	record, found := store.victories[id]
	if !found || record.Fingerprint != fingerprint {
		return nil, database.ErrBossVictoryConflict
	}
	for _, participant := range record.Participants {
		if !database.BossVictoryCharacterReceiptMatches(store.characters[participant.Username], record.BossVictoryOperation) {
			return nil, database.ErrBossVictoryUnconfirmed
		}
	}
	record.State = database.BossVictoryComplete
	store.victories[id] = record
	return cloneBossVictoryRecord(record), nil
}

func (store *bossVictoryRecoveryStore) PendingBossVictories(username, after string, limit int) ([]database.BossVictoryRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.reads++
	var records []database.BossVictoryRecord
	for _, record := range store.victories {
		_, eligible := database.BossVictoryRecipientFor(record.BossVictoryOperation, username)
		if record.State == database.BossVictoryPending && record.ID > after && (username == "" || eligible) {
			records = append(records, *cloneBossVictoryRecord(record))
		}
	}
	slices.SortFunc(records, func(a, b database.BossVictoryRecord) int { return strings.Compare(a.ID, b.ID) })
	return records[:min(limit, len(records))], nil
}

func (store *bossVictoryRecoveryStore) ActiveBossVictoryDropPage(after string, now time.Time, limit int) ([]database.BossVictoryRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	var records []database.BossVictoryRecord
	for _, record := range store.victories {
		if record.ID <= after {
			continue
		}
		for _, drop := range record.Drops {
			if drop.ExpiresAt.After(now) {
				records = append(records, *cloneBossVictoryRecord(record))
				break
			}
		}
	}
	slices.SortFunc(records, func(a, b database.BossVictoryRecord) int { return strings.Compare(a.ID, b.ID) })
	return records[:min(limit, len(records))], nil
}

func bossVictoryDeliveryFixture(t *testing.T) (*bossVictoryRecoveryStore, *game.DungeonInstance, []*game.Entity, database.BossVictoryOperation, string) {
	t.Helper()
	roomStore, instance, players, dir := roomDeliveryFixture(t)
	oldStore, oldPending := bossVictories, bossVictoryPendingSaves.accounts
	t.Cleanup(func() {
		bossVictories, bossVictoryPendingSaves.accounts = oldStore, oldPending
	})
	store := &bossVictoryRecoveryStore{tradeRecoveryStore: roomStore.tradeRecoveryStore, victories: map[string]database.BossVictoryRecord{}}
	bossVictories, characterSaveCommitter = store, store
	bossVictoryPendingSaves.accounts = map[string]bossVictorySavePending{}
	op := database.BossVictoryOperation{Version: 1, InstanceID: instance.ID, BossType: "RootboundWarden", DungeonType: instance.DungeonType,
		Difficulty: "normal", RunLevel: instance.RunLevel, RoomIndex: 2, CreatedAt: time.Now().UTC().Truncate(time.Millisecond)}
	op.BossID = op.BossType + "-" + instance.ID
	op.ID = database.BossVictoryID(op.InstanceID, op.BossID)
	for index, player := range players {
		player.Quests = []game.Quest{{ID: "original-boss-hunt", Type: "KILL", Target: op.BossType, Accepted: true, Count: 2, MaxCount: 5,
			RewardGold: 23, RewardGoldQuoted: true}}
		player.EP = 43
		store.characters[player.Name] = characterSnapshotForSave(player.Name, world.GetEntityCopy(player.ID))
		op.Participants = append(op.Participants, database.BossVictoryRecipient{Username: player.Name, PlayerID: player.ID, Gold: 73, XP: 234,
			Items:  []string{fmt.Sprintf(`{"id":"original-blade-%d","name":"Original","type":"WEAPON","stack":1,"maxStack":1,"potency":7,"stats":{"damage":73}}`, index)},
			Quests: []database.BossVictoryKillCredit{{QuestID: "original-boss-hunt", Target: op.BossType, Amount: 1, Maximum: 5}}})
	}
	op.Drops = []database.BossVictoryDrop{{LootID: "loot-boss-" + strings.TrimPrefix(op.ID, "bossvictory:") + "-0",
		Item: `{"id":"public-original","name":"Original","type":"WEAPON","stack":1,"maxStack":1,"potency":7,"stats":{"damage":73}}`,
		X:    200, Y: .5, AvailableAt: op.CreatedAt, ExpiresAt: op.CreatedAt.Add(time.Minute)}}
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	return store, instance, players, op, dir
}

func TestBossVictoryDeliveryUnknownPrepareHasNoEffectsOrCheckpoint(t *testing.T) {
	for _, after := range []bool{false, true} {
		t.Run(fmt.Sprint(after), func(t *testing.T) {
			store, instance, players, op, _ := bossVictoryDeliveryFixture(t)
			store.failPrepareBefore, store.failPrepareAfter = !after, after
			if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err == nil || instance.RoomState.Rooms[2].Cleared || len(store.writes) != 0 || players[0].Gold != 99 {
				t.Fatal("unconfirmed preparation changed progress or private value")
			}
			if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err != nil || !instance.RoomState.Rooms[2].Cleared || store.victories[op.ID].Fingerprint != op.Fingerprint {
				t.Fatal("original preparation could not resume", err)
			}
			if store.victories[op.ID].State != database.BossVictoryPending || store.completeCalls != 0 {
				t.Fatal("private grant coordinator falsely terminalized unhandled public drops")
			}
		})
	}
}

func TestBossVictoryDeliveryFailedMemberDoesNotStarvePartyOrRepeatRewards(t *testing.T) {
	for _, after := range []bool{false, true} {
		t.Run(fmt.Sprint(after), func(t *testing.T) {
			store, _, players, op, dir := bossVictoryDeliveryFixture(t)
			failed := players[0].Name
			store.failSaveAccount, store.failSaveAfter = failed, after
			feedback := map[string]int{}
			world.OnEvent = func(kind string, value interface{}) {
				if kind == "reward_summary" {
					summary := value.(game.RewardSummaryEvent)
					name := strings.TrimPrefix(summary.PlayerID, "player-")
					if !database.BossVictoryCharacterReceiptMatches(store.characters[name], op) {
						t.Error("reward feedback preceded actual saved receipt")
					}
					feedback[name]++
				}
			}
			if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err == nil || feedback[failed] != 0 || len(feedback) != 3 {
				t.Fatal("failed member blocked others or published unsaved success")
			}
			var err error
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			journal, err := characterSaveJournal.Read(failed)
			if err != nil || journal == nil {
				t.Fatal("failed grant has no actually reopened filesystem journal", err)
			}
			image, err := journal.Character()
			if err != nil || image.ItemDeliveryReceipts[op.ID] != op.Fingerprint || image.Gold != 172 || image.Quests[0].Count != 3 || image.Inventory[0].ID != "original-blade-0" || !image.DungeonProgress.Rooms[2].Cleared {
				t.Fatal("journal split original reward, receipt and checkpoint", err)
			}
			players[0].Gold += 9
			players[0].Quests[0].Count++
			if err := recoverAccountBossVictoriesLocked(failed); err != nil || feedback[failed] != 1 {
				t.Fatal("failed recipient could not recover exactly once", err)
			}
			if store.characters[failed].Gold != 181 || store.characters[failed].Quests[0].Count != 4 {
				t.Fatal("recovery erased a newer independent Gold/kill credit")
			}
			reads := store.reads
			for range 20 {
				if err := recoverAccountBossVictoriesLocked(failed); err != nil {
					t.Fatal(err)
				}
			}
			if reads != store.reads {
				t.Fatal("admitted gameplay needlessly polled reward storage")
			}
			if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err != nil {
				t.Fatal(err)
			}
			for _, player := range players {
				if feedback[player.Name] != 1 || store.writes[player.Name] > 2 {
					t.Fatal("replay repeated a private reward or popup")
				}
			}
		})
	}
}

func TestBossVictoryDeliveryFullBagAndOfflineMemberKeepOriginalEntitlements(t *testing.T) {
	store, _, players, op, _ := bossVictoryDeliveryFixture(t)
	for i := range players[0].Inventory {
		players[0].Inventory[i] = game.Item{ID: fmt.Sprintf("occupied-%d", i), Name: "Owned", Stack: 1, MaxStack: 1}
	}
	players[0].PendingBossLoot = []string{`{"id":"older-retained","name":"Old","type":"WEAPON","stack":1,"maxStack":1}`}
	players[0].Health, players[0].State = 0, "DEAD"
	store.characters[players[0].Name] = characterSnapshotForSave(players[0].Name, world.GetEntityCopy(players[0].ID))
	offline := players[3]
	world.RemoveEntity(offline.ID)
	store.characters[offline.Name].LastLogout = time.Now().Add(-16 * time.Minute).UTC().Truncate(time.Millisecond)
	store.characters[offline.Name].Equipment["mainHand"] = database.Item{ID: "legacy-equipped", Level: 1, Stack: 1, Stats: map[string]int{"damage": 123}}
	before := cloneTradeRecoveryCharacter(store.characters[offline.Name])
	feedback := map[string]game.RewardSummaryEvent{}
	world.OnEvent = func(kind string, value interface{}) {
		if kind == "reward_summary" {
			summary := value.(game.RewardSummaryEvent)
			feedback[summary.PlayerID] = summary
		}
	}
	if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err != nil {
		t.Fatal(err)
	}
	savedFull := store.characters[players[0].Name]
	if savedFull.Gold != 172 || len(savedFull.PendingBossLoot) != 2 || savedFull.PendingBossLoot[1] != op.Participants[0].Items[0] || feedback[players[0].ID].PendingItemCount != 1 || players[0].Health != 0 || players[0].State != "DEAD" {
		t.Fatal("full/downed member lost original value or counted another boss's pending loot")
	}
	saved := cloneTradeRecoveryCharacter(store.characters[offline.Name])
	if saved.Gold != 172 || saved.Inventory[0].ID != "original-blade-3" || saved.Quests[0].Count != 3 || !saved.DungeonProgress.Rooms[2].Cleared || !saved.LastLogout.Equal(before.LastLogout) || saved.EP != 43 || len(feedback) != 3 {
		t.Fatal("offline original entitlement or unrelated state changed")
	}
	// Erase only expected earned changes before comparing the whole document.
	saved.Gold, saved.Level, saved.XP, saved.ProgressionVersion = before.Gold, before.Level, before.XP, before.ProgressionVersion
	saved.Stats, saved.UnlockedSkills, saved.Inventory = before.Stats, before.UnlockedSkills, before.Inventory
	saved.ResonanceLevel, saved.ResonanceXP, saved.ResonancePoints = before.ResonanceLevel, before.ResonanceXP, before.ResonancePoints
	saved.Quests, saved.ItemDeliveryReceipts, saved.DungeonProgress, saved.LastSaveID = before.Quests, before.ItemDeliveryReceipts, before.DungeonProgress, before.LastSaveID
	if !reflect.DeepEqual(saved, before) {
		t.Fatal("offline delivery changed unrelated equipment/build/EP/resources/logout metadata")
	}
	if err := recoverColdAccountBossVictoriesLocked(offline.Name); err != nil || store.writes[offline.Name] != 1 {
		t.Fatal("cold replay duplicated an offline claim", err)
	}
}

func TestBossVictoryDeliveryUsesStoredWinnerAndRefusesStaleLiveProof(t *testing.T) {
	store, _, players, op, _ := bossVictoryDeliveryFixture(t)
	if _, err := store.PrepareBossVictory(op); err != nil {
		t.Fatal(err)
	}
	proposal := *cloneBossVictoryRecord(database.BossVictoryRecord{BossVictoryOperation: op, State: database.BossVictoryPending})
	proposal.Participants[0].Gold++
	proposal.Fingerprint, _ = database.BossVictoryFingerprint(proposal.BossVictoryOperation)
	winner, err := prepareAndDeliverBossVictoryCharacters(proposal.BossVictoryOperation, true)
	if err != nil || winner.Fingerprint != op.Fingerprint || players[0].Gold != 172 {
		t.Fatal("losing fresh-process proposal replaced the first stored victory", err)
	}
	delete(players[0].ItemDeliveryReceipts, op.ID)
	writes := store.writes[players[0].Name]
	if _, err := deliverBossVictoryRecipientLocked(op, players[0].Name); err == nil || store.writes[players[0].Name] != writes || players[0].Gold != 172 {
		t.Fatal("stale live copy overwrote actual saved proof or regranted the boss")
	}
}

func TestBossVictoryDeliveryAcknowledgesOnlyCapturedSavedBagAndQuests(t *testing.T) {
	store, _, players, op, _ := bossVictoryDeliveryFixture(t)
	player := players[0]
	client := &Client{username: player.Name, playerID: player.ID, send: make(chan []byte, 8)}
	sessionsMu.Lock()
	oldSessions := activeSessions
	activeSessions = map[string]*Client{player.Name: client}
	sessionsMu.Unlock()
	t.Cleanup(func() {
		sessionsMu.Lock()
		activeSessions = oldSessions
		sessionsMu.Unlock()
	})
	if _, err := store.PrepareBossVictory(op); err != nil {
		t.Fatal(err)
	}
	questUpdates := 0
	world.OnQuestUpdate = func(id string, quests []game.Quest) {
		questUpdates++
		if id != player.ID || len(quests) != 1 || quests[0].Count != 3 {
			t.Error("confirmed quest feedback re-read a later unsaved kill")
		}
	}
	characterSaveCommitter = bossLootCheckingCommitter{store.tradeRecoveryStore, func(image *database.Character) {
		if len(client.send) != 0 || image.Inventory[0].ID != "original-blade-0" || image.Quests[0].Count != 3 {
			t.Error("inventory feedback preceded complete original victory save")
		}
		player.Mu.Lock()
		player.Inventory[1] = game.Item{ID: "later-unsaved-roll", Stack: 1, MaxStack: 1}
		player.Quests[0].Count++
		player.Mu.Unlock()
	}}
	if changed, err := deliverBossVictoryRecipientLocked(op, player.Name); err != nil || !changed {
		t.Fatal(err)
	}
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgInventory || questUpdates != 1 {
		t.Fatal("missing confirmed owner feedback", messages)
	}
	var items []game.Item
	if err := json.Unmarshal(messages[0].Payload, &items); err != nil {
		t.Fatal(err)
	}
	// Saved bags compact empty slots; owner replies preserve their UI slots.
	savedContainsLater := false
	for _, item := range store.characters[player.Name].Inventory {
		savedContainsLater = savedContainsLater || item.ID == "later-unsaved-roll"
	}
	if len(items) != game.MaxInventorySize || items[0].ID != "original-blade-0" || items[1].ID == "later-unsaved-roll" || savedContainsLater || player.Quests[0].Count != 4 || player.Inventory[1].ID != "later-unsaved-roll" {
		t.Fatal("saved feedback included or erased a later independent live award")
	}
}

func TestBossVictoryDeliveryRecoveredReplyPreservesLiveSlotPositions(t *testing.T) {
	store, _, players, op, _ := bossVictoryDeliveryFixture(t)
	player := players[0]
	for i := 0; i < 5; i++ {
		player.Inventory[i] = game.Item{ID: fmt.Sprintf("occupied-%d", i), Name: "Owned", Stack: 1, MaxStack: 1}
	}
	client := &Client{username: player.Name, playerID: player.ID, send: make(chan []byte, 8)}
	sessionsMu.Lock()
	oldSessions := activeSessions
	activeSessions = map[string]*Client{player.Name: client}
	sessionsMu.Unlock()
	t.Cleanup(func() {
		sessionsMu.Lock()
		activeSessions = oldSessions
		sessionsMu.Unlock()
	})
	if _, err := store.PrepareBossVictory(op); err != nil {
		t.Fatal(err)
	}
	store.failSaveAccount = player.Name
	if _, err := deliverBossVictoryRecipientLocked(op, player.Name); err == nil || player.Inventory[5].ID != "original-blade-0" || len(client.send) != 0 {
		t.Fatal("failed original save produced a reply or wrong item slot")
	}
	player.Inventory[0] = game.Item{} // Independent bag space, before recovery.
	if err := recoverAccountBossVictoriesLocked(player.Name); err != nil {
		t.Fatal(err)
	}
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgInventory {
		t.Fatal("recovered bag acknowledgement missing", messages)
	}
	var items []game.Item
	if err := json.Unmarshal(messages[0].Payload, &items); err != nil {
		t.Fatal(err)
	}
	if len(items) != game.MaxInventorySize || items[0].ID != "" || items[5].ID != "original-blade-0" {
		t.Fatal("compacted DB bag shifted live item slots in recovered reply")
	}
}
