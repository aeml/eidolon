package main

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

// These observations consume ordinary JSON and binary scene messages from a
// separate production process. No command changes position or bypasses casts.
type gameplaySessionObservation struct {
	self                *statepb.Entity
	entities            map[string]*statepb.Entity
	message             string
	joined, contextSeen bool
	context             string
	quests              []game.Quest
	cast                struct {
		ID     uint64 `json:"id"`
		Kind   string `json:"kind"`
		Target string `json:"target"`
		State  string `json:"state"`
	}
	discovery game.ChronicleDiscoveryReceipt
}

func readImmediateQuestTurnIn(t *testing.T, conn *websocket.Conn, quests *[]game.Quest) {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type == "interaction_cast" || message.Type == MsgError {
			t.Fatal("manual NPC turn-in gained an interaction cast or was rejected", message.Type, string(message.Payload))
		}
		if message.Type == MsgQuestUpdate {
			if err := json.Unmarshal(message.Payload, quests); err != nil {
				t.Fatal(err)
			}
			return
		}
	}
}

func gameplayRead(t *testing.T, conn *websocket.Conn, username string, o *gameplaySessionObservation, deadline time.Time) {
	t.Helper()
	_ = conn.SetReadDeadline(deadline)
	kind, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatal("ordinary gameplay observation", err)
	}
	o.message = ""
	if kind == websocket.TextMessage {
		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		o.message = message.Type
		switch message.Type {
		case MsgError:
			t.Fatal("ordinary gameplay rejected", string(message.Payload))
		case MsgQuestUpdate:
			o.joined = true
			if err := json.Unmarshal(message.Payload, &o.quests); err != nil {
				t.Fatal(err)
			}
		case MsgMovementContext:
			var context struct {
				ID string `json:"movementContext"`
			}
			if err := json.Unmarshal(message.Payload, &context); err != nil {
				t.Fatal(err)
			}
			o.context, o.contextSeen = context.ID, true
		case "interaction_cast":
			if err := json.Unmarshal(message.Payload, &o.cast); err != nil {
				t.Fatal(err)
			}
		case MsgChronicleDiscovery:
			if err := json.Unmarshal(message.Payload, &o.discovery); err != nil {
				t.Fatal(err)
			}
		}
		return
	}
	if kind != websocket.BinaryMessage {
		return
	}
	if len(data) < 5 || !bytes.Equal(data[:4], stateProtoMagic) || data[4] != stateProtoWireVersion {
		t.Fatal("ordinary scene has an invalid protobuf envelope")
	}
	var envelope statepb.StateEnvelope
	if err := proto.Unmarshal(data[5:], &envelope); err != nil {
		t.Fatal(err)
	}
	var entities []*statepb.Entity
	if full := envelope.GetFull(); full != nil {
		entities = full.Entities
	} else if delta := envelope.GetDelta(); delta != nil {
		entities = delta.Entities
		for _, id := range delta.RemovedIds {
			delete(o.entities, id)
		}
	}
	if o.entities == nil {
		o.entities = map[string]*statepb.Entity{}
	}
	for _, entity := range entities {
		o.entities[entity.Id] = entity
		if entity.Id == "player-"+username {
			o.self = entity
		}
	}
}

func gameplayWait(t *testing.T, conn *websocket.Conn, username string, o *gameplaySessionObservation, ready func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !ready() {
		gameplayRead(t, conn, username, o, deadline)
	}
}

func gameplayJoin(t *testing.T, address string, fixture *database.Character, password string) (*websocket.Conn, *gameplaySessionObservation) {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	resourceSend(t, conn, MsgLogin, map[string]string{"username": fixture.Name, "password": password})
	resourceReadMessage(t, conn, "login_success", nil)
	resourceSend(t, conn, MsgJoin, JoinPayload{Type: fixture.Class})
	o := &gameplaySessionObservation{}
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.joined && o.contextSeen && o.self != nil })
	// New entity admission deliberately fences movement for its first second.
	readyAt := time.Now().Add(1050 * time.Millisecond)
	gameplayWait(t, conn, fixture.Name, o, func() bool { return time.Now().After(readyAt) })
	return conn, o
}

func TestGameplayActualRoofWalkJumpAndColdRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.Class, fixture.X, fixture.Y, fixture.Z = "Fighter", -74, 8.78, 130
	item := database.Item{ID: "roof-earned-" + fixture.Name, Name: "Roof blade", Type: "WEAPON", Level: 30,
		Rarity: string(game.RarityRare), Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion,
		Stats: map[string]int{"strength": 7}}
	fixture.Inventory = []database.Item{item}
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 740, "-save-journal-dir", dir)
	conn, o := gameplayJoin(t, address, fixture, password)
	if o.self.SupportSurface == "" || math.Abs(float64(o.self.Y)-fixture.Y) > .001 {
		t.Fatal("actual first scene flattened a valid saved roof", float64(o.self.Y), o.self.SupportSurface)
	}
	roof := o.self.SupportSurface
	resourceSend(t, conn, MsgMove, MovePayload{MovementContext: o.context, X: fixture.X + .1, Y: 99999, Z: fixture.Z, State: "MOVING", Sequence: 1})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return math.Abs(float64(o.self.X)-fixture.X-.1) < .001 })
	if o.self.SupportSurface != roof || float64(o.self.Y) > fixture.Y+.1 || float64(o.self.Y) < fixture.Y-1 {
		t.Fatal("ordinary roof walking lost support or trusted packet height", float64(o.self.Y), o.self.SupportSurface)
	}
	resourceSend(t, conn, MsgJump, JumpPayload{MovementContext: o.context, X: fixture.X - 32, Y: 77777, Z: fixture.Z})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.self.State == "JUMPING" })
	if float64(o.self.JumpTargetY) != 0 {
		t.Fatal("actual jump down trusted the supplied height")
	}
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.self.State != "JUMPING" && math.Abs(float64(o.self.X)-fixture.X+32) < .001 })
	if float64(o.self.Y) != 0 || o.self.SupportSurface != "" {
		t.Fatal("ground landing retained the departed roof")
	}
	resourceSend(t, conn, MsgJump, JumpPayload{MovementContext: o.context, X: fixture.X, Y: 55555, Z: fixture.Z})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.self.State == "JUMPING" })
	if math.Abs(float64(o.self.JumpTargetY)-fixture.Y) > .001 {
		t.Fatal("actual jump up failed to resolve the authored roof")
	}
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.self.State != "JUMPING" && o.self.SupportSurface == roof })
	quantity := 1
	resourceSend(t, conn, MsgInventoryDrop, InventoryDropPayload{Index: 0, ItemID: item.ID, ExpectedStack: &quantity})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == MsgInventory })
	page, err := repo.GroundItemProjectionPage("", time.Now(), 50)
	if err != nil {
		t.Fatal(err)
	}
	var dropped *database.GroundItemRecord
	for i := range page {
		if page[i].Username == fixture.Name && page[i].Kind == database.GroundItemDrop {
			dropped = &page[i]
		}
	}
	if dropped == nil || dropped.Version != 3 || dropped.SupportSurface != roof || math.Abs(dropped.Y-fixture.Y-.5) > .001 {
		t.Fatal("actual saved drop did not retain its roof floor")
	}
	_ = conn.Close()
	stop()
	saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil || math.Abs(saved.Y-fixture.Y) > .001 || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) {
		t.Fatal("roof disconnect save lost position or changed gear", err)
	}
	address, stop = compatStartServer(t, binary, uri, 741, "-save-journal-dir", dir)
	conn, o = gameplayJoin(t, address, fixture, password)
	if o.self.SupportSurface != roof || math.Abs(float64(o.self.Y)-fixture.Y) > .001 {
		t.Fatal("cold ordinary login lost roof support")
	}
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.entities[dropped.LootID] != nil })
	loot := o.entities[dropped.LootID]
	if loot.SupportSurface != roof || math.Abs(float64(loot.Y)-dropped.Y) > .001 {
		t.Fatal("cold first scene lost the saved item's floor")
	}
	if previous := os.Getenv("EIDOLON_ROOF_PREVIOUS_BINARY"); previous != "" {
		if !filepath.IsAbs(previous) {
			t.Fatal("previous schema26 writer must be an owned absolute binary")
		}
		for _, args := range [][]string{
			{"--check-schema", "--mongo-uri", uri},
			{"-addr", "127.0.0.1:0", "-mongo-uri", uri, "-save-journal-dir", t.TempDir(),
				"-log-file", "", "-suspicious-log-file", "", "-economy-metrics-file", ""},
		} {
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			output, oldError := exec.CommandContext(ctx, previous, args...).CombinedOutput()
			cancel()
			if oldError == nil || !strings.Contains(string(output), "database schema 27 is newer than this server supports (26)") {
				t.Fatalf("previous schema26 writer did not refuse roof custody: %v %s", oldError, output)
			}
		}
		after, err := repo.LatestGroundItemOperation(dropped.LootID)
		if err != nil || after == nil || !reflect.DeepEqual(after, dropped) {
			t.Fatal("old preflight/startup changed the exact roof ledger", err)
		}
		t.Log("PREVIOUS_WRITER_SCHEMA26_REFUSED_SCHEMA27_PREFLIGHT_AND_STARTUP_WITHOUT_LEDGER_WRITES")
	} else {
		t.Log("Previous schema26 executable fence not enabled; connected floor/custody checks remain scoped")
	}
	resourceSend(t, conn, MsgPickup, PickupPayload{LootID: dropped.LootID})
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		if o.message == "interaction_cast" {
			t.Fatal("ordinary equipment pickup gained a quest-object cast")
		}
		return o.message == MsgInventory
	})
	picked, err := repo.LatestGroundItemOperation(dropped.LootID)
	if err != nil || picked == nil || picked.Kind != database.GroundItemPickup || picked.State != database.GroundItemComplete ||
		picked.Y != dropped.Y || picked.SupportSurface != roof || !picked.ExpiresAt.Equal(dropped.ExpiresAt) {
		t.Fatal("actual roof pickup changed floor, lifetime or saved custody", err)
	}
	resourceSend(t, conn, MsgPickup, PickupPayload{LootID: dropped.LootID})
	resourceReadMessage(t, conn, MsgError, nil)
	_ = conn.Close()
	stop()
	saved, err = repo.GetCharacter(fixture.Name, fixture.Name)
	count := 0
	if err != nil || saved == nil {
		t.Fatal(err)
	}
	for _, owned := range saved.Inventory {
		if owned.ID == item.ID {
			count += owned.Stack
		}
	}
	if count != 1 || !database.GroundItemCharacterReceiptMatches(saved, picked.GroundItemOperation) || saved.Gold != fixture.Gold || saved.EP != fixture.EP {
		t.Fatal("cold roof pickup/replay changed quantity, checkpoint or wallets")
	}
}

func TestGameplayActualRecallDeadlineAndMovementCancellation(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.X, fixture.Z = -40, 200
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 742, "-save-journal-dir", t.TempDir())
	defer stop()
	conn, o := gameplayJoin(t, address, fixture, password)
	resourceSend(t, conn, MsgRecall, TownRecoveryPayload{MovementContext: "cancelled-recall"})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == "interaction_cast" && o.cast.State == "started" })
	cancelledID := o.cast.ID
	resourceSend(t, conn, MsgMove, MovePayload{MovementContext: o.context, X: fixture.X + .25, Z: fixture.Z, State: "MOVING", Sequence: 1})
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		return o.message == "interaction_cast" && o.cast.ID == cancelledID && o.cast.State == "cancelled"
	})
	until := time.Now().Add(game.StationaryCastDuration + 200*time.Millisecond)
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		if o.message == "interaction_cast" && o.cast.ID == cancelledID && o.cast.State == "completed" || o.context == "cancelled-recall" {
			t.Fatal("cancelled recall eventually teleported")
		}
		return time.Now().After(until)
	})
	if math.Abs(float64(o.self.X)-fixture.X-.25) > .001 {
		t.Fatal("cancelled recall changed the ordinary movement endpoint")
	}
	started := time.Now()
	resourceSend(t, conn, MsgRecall, TownRecoveryPayload{MovementContext: "completed-recall"})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == "interaction_cast" && o.cast.State == "started" })
	completedID := o.cast.ID
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		completed := o.message == "interaction_cast" && o.cast.ID == completedID && o.cast.State == "completed"
		if !completed && math.Abs(float64(o.self.X)+1.25) < .001 {
			t.Fatal("recall arrival preceded cast completion")
		}
		return completed
	})
	if time.Since(started) < game.StationaryCastDuration {
		t.Fatal("actual recall completed before three seconds")
	}
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		return o.context == "completed-recall" && math.Abs(float64(o.self.X)+1.25) < .001 && float64(o.self.Z) == 200
	})
	if o.self.SupportSurface != "" {
		t.Fatal("town arrival retained a departed floor")
	}
}

func TestGameplayActualQuestObjectCastSavesDiscovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	chapter := game.ChronicleInvestigationCatalog()[0]
	site := chapter.Sites[0]
	fixture.X, fixture.Z, fixture.Level = site.X, site.Z, 75
	fixture.Resources.Health = 100000
	fixture.Quests = []database.Quest{
		{ID: "chronicle_01_bell_below", Category: game.QuestCategoryChronicle, Type: "KILL", Target: "Skeleton", Count: 3, MaxCount: 3, Accepted: true, Completed: true},
		{ID: chapter.ID, Category: game.QuestCategoryChronicle, Type: "INVESTIGATE", MaxCount: len(chapter.Sites), Accepted: true},
	}
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 743, "-save-journal-dir", dir)
	conn, o := gameplayJoin(t, address, fixture, password)
	started := time.Now()
	resourceSend(t, conn, MsgChronicleInspect, map[string]string{"entityId": site.EntityID})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == "interaction_cast" && o.cast.State == "started" })
	id := o.cast.ID
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		if o.message == MsgChronicleDiscovery {
			t.Fatal("quest discovery preceded cast completion")
		}
		return o.message == "interaction_cast" && o.cast.ID == id && o.cast.State == "completed"
	})
	if time.Since(started) < game.StationaryCastDuration {
		t.Fatal("actual quest object completed before three seconds")
	}
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == MsgChronicleDiscovery })
	if !o.discovery.Recorded || o.discovery.QuestID != chapter.ID || o.discovery.Count != 1 {
		t.Fatal("ordinary inspection did not record its discovery")
	}
	saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil {
		t.Fatal("discovery acknowledgement lacks a saved character", err)
	}
	confirmed := false
	for _, quest := range saved.Quests {
		if quest.ID == chapter.ID {
			confirmed = quest.Count == 1 && quest.InvestigationMask == 1 && !quest.Completed
		}
	}
	if !confirmed || saved.Gold != fixture.Gold || saved.XP != fixture.XP {
		t.Fatal("inspection bypassed save or paid a manual NPC turn-in")
	}
	_ = conn.Close()
	stop()
	address, stop = compatStartServer(t, binary, uri, 744, "-save-journal-dir", dir)
	conn, o = gameplayJoin(t, address, fixture, password)
	confirmed = false
	for _, quest := range o.quests {
		if quest.ID == chapter.ID {
			confirmed = quest.Count == 1 && quest.InvestigationMask == 1 && !quest.Completed
		}
	}
	if !confirmed {
		t.Fatal("cold process lost the inspected story evidence")
	}
	_ = conn.Close()
	stop()
}

func TestGameplayActualQuestItemCancellationHasNoReservationAndSavedPickupReplays(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.X, fixture.Z = 20, 215
	item := game.Item{ID: "chronicle-item-" + fixture.Name, Name: "Verdant Memory Seed", Type: game.ItemRelic,
		Stack: 4, MaxStack: 8, Rarity: game.RarityUncommon}
	encode := func(stack int) string {
		copy := item
		copy.Stack = stack
		data, err := json.Marshal(copy)
		if err != nil {
			t.Fatal(err)
		}
		return string(data)
	}
	// A prepared retained partial pickup represents one saved seed and three
	// still on the ground. This does not claim a campaign kill or earned drop;
	// every subsequent cancellation/pickup is an ordinary server command.
	now := time.Now().UTC().Truncate(time.Millisecond)
	op := database.GroundItemOperation{Version: 2, AccountOrdinal: 1,
		ID: database.GroundItemOperationID("prepared-partial-" + fixture.Name), Kind: database.GroundItemPickup,
		Username: fixture.Name, PlayerID: "player-" + fixture.Name, LootID: "prepared-quest-object-" + fixture.Name,
		Generation: 1, BeforePayload: encode(4), MovedPayload: encode(1), RemainingPayload: encode(3),
		LootOwnerID: "player-" + fixture.Name, X: fixture.X, Z: fixture.Z, CreatedAt: now, LootTime: now, LootCreatedAt: now}
	op.Fingerprint, _ = database.GroundItemFingerprint(op)
	if _, err := repo.PrepareGroundItemOperation(op); err != nil {
		t.Fatal(err)
	}
	fixture.Inventory = []database.Item{{ID: item.ID, Name: item.Name, Type: string(item.Type), Rarity: string(item.Rarity), Stack: 1, MaxStack: 8}}
	fixture.GroundAccountOrdinal, fixture.GroundAccountOperationID, fixture.GroundAccountFingerprint = 1, op.ID, op.Fingerprint
	fixture.Quests = []database.Quest{
		{ID: "chronicle_01_bell_below", Category: game.QuestCategoryChronicle, Type: "KILL", Target: "Skeleton", Count: 3, MaxCount: 3, Accepted: true, Completed: true},
		{ID: game.ChronicleInvestigationCatalog()[0].ID, Category: game.QuestCategoryChronicle, Type: "INVESTIGATE", MaxCount: 1, Count: 1, InvestigationMask: 1, Accepted: true, Completed: true},
		{ID: "chronicle_02_seeds_first_grove", Category: game.QuestCategoryChronicle, Type: "COLLECT", Target: item.Name,
			Count: 1, MaxCount: 8, CollectionVersion: 2, Accepted: true},
	}
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	original, err := repo.CompleteGroundItemOperation(op.ID, op.Fingerprint)
	if err != nil || original == nil {
		t.Fatal("prepared partial custody", err)
	}
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 745, "-save-journal-dir", dir)
	conn, o := gameplayJoin(t, address, fixture, password)
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.entities[op.LootID] != nil })
	if o.entities[op.LootID].LootItem.Stack != 3 {
		t.Fatal("retained ground object lost its exact remainder")
	}
	resourceSend(t, conn, MsgPickup, PickupPayload{LootID: op.LootID})
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		return o.message == "interaction_cast" && o.cast.Kind == "quest_pickup" && o.cast.State == "started"
	})
	cancelledID := o.cast.ID
	resourceSend(t, conn, MsgMove, MovePayload{MovementContext: o.context, X: fixture.X + .25, Z: fixture.Z, State: "MOVING", Sequence: 1})
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		return o.message == "interaction_cast" && o.cast.ID == cancelledID && o.cast.State == "cancelled"
	})
	until := time.Now().Add(game.StationaryCastDuration + 200*time.Millisecond)
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		if o.message == MsgInventory || o.message == "interaction_cast" && o.cast.ID == cancelledID && o.cast.State == "completed" {
			t.Fatal("cancelled quest pickup granted an item")
		}
		return time.Now().After(until)
	})
	after, err := repo.LatestGroundItemOperation(op.LootID)
	if err != nil || after == nil || !reflect.DeepEqual(after, original) {
		t.Fatal("cancelled quest cast reserved a new durable intent", err)
	}
	started := time.Now()
	resourceSend(t, conn, MsgPickup, PickupPayload{LootID: op.LootID})
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == "interaction_cast" && o.cast.State == "started" })
	id := o.cast.ID
	gameplayWait(t, conn, fixture.Name, o, func() bool {
		if o.message == MsgInventory {
			t.Fatal("quest pickup inventory preceded cast completion")
		}
		return o.message == "interaction_cast" && o.cast.ID == id && o.cast.State == "completed"
	})
	if time.Since(started) < game.StationaryCastDuration {
		t.Fatal("quest pickup completed before three seconds")
	}
	gameplayWait(t, conn, fixture.Name, o, func() bool { return o.message == MsgInventory })
	picked, err := repo.LatestGroundItemOperation(op.LootID)
	if err != nil || picked == nil || picked.Generation != 2 || picked.State != database.GroundItemComplete || picked.GroundPayload() != "" ||
		!picked.AvailableAt.Equal(original.AvailableAt) || !picked.ExpiresAt.Equal(original.ExpiresAt) {
		t.Fatal("quest cast changed lifetime, remainder or saved custody", err)
	}
	_ = conn.Close()
	stop()
	address, stop = compatStartServer(t, binary, uri, 746, "-save-journal-dir", dir)
	conn, o = gameplayJoin(t, address, fixture, password)
	if o.entities[op.LootID] != nil {
		t.Fatal("cold process resurrected the collected quest object")
	}
	saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil {
		t.Fatal(err)
	}
	count := 0
	for _, owned := range saved.Inventory {
		if owned.ID == item.ID {
			count += owned.Stack
		}
	}
	if count != 4 || !database.GroundItemCharacterReceiptMatches(saved, picked.GroundItemOperation) || saved.Gold != fixture.Gold || saved.EP != fixture.EP {
		t.Fatal("cold quest pickup lost exact quantity/checkpoint or changed wallets")
	}
	resourceSend(t, conn, MsgPickup, PickupPayload{LootID: op.LootID})
	resourceReadMessage(t, conn, MsgError, nil)
	_ = conn.Close()
	stop()
}
