package main

import (
	"errors"
	"fmt"
	"reflect"
	"slices"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Real filesystem journal with modeled strong immutable storage and atomic
// character receipts. Not ordinary socket or actual Mongo integration proof.
type roomRecoveryStore struct {
	*tradeRecoveryStore
	rooms map[string]database.DungeonRoomRewardRecord
}

func (store *roomRecoveryStore) GetDungeonRoomReward(id string) (*database.DungeonRoomRewardRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.reads++
	if record, found := store.rooms[id]; found {
		return &record, nil
	}
	return nil, nil
}

func (store *roomRecoveryStore) PrepareDungeonRoomReward(op database.DungeonRoomRewardOperation) (*database.DungeonRoomRewardRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.prepareCalls++
	if store.failPrepareBefore {
		store.failPrepareBefore = false
		return nil, errors.New("prepare rejected")
	}
	if previous, found := store.rooms[op.ID]; found {
		if previous.Fingerprint != op.Fingerprint {
			return nil, database.ErrDungeonRoomRewardConflict
		}
		return &previous, nil
	}
	record := database.DungeonRoomRewardRecord{DungeonRoomRewardOperation: op, State: database.DungeonRoomRewardPending}
	store.rooms[op.ID] = record
	if store.failPrepareAfter {
		store.failPrepareAfter = false
		return nil, errors.New("prepare applied, acknowledgement lost")
	}
	return &record, nil
}

func (store *roomRecoveryStore) CompleteDungeonRoomReward(id, fp string) (*database.DungeonRoomRewardRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	record, found := store.rooms[id]
	if !found || record.Fingerprint != fp {
		return nil, database.ErrDungeonRoomRewardConflict
	}
	for _, participant := range record.Participants {
		if !database.DungeonRoomRewardCharacterReceiptMatches(store.characters[participant.Username], record.DungeonRoomRewardOperation) {
			return nil, database.ErrDungeonRoomRewardUnconfirmed
		}
	}
	if store.failCompleteBefore {
		store.failCompleteBefore = false
		return nil, errors.New("terminal save rejected")
	}
	record.State = database.DungeonRoomRewardComplete
	store.rooms[id] = record
	if store.failCompleteAfter {
		store.failCompleteAfter = false
		return nil, errors.New("terminal applied, acknowledgement lost")
	}
	return &record, nil
}

func (store *roomRecoveryStore) PendingDungeonRoomRewards(username, after string, limit int) ([]database.DungeonRoomRewardRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.reads++
	var records []database.DungeonRoomRewardRecord
	for _, record := range store.rooms {
		_, eligible := database.DungeonRoomRewardRecipientFor(record.DungeonRoomRewardOperation, username)
		if record.State == database.DungeonRoomRewardPending && record.ID > after && (username == "" || eligible) {
			records = append(records, record)
		}
	}
	slices.SortFunc(records, func(a, b database.DungeonRoomRewardRecord) int {
		if a.ID < b.ID {
			return -1
		}
		return 1
	})
	return records[:min(len(records), limit)], nil
}

func roomDeliveryFixture(t *testing.T) (*roomRecoveryStore, *game.DungeonInstance, []*game.Entity, string) {
	t.Helper()
	dir, _ := setupCharacterJournalTest(t)
	oldStore, oldPending := dungeonRoomRewards, roomRewardPendingSaves.accounts
	oldCacheAfter, oldStoreAfter := dungeonRoomRewardRecovery.cacheAfter, dungeonRoomRewardRecovery.storeAfter
	t.Cleanup(func() {
		dungeonRoomRewards, roomRewardPendingSaves.accounts = oldStore, oldPending
		dungeonRoomRewardRecovery.cacheAfter, dungeonRoomRewardRecovery.storeAfter = oldCacheAfter, oldStoreAfter
	})
	roomRewardPendingSaves.accounts = map[string]roomRewardSavePending{}
	dungeonRoomRewardRecovery.cacheAfter, dungeonRoomRewardRecovery.storeAfter = "", ""
	store := &roomRecoveryStore{tradeRecoveryStore: &tradeRecoveryStore{characters: map[string]*database.Character{}, writes: map[string]int{}}, rooms: map[string]database.DungeonRoomRewardRecord{}}
	dungeonRoomRewards, characterSaveCommitter = store, store
	world = game.NewWorld(nil)
	layout := game.DungeonLayout{Rooms: []game.DungeonRoom{{Type: "start", Width: 40, Height: 40}, {Type: "normal", Hook: "elite_ambush", Width: 40, Height: 40, X: 100}, {Type: "boss", Width: 40, Height: 40, X: 200}}}
	instance := &game.DungeonInstance{ID: "dungeon_delivery_test", CreatedAt: time.Now(), Layout: layout, DungeonType: "verdant_bastion_catacombs", RunLevel: 30, Difficulty: game.DifficultyNormal, RoomState: game.NewDungeonRoomState(layout), PlayerRoomSummary: map[string]game.DungeonRoomSummary{}}
	world.InstanceLayouts[instance.ID] = instance
	var players []*game.Entity
	for index, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		name := fmt.Sprintf("room-party-%d", index)
		player := &game.Entity{ID: "player-" + name, Name: name, Type: game.TypePlayer, SubType: class, Level: 30, MaxExperience: game.ExperienceRequiredForLevel(30), BaseStats: game.InitialPlayerStats(), Gold: 99, InstanceID: instance.ID, Health: 10, Mana: 10, State: "IDLE", Inventory: make([]game.Item, game.MaxInventorySize), Equipment: map[string]game.Item{}}
		player.RecalculateStats()
		world.AddEntity(player)
		players = append(players, player)
		store.characters[name] = characterSnapshotForSave(name, world.GetEntityCopy(player.ID))
	}
	world.OnDungeonRoomReward = prepareAndDeliverDungeonRoomReward
	return store, instance, players, dir
}

func TestDungeonRoomRewardDeliveryUnknownPrepareHasNoProgressOrEffects(t *testing.T) {
	for _, mode := range []string{"before", "after"} {
		t.Run(mode, func(t *testing.T) {
			store, instance, players, _ := roomDeliveryFixture(t)
			store.failPrepareBefore, store.failPrepareAfter = mode == "before", mode == "after"
			world.MarkDungeonRoomCleared(instance.ID, 1)
			plans := world.PendingDungeonRoomRewardPlans()
			if len(plans) != 1 || instance.RoomState.Rooms[1].Cleared || players[0].Gold != 99 || len(store.writes) != 0 {
				t.Fatal("unconfirmed preparation advanced shared or private value")
			}
			first := plans[0]
			players[0].Disconnected = true
			if err := recoverPendingDungeonRoomRewards(); err != nil {
				t.Fatal(err)
			}
			if store.rooms[first.ID].Fingerprint != first.Fingerprint || store.rooms[first.ID].State != database.DungeonRoomRewardComplete || len(world.PendingDungeonRoomRewardPlans()) != 0 {
				t.Fatal("first outcome was not retained/completed")
			}
			for _, participant := range first.Participants {
				if store.characters[participant.Username].Gold != 99+participant.Gold {
					t.Fatal("original cohort lost win-time entitlement")
				}
			}
		})
	}
}

func TestDungeonRoomRewardDeliveryFailedSaveRetainsCohortAndFeedbackBarrier(t *testing.T) {
	for _, after := range []bool{false, true} {
		t.Run(fmt.Sprint(after), func(t *testing.T) {
			store, instance, players, _ := roomDeliveryFixture(t)
			failed := players[0].Name
			store.failSaveAccount, store.failSaveAfter = failed, after
			feedback := map[string]int{}
			world.OnEvent = func(kind string, value interface{}) {
				if kind == "room_clear_reward" {
					event := value.(game.DungeonRoomClearRewardEvent)
					name := event.PlayerID[len("player-"):]
					op := world.PendingDungeonRoomRewardPlans()[0]
					if !database.DungeonRoomRewardCharacterReceiptMatches(store.characters[name], op) {
						t.Fatal("feedback preceded confirmed recipient save")
					}
					feedback[name]++
				}
			}
			world.MarkDungeonRoomCleared(instance.ID, 1)
			op := world.PendingDungeonRoomRewardPlans()[0]
			if !instance.RoomState.Rooms[1].Cleared || store.rooms[op.ID].State != database.DungeonRoomRewardPending || feedback[failed] != 0 || len(feedback) != 3 {
				t.Fatal("failed recipient lost pending claim or blocked unrelated recipients")
			}
			if _, found := roomRewardPendingFor(failed); !found {
				t.Fatal("failed grant save did not fence admission")
			}
			players[0].Gold += 7 // New live change must survive journal reconciliation.
			if err := recoverAccountDungeonRoomRewardsLocked(failed); err != nil {
				t.Fatal(err)
			}
			if feedback[failed] != 1 || store.characters[failed].Gold != 99+7+op.Participants[0].Gold {
				t.Fatal("recovery lost newer live change, grant or deferred feedback")
			}
			if err := prepareAndDeliverDungeonRoomReward(op); err != nil {
				t.Fatal(err)
			}
			for _, player := range players {
				if feedback[player.Name] != 1 {
					t.Fatal("replay emitted another grant popup")
				}
			}
			if store.rooms[op.ID].State != database.DungeonRoomRewardComplete {
				t.Fatal("saved cohort did not complete")
			}
		})
	}
}

func TestDungeonRoomRewardDeliveryFullBagDoesNotPollOrStarveParty(t *testing.T) {
	store, instance, players, _ := roomDeliveryFixture(t)
	for index := range players[0].Inventory {
		players[0].Inventory[index] = game.Item{ID: fmt.Sprintf("occupied-%d", index), Name: "Full", Stack: 1, MaxStack: 1}
	}
	world.MarkDungeonRoomCleared(instance.ID, 1)
	op := world.PendingDungeonRoomRewardPlans()[0]
	if players[0].Gold != 99 || store.rooms[op.ID].State != database.DungeonRoomRewardPending || !instance.RoomState.Rooms[1].Rewarded {
		t.Fatal("full bag changed partial value or erased retained room")
	}
	reads := store.reads
	for range 20 {
		if err := recoverAccountDungeonRoomRewardsLocked(players[0].Name); err != nil {
			t.Fatal(err)
		}
	}
	if store.reads != reads {
		t.Fatal("ordinary admitted play polled full-bag reward storage")
	}
	if err := recoverColdAccountDungeonRoomRewardsLocked(players[0].Name); err != nil {
		t.Fatal("full-bag login refused", err)
	}
	for _, player := range players[1:] {
		if store.characters[player.Name].Gold != 99+op.Participants[1].Gold {
			t.Fatal("one full bag blocked another recipient")
		}
	}
	players[0].Inventory[0] = game.Item{}
	if err := recoverColdAccountDungeonRoomRewardsLocked(players[0].Name); err != nil {
		t.Fatal(err)
	}
	if err := recoverPendingDungeonRoomRewards(); err != nil {
		t.Fatal(err)
	}
	if store.rooms[op.ID].State != database.DungeonRoomRewardComplete || players[0].Gold != 99+op.Participants[0].Gold {
		t.Fatal("space retry did not deliver exact retained reward")
	}
}

func TestDungeonRoomRewardDeliveryJournalReopenAndOfflineMetadata(t *testing.T) {
	store, instance, players, dir := roomDeliveryFixture(t)
	store.failSaveAccount = players[0].Name
	world.MarkDungeonRoomCleared(instance.ID, 1)
	op := world.PendingDungeonRoomRewardPlans()[0]
	saved := store.characters[players[0].Name]
	if database.DungeonRoomRewardCharacterReceiptMatches(saved, op) {
		t.Fatal("fixture should retain rejected save")
	}
	var err error
	world = nil
	roomRewardPendingSaves.accounts = map[string]roomRewardSavePending{}
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	failedCharacterSaves.users = map[string]bool{}
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if err := recoverDungeonRoomRewardsOnStartup(); err != nil {
		t.Fatal(err)
	}
	if store.rooms[op.ID].State != database.DungeonRoomRewardComplete {
		t.Fatal("offline recipient prevented cohort recovery")
	}
	for _, participant := range op.Participants {
		if store.characters[participant.Username].Gold != 99+participant.Gold {
			t.Fatal("journal replay re-granted/lost award")
		}
	}
	before := cloneTradeRecoveryCharacter(store.characters[players[0].Name])
	if err := prepareAndDeliverDungeonRoomReward(op); err != nil || !reflect.DeepEqual(before, store.characters[players[0].Name]) {
		t.Fatal("terminal replay rewrote offline metadata", err)
	}
}

func TestDungeonRoomRewardDeliveryStoredOutcomeWinsRestoredProposal(t *testing.T) {
	store, instance, players, _ := roomDeliveryFixture(t)
	first, err := world.PrepareDungeonRoomReward(instance.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.PrepareDungeonRoomReward(first); err != nil {
		t.Fatal(err)
	}
	players[0].Disconnected = true // A new local capture would omit this owner.
	world.MarkDungeonRoomCleared(instance.ID, 1)
	if store.rooms[first.ID].Fingerprint != first.Fingerprint || store.rooms[first.ID].State != database.DungeonRoomRewardComplete {
		t.Fatal("restored scene replaced previously recorded first outcome")
	}
	for _, participant := range first.Participants {
		if store.characters[participant.Username].Gold != 99+participant.Gold || store.characters[participant.Username].ItemDeliveryReceipts[first.ID] != first.Fingerprint {
			t.Fatal("old first cohort lost entitlement")
		}
	}
}

func TestDungeonRoomRewardDeliveryTerminalOutcomeRetiresStaleLocalCapture(t *testing.T) {
	store, instance, players, _ := roomDeliveryFixture(t)
	world.MarkDungeonRoomCleared(instance.ID, 1)
	if len(world.PendingDungeonRoomRewardPlans()) != 0 {
		t.Fatal("first cohort did not finish")
	}
	gold := players[0].Gold
	// A restored older room projection must discover the terminal first
	// outcome, not grant a new roll or retain an impossible local retry forever.
	instance.RoomState = game.NewDungeonRoomState(instance.Layout)
	world.MarkDungeonRoomCleared(instance.ID, 1)
	if len(world.PendingDungeonRoomRewardPlans()) != 0 || players[0].Gold != gold || !instance.RoomState.Rooms[1].Cleared || len(store.rooms) != 1 {
		t.Fatal("terminal room recreated value or left a stale local proposal")
	}
}

func TestDungeonRoomRewardDeliveryOfflineGrowthPreservesOwnedMetadata(t *testing.T) {
	for _, dead := range []bool{false, true} {
		t.Run(fmt.Sprint(dead), func(t *testing.T) {
			store, instance, players, _ := roomDeliveryFixture(t)
			op, err := world.PrepareDungeonRoomReward(instance.ID, 1)
			if err != nil {
				t.Fatal(err)
			}
			character := cloneTradeRecoveryCharacter(store.characters[players[0].Name])
			character.Level, character.XP, character.ProgressionVersion = 99, game.ExperienceRequiredForLevel(99)-50, game.CurrentProgressionVersion
			character.EP, character.ResonanceXP = 123, 17
			character.SelectedBranch, character.UnlockedSkills = "A", []string{"Charge"}
			character.TalentRanks = map[string]int{"FTR_01": 1}
			character.SavedHotbar = []string{"Charge", "Whirlwind"}
			character.SkillRunes = map[string]string{"Charge": "charge_momentum"}
			character.WellRested = &database.CharacterWellRested{Version: 1, RemainingSeconds: 100}
			character.Resources = &database.CharacterResources{Version: 1, Health: 10, Mana: 0}
			if dead {
				character.Resources.Health, character.Resources.Dead = 0, true
			}
			before := cloneTradeRecoveryCharacter(character)
			op.Participants[0].XP = 300
			op.Fingerprint, _ = database.DungeonRoomRewardFingerprint(op)
			receipt, changed, err := applyOfflineDungeonRoomReward(character, op)
			if err != nil || !changed || receipt.XP != 50 || receipt.ResonanceXP != 250 || character.Level != 100 || character.ResonanceXP != 267 {
				t.Fatal("offline level-to-cap split lost progression", receipt, err)
			}
			if character.Stats.Strength != before.Stats.Strength+2 || character.Stats.Vitality != before.Stats.Vitality+2 || character.Stats.Dexterity != before.Stats.Dexterity+1 {
				t.Fatal("offline level did not grow existing base stats")
			}
			if dead && (!character.Resources.Dead || character.Resources.Health != 0) {
				t.Fatal("offline leveling resurrected a corpse")
			}
			if character.EP != before.EP || !reflect.DeepEqual(character.Equipment, before.Equipment) || !reflect.DeepEqual(character.Quests, before.Quests) || !reflect.DeepEqual(character.TalentRanks, before.TalentRanks) || !reflect.DeepEqual(character.SkillRunes, before.SkillRunes) || !reflect.DeepEqual(character.WellRested, before.WellRested) || !reflect.DeepEqual(character.DungeonProgress, before.DungeonProgress) || !reflect.DeepEqual(character.SavedHotbar, before.SavedHotbar) || character.LastLogout != before.LastLogout {
				t.Fatal("offline grant overwrote unrelated owned metadata")
			}
		})
	}
}

func TestDungeonRoomRewardDeliveryOfflineFullBagKeepsClearProjection(t *testing.T) {
	store, instance, players, _ := roomDeliveryFixture(t)
	op, err := world.PrepareDungeonRoomReward(instance.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.PrepareDungeonRoomReward(op); err != nil {
		t.Fatal(err)
	}
	name := players[0].Name
	store.characters[name].Inventory = make([]database.Item, game.MaxInventorySize)
	for index := range store.characters[name].Inventory {
		store.characters[name].Inventory[index] = database.Item{ID: fmt.Sprintf("full-%d", index), Name: "Full", Stack: 1, MaxStack: 1}
	}
	before := cloneTradeRecoveryCharacter(store.characters[name])
	world = nil
	if err := recoverColdAccountDungeonRoomRewardsLocked(name); err != nil {
		t.Fatal("full bag denied login", err)
	}
	saved := store.characters[name]
	if saved.DungeonProgress == nil || !saved.DungeonProgress.Rooms[1].Cleared || !saved.DungeonProgress.Rooms[1].Rewarded || saved.DungeonProgress.CreatedAt != before.DungeonProgress.CreatedAt {
		t.Fatal("retained reward lost cleared progress or renewed run age")
	}
	if saved.Gold != before.Gold || saved.XP != before.XP || !reflect.DeepEqual(saved.Inventory, before.Inventory) || saved.ItemDeliveryReceipts[op.ID] != "" || store.rooms[op.ID].State != database.DungeonRoomRewardPending {
		t.Fatal("clear projection consumed/partially granted full-bag entitlement")
	}
}

func TestDungeonRoomRewardDeliveryStartupDrainsPagesPastFullBag(t *testing.T) {
	store, instance, players, _ := roomDeliveryFixture(t)
	base, err := world.PrepareDungeonRoomReward(instance.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.PrepareDungeonRoomReward(base); err != nil {
		t.Fatal(err)
	}
	full := store.characters[players[0].Name]
	full.Inventory = make([]database.Item, game.MaxInventorySize)
	for index := range full.Inventory {
		full.Inventory[index] = database.Item{ID: fmt.Sprintf("full-%d", index), Stack: 1, MaxStack: 1}
	}
	for index := range 52 {
		op := base
		op.InstanceID = fmt.Sprintf("dungeon_paged_%d", index)
		op.ID = database.DungeonRoomRewardID(op.InstanceID, op.RoomIndex)
		op.Participants = []database.DungeonRoomRewardRecipient{base.Participants[1]}
		op.Participants[0].Gold, op.Participants[0].XP, op.Participants[0].Items = 1, 1, nil
		op.Fingerprint, _ = database.DungeonRoomRewardFingerprint(op)
		if _, err := store.PrepareDungeonRoomReward(op); err != nil {
			t.Fatal(err)
		}
	}
	world = nil
	if err := recoverDungeonRoomRewardsOnStartup(); err != nil {
		t.Fatal(err)
	}
	completed := 0
	for _, record := range store.rooms {
		if record.State == database.DungeonRoomRewardComplete {
			completed++
		}
	}
	if completed != 52 || store.rooms[base.ID].State != database.DungeonRoomRewardPending || store.characters[players[1].Name].Gold != 99+base.Participants[1].Gold+52 {
		t.Fatal("full first cohort starved later recovery pages")
	}
}
