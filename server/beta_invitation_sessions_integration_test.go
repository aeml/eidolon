package main

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Ordinary sockets and the production binary, restricted by the existing
// explicit disposable-loopback guard. No production identity or mail is used.
func TestBetaInvitationActualSignupRetainedAccountsRotationAndRollback(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	const initialKey = "7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a"
	const rotatedKey = "6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b"
	t.Setenv("EIDOLON_REGISTRATION_MODE", "invited")
	t.Setenv("EIDOLON_INVITATION_SIGNING_KEY", initialKey)
	// These fixtures must never inherit an actual configured mail integration.
	t.Setenv("POSTMARK_SERVER_TOKEN", "")
	t.Setenv("ADMIN_NOTIFICATION_EMAILS", "")
	t.Setenv("EIDOLON_ADMIN_BOOTSTRAP_USERNAMES", "")
	fixture, password := resourceJournalFixture(t, repo)
	operator := fmt.Sprintf("beta-operator-%d", time.Now().UnixNano())
	if err := repo.CreateUser(operator, "operator@example.invalid", password); err != nil {
		t.Fatal("fixture operator creation failed")
	}
	if granted, err := repo.GrantAdminRole(operator, operator, "disposable_invitation_fixture"); err != nil || !granted {
		t.Fatal("fixture operator permission failed")
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 901, "-save-journal-dir", journal)
	defer stop()

	// Existing accounts need neither an invitation nor a new password. Establish
	// normal first-admission normalization before comparing saved progression.
	member, _ := resourceLoginCharacter(t, address, fixture.Name, password, fixture.Class)
	baseline := resourceCloseAndWait(t, repo, member, fixture.Name)
	member, token := resourceLoginCharacter(t, address, fixture.Name, password, fixture.Class)
	resourceCloseAndWait(t, repo, member, fixture.Name)
	resumed := credentialSocket(t, address)
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	var resume struct {
		PlayerID    string `json:"playerID"`
		ResumeToken string `json:"resumeToken"`
	}
	resourceReadMessage(t, resumed, MsgResumeSession, &resume)
	if resume.PlayerID != "player-"+fixture.Name || resume.ResumeToken == "" || resume.ResumeToken == token {
		t.Fatal("invited mode broke an existing character's resume/rotation")
	}
	resourceReadMessage(t, resumed, MsgQuestUpdate, nil)
	assertBetaRetainedProgress(t, baseline, resourceCloseAndWait(t, repo, resumed, fixture.Name))

	staff := credentialSocket(t, address)
	resourceSend(t, staff, MsgLogin, AuthPayload{Username: operator, Password: password})
	credentialExpectLogin(t, staff)
	expires := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	name := fmt.Sprintf("beta-invitee-%d", time.Now().UnixNano())
	raceName, pendingName := name+"-race", name+"-pending"
	const email = "invitee@example.invalid"
	request := func(conn *websocket.Conn, id, username string) betaInvitationResult {
		t.Helper()
		resourceSend(t, conn, MsgAdminBetaInvitation, map[string]any{
			"id": id, "username": username, "email": email, "expiresAt": expires, "confirmed": true,
		})
		var result betaInvitationResult
		resourceReadMessage(t, conn, MsgAdminBetaInvitation+"_result", &result)
		if result.ID != id {
			t.Fatal("private issuance response lost request correlation")
		}
		return result
	}
	ordinary := credentialSocket(t, address)
	resourceSend(t, ordinary, MsgLogin, AuthPayload{Username: fixture.Name, Password: password})
	credentialExpectLogin(t, ordinary)
	if rejected := request(ordinary, "beta-member-denied-0001", name); rejected.Success || rejected.Authorized || rejected.Code != "" {
		t.Fatal("ordinary account obtained an invitation")
	}
	ordinary.Close()
	proofs := make(map[string]string)
	for i, username := range []string{name, raceName, pendingName} {
		result := request(staff, fmt.Sprintf("beta-prepare-proof-%04d", i), username)
		if !result.Success || !result.Authorized || !result.Final || result.Username != username || len(result.Code) != 76 {
			t.Fatal("administrator did not receive a reviewed private proof")
		}
		proofs[username] = result.Code
		if _, err := repo.GetUser(username); err != mongo.ErrNoDocuments {
			t.Fatal("issuing an invitation created an account")
		}
	}
	staff.Close()

	register := func(username, mail, proof string) string {
		t.Helper()
		conn := credentialSocket(t, address)
		defer conn.Close()
		resourceSend(t, conn, MsgRegister, AuthPayload{Username: username, Email: mail, Password: password, InviteCode: proof})
		message := credentialControlReply(t, conn)
		var reply string
		if message.Type != MsgError || json.Unmarshal(message.Payload, &reply) != nil {
			t.Fatal("registration reply did not use the bounded ordinary control path")
		}
		return reply
	}
	policy, _ := newRegistrationInvitationPolicy("invited", initialKey)
	expired, err := policy.issue(name, email, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatal("synthetic expired-proof fixture failed")
	}
	for _, bad := range []struct{ username, mail, proof string }{
		{name, email, ""}, {name, email, "not-a-valid-proof"},
		{name + "-other", email, proofs[name]}, {name, "different@example.invalid", proofs[name]},
		{name, email, expired}, {name, email, proofs[name][:25] + strings.Repeat("A", 51)},
	} {
		if reply := register(bad.username, bad.mail, bad.proof); reply != "Registration failed: A valid invitation for this exact username and email is required." {
			t.Fatal("invalid proofs did not receive the same generic denial")
		}
		if _, err := repo.GetUser(bad.username); err != mongo.ErrNoDocuments {
			t.Fatal("denied proof created an account")
		}
	}
	if reply := register(name, email, proofs[name]); reply != "Registration successful! Please login." {
		t.Fatal("valid reviewed invitation did not admit signup")
	}
	if authenticated, err := repo.Authenticate(name, password); err != nil || !authenticated {
		t.Fatal("invited signup did not persist real credentials")
	}
	created, err := repo.GetUser(name)
	if err != nil || created.Email != email || len(created.Characters) != 0 || len(created.Roles) != 0 || len(created.VIPPeriods) != 0 {
		t.Fatal("invited signup changed identity or granted unintended gameplay privilege")
	}
	if reply := register(name, email, proofs[name]); strings.Contains(reply, "Registration successful") {
		t.Fatal("replaying a bound invitation created another account")
	}

	// Two ordinary transports submit the same bound proof concurrently. Existing
	// credential admission and unique account indexes decide exactly one create;
	// the loser may receive a duplicate or retry denial, never a second success.
	left, right := credentialSocket(t, address), credentialSocket(t, address)
	start, submitted := make(chan struct{}), make(chan error, 2)
	for _, conn := range []*websocket.Conn{left, right} {
		go func(conn *websocket.Conn) {
			<-start
			submitted <- conn.WriteJSON(map[string]any{"type": MsgRegister, "payload": AuthPayload{
				Username: raceName, Email: email, Password: password, InviteCode: proofs[raceName],
			}})
		}(conn)
	}
	close(start)
	for i := 0; i < 2; i++ {
		if err := <-submitted; err != nil {
			t.Fatal("concurrent fixture transport failed")
		}
	}
	successes := 0
	for _, conn := range []*websocket.Conn{left, right} {
		message := credentialControlReply(t, conn)
		var reply string
		if message.Type != MsgError || json.Unmarshal(message.Payload, &reply) != nil {
			t.Fatal("concurrent signup omitted a bounded outcome")
		}
		if reply == "Registration successful! Please login." {
			successes++
		}
		conn.Close()
	}
	if successes != 1 {
		t.Fatal("concurrent invitation signup did not create exactly one account")
	}
	// Inspect only synthetic owned records; never print credentials or tokens.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	raw, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal("isolated record inspection unavailable")
	}
	defer raw.Disconnect(context.Background())
	for _, username := range []string{name, raceName} {
		count, err := raw.Database("eidolon").Collection("users").CountDocuments(ctx, bson.M{"username": username})
		if err != nil || count != 1 {
			t.Fatal("unique identity admission did not persist exactly one account")
		}
		var record bson.M
		if err := raw.Database("eidolon").Collection("users").FindOne(ctx, bson.M{"username": username}).Decode(&record); err != nil {
			t.Fatal("created synthetic account unavailable")
		}
		encoded, _ := json.Marshal(record)
		if strings.Contains(string(encoded), proofs[username]) || strings.Contains(string(encoded), "inviteCode") || strings.Contains(string(encoded), initialKey) {
			t.Fatal("account record persisted a private invitation or signing key")
		}
	}
	stop()

	// Key rotation revokes pending proofs only, not existing credentials, saved
	// characters or admitted accounts. Audit history must survive the restart.
	t.Setenv("EIDOLON_INVITATION_SIGNING_KEY", rotatedKey)
	address, stopRotated := compatStartServer(t, binary, uri, 902, "-save-journal-dir", journal)
	defer stopRotated()
	if reply := register(pendingName, email, proofs[pendingName]); reply != "Registration failed: A valid invitation for this exact username and email is required." {
		t.Fatal("rotated key admitted an outstanding former proof")
	}
	for _, username := range []string{name, raceName} {
		conn := credentialSocket(t, address)
		resourceSend(t, conn, MsgLogin, AuthPayload{Username: username, Password: password})
		credentialExpectLogin(t, conn)
		conn.Close()
	}
	member, _ = resourceLoginCharacter(t, address, fixture.Name, password, fixture.Class)
	assertBetaRetainedProgress(t, baseline, resourceCloseAndWait(t, repo, member, fixture.Name))
	history, err := repo.ReadAdminActivity(database.AdminActivityQuery{Actor: operator, Action: MsgAdminBetaInvitation})
	if err != nil || len(history.Entries) != 3 {
		t.Fatal("private issuance audit did not survive process restart")
	}
	encoded, _ := json.Marshal(history)
	if strings.Contains(string(encoded), email) || strings.Contains(string(encoded), initialKey) {
		t.Fatal("invitation audit persisted private email or signing key")
	}
	for _, proof := range proofs {
		if strings.Contains(string(encoded), proof) {
			t.Fatal("invitation audit persisted a private proof")
		}
	}
	stopRotated()

	// Roll back to the unchanged default-open startup configuration. No schema,
	// invitation table or account rewrite is needed; existing saves remain valid.
	t.Setenv("EIDOLON_REGISTRATION_MODE", "")
	t.Setenv("EIDOLON_INVITATION_SIGNING_KEY", "")
	address, stopOpen := compatStartServer(t, binary, uri, 903, "-save-journal-dir", journal)
	defer stopOpen()
	if reply := register(pendingName, email, ""); reply != "Registration successful! Please login." {
		t.Fatal("default-open rollback did not restore ordinary signup")
	}
	member, _ = resourceLoginCharacter(t, address, fixture.Name, password, fixture.Class)
	assertBetaRetainedProgress(t, baseline, resourceCloseAndWait(t, repo, member, fixture.Name))
	staff = credentialSocket(t, address)
	resourceSend(t, staff, MsgLogin, AuthPayload{Username: operator, Password: password})
	credentialExpectLogin(t, staff)
	if result := request(staff, "beta-disabled-after-rollback", name+"-disabled"); result.Success || result.Code != "" {
		t.Fatal("blank-key rollback left invitation issuance enabled")
	}
	staff.Close()
}

func assertBetaRetainedProgress(t *testing.T, before, after *database.Character) {
	t.Helper()
	if before.Name != after.Name || before.Class != after.Class || before.Level != after.Level || before.Gold != after.Gold || before.XP != after.XP ||
		!reflect.DeepEqual(before.Equipment, after.Equipment) || !reflect.DeepEqual(before.Inventory, after.Inventory) ||
		!reflect.DeepEqual(before.Quests, after.Quests) || !reflect.DeepEqual(before.Stats, after.Stats) {
		t.Fatal("invitation rollout/restart/rollback altered existing earned progression or gear")
	}
}
