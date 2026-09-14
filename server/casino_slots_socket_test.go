package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
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
	testSlotsActualSocketSpinResumeAndRestart(t, false)
}

func TestVIPSlotsActualSocketSpinResumeAndRestart(t *testing.T) {
	testSlotsActualSocketSpinResumeAndRestart(t, true)
}

func approachVIPSlotSocket(t *testing.T, conn *websocket.Conn, table game.CasinoTable) {
	t.Helper()
	resourceSend(t, conn, MsgCasino, map[string]any{"action": "vip"})
	var floor struct {
		Upstairs bool `json:"upstairs"`
	}
	resourceReadMessage(t, conn, "casino_floor", &floor)
	if !floor.Upstairs {
		t.Fatal("VIP slot floor not authorized")
	}
	var context struct {
		ID string `json:"movementContext"`
	}
	resourceReadMessage(t, conn, MsgMovementContext, &context)
	if context.ID == "" {
		t.Fatal("VIP stairs omitted movement context")
	}
	// Walk around the atrium using the back balcony then the side gallery.
	x, z, sequence := 0.0, 140.0, uint64(0)
	point := table.Seats[0]
	for _, target := range [][2]float64{{point.ExitX, 140}, {point.ExitX, point.ExitZ}} {
		steps := int(math.Ceil(math.Hypot(target[0]-x, target[1]-z) / .8))
		for step := 1; step <= steps; step++ {
			time.Sleep(350 * time.Millisecond)
			sequence++
			fraction := float64(step) / float64(steps)
			resourceSend(t, conn, MsgMove, MovePayload{MovementContext: context.ID,
				X: x + (target[0]-x)*fraction, Y: 8, Z: z + (target[1]-z)*fraction,
				State: "RUNNING", Sequence: sequence})
		}
		x, z = target[0], target[1]
	}
}

func testSlotsActualSocketSpinResumeAndRestart(t *testing.T, vip bool) {
	t.Helper()
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
	currency, initialBalance := "gold", 500
	if vip {
		currency, initialBalance = "ep", 100
	}
	defer cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": slotRecordKey(owner, "earth", currency)})
	tableID := "public-slots-earth"
	if vip {
		tableID = "vip-slots-earth"
	}
	table, ok := game.CasinoTableByID(tableID)
	if !ok {
		t.Fatal("missing Earth slot machine", tableID)
	}
	point := table.Seats[0]
	if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
		t.Fatal(err)
	}
	fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion,
		InstanceID: game.CasinoInstanceID, X: point.ExitX, Z: point.ExitZ, Gold: 500, LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
	if vip {
		fixture.X, fixture.Z = 0, 153
		period, err := database.NewVIPPeriod(time.Now().Add(-time.Hour), time.Now().AddDate(0, 1, 0))
		if err != nil {
			t.Fatal(err)
		}
		if added, err := repo.ProvisionVIPPeriod(name, period); err != nil || !added {
			t.Fatal("fixture VIP provisioning failed", err)
		}
	}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 51, "-save-journal-dir", journal)
	defer stop()
	conn, token := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
	if vip {
		approachVIPSlotSocket(t, conn, table)
	}
	resourceSend(t, conn, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 0})
	seated := readSlotSocket(t, conn, func(v slotSocketPresence) bool { return v.YourSeat != nil && v.Slots != nil && v.Slots.Available })
	if seated.Slots.Currency != currency || seated.Slots.Balance != initialBalance || (vip && seated.Slots.MaxBet != 100) {
		t.Fatal("slot currency/balance/limit mismatch")
	}
	spin := map[string]any{"action": "slot_spin", "sessionId": seated.YourSeat.SessionID, "roundRevision": seated.Slots.Session.Revision, "bet": 20}
	resourceSend(t, conn, MsgCasino, spin)
	result := readSlotSocket(t, conn, func(v slotSocketPresence) bool {
		return v.Slots != nil && v.Slots.Session.Revision == 2 && !v.Slots.Processing
	})
	expectedBalance := initialBalance - 20 + result.Slots.Session.Last.Payout
	if result.Slots.Balance != expectedBalance || (vip && result.Slots.Gold != 500) {
		t.Fatal("ordinary socket spin settled in the wrong wallet")
	}
	resourceSend(t, conn, MsgCasino, spin)
	var rejected string
	resourceReadMessage(t, conn, MsgError, &rejected)
	if !strings.Contains(rejected, "changed") {
		t.Fatal("duplicate spin was not fenced", rejected)
	}
	saved := resourceCloseAndWait(t, repo, conn, name)
	saveMatches := func(saved *database.Character) bool {
		if vip {
			return saved.EP == expectedBalance && saved.Gold == 500 && len(saved.GoldCreditReceipts) == 0 && len(saved.VIPAllowanceReceipts) == 1
		}
		return saved.Gold == expectedBalance && saved.EP == 0
	}
	if !saveMatches(saved) {
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
	if view.YourSeat.SessionID != seated.YourSeat.SessionID || view.Slots.Session.Revision != 2 || view.Slots.Balance != expectedBalance || view.Slots.Gold != saved.Gold {
		t.Fatal("session resume changed machine state or balance")
	}
	resourceSend(t, resumed, MsgCasino, map[string]any{"action": "leave", "sessionId": view.YourSeat.SessionID})
	readSlotSocket(t, resumed, func(v slotSocketPresence) bool { return v.YourSeat == nil })
	resourceCloseAndWait(t, repo, resumed, name)
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 52, "-save-journal-dir", journal)
	defer stopAgain()
	returned, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
	if vip {
		approachVIPSlotSocket(t, returned, table)
	}
	resourceSend(t, returned, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 0})
	after := readSlotSocket(t, returned, func(v slotSocketPresence) bool { return v.YourSeat != nil && v.Slots != nil && v.Slots.Available })
	if after.Slots.Session.Revision != 2 || after.Slots.Session.FreeSpins != result.Slots.Session.FreeSpins || after.Slots.Session.Bonus != result.Slots.Session.Bonus || after.Slots.Gold != saved.Gold || after.Slots.Balance != expectedBalance {
		t.Fatal("restart lost owner entitlements or duplicated payment")
	}
	if !saveMatches(resourceCloseAndWait(t, repo, returned, name)) {
		t.Fatal("restart changed saved wallet or repeated VIP allowance")
	}
	t.Logf("%s Earth slot: paid20, payout%d, balance%d; token resume, leave, restart/reseat retain revision2 freeSpins=%d bonus=%t", currency, result.Slots.Session.Last.Payout, expectedBalance, result.Slots.Session.FreeSpins, result.Slots.Session.Bonus)
}
