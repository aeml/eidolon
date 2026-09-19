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
	"github.com/gorilla/websocket"
)

// Actual production binary and two disposable accounts. No production role or
// currency is modified, and fixture permissions never replace socket admission.
func TestAdminConsoleActualSessionsAndHistoryRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and built server")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires isolated loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	operator, member := fmt.Sprintf("operator-%d", time.Now().UnixNano()), fmt.Sprintf("member-%d", time.Now().UnixNano())
	for _, name := range []string{operator, member} {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-test-password"); err != nil {
			t.Fatal(err)
		}
	}
	if granted, err := repo.GrantAdminRole(operator, operator, "disposable_integration_fixture"); err != nil || !granted {
		t.Fatal(granted, err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 201, "-save-journal-dir", journal)
	defer stop()
	a, _ := resourceLoginCharacter(t, address, operator, operator+"-test-password", "Fighter")
	b, token := resourceLoginCharacter(t, address, member, member+"-test-password", "Wizard")
	request := func(conn *websocket.Conn, kind, requestID string) adminReadResult {
		t.Helper()
		resourceSend(t, conn, kind, map[string]string{"id": requestID})
		var response adminReadResult
		resourceReadMessage(t, conn, kind+"_result", &response)
		return response
	}
	if response := request(a, MsgAdminStatus, "admin-status-000001"); !response.Success || !response.Authorized {
		t.Fatal(response)
	}
	if response := request(b, MsgAdminStatus, "member-status-000001"); !response.Success || response.Authorized {
		t.Fatal(response)
	}
	if response := request(b, MsgAdminPlayers, "member-players-000001"); response.Success || response.Authorized || len(response.Players) != 0 {
		t.Fatal("member read admin roster")
	}
	response := request(a, MsgAdminPlayers, "admin-players-000001")
	found := map[string]bool{}
	for _, player := range response.Players {
		found[player.Account] = true
	}
	if !response.Success || !found[operator] || !found[member] {
		t.Fatal("missing authenticated players")
	}
	resourceCloseAndWait(t, repo, b, member)
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	resourceReadMessage(t, resumed, MsgResumeSession, nil)
	resourceReadMessage(t, resumed, MsgQuestUpdate, nil)
	resourceCloseAndWait(t, repo, resumed, member)
	history := request(a, MsgAdminHistory, "admin-history-000001")
	if !history.Success || history.History == nil {
		t.Fatal(history)
	}
	encoded, _ := json.Marshal(history)
	if strings.Contains(string(encoded), token) || strings.Contains(string(encoded), "-test-password") || strings.Contains(string(encoded), "password_hash") {
		t.Fatal("history leaked credentials")
	}
	resourceCloseAndWait(t, repo, a, operator)
	stop()
	// Startup replays any last disconnect still queued when the server stopped.
	_, stopRestart := compatStartServer(t, binary, uri, 202, "-save-journal-dir", journal)
	defer stopRestart()
	page, err := repo.ReadAdminActivity(database.AdminActivityQuery{Actor: member})
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	seen := map[string]bool{}
	for _, event := range page.Entries {
		if seen[event.ID.Hex()] {
			t.Fatal("duplicate durable event")
		}
		seen[event.ID.Hex()] = true
		counts[event.Action]++
	}
	if counts["login"] != 1 || counts["resume"] != 1 || counts["disconnect"] != 2 || counts[MsgAdminStatus] != 1 || counts[MsgAdminPlayers] != 1 {
		t.Fatal("wrong saved session history", counts)
	}
	t.Log("two actual accounts: administrator/non-admin reads, login, token resume, two disconnects and restart-persisted history passed")
}
