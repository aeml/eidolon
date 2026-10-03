package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"slices"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/protobuf/proto"
)

type roomSocketProbe struct {
	connection     *websocket.Conn
	mu             sync.Mutex
	actors         map[string]*statepb.Entity
	acceptedSkills map[string]int
	messages       chan Message
	errors         chan error
	done           chan struct{}
}

func roomSocketMonitor(t *testing.T, connection *websocket.Conn) *roomSocketProbe {
	t.Helper()
	probe := &roomSocketProbe{connection: connection, actors: map[string]*statepb.Entity{}, acceptedSkills: map[string]int{}, messages: make(chan Message, 128), errors: make(chan error, 1), done: make(chan struct{})}
	_ = connection.SetReadDeadline(time.Now().Add(90 * time.Second))
	go func() {
		defer close(probe.done)
		fail := func(err error) {
			select {
			case probe.errors <- err:
			default:
			}
		}
		for {
			kind, data, err := connection.ReadMessage()
			if err != nil {
				fail(err)
				return
			}
			if kind == websocket.TextMessage {
				var message Message
				if err := json.Unmarshal(data, &message); err != nil {
					fail(err)
					return
				}
				if message.Type == MsgAbilityResult {
					var cast game.AbilityResult
					if err := json.Unmarshal(message.Payload, &cast); err != nil {
						fail(err)
						return
					}
					if cast.Accepted {
						probe.mu.Lock()
						probe.acceptedSkills[cast.SkillName]++
						probe.mu.Unlock()
					}
				}
				switch message.Type {
				case MsgPartyRequest, MsgPartyUpdate, MsgRoomClearReward, MsgInventory, MsgError:
				default:
					continue
				}
				select {
				case probe.messages <- message:
				default:
					fail(fmt.Errorf("room test message queue overflow"))
					return
				}
				continue
			}
			if kind != websocket.BinaryMessage || len(data) < 5 || string(data[:4]) != string(stateProtoMagic) || data[4] != stateProtoWireVersion {
				fail(fmt.Errorf("invalid ordinary room scene frame"))
				return
			}
			var envelope statepb.StateEnvelope
			if err := proto.Unmarshal(data[5:], &envelope); err != nil {
				fail(err)
				return
			}
			probe.mu.Lock()
			if full := envelope.GetFull(); full != nil {
				probe.actors = map[string]*statepb.Entity{}
				for _, actor := range full.Entities {
					probe.actors[actor.Id] = actor
				}
			}
			if delta := envelope.GetDelta(); delta != nil {
				for _, id := range delta.RemovedIds {
					delete(probe.actors, id)
				}
				for _, actor := range delta.Entities {
					probe.actors[actor.Id] = actor
				}
			}
			probe.mu.Unlock()
		}
	}()
	t.Cleanup(func() { _ = connection.Close(); <-probe.done })
	return probe
}

func (probe *roomSocketProbe) waitMessage(t *testing.T, kind string, payload any) {
	t.Helper()
	timer := time.NewTimer(10 * time.Second)
	defer timer.Stop()
	for {
		select {
		case err := <-probe.errors:
			t.Fatal("ordinary room socket", err)
		case <-timer.C:
			t.Fatal("room message deadline", kind)
		case message := <-probe.messages:
			if message.Type == MsgError && kind != MsgError {
				t.Fatal("ordinary room command rejected", string(message.Payload))
			}
			if message.Type == kind {
				if payload != nil {
					if err := json.Unmarshal(message.Payload, payload); err != nil {
						t.Fatal(err)
					}
				}
				return
			}
		}
	}
}

func roomPreparedResume(instanceID string) *database.CharacterDungeonResume {
	layout := game.DungeonLayout{Rooms: []game.DungeonRoom{
		{X: 20000, Z: 20000, Width: 40, Height: 40, Type: "start"},
		{X: 20000, Z: 19950, Width: 40, Height: 40, Type: "normal", Hook: "elite_ambush"},
		{X: 20000, Z: 19850, Width: 60, Height: 60, Type: "boss"},
	}, WalkRects: []game.DungeonWalkRect{
		{X: 20000, Z: 20000, Width: 40, Height: 40, Kind: "room", RoomIndex: 0},
		{X: 20000, Z: 19950, Width: 40, Height: 40, Kind: "room", RoomIndex: 1},
		{X: 20000, Z: 19850, Width: 60, Height: 60, Kind: "room", RoomIndex: 2},
		{X: 20000, Z: 19975, Width: 10, Height: 50, Kind: "corridor"},
		{X: 20000, Z: 19900, Width: 10, Height: 100, Kind: "corridor"},
	}, Corridors: []game.DungeonCorridor{{FromRoomIndex: 0, ToRoomIndex: 1, Width: 10, WalkRectIndices: []int{3}}, {FromRoomIndex: 1, ToRoomIndex: 2, Width: 10, WalkRectIndices: []int{4}}}}
	return dungeonResumeToDatabase(game.DungeonResumeSnapshot{ID: instanceID, CreatedAt: time.Now().UTC().Truncate(time.Millisecond), Difficulty: game.DifficultyNormal, DungeonType: "verdant_bastion_catacombs", RunLevel: 30, Layout: layout, Rooms: make([]game.DungeonRoomProgress, 3), CurrentRoomIndexValue: 1})
}

func roomSocketHasAllKillCredit(character *database.Character) bool {
	if character == nil {
		return false
	}
	matches := 0
	for _, quest := range character.Quests {
		if quest.ID == "room-skeleton-credit" && quest.Accepted && !quest.Completed && quest.Count == 3 && quest.MaxCount == 3 {
			matches++
		}
	}
	return matches == 1
}

// Prepared layout/saves, real four-class consent/party, ordinary attacks/casts,
// actual immutable room claims and saved receipts. No fabricated earned reward,
// test-only game command, accelerated/protected combat or production account.
func TestDungeonRoomRewardActualPartyClearCrashAndRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	instanceID := fmt.Sprintf("dungeon_room_socket_%d", time.Now().UnixNano())
	resume := roomPreparedResume(instanceID)
	if err := game.ValidateDungeonLayout(dungeonResumeFromDatabase(resume).Layout); err != nil {
		t.Fatal(err)
	}
	classes := []string{"Fighter", "Cleric", "Wizard", "Rogue"}
	weapons := []string{"iron-sword", "cleric-mace", "wooden-staff", "steel-dagger"}
	fixtures := make([]*database.Character, 4)
	passwords := make([]string, 4)
	for index, class := range classes {
		fixture, password := resourceJournalFixture(t, repo)
		fixture.Class, fixture.InstanceID, fixture.DungeonProgress = class, instanceID, resume
		fixture.LastLogout, fixture.X, fixture.Z, fixture.EP = time.Now(), 20000+float64(index)-1.5, 19950, 43
		fixture.SelectedBranch = "A"
		fixture.Quests = []database.Quest{{ID: "room-skeleton-credit", Type: "KILL", Target: "Skeleton", MaxCount: 3, Accepted: true}}
		fixture.Stats = database.Stats{Strength: 68, Vitality: 68, Dexterity: 39, Intelligence: 39, Wisdom: 39}
		switch class {
		case "Cleric":
			fixture.Stats.Strength, fixture.Stats.Wisdom = 39, 68
			fixture.UnlockedSkills = []string{"Radiant Strike", "Healing Light", "Guardian Embrace", "Purifying Wave"}
		case "Wizard":
			fixture.Stats.Strength, fixture.Stats.Intelligence = 39, 68
			fixture.UnlockedSkills = []string{"Fireball", "Flame Whip", "Flame Tornado", "Meteor Drop"}
		case "Rogue":
			fixture.Stats.Strength, fixture.Stats.Dexterity = 39, 68
			fixture.UnlockedSkills = []string{"Piercing Throw", "Backstab", "Weak Point Mark", "Shadow Lunge"}
		default:
			fixture.UnlockedSkills = []string{"Charge", "Whirlwind", "Shield Slam", "Iron Fortress"}
		}
		fixture.Resources = &database.CharacterResources{Version: 1, Health: 10000, Mana: 10000}
		fixture.Equipment = map[string]database.Item{}
		for gearIndex, itemID := range []string{weapons[index], "silk-hood", "robes", "silk-skirt", "sandals", "silk-gloves", "velvet-mantle", "silk-sash", "gold-ring", "silver-ring"} {
			rarity := game.RarityUncommon
			if gearIndex%2 == 0 {
				rarity = game.RarityRare
			}
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: itemID, Rarity: rarity, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal(err)
			}
			item := items[0]
			slot := item.Slot
			if slot == "ring" {
				slot = "ring1"
				if _, found := fixture.Equipment[slot]; found {
					slot = "ring2"
				}
			}
			fixture.Equipment[slot] = databaseItem(item)
		}
		if class == "Rogue" {
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: "steel-dagger", Rarity: game.RarityRare, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal(err)
			}
			fixture.Equipment["offHand"] = databaseItem(items[0])
		}
		if index == 1 {
			fixture.Inventory = make([]database.Item, game.MaxInventorySize)
			for slot := range fixture.Inventory {
				fixture.Inventory[slot] = database.Item{ID: fmt.Sprintf("full-%s-%d", fixture.Name, slot), Name: "Owned fixture item", Type: "MATERIAL", Stack: 1, MaxStack: 1}
			}
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		fixtures[index], passwords[index] = fixture, password
	}
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Disconnect(context.Background()) })
	validator := func(value bson.M) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := admin.Database("eidolon").RunCommand(ctx, bson.D{{Key: "collMod", Value: "users"}, {Key: "validator", Value: value}, {Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"}}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { validator(bson.M{}) })
	address, crash := compatStartServerWithCrash(t, binary, uri, 738, true, "-save-journal-dir", dir)
	probes := make([]*roomSocketProbe, 4)
	for index, fixture := range fixtures {
		connection, _ := resourceLoginCharacter(t, address, fixture.Name, passwords[index], fixture.Class)
		scene := resourceReadScene(t, connection)
		if scene.InstanceID != instanceID {
			t.Fatal("prepared ordinary dungeon resume failed")
		}
		probes[index] = roomSocketMonitor(t, connection)
	}
	for index := 1; index < len(probes); index++ {
		resourceSend(t, probes[0].connection, MsgPartyInvite, PartyInvitePayload{TargetName: fixtures[index].Name})
		var invite PartyRequestPayload
		probes[index].waitMessage(t, MsgPartyRequest, &invite)
		resourceSend(t, probes[index].connection, MsgPartyResponse, PartyResponsePayload{InviterName: fixtures[0].Name, InvitationID: invite.InvitationID, Accepted: true})
		probes[index].waitMessage(t, MsgPartyUpdate, nil)
	}
	operationID := database.DungeonRoomRewardID(instanceID, 1)
	validator(bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": fixtures[3].Name}}, bson.M{"characters.item_delivery_receipts." + operationID: bson.M{"$exists": false}}}})
	deadline := time.Now().Add(55 * time.Second)
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	var record *database.DungeonRoomRewardRecord
	lastSkills := time.Time{}
	for time.Now().Before(deadline) {
		<-ticker.C
		for _, probe := range probes {
			select {
			case err := <-probe.errors:
				t.Fatal(err)
			default:
			}
		}
		record, err = repo.GetDungeonRoomReward(operationID)
		if err != nil {
			t.Fatal(err)
		}
		if record != nil {
			break
		}
		probes[2].mu.Lock()
		var targets []*statepb.Entity
		for _, actor := range probes[2].actors {
			if actor.Type == string(game.TypeEnemy) && actor.InstanceId == instanceID && actor.State != "DEAD" && actor.Health > 0 && math.Abs(float64(actor.Z)-19950) < 20 {
				targets = append(targets, actor)
			}
		}
		probes[2].mu.Unlock()
		if len(targets) == 0 {
			continue
		}
		slices.SortFunc(targets, func(a, b *statepb.Entity) int {
			if a.Health < b.Health {
				return -1
			}
			return 1
		})
		target := targets[0]
		for _, probe := range probes {
			resourceSend(t, probe.connection, MsgAttack, AttackPayload{TargetID: target.Id})
		}
		if time.Since(lastSkills) >= 1200*time.Millisecond {
			lastSkills = time.Now()
			for index, skill := range []string{"Shield Slam", "Healing Light", "Fireball", "Backstab"} {
				targetID := target.Id
				if index == 1 {
					targetID = "player-" + fixtures[0].Name
				}
				resourceSend(t, probes[index].connection, MsgAbility, AbilityPayload{SkillName: skill, TargetID: targetID, TargetX: float64(target.X), TargetZ: float64(target.Z)})
			}
		}
	}
	if record == nil || record.Validate() != nil || len(record.Participants) != 4 {
		t.Fatal("ordinary four-class combat did not earn a frozen room cohort", record)
	}
	for index, skill := range []string{"Shield Slam", "Healing Light", "Fireball", "Backstab"} {
		probes[index].mu.Lock()
		accepted := probes[index].acceptedSkills[skill]
		probes[index].mu.Unlock()
		if accepted == 0 {
			t.Fatal("ordinary class-kit action was never accepted", classes[index], skill)
		}
	}
	probes[0].waitMessage(t, MsgRoomClearReward, nil)
	probes[2].waitMessage(t, MsgRoomClearReward, nil)
	for _, index := range []int{0, 2} {
		saved, err := repo.GetDirectTradeCharacter(fixtures[index].Name, fixtures[index].Name)
		if err != nil || !database.DungeonRoomRewardCharacterReceiptMatches(saved, record.DungeonRoomRewardOperation) || saved.DungeonProgress == nil || !saved.DungeonProgress.Rooms[1].Rewarded || !roomSocketHasAllKillCredit(saved) {
			t.Fatal("room acknowledgement preceded saved grant and progress", err)
		}
	}
	var pending *database.PendingCharacterSave
	for until := time.Now().Add(5 * time.Second); time.Now().Before(until); {
		pending, err = journal.Read(fixtures[3].Name)
		if err != nil {
			t.Fatal(err)
		}
		if pending != nil {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if pending == nil {
		t.Fatal("rejected recipient lost complete local journal")
	}
	planned, err := pending.Character()
	if err != nil || !database.DungeonRoomRewardCharacterReceiptMatches(planned, record.DungeonRoomRewardOperation) {
		t.Fatal("rejected save omitted original grant fingerprint", err)
	}
	for _, index := range []int{1, 3} {
		saved, err := repo.GetDirectTradeCharacter(fixtures[index].Name, fixtures[index].Name)
		if err != nil || database.DungeonRoomRewardCharacterReceiptMatches(saved, record.DungeonRoomRewardOperation) {
			t.Fatal("full/rejected recipient falsely saved award", err)
		}
	}
	fullBeforeCrash, err := repo.GetDirectTradeCharacter(fixtures[1].Name, fixtures[1].Name)
	if err != nil || fullBeforeCrash.DungeonProgress == nil || !fullBeforeCrash.DungeonProgress.Rooms[1].Cleared ||
		fullBeforeCrash.Gold <= fixtures[1].Gold || fullBeforeCrash.XP <= fixtures[1].XP || !roomSocketHasAllKillCredit(fullBeforeCrash) {
		t.Fatal("full-bag room checkpoint failed to save the complete earned kill effects", err)
	}
	crash()
	for _, probe := range probes {
		_ = probe.connection.Close()
		<-probe.done
	}
	validator(bson.M{})
	address, stop := compatStartServer(t, binary, uri, 739, "-save-journal-dir", dir)
	var recovered [4]*database.Character
	for index, fixture := range fixtures {
		recovered[index], err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
		if err != nil || recovered[index] == nil {
			t.Fatal(err)
		}
		if index != 1 && !database.DungeonRoomRewardCharacterReceiptMatches(recovered[index], record.DungeonRoomRewardOperation) {
			t.Fatal("fresh startup lost previously earned grant")
		}
		if recovered[index].EP != fixture.EP || !reflect.DeepEqual(recovered[index].Equipment, fixture.Equipment) {
			t.Fatal("recovery changed EP or class gear")
		}
		if !roomSocketHasAllKillCredit(recovered[index]) {
			t.Fatal("recovery lost one or more original party kill credits")
		}
	}
	if recovered[3].Gold != planned.Gold || recovered[3].XP != planned.XP || !reflect.DeepEqual(recovered[3].Inventory, planned.Inventory) {
		t.Fatal("fresh process failed exact rejected-post-image recovery")
	}
	if recovered[1].DungeonProgress == nil || !recovered[1].DungeonProgress.Rooms[1].Cleared || len(recovered[1].Inventory) != game.MaxInventorySize || recovered[1].DungeonProgress.CreatedAt != resume.CreatedAt {
		t.Fatal("offline full bag lost cleared projection or renewed run age")
	}
	connection, _ := resourceLoginCharacter(t, address, fixtures[1].Name, passwords[1], fixtures[1].Class)
	resourceReadScene(t, connection)
	fullProbe := roomSocketMonitor(t, connection)
	quantity := 1
	resourceSend(t, connection, MsgInventoryDrop, InventoryDropPayload{Index: 0, ItemID: fixtures[1].Inventory[0].ID, ExpectedStack: &quantity})
	fullProbe.waitMessage(t, MsgInventory, nil)
	fullProbe.waitMessage(t, MsgRoomClearReward, nil)
	for until := time.Now().Add(5 * time.Second); time.Now().Before(until); {
		record, err = repo.GetDungeonRoomReward(operationID)
		if err != nil {
			t.Fatal(err)
		}
		if record.State == database.DungeonRoomRewardComplete {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if record.State != database.DungeonRoomRewardComplete {
		t.Fatal("one freed slot did not complete retained party claim")
	}
	final, err := repo.GetDirectTradeCharacter(fixtures[1].Name, fixtures[1].Name)
	if err != nil || !database.DungeonRoomRewardCharacterReceiptMatches(final, record.DungeonRoomRewardOperation) {
		t.Fatal("ordinary bag-space retry preceded actual saved proof", err)
	}
	participant, _ := database.DungeonRoomRewardRecipientFor(record.DungeonRoomRewardOperation, fixtures[1].Name)
	if final.Gold != recovered[1].Gold+participant.Gold || final.XP != recovered[1].XP+participant.XP || final.EP != recovered[1].EP || len(final.Inventory) != game.MaxInventorySize {
		t.Fatal("full-bag retry changed retained amounts, EP or capacity")
	}
	_ = connection.Close()
	<-fullProbe.done
	stop()
	address, stop = compatStartServer(t, binary, uri, 740, "-save-journal-dir", dir)
	connection, _ = resourceLoginCharacter(t, address, fixtures[1].Name, passwords[1], fixtures[1].Class)
	resourceReadScene(t, connection)
	actor := wellRestedReadActor(t, connection, fixtures[1].Name, func(actor *statepb.Entity) bool { return actor.InstanceId == instanceID })
	if int(actor.Gold) != final.Gold || int(actor.Experience) != final.XP {
		t.Fatal("terminal restart repeated the room reward")
	}
	_ = connection.Close()
	stop()
}
