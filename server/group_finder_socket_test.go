package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type groupSocketBoard struct {
	ViewerID string              `json:"viewerId"`
	Listings []game.GroupListing `json:"listings"`
}

type groupSocketParty struct {
	ReadyCheckActive bool   `json:"readyCheckActive"`
	ID               string `json:"partyId"`
	LeaderID         string `json:"leaderId"`
	AllReady         bool   `json:"allReady"`
	Members          []struct {
		ID    string `json:"id"`
		Role  string `json:"role"`
		Ready bool   `json:"ready"`
	} `json:"members"`
}

func readGroupSocketBoard(t *testing.T, conn *websocket.Conn, match func(groupSocketBoard) bool) groupSocketBoard {
	t.Helper()
	for messages := 0; messages < 20; messages++ {
		var board groupSocketBoard
		resourceReadMessage(t, conn, "group_finder_update", &board)
		if match(board) {
			return board
		}
	}
	t.Fatal("group finder did not reach expected board state")
	return groupSocketBoard{}
}

func readGroupSocketParty(t *testing.T, conn *websocket.Conn, match func(groupSocketParty) bool) groupSocketParty {
	t.Helper()
	for messages := 0; messages < 20; messages++ {
		var party groupSocketParty
		resourceReadMessage(t, conn, MsgPartyUpdate, &party)
		if match(party) {
			return party
		}
	}
	t.Fatal("party did not reach expected membership/readiness")
	return groupSocketParty{}
}

// Release integration: real sockets and ordinary fresh characters. No world
// access, grants, forced membership, shortened expiry or replaced clock.
func TestGroupFinderActualSocketsConsentPrivacyAndReady(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable Mongo and built server required")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute binary")
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
	names, ids := make([]string, 3), make([]string, 3)
	for i := range names {
		names[i] = fmt.Sprintf("group-%d-%d", i, time.Now().UnixNano())
		ids[i] = "player-" + names[i]
		if err := repo.CreateUser(names[i], names[i]+"@example.invalid", names[i]+"-local-only"); err != nil {
			t.Fatal(err)
		}
		defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": names[i]})
		defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteOne(context.Background(), bson.M{"player_id": ids[i]})
	}
	address, stop := compatStartServer(t, binary, uri, 81, "-save-journal-dir", t.TempDir())
	defer stop()
	connections := make([]*websocket.Conn, 3)
	tokens := make([]string, 3)
	for i, class := range []string{"Fighter", "Cleric", "Rogue"} {
		connections[i], tokens[i] = resourceLoginCharacter(t, address, names[i], names[i]+"-local-only", class)
	}
	send := func(index int, payload map[string]any) { resourceSend(t, connections[index], MsgGroupFinder, payload) }
	send(0, map[string]any{"action": "post", "mode": "recruit", "activity": "world", "role": "healer", "minLevel": 1, "note": "Tank seeking a healer", "ownerId": ids[2]})
	board := readGroupSocketBoard(t, connections[0], func(b groupSocketBoard) bool { return len(b.Listings) == 1 })
	if board.ViewerID != ids[0] || board.Listings[0].OwnerID != ids[0] {
		t.Fatal("listing ownership accepted client spoof")
	}
	send(1, map[string]any{"action": "list"})
	readGroupSocketBoard(t, connections[1], func(b groupSocketBoard) bool { return len(b.Listings) == 1 && b.Listings[0].Role == "healer" })
	send(1, map[string]any{"action": "request", "ownerId": ids[0], "role": "healer"})
	board = readGroupSocketBoard(t, connections[0], func(b groupSocketBoard) bool { return len(b.Listings) == 1 && len(b.Listings[0].Applicants) == 1 })
	applicant := board.Listings[0].Applicants[0]
	if applicant.PlayerID != ids[1] || applicant.Class != "Cleric" || applicant.Role != "healer" || board.Listings[0].Members != 1 {
		t.Fatal("application changed role or joined party without consent")
	}
	board = readGroupSocketBoard(t, connections[1], func(b groupSocketBoard) bool { return len(b.Listings) == 1 && b.Listings[0].Requested })
	if len(board.Listings[0].Applicants) != 0 {
		t.Fatal("applicant received leader-only request list")
	}
	send(2, map[string]any{"action": "list"})
	board = readGroupSocketBoard(t, connections[2], func(b groupSocketBoard) bool { return len(b.Listings) == 1 })
	if board.Listings[0].Requested || len(board.Listings[0].Applicants) != 0 {
		t.Fatal("bystander received private request data")
	}
	resourceSend(t, connections[0], MsgPartyInvite, PartyInvitePayload{TargetName: names[1]})
	resourceReadMessage(t, connections[1], MsgPartyRequest, nil)
	resourceSend(t, connections[1], MsgPartyResponse, PartyResponsePayload{InviterName: names[0], Accepted: true})
	party := readGroupSocketParty(t, connections[0], func(p groupSocketParty) bool { return len(p.Members) == 2 })
	if party.LeaderID != ids[0] || party.Members[0].Role != "tank" || party.Members[1].ID != ids[1] || party.Members[1].Role != "support" {
		t.Fatal("accepted party lost leader or class roles", party)
	}
	readGroupSocketParty(t, connections[1], func(p groupSocketParty) bool { return p.ID == party.ID && len(p.Members) == 2 })
	send(0, map[string]any{"action": "list"})
	readGroupSocketBoard(t, connections[0], func(b groupSocketBoard) bool {
		return len(b.Listings) == 1 && b.Listings[0].Members == 2 && len(b.Listings[0].Applicants) == 0
	})
	resourceSend(t, connections[0], MsgPartyReadyCheck, map[string]any{})
	for i := 0; i < 2; i++ {
		readGroupSocketParty(t, connections[i], func(p groupSocketParty) bool { return p.ID == party.ID && p.ReadyCheckActive && !p.AllReady })
	}
	for i := 0; i < 2; i++ {
		resourceSend(t, connections[i], MsgPartyReady, PartyReadyPayload{Ready: true})
	}
	for i := 0; i < 2; i++ {
		readGroupSocketParty(t, connections[i], func(p groupSocketParty) bool { return p.ID == party.ID && p.AllReady && len(p.Members) == 2 })
	}
	resourceCloseAndWait(t, repo, connections[1], names[1])
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": tokens[1]})
	var reply struct {
		PlayerID string `json:"playerID"`
		Token    string `json:"resumeToken"`
	}
	resourceReadMessage(t, resumed, MsgResumeSession, &reply)
	if reply.PlayerID != ids[1] || reply.Token == "" || reply.Token == tokens[1] {
		t.Fatal("party member resume did not bind identity and rotate token")
	}
	// No leader interaction: normal replication after resume must restore the roster.
	readGroupSocketParty(t, resumed, func(p groupSocketParty) bool { return p.ID == party.ID && p.LeaderID == ids[0] && len(p.Members) == 2 })
	connections[1] = resumed
	resourceSend(t, connections[1], MsgPartyLeave, map[string]any{})
	readGroupSocketParty(t, connections[1], func(p groupSocketParty) bool { return p.ID == "" && len(p.Members) == 0 })
	send(0, map[string]any{"action": "list"})
	readGroupSocketBoard(t, connections[0], func(b groupSocketBoard) bool { return len(b.Listings) == 1 && b.Listings[0].Members == 1 })
	send(0, map[string]any{"action": "remove"})
	readGroupSocketBoard(t, connections[0], func(b groupSocketBoard) bool { return len(b.Listings) == 0 })
	send(2, map[string]any{"action": "list"})
	readGroupSocketBoard(t, connections[2], func(b groupSocketBoard) bool { return len(b.Listings) == 0 })
	for i, conn := range connections {
		saved := resourceCloseAndWait(t, repo, conn, names[i])
		if saved.Level != 1 || saved.Gold != 0 || saved.EP != 0 || saved.XP != 0 {
			t.Fatal("social recruitment changed progression or currencies")
		}
	}
	t.Log("three connected fresh characters: role listing, consent, private applicants, invite/accept, readiness, token resume roster, leave/removal, unchanged progression passed")
}
