package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type arenaSocketState struct {
	DeserterUntil time.Time           `json:"deserterUntil"`
	Queued        int                 `json:"queued"`
	Match         *game.PvPMatch      `json:"match"`
	Opponents     []string            `json:"opponents"`
	Profile       database.PvPProfile `json:"profile"`
}

// Actual transport loss is deliberately distinct from the completed-combat
// test below. It must settle once, penalize only the leaver, and retain that
// decision through token resume and a real server restart.
func TestArenaActualDisconnectPenaltySurvivesResumeAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and built server")
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
	storage, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer storage.Disconnect(context.Background())
	users := storage.Database("eidolon").Collection("users")
	if count, err := users.CountDocuments(context.Background(), bson.M{}); err != nil || count != 0 {
		t.Fatal("requires empty disposable accounts; refusing existing users", err)
	}
	names, ids := make([]string, 4), make([]string, 4)
	for i := range names {
		names[i] = fmt.Sprintf("ad-%x-%d", time.Now().UnixNano(), i)
		ids[i] = "player-" + names[i]
	}
	defer users.DeleteMany(context.Background(), bson.M{"username": bson.M{"$in": names}})
	defer storage.Database("eidolon").Collection("pvp_profiles").DeleteMany(context.Background(), bson.M{"player_id": bson.M{"$in": ids}})
	for _, name := range names {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		if err := repo.SetFirstCharacter(name, &database.Character{Name: name, Class: "Wizard", Level: 30,
			ProgressionVersion: game.CurrentProgressionVersion, LastDailyQuest: time.Now(),
			Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}}); err != nil {
			t.Fatal(err)
		}
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 62, "-save-journal-dir", journal)
	defer stop()
	connections, tokens := make([]*websocket.Conn, 4), make([]string, 4)
	for i, name := range names {
		connections[i], tokens[i] = resourceLoginCharacter(t, address, name, name+"-local-only", "Wizard")
	}
	for _, leader := range []int{0, 2} {
		resourceSend(t, connections[leader], MsgPartyInvite, PartyInvitePayload{TargetName: names[leader+1]})
		resourceReadMessage(t, connections[leader+1], MsgPartyRequest, nil)
		resourceSend(t, connections[leader+1], MsgPartyResponse, PartyResponsePayload{InviterName: names[leader], Accepted: true})
		for {
			var payload json.RawMessage
			resourceReadMessage(t, connections[leader], MsgPartyUpdate, &payload)
			if strings.Contains(string(payload), ids[leader+1]) {
				break
			}
		}
	}
	probes := make([]*arenaSocketProbe, 4)
	for i := range probes {
		probes[i] = watchArenaSocket(connections[i], ids[i])
	}
	resourceSend(t, connections[0], MsgArenaQueue, ArenaQueuePayload{TeamSize: 2})
	arenaAwait(t, 10*time.Second, func() bool { state, _, _, _ := arenaProbeRead(t, probes[0]); return state.Queued == 2 })
	resourceSend(t, connections[2], MsgArenaQueue, ArenaQueuePayload{TeamSize: 2})
	var matchID string
	arenaAwait(t, 10*time.Second, func() bool {
		for _, probe := range probes {
			state, _, _, _ := arenaProbeRead(t, probe)
			if state.Match == nil || state.Match.Status != game.PvPMatchActive {
				return false
			}
			if matchID == "" {
				matchID = state.Match.ID
			}
			if state.Match.ID != matchID || state.Match.Practice || state.Match.Mode != game.PvPModeArena2v2 {
				t.Fatal("incorrect ranked match")
			}
		}
		return true
	})
	closedAt := time.Now()
	connections[0].Close() // Real connection loss; no arena_leave/forfeit command.
	arenaAwait(t, 10*time.Second, func() bool {
		for _, probe := range probes[1:] {
			state, _, _, _ := arenaProbeRead(t, probe)
			if state.Match != nil || state.Profile.Wins+state.Profile.Losses != 1 {
				return false
			}
		}
		return true
	})
	profiles := make([]database.PvPProfile, 4)
	for i, id := range ids {
		profile, err := repo.GetPvPProfile(id)
		if err != nil {
			t.Fatal(err)
		}
		if profile.LastMatchID != matchID || !profile.LastResult.Forfeit || profile.Wins+profile.Losses != 1 ||
			profile.Honor != 0 || profile.SeasonPoints != 0 || (profile.Wins == 1) != (i >= 2) {
			t.Fatal("disconnect result/reward ownership is incorrect", i, profile)
		}
		if i == 0 {
			if profile.RewardState.DeserterUntil < closedAt.Add(4*time.Minute).Unix() || profile.RewardState.DeserterUntil > closedAt.Add(6*time.Minute).Unix() {
				t.Fatal("leaver did not receive the bounded five-minute penalty")
			}
		} else if profile.RewardState.DeserterUntil != 0 {
			t.Fatal("innocent teammate or opponent received a deserter penalty", i)
		}
		profiles[i] = *profile
	}
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { resumed.Close() })
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": tokens[0]})
	var reply struct {
		PlayerID    string `json:"playerID"`
		ResumeToken string `json:"resumeToken"`
	}
	resourceReadMessage(t, resumed, MsgResumeSession, &reply)
	if reply.PlayerID != ids[0] || reply.ResumeToken == "" || reply.ResumeToken == tokens[0] {
		t.Fatal("resume lost ownership or failed token rotation")
	}
	resourceReadMessage(t, resumed, MsgQuestUpdate, nil)
	resourceSend(t, resumed, MsgPvPGet, struct{}{})
	var state arenaSocketState
	resourceReadMessage(t, resumed, MsgPvPUpdate, &state)
	if state.Match != nil || state.Profile.Losses != 1 || state.DeserterUntil.Unix() != profiles[0].RewardState.DeserterUntil {
		t.Fatal("resume escaped the recorded forfeit", state)
	}
	resourceSend(t, resumed, MsgArenaQueue, ArenaQueuePayload{TeamSize: 1})
	var rejection json.RawMessage
	resourceReadMessage(t, resumed, MsgError, &rejection)
	if !strings.Contains(string(rejection), "deserter penalty") {
		t.Fatal("resume did not enforce ranked queue penalty", string(rejection))
	}
	resumed.Close()
	for _, conn := range connections[1:] {
		conn.Close()
	}
	stop()
	address, stopRestart := compatStartServer(t, binary, uri, 63, "-save-journal-dir", journal)
	defer stopRestart()
	for i, name := range names {
		fresh, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Wizard")
		resourceSend(t, fresh, MsgPvPGet, struct{}{})
		state = arenaSocketState{}
		resourceReadMessage(t, fresh, MsgPvPUpdate, &state)
		profile, err := repo.GetPvPProfile(ids[i])
		if err != nil {
			t.Fatal(err)
		}
		if state.Match != nil || profile.LastMatchID != matchID || profile.Revision != profiles[i].Revision ||
			profile.Wins != profiles[i].Wins || profile.Losses != profiles[i].Losses || profile.Rating != profiles[i].Rating ||
			profile.Honor != 0 || profile.SeasonPoints != 0 || profile.RewardState.DeserterUntil != profiles[i].RewardState.DeserterUntil {
			t.Fatal("restart duplicated/changed the disconnect result", i, profile)
		}
		if i == 0 && state.DeserterUntil.Unix() != profiles[i].RewardState.DeserterUntil {
			t.Fatal("restart lost active leaver penalty")
		}
		if i != 0 && !state.DeserterUntil.IsZero() {
			t.Fatal("restart penalized an innocent participant", i)
		}
		t.Logf("client=%d wins=%d losses=%d rating=%d honor=%d penalty=%t revision=%d", i,
			profile.Wins, profile.Losses, profile.Rating, profile.Honor, i == 0, profile.Revision)
		fresh.Close()
	}
	t.Log("actual disconnect settled once; token resume and server restart retained only the leaver's penalty")
}

type arenaSocketProbe struct {
	mu         sync.Mutex
	state      arenaSocketState
	complete   *game.PvPMatch
	movement   string
	hits       int
	readErr    error
	rejections []string
}

// Drain every actual socket throughout combat, including eliminated players.
// Only replicated results are observed; no world pointer or clock is replaced.
func watchArenaSocket(conn *websocket.Conn, id string) *arenaSocketProbe {
	_ = conn.SetReadDeadline(time.Time{})
	p := &arenaSocketProbe{}
	go func() {
		for {
			kind, data, err := conn.ReadMessage()
			p.mu.Lock()
			if err != nil {
				p.readErr = err
				p.mu.Unlock()
				return
			}
			var message Message
			if kind != websocket.TextMessage || json.Unmarshal(data, &message) != nil {
				p.mu.Unlock()
				continue
			}
			switch message.Type {
			case MsgPvPUpdate:
				var state arenaSocketState
				if err := json.Unmarshal(message.Payload, &state); err != nil {
					p.readErr = err
				} else {
					p.state = state
					if state.Match != nil && state.Match.Status == game.PvPMatchComplete {
						p.complete = state.Match
					}
				}
			case MsgMovementContext:
				var movement struct {
					Context string `json:"movementContext"`
				}
				if json.Unmarshal(message.Payload, &movement) == nil {
					p.movement = movement.Context
				}
			case "damage":
				var hit struct {
					SourceID string `json:"sourceId"`
					Amount   int    `json:"amount"`
				}
				if json.Unmarshal(message.Payload, &hit) == nil && hit.SourceID == id && hit.Amount > 0 {
					p.hits++
				}
			case MsgError:
				p.rejections = append(p.rejections, string(message.Payload))
			}
			p.mu.Unlock()
		}
	}()
	return p
}

func arenaProbeRead(t *testing.T, p *arenaSocketProbe) (arenaSocketState, string, *game.PvPMatch, int) {
	t.Helper()
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.readErr != nil || len(p.rejections) != 0 {
		t.Fatalf("arena socket failed: read=%v rejections=%v", p.readErr, p.rejections)
	}
	return p.state, p.movement, p.complete, p.hits
}

func arenaAwait(t *testing.T, timeout time.Duration, check func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if check() {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatal("ordinary arena transition did not arrive before its declared deadline")
}

// Separate from browser appearance/cadence checks: real parties, ranked queue,
// production combat/round timers, and saved results after fresh authentication.
func TestArenaActualSocketsTeamRoundsAndSavedResults(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and built server")
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
	storage, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer storage.Disconnect(context.Background())
	users := storage.Database("eidolon").Collection("users")
	if count, err := users.CountDocuments(context.Background(), bson.M{}); err != nil || count != 0 {
		t.Fatal("requires an empty disposable user collection; refusing existing accounts", err)
	}
	names, ids := make([]string, 4), make([]string, 4)
	for i := range names {
		names[i] = fmt.Sprintf("aq-%x-%d", time.Now().UnixNano(), i)
		ids[i] = "player-" + names[i]
	}
	defer users.DeleteMany(context.Background(), bson.M{"username": bson.M{"$in": names}})
	defer storage.Database("eidolon").Collection("pvp_profiles").DeleteMany(context.Background(), bson.M{"player_id": bson.M{"$in": ids}})
	gearIDs := make([]string, 4)
	for i, name := range names {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		// Attainable prepared gear and allocated level points, never mid-match
		// stat/health/damage grants. All four actors are ranged Wizards so this
		// focused socket check needs only the ordinary short arena approach.
		var staff *game.Item
		for attempt := 0; attempt < 1000; attempt++ {
			item := game.GenerateLootForSlot("mainHand", 30)
			if item != nil && strings.Contains(item.Name, "Staff") && item.Rarity == game.RarityRare {
				staff = item
				break
			}
		}
		if staff == nil {
			t.Fatal("could not roll an ordinary Rare staff")
		}
		gearIDs[i] = staff.ID
		character := &database.Character{Name: name, Class: "Wizard", Level: 30, Gold: 1000,
			ProgressionVersion: game.CurrentProgressionVersion, LastDailyQuest: time.Now(),
			Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 155, Vitality: 10, Wisdom: 10},
			Equipment: map[string]database.Item{"mainHand": databaseItem(*staff)}}
		if err := repo.SetFirstCharacter(name, character); err != nil {
			t.Fatal(err)
		}
	}
	address, stop := compatStartServer(t, binary, uri, 61, "-save-journal-dir", t.TempDir())
	defer stop()
	connections := make([]*websocket.Conn, 4)
	for i, name := range names {
		connections[i], _ = resourceLoginCharacter(t, address, name, name+"-local-only", "Wizard")
	}
	for _, leader := range []int{0, 2} {
		resourceSend(t, connections[leader], MsgPartyInvite, PartyInvitePayload{TargetName: names[leader+1]})
		resourceReadMessage(t, connections[leader+1], MsgPartyRequest, nil)
		resourceSend(t, connections[leader+1], MsgPartyResponse, PartyResponsePayload{InviterName: names[leader], Accepted: true})
		for {
			var payload json.RawMessage
			resourceReadMessage(t, connections[leader], MsgPartyUpdate, &payload)
			if strings.Contains(string(payload), ids[leader+1]) {
				break
			}
		}
	}
	probes := make([]*arenaSocketProbe, 4)
	for i := range probes {
		probes[i] = watchArenaSocket(connections[i], ids[i])
	}
	resourceSend(t, connections[0], MsgArenaQueue, ArenaQueuePayload{TeamSize: 2})
	arenaAwait(t, 10*time.Second, func() bool {
		state, _, _, _ := arenaProbeRead(t, probes[0])
		return state.Queued == 2 && state.Match == nil
	})
	resourceSend(t, connections[2], MsgArenaQueue, ArenaQueuePayload{TeamSize: 2})
	var matchID string
	arenaAwait(t, 10*time.Second, func() bool {
		for _, probe := range probes {
			state, _, _, _ := arenaProbeRead(t, probe)
			if state.Match == nil {
				return false
			}
			if state.Match.Mode != game.PvPModeArena2v2 || state.Match.Practice || state.Match.FirstTo != 2 || len(state.Match.TeamA) != 2 || len(state.Match.TeamB) != 2 {
				t.Fatal("wrong authoritative team match", state.Match)
			}
			if matchID == "" {
				matchID = state.Match.ID
			}
			if state.Match.ID != matchID {
				t.Fatal("party members entered different matches")
			}
			for _, pair := range [][]string{ids[:2], ids[2:]} {
				if !(containsString(state.Match.TeamA, pair[0]) && containsString(state.Match.TeamA, pair[1])) &&
					!(containsString(state.Match.TeamB, pair[0]) && containsString(state.Match.TeamB, pair[1])) {
					t.Fatal("queue split a two-player party across opposing teams")
				}
			}
		}
		return true
	})
	t.Log("all four ordinary socket clients admitted to one ranked 2v2 match")
	steps, rounds, sequences := make([]int, 4), make([]int, 4), make([]uint64, 4)
	deadline := time.Now().Add(3 * time.Minute)
	finished := false
	for time.Now().Before(deadline) {
		completeCount := 0
		for i, probe := range probes {
			state, movement, completed, _ := arenaProbeRead(t, probe)
			if completed != nil {
				completeCount++
				continue
			}
			m := state.Match
			if m == nil || m.RoundPending || len(state.Opponents) == 0 {
				continue
			}
			if rounds[i] != m.Round {
				rounds[i], steps[i] = m.Round, 0
			}
			if steps[i] < 4 {
				steps[i]++
				sign, member := -1.0, 0
				for index, id := range m.TeamA {
					if id == ids[i] {
						member = index
					}
				}
				for index, id := range m.TeamB {
					if id == ids[i] {
						sign, member = 1, index
					}
				}
				sequences[i]++
				resourceSend(t, connections[i], MsgMove, MovePayload{MovementContext: movement,
					X: sign * float64(8-steps[i]), Z: -3 + float64(member)*6, State: "RUNNING", Sequence: sequences[i]})
				continue
			}
			resourceSend(t, connections[i], MsgAttack, AttackPayload{TargetID: state.Opponents[0]})
		}
		if completeCount == 4 {
			finished = true
			break
		}
		time.Sleep(500 * time.Millisecond)
	}
	if !finished {
		t.Fatal("ranked match did not complete through ordinary attacks within three minutes")
	}
	for i, probe := range probes {
		_, _, completed, hits := arenaProbeRead(t, probe)
		if completed == nil || completed.ID != matchID || completed.Round < 2 || len(completed.WinnerIDs) != 2 || hits == 0 {
			t.Fatalf("client %d missed real combat/full team result: hits=%d result=%+v", i, hits, completed)
		}
		if max(completed.ScoreA, completed.ScoreB) != 2 || min(completed.ScoreA, completed.ScoreB) >= 2 {
			t.Fatal("match ended without the required first-to-two score", completed)
		}
		winningTeam := completed.TeamA
		if completed.ScoreB == 2 {
			winningTeam = completed.TeamB
		}
		for _, id := range winningTeam {
			if !containsString(completed.WinnerIDs, id) {
				t.Fatal("announced winner disagrees with team score")
			}
		}
	}
	// Wait for ordinary result delivery/persistence, then authenticate again.
	profiles := make([]database.PvPProfile, 4)
	arenaAwait(t, 15*time.Second, func() bool {
		for i, id := range ids {
			profile, err := repo.GetPvPProfile(id)
			if err != nil || profile.LastMatchID != matchID || profile.Wins+profile.Losses != 1 {
				return false
			}
			profiles[i] = *profile
		}
		return true
	})
	wins := 0
	for i, conn := range connections {
		_, _, completed, hits := arenaProbeRead(t, probes[i])
		if (profiles[i].Wins == 1) != containsString(completed.WinnerIDs, ids[i]) {
			t.Fatal("saved result credited the wrong winner", i, profiles[i])
		}
		t.Logf("client=%d rounds=%d score=%d:%d hits=%d wins=%d losses=%d rating=%d honor=%d",
			i, completed.Round, completed.ScoreA, completed.ScoreB, hits,
			profiles[i].Wins, profiles[i].Losses, profiles[i].Rating, profiles[i].Honor)
		wins += profiles[i].Wins
		conn.Close()
		fresh, _ := resourceLoginCharacter(t, address, names[i], names[i]+"-local-only", "Wizard")
		resourceSend(t, fresh, MsgPvPGet, struct{}{})
		var state arenaSocketState
		resourceReadMessage(t, fresh, MsgPvPUpdate, &state)
		if state.Match != nil || state.Profile.Wins != profiles[i].Wins || state.Profile.Losses != profiles[i].Losses || state.Profile.Rating != profiles[i].Rating || state.Profile.Honor != profiles[i].Honor {
			t.Fatalf("client %d lost its completed result across login: %+v", i, state)
		}
		saved, err := repo.GetCharacter(names[i], names[i])
		if err != nil || saved.Level != 30 || saved.Gold != 1000 || saved.XP != 0 || saved.Equipment["mainHand"].ID != gearIDs[i] {
			t.Fatal("ranked combat changed PvE level, Gold, XP or the prepared weapon", i, err)
		}
		fresh.Close()
	}
	if wins != 2 {
		t.Fatal("ranked result did not award exactly two winners", profiles)
	}
	t.Log("first-to-two combat, four correctly owned saved results, and fresh-login persistence verified")
}
