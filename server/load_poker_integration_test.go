package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// The driver walks in from the real town door, seats two actual players and
// plays ordinary shuffled hands. Reconnect/explicit leave verifies normal
// cash-out; no forced deals, altered timers or money grants during play.
func TestLoadPokerActualEntryPlayAndCashOut(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires an absolute prepared load-driver binary path")
	}
	a, passwordA := resourceJournalFixture(t, repo)
	b, passwordB := resourceJournalFixture(t, repo)
	for index, fixture := range []*database.Character{a, b} {
		fixture.Class, fixture.X, fixture.Z, fixture.EP = "Fighter", float64(index), 180, 43
		fixture.Resources.Health = 100
		fixture.Inventory = []database.Item{{ID: "poker-keep-bag", Name: "Poker preservation fixture", Type: "ARMOR", Slot: "chest", Rarity: "LEGENDARY", Level: 1, Stack: 1, MaxStack: 1, Value: 9999, StatScaleVersion: game.ItemStatScaleVersion}}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not persist disposable prepared character")
		}
	}
	credentials, err := json.Marshal([]map[string]string{{"username": a.Name, "password": passwordA}, {"username": b.Name, "password": passwordB}})
	if err != nil {
		t.Fatal("could not encode disposable credentials")
	}
	credentialPath := filepath.Join(t.TempDir(), "test-credentials.json")
	if err := os.WriteFile(credentialPath, credentials, 0600); err != nil {
		t.Fatal("could not store disposable credentials")
	}
	address, stop := compatStartServer(t, binary, uri, 179, "-save-journal-dir", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 110*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "casino-poker", "-n", "2", "-credentials-file", credentialPath, "-casino-bet", "100", "-duration", "90s", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Poker coverage): [a-z_0-9= ]+$`).FindString(line); match != "" {
			t.Log(match) // Aggregate fields only, never raw credentials/socket logs.
		}
	}
	if runErr != nil {
		t.Fatal("actual poker driver failed; raw synthetic socket logs omitted")
	}
	if !regexp.MustCompile(`Poker coverage: clients=2 accepted_wagers=[1-9][0-9]* completed_rounds=[1-9][0-9]* min_completed_rounds=[1-9][0-9]* observed_turns=[0-9]+ failed=0`).Match(output) {
		t.Fatal("missing fresh paid hands for both actual poker players")
	}
	for index, fixture := range []*database.Character{a, b} {
		password := []string{passwordA, passwordB}[index]
		connection, _ := resourceLoginCharacter(t, address, fixture.Name, password, fixture.Class)
		t.Cleanup(func() { connection.Close() })
		view := readPokerSocket(t, connection, func(view pokerSocketPresence) bool {
			return view.YourSeat != nil && !view.Poker.Processing
		})
		if view.YourSeat.TableID != publicPokerTable || view.YourSeat.Seat != index {
			t.Fatal("actual bot did not preserve its assigned public poker chair")
		}
		resourceSend(t, connection, MsgCasino, map[string]any{"action": "leave", "sessionId": view.YourSeat.SessionID})
		readPokerSocket(t, connection, func(view pokerSocketPresence) bool { return view.YourSeat == nil })
		resourceCloseAndWait(t, repo, connection, fixture.Name)
	}
	// Explicit departure may leave the final hand in ordinary settlement. Wait
	// for durable cash-out, not the reconnect grace or a synthetic clock advance.
	settled := false
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		record, err := repo.GetBlackjackTable(publicPokerTable)
		if err != nil {
			t.Fatal("could not inspect disposable poker settlement")
		}
		state, err := decodePokerState(record)
		if err != nil {
			t.Fatal("could not decode disposable poker settlement")
		}
		settled = record.Pending == nil && (state.Phase == "complete" || state.Phase == "betting" && len(state.Players) == 0)
		for _, participant := range state.Players {
			settled = settled && participant.Paid
		}
		if settled {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !settled {
		t.Fatal("ordinary final poker cash-out did not settle within its declared bound")
	}
	stop()
	total := 0
	for _, fixture := range []*database.Character{a, b} {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) {
			t.Fatal("missing fresh ordinary poker disconnect save")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || !reflect.DeepEqual(actual.Inventory, fixture.Inventory) {
			t.Fatal("poker profile changed class, EP, equipped gear or preserved bag")
		}
		if actual.CasinoWalletCheckpoints[publicPokerTable].Version < 2 || len(actual.GoldCreditReceipts) != 0 || len(actual.EPCasinoReceipts) != 0 || actual.Gold < 0 {
			t.Fatal("poker cash-out lost compact proof or grew legacy receipt maps")
		}
		total += actual.Gold
	}
	if total != a.Gold+b.Gold {
		t.Fatal("two-player actual bot poker created or lost Gold after cash-out")
	}
	t.Logf("two real bots: town entry, walking/seating, shared shuffled play, reconnect/leave, settled conserved Gold=%d and unchanged gear/bag/EP; elapsed=%s; no capacity or restart claim", total, time.Since(started).Round(time.Millisecond))
}
