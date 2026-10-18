package main

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func gameplayReadUpdateRequired(t *testing.T, connection *websocket.Conn) {
	t.Helper()
	_ = connection.SetReadDeadline(time.Now().Add(10 * time.Second))
	for {
		kind, data, err := connection.ReadMessage()
		if err != nil {
			t.Fatal("obsolete client lacked a readable update response", err)
		}
		if kind == websocket.BinaryMessage {
			t.Fatal("obsolete client was admitted to a world it cannot present")
		}
		var message Message
		if kind != websocket.TextMessage || json.Unmarshal(data, &message) != nil {
			continue
		}
		if message.Type == MsgMovementContext || message.Type == MsgQuestUpdate || message.Type == MsgResumeSession {
			t.Fatal("obsolete client received world entry/resume", message.Type)
		}
		if message.Type == "world_access_denied" {
			var denied struct{ Code, Message string }
			if json.Unmarshal(message.Payload, &denied) != nil || denied.Code != "client_update_required" ||
				!strings.Contains(strings.ToLower(denied.Message), "reload") {
				t.Fatal("update response is not readable by the previous client")
			}
			return
		}
	}
}

func TestGameplayActualCachedClientRequiresUpdateWithoutLosingCharacterOrToken(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	before, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 751, "-save-journal-dir", t.TempDir())
	open := func() *websocket.Conn {
		t.Helper()
		connection, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = connection.Close() })
		return connection
	}
	login := func(connection *websocket.Conn) string {
		t.Helper()
		resourceSend(t, connection, MsgLogin, map[string]string{"username": fixture.Name, "password": password})
		var accepted struct{ ResumeToken, GameplayProtocol string }
		resourceReadMessage(t, connection, "login_success", &accepted)
		if accepted.ResumeToken == "" || accepted.GameplayProtocol != "stationary-actions-roofs-v1" {
			t.Fatal("ordinary authentication did not issue a resume token")
		}
		return accepted.ResumeToken
	}
	legacy := open()
	login(legacy)
	// This is the exact pre-update shape: authentication remains available, but
	// neither optimistic instant recall nor absent roof support may enter play.
	resourceSend(t, legacy, MsgJoin, map[string]string{"type": fixture.Class})
	gameplayReadUpdateRequired(t, legacy)
	_ = legacy.Close()
	after, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("refused cached client changed its saved character", err)
	}
	current := open()
	token := login(current)
	resourceSend(t, current, MsgJoin, map[string]string{"type": fixture.Class, "gameplayProtocol": "stationary-actions-roofs-v1"})
	observation := &gameplaySessionObservation{}
	gameplayWait(t, current, fixture.Name, observation, func() bool { return observation.joined && observation.self != nil })
	closed := time.Now()
	_ = current.Close()
	for deadline := time.Now().Add(10 * time.Second); ; {
		after, err = repo.GetCharacter(fixture.Name, fixture.Name)
		if err == nil && after != nil && after.LastLogout.After(closed) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("current character did not save its disconnected session", err)
		}
		time.Sleep(20 * time.Millisecond)
	}
	saved := after
	resumed := open()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	gameplayReadUpdateRequired(t, resumed)
	after, err = repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || !reflect.DeepEqual(saved, after) {
		t.Fatal("refused cached resume changed saved progress", err)
	}
	// The existing denial writer closes the old transport after flushing its
	// readable instruction. A new compatible transport must still be able to
	// claim the live entity and rotate the same unconsumed single-use token.
	_ = resumed.Close()
	resumed = open()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token, "gameplayProtocol": "stationary-actions-roofs-v1"})
	var reply struct{ ResumeToken, GameplayProtocol string }
	resourceReadMessage(t, resumed, MsgResumeSession, &reply)
	if reply.ResumeToken == "" || reply.ResumeToken == token || reply.GameplayProtocol != "stationary-actions-roofs-v1" {
		t.Fatal("current resume did not retain and then rotate the refused token")
	}
	observation = &gameplaySessionObservation{}
	gameplayWait(t, resumed, fixture.Name, observation, func() bool { return observation.joined && observation.self != nil })
	_ = resumed.Close()
	stop()
	after, err = repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || after == nil || after.Gold != saved.Gold || after.EP != saved.EP ||
		after.Level != saved.Level || after.XP != saved.XP || !reflect.DeepEqual(after.Inventory, saved.Inventory) ||
		!reflect.DeepEqual(after.Equipment, saved.Equipment) || !reflect.DeepEqual(after.Stats, saved.Stats) {
		t.Fatal("current world entry/resume lost retained character custody", err)
	}
	t.Log("Cached join/resume receive the previous client's readable reload response before world entry; saved character and single-use token remain intact; current declared protocol joins and resumes normally. No production account or campaign claim.")
}
