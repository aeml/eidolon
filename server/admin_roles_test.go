package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

type fakeAdminRoleStore struct {
	roles      map[string]bool
	lookupErr  error
	grantErr   error
	grantCount int
	username   string
	grantedBy  string
	source     string
}

func (store *fakeAdminRoleStore) HasAdminRole(username string) (bool, error) {
	if store.lookupErr != nil {
		return false, store.lookupErr
	}
	return store.roles[username], nil
}

func (store *fakeAdminRoleStore) GrantAdminRole(username, grantedBy, source string) (bool, error) {
	if store.grantErr != nil {
		return false, store.grantErr
	}
	store.grantCount++
	store.username = username
	store.grantedBy = grantedBy
	store.source = source
	if store.roles[username] {
		return false, nil
	}
	store.roles[username] = true
	return true, nil
}

func setAdminRoleTestState(t *testing.T, store adminRoleStore, bootstrap string) {
	t.Helper()
	originalStore, originalBootstrap := adminRoles, adminBootstrapUsernames
	adminRoles = store
	adminBootstrapUsernames = parseAdminBootstrapUsernames(bootstrap)
	t.Cleanup(func() {
		adminRoles = originalStore
		adminBootstrapUsernames = originalBootstrap
	})
}

func sendAdminCommand(t *testing.T, client *Client, message, sender string) []Message {
	t.Helper()
	payload, err := json.Marshal(ChatPayload{Message: message, Sender: sender})
	if err != nil {
		t.Fatal(err)
	}
	client.handleMessage(Message{Type: MsgChat, Payload: payload})
	return drainSentMessages(client.send)
}

func containsAdminResponse(t *testing.T, messages []Message, messageType, text string) bool {
	t.Helper()
	for _, message := range messages {
		if message.Type != messageType {
			continue
		}
		if messageType == MsgChat && strings.Contains(messagePayloadChat(t, message).Message, text) {
			return true
		}
		if messageType == MsgError && strings.Contains(messagePayloadString(t, message), text) {
			return true
		}
	}
	return false
}

func TestParseAdminBootstrapUsernamesUsesExactAccountNames(t *testing.T) {
	parsed := parseAdminBootstrapUsernames(" donveetz,OtherAdmin ,,donveetz ")
	if _, ok := parsed["donveetz"]; !ok {
		t.Fatal("expected donveetz in bootstrap allowlist")
	}
	if _, ok := parsed["OtherAdmin"]; !ok {
		t.Fatal("expected exact mixed-case account in bootstrap allowlist")
	}
	if _, ok := parsed["DONVEETZ"]; ok {
		t.Fatal("bootstrap allowlist must not authorize case variants")
	}
	if len(parsed) != 2 {
		t.Fatalf("expected two unique usernames, got %d", len(parsed))
	}
}

func TestRelevelGrantsDurableAdminRoleFromAuthenticatedAccount(t *testing.T) {
	store := &fakeAdminRoleStore{roles: make(map[string]bool)}
	setAdminRoleTestState(t, store, "donveetz")
	originalWorld := world
	world = game.NewWorld(nil)
	t.Cleanup(func() { world = originalWorld })
	client := newLevelCommandClient()
	client.username = "donveetz"
	player := newLevelCommandPlayer(client.playerID)
	player.Level = 73
	player.Experience = 4567
	player.Gold = 8910
	world.AddEntity(player)

	messages := sendAdminCommand(t, client, "/relevel", "spoofed-sender")
	if !store.roles["donveetz"] || store.grantCount != 1 {
		t.Fatalf("expected one durable role grant, got roles=%v grants=%d", store.roles, store.grantCount)
	}
	if store.username != "donveetz" || store.grantedBy != "donveetz" || store.source != "bootstrap_chat" {
		t.Fatalf("unexpected grant identity: username=%q actor=%q source=%q", store.username, store.grantedBy, store.source)
	}
	updated := world.GetEntity(client.playerID)
	if updated.Level != 73 || updated.Experience != 4567 || updated.Gold != 8910 {
		t.Fatalf("admin role changed progression: level=%d xp=%d gold=%d", updated.Level, updated.Experience, updated.Gold)
	}
	if !containsAdminResponse(t, messages, MsgChat, "Admin access enabled") ||
		!containsAdminResponse(t, messages, MsgChat, "level remains unchanged") {
		t.Fatalf("expected admin success response, got %+v", messages)
	}
}

func TestRelevelRejectsSenderSpoofAndQAAllowlistDoesNotConferAdmin(t *testing.T) {
	store := &fakeAdminRoleStore{roles: make(map[string]bool)}
	setAdminRoleTestState(t, store, "donveetz")
	originalQAUsernames := qaUsernames
	qaUsernames = parseQAUsernames("qa_level_test")
	t.Cleanup(func() { qaUsernames = originalQAUsernames })
	client := newLevelCommandClient()

	messages := sendAdminCommand(t, client, "/relevel", "donveetz")
	if store.grantCount != 0 || store.roles[client.username] {
		t.Fatal("chat sender or QA allowlisting must not confer admin access")
	}
	if !containsAdminResponse(t, messages, MsgError, "Admin bootstrap unavailable") {
		t.Fatalf("expected admin authorization error, got %+v", messages)
	}
}

func TestAdminRoleDoesNotConferQACommands(t *testing.T) {
	store := &fakeAdminRoleStore{roles: map[string]bool{"existing-admin": true}}
	setAdminRoleTestState(t, store, "donveetz")
	originalWorld, originalQAUsernames := world, qaUsernames
	world = game.NewWorld(nil)
	qaUsernames = parseQAUsernames("different-qa-account")
	t.Cleanup(func() {
		world = originalWorld
		qaUsernames = originalQAUsernames
	})
	client := newLevelCommandClient()
	client.username = "existing-admin"
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	messages := sendAdminCommand(t, client, "/level 30", client.username)
	if world.GetEntity(client.playerID).Level != 1 {
		t.Fatal("administrator role must not confer QA level access")
	}
	if !containsAdminResponse(t, messages, MsgError, "QA command unavailable") {
		t.Fatalf("expected independent QA authorization error, got %+v", messages)
	}
}

func TestRelevelIsIdempotentForExistingAdminOutsideBootstrapList(t *testing.T) {
	store := &fakeAdminRoleStore{roles: map[string]bool{"existing-admin": true}}
	setAdminRoleTestState(t, store, "donveetz")
	client := newLevelCommandClient()
	client.username = "existing-admin"

	messages := sendAdminCommand(t, client, "/relevel", client.username)
	if store.grantCount != 0 {
		t.Fatalf("existing role should not be rewritten, got %d grants", store.grantCount)
	}
	if !containsAdminResponse(t, messages, MsgChat, "already enabled") {
		t.Fatalf("expected idempotent success response, got %+v", messages)
	}
}

func TestRelevelFailsClosedWhenRolePersistenceFails(t *testing.T) {
	store := &fakeAdminRoleStore{roles: make(map[string]bool), grantErr: errors.New("database unavailable")}
	setAdminRoleTestState(t, store, "donveetz")
	client := newLevelCommandClient()
	client.username = "donveetz"

	messages := sendAdminCommand(t, client, "/relevel", client.username)
	if store.roles[client.username] {
		t.Fatal("failed persistence must not confer admin access")
	}
	if !containsAdminResponse(t, messages, MsgError, "Could not enable admin access") {
		t.Fatalf("expected persistence error, got %+v", messages)
	}
}

func TestRelevelRequiresExactCommandAndAvailableRoleStore(t *testing.T) {
	setAdminRoleTestState(t, nil, "donveetz")
	client := newLevelCommandClient()
	client.username = "donveetz"

	usage := sendAdminCommand(t, client, "/relevel now", client.username)
	if !containsAdminResponse(t, usage, MsgError, "Usage: /relevel") {
		t.Fatalf("expected usage response, got %+v", usage)
	}
	unavailable := sendAdminCommand(t, client, "/relevel", client.username)
	if !containsAdminResponse(t, unavailable, MsgError, "Admin role service unavailable") {
		t.Fatalf("expected unavailable response, got %+v", unavailable)
	}
}
