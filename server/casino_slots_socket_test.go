package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type slotSocketPresence struct {
	game.CasinoPresence
	Slots *slotMachineView `json:"slots"`
}

func readSlotSocket(t *testing.T, conn *websocket.Conn, match func(slotSocketPresence) bool) slotSocketPresence {
	t.Helper()
	for i := 0; i < 20; i++ {
		var raw json.RawMessage
		resourceReadMessage(t, conn, "casino_update", &raw)
		if strings.Contains(string(raw), "bonusOffers") {
			t.Fatal("hidden slot offers leaked over network")
		}
		var view slotSocketPresence
		if err := json.Unmarshal(raw, &view); err != nil {
			t.Fatal(err)
		}
		if match(view) {
			return view
		}
	}
	t.Fatal("slot presence did not reach expected state")
	return slotSocketPresence{}
}

func TestSlotsActualSocketSpinResumeAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicit disposable loopback Mongo and built server")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute server binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	name := fmt.Sprintf("slot-socket-%d", time.Now().UnixNano())
	owner := "player-" + name
	defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
	defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteOne(context.Background(), bson.M{"player_id": owner})
	defer cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": slotRecordKey(owner, "earth")})
	table := game.CasinoTables()[2]
	point := table.Seats[0]
	if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
		t.Fatal(err)
	}
	fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion,
		X: point.ExitX, Z: point.ExitZ, Gold: 500, LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 51, "-save-journal-dir", journal)
	defer stop()
	conn, token := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
	resourceSend(t, conn, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 0})
	seated := readSlotSocket(t, conn, func(v slotSocketPresence) bool { return v.YourSeat != nil && v.Slots != nil && v.Slots.Available })
	spin := map[string]any{"action": "slot_spin", "sessionId": seated.YourSeat.SessionID, "roundRevision": seated.Slots.Session.Revision, "bet": 20}
	resourceSend(t, conn, MsgCasino, spin)
	result := readSlotSocket(t, conn, func(v slotSocketPresence) bool {
		return v.Slots != nil && v.Slots.Session.Revision == 2 && !v.Slots.Processing
	})
	if result.Slots.Gold != 480+result.Slots.Session.Last.Payout {
		t.Fatal("ordinary socket spin did not settle normal Gold")
	}
	resourceSend(t, conn, MsgCasino, spin)
	var rejected string
	resourceReadMessage(t, conn, MsgError, &rejected)
	if !strings.Contains(rejected, "changed") {
		t.Fatal("duplicate spin was not fenced", rejected)
	}
	saved := resourceCloseAndWait(t, repo, conn, name)
	if saved.Gold != result.Slots.Gold {
		t.Fatal("spin not saved on disconnect")
	}
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	resourceReadMessage(t, resumed, MsgResumeSession, nil)
	view := readSlotSocket(t, resumed, func(v slotSocketPresence) bool { return v.YourSeat != nil && v.Slots != nil && v.Slots.Available })
	if view.YourSeat.SessionID != seated.YourSeat.SessionID || view.Slots.Session.Revision != 2 || view.Slots.Gold != saved.Gold {
		t.Fatal("session resume changed machine state or balance")
	}
	resourceSend(t, resumed, MsgCasino, map[string]any{"action": "leave", "sessionId": view.YourSeat.SessionID})
	readSlotSocket(t, resumed, func(v slotSocketPresence) bool { return v.YourSeat == nil })
	resourceCloseAndWait(t, repo, resumed, name)
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 52, "-save-journal-dir", journal)
	defer stopAgain()
	returned, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
	resourceSend(t, returned, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 0})
	after := readSlotSocket(t, returned, func(v slotSocketPresence) bool { return v.YourSeat != nil && v.Slots != nil && v.Slots.Available })
	if after.Slots.Session.Revision != 2 || after.Slots.Session.FreeSpins != result.Slots.Session.FreeSpins || after.Slots.Session.Bonus != result.Slots.Session.Bonus || after.Slots.Gold != saved.Gold {
		t.Fatal("restart lost owner entitlements or duplicated payment")
	}
	resourceCloseAndWait(t, repo, returned, name)
}
