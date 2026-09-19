package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type fakeAdminActivityStore struct {
	events             []database.AdminActivity
	appendErr, readErr error
	query              database.AdminActivityQuery
	reads              int
}

func (s *fakeAdminActivityStore) AdminActivityRetentionDays() int { return 90 }
func (s *fakeAdminActivityStore) AppendAdminActivity(event database.AdminActivity) error {
	if s.appendErr != nil {
		return s.appendErr
	}
	s.events = append(s.events, event)
	return nil
}
func (s *fakeAdminActivityStore) ReadAdminActivity(query database.AdminActivityQuery) (database.AdminActivityPage, error) {
	s.query = query
	s.reads++
	return database.AdminActivityPage{Entries: append([]database.AdminActivity{}, s.events...), RetentionDays: 90}, s.readErr
}

func adminReadFixture(t *testing.T) (*Client, *fakeAdminRoleStore) {
	t.Helper()
	store := &fakeAdminRoleStore{roles: map[string]bool{"operator": true}}
	setAdminRoleTestState(t, store, "bootstrap-only")
	previousActivities := adminActivities
	adminActivities = &fakeAdminActivityStore{}
	t.Cleanup(func() { adminActivities = previousActivities })
	previousWorld, previousSessions := world, activeSessions
	world, activeSessions = game.NewWorld(nil), make(map[string]*Client)
	t.Cleanup(func() { world, activeSessions = previousWorld, previousSessions })
	c := &Client{username: "operator", send: make(chan []byte, 10)}
	activeSessions[c.username] = c
	return c, store
}

func adminRead(t *testing.T, c *Client, kind, after string) adminReadResult {
	t.Helper()
	payload, _ := json.Marshal(adminReadRequest{ID: "read-request-000001", After: after})
	handleAdminRead(c, Message{Type: kind, Payload: payload})
	messages := drainSentMessages(c.send)
	if len(messages) != 1 {
		t.Fatalf("got %d responses", len(messages))
	}
	var result adminReadResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestAdminConsoleDurableRoleIsRecheckedAndFailsClosed(t *testing.T) {
	c, store := adminReadFixture(t)
	if result := adminRead(t, c, MsgAdminStatus, ""); !result.Success || !result.Authorized {
		t.Fatal(result)
	}
	delete(store.roles, "operator")
	if result := adminRead(t, c, MsgAdminPlayers, ""); result.Success || result.Authorized || len(result.Players) != 0 {
		t.Fatal(result)
	}
	store.roles["operator"] = true
	store.lookupErr = errors.New("sensitive database diagnostic")
	if result := adminRead(t, c, MsgAdminStatus, ""); result.Success || result.Authorized || strings.Contains(result.Message, "sensitive") {
		t.Fatal(result)
	}
	adminRoles = nil
	if result := adminRead(t, c, MsgAdminStatus, ""); result.Success || result.Authorized {
		t.Fatal(result)
	}
}

func TestAdminConsoleRejectsBootstrapOnlyAnonymousAndReplacedClients(t *testing.T) {
	c, _ := adminReadFixture(t)
	for _, username := range []string{"bootstrap-only", "qa-only", ""} {
		c.username = username
		if result := adminRead(t, c, MsgAdminStatus, ""); result.Authorized {
			t.Fatal(username, result)
		}
	}
	c.username = "operator"
	activeSessions[c.username] = &Client{username: c.username}
	if result := adminRead(t, c, MsgAdminPlayers, ""); result.Success || result.Authorized {
		t.Fatal(result)
	}
}

func TestAdminConsoleRequestsHaveClosedBoundedSchema(t *testing.T) {
	for _, payload := range []string{
		`null`, `[]`, `{}`, `{"id":"short"}`, `{"id":"read-request-000001","sender":"operator"}`,
		`{"id":"read-request-000001","role":"admin"}`, `{"id":"read-request-000001","id":"read-request-000002"}`,
		`{"id":"read-request-000001"} {}`, `{"id":"read-request-000001","after":3}`,
		`{"id":"read-request-000001","after":"\u0000"}`,
		`{"id":"read-request-000001","after":null}`,
		`{"id":"` + strings.Repeat("a", 65) + `"}`,
		`{"id":"read-request-000001","after":"` + strings.Repeat("a", 72) + `"}`,
	} {
		if _, err := decodeAdminRead(Message{Type: MsgAdminPlayers, Payload: json.RawMessage(payload)}); err == nil {
			t.Fatalf("accepted %s", payload)
		}
	}
	if _, err := decodeAdminRead(Message{Type: MsgAdminStatus, Payload: json.RawMessage(`{"id":"read-request-000001","after":"abc"}`)}); err == nil {
		t.Fatal("status accepted cursor")
	}
}

func TestAdminConsoleOnlinePagesAreBoundedSortedAndMinimal(t *testing.T) {
	c, _ := adminReadFixture(t)
	for index := 60; index >= 0; index-- {
		name := fmt.Sprintf("account-%03d", index)
		id := "player-" + name
		activeSessions[name] = &Client{username: name, playerID: id}
		world.AddEntity(&game.Entity{ID: id, Name: name, Type: game.TypePlayer, SubType: "Fighter", Level: 70, Gold: 999999, EP: 20})
	}
	activeSessions["account-000"].transportClosed.Store(true)
	first := adminRead(t, c, MsgAdminPlayers, "")
	if !first.Success || len(first.Players) != 50 || first.Next != "account-050" || first.Players[0].Account != "account-001" {
		t.Fatal(first)
	}
	second := adminRead(t, c, MsgAdminPlayers, first.Next)
	if !second.Success || len(second.Players) != 10 || second.Next != "" || second.Players[0].Account != "account-051" {
		t.Fatal(second)
	}
	encoded, _ := json.Marshal(first.Players[0])
	var fields map[string]interface{}
	_ = json.Unmarshal(encoded, &fields)
	if len(fields) != 5 {
		t.Fatalf("unexpected private fields: %s", encoded)
	}
	for _, key := range []string{"account", "playerId", "name", "class", "level"} {
		if _, ok := fields[key]; !ok {
			t.Fatal(key)
		}
	}
}

func TestAdminConsoleAdmissionRequiresAuthenticationAndRateLimits(t *testing.T) {
	for _, kind := range []string{MsgAdminStatus, MsgAdminPlayers, MsgAdminHistory} {
		policy := inboundMessagePolicies[kind]
		if policy.access != accessAuthenticated || policy.maxPayloadBytes != 1024 || policy.burst != 5 || messageHandlers[kind] == nil {
			t.Fatal(kind, policy)
		}
		c := &Client{}
		msg := Message{Type: kind, Payload: json.RawMessage(`{"id":"read-request-000001"}`)}
		if c.acceptInboundMessage(msg, time.Now()) == nil {
			t.Fatal("anonymous admission")
		}
		c.username = "operator"
		when := time.Now()
		for count := 0; count < 5; count++ {
			if err := c.acceptInboundMessage(msg, when); err != nil {
				t.Fatal(err)
			}
		}
		if c.acceptInboundMessage(msg, when) == nil {
			t.Fatal("missing rate limit")
		}
	}
}

func TestAdminConsoleHistoryAuthorizationAuditAndFailure(t *testing.T) {
	c, roles := adminReadFixture(t)
	store := adminActivities.(*fakeAdminActivityStore)
	adminRead(t, c, MsgAdminStatus, "")
	if len(store.events) != 1 || store.events[0].Actor != "operator" || store.events[0].Action != MsgAdminStatus || store.events[0].Result != "success" {
		t.Fatal(store.events)
	}
	page := adminRead(t, c, MsgAdminHistory, "")
	if !page.Success || page.History == nil || len(page.History.Entries) != 1 || page.History.RetentionDays != 90 {
		t.Fatal(page)
	}
	delete(roles.roles, "operator")
	denied := adminRead(t, c, MsgAdminHistory, "")
	if denied.Authorized || denied.History != nil || store.reads != 1 || store.events[len(store.events)-1].Result != "denied" {
		t.Fatal(denied)
	}
	roles.roles["operator"] = true
	store.readErr = errors.New("private store error")
	if result := adminRead(t, c, MsgAdminHistory, ""); result.Success || result.History != nil || strings.Contains(result.Message, "private") {
		t.Fatal(result)
	}
	store.readErr = nil
	store.appendErr = errors.New("audit disk failed")
	if result := adminRead(t, c, MsgAdminHistory, ""); result.Success || result.Authorized || result.History != nil {
		t.Fatal("acknowledged unaudited read", result)
	}
}
