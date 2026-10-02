package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
)

func credentialSocket(t *testing.T, address string) *websocket.Conn {
	t.Helper()
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func credentialControlReply(t *testing.T, conn *websocket.Conn) Message {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal("invalid credential control envelope")
		}
		if message.Type == MsgError || message.Type == "login_success" || message.Type == MsgResumeSession {
			return message
		}
	}
}

func credentialExpectError(t *testing.T, conn *websocket.Conn, text string) {
	t.Helper()
	message := credentialControlReply(t, conn)
	var actual string
	if message.Type != MsgError || json.Unmarshal(message.Payload, &actual) != nil || !strings.Contains(actual, text) {
		t.Fatalf("unexpected credential reply type=%s (wanted %s)", message.Type, text)
	}
}

func credentialExpectLogin(t *testing.T, conn *websocket.Conn) string {
	t.Helper()
	message := credentialControlReply(t, conn)
	var result struct {
		ResumeToken string `json:"resumeToken"`
	}
	if message.Type != "login_success" || json.Unmarshal(message.Payload, &result) != nil || result.ResumeToken == "" {
		t.Fatal("ordinary login did not issue its resume token")
	}
	return result.ResumeToken
}

// The opt-in guard requires an explicitly disposable loopback Mongo and built
// server. These are ordinary sockets, real bcrypt credentials and real session
// ownership, not a fake auth repository or a production account experiment.
func TestCredentialActualFreshConnectionsAndTakeover(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	name := fmt.Sprintf("credential-legacy-%d", time.Now().UnixNano())
	const legacyPassword = "oldpass" // Existing short passwords are not migrated or locked out.
	const newPassword = "prepared-new-account-pass"
	const bootstrapName = "reserved-owner-171"
	if err := repo.CreateUser(name, name+"@example.invalid", legacyPassword); err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 171,
		"-save-journal-dir", t.TempDir(), "-auth-max-concurrent", "1",
		"-admin-bootstrap-usernames", bootstrapName)
	for _, reserved := range []string{bootstrapName, strings.ToUpper(bootstrapName)} {
		conn := credentialSocket(t, address)
		resourceSend(t, conn, MsgRegister, AuthPayload{Username: reserved, Password: newPassword})
		credentialExpectError(t, conn, "account name is reserved")
		conn.Close()
	}
	login := func(conn *websocket.Conn, username, password string) {
		resourceSend(t, conn, MsgLogin, AuthPayload{Username: username, Password: password})
	}
	original := credentialSocket(t, address)
	login(original, name, legacyPassword)
	oldToken := credentialExpectLogin(t, original)
	login(original, name+"-different", "not-checked")
	credentialExpectError(t, original, "Use a new connection to switch accounts.")
	for attempt := 0; attempt < 3; attempt++ {
		conn := credentialSocket(t, address)
		login(conn, name, "wrong-password")
		credentialExpectError(t, conn, "Invalid credentials")
		conn.Close()
	}
	owner := credentialSocket(t, address)
	login(owner, name, legacyPassword) // Fifth account attempt: correct credentials take ownership.
	currentToken := credentialExpectLogin(t, owner)
	if currentToken == oldToken {
		t.Fatal("takeover did not rotate the token")
	}
	probe := credentialSocket(t, address)
	resourceSend(t, probe, MsgResumeSession, map[string]string{"token": oldToken})
	credentialExpectError(t, probe, "Session token invalid or expired")
	resourceSend(t, probe, MsgResumeSession, map[string]string{"token": currentToken})
	credentialExpectError(t, probe, "Session token invalid or expired")
	probe.Close() // A bearer cannot displace the still-live owner or burn its token.
	blocked := credentialSocket(t, address)
	login(blocked, name, legacyPassword)
	credentialExpectError(t, blocked, "Too many attempts for this account")
	blocked.Close()
	resourceSend(t, owner, MsgJoin, JoinPayload{Type: "Fighter"})
	wellRestedReadActor(t, owner, name, func(entity *statepb.Entity) bool { return entity.Health > 0 })
	owner.Close()

	// Another account, from the same loopback address, can register and login.
	// Registration's budget is distinct; duplicate attempts cannot reset it by
	// changing sockets and must not alter the already registered account.
	newName := fmt.Sprintf("credential-new-%d", time.Now().UnixNano())
	for attempt := 0; attempt < 6; attempt++ {
		conn := credentialSocket(t, address)
		resourceSend(t, conn, MsgRegister, AuthPayload{Username: newName, Email: newName + "@example.invalid", Password: newPassword})
		switch {
		case attempt == 0:
			credentialExpectError(t, conn, "Registration successful")
		case attempt < 5:
			credentialExpectError(t, conn, "username already exists")
		default:
			credentialExpectError(t, conn, "Too many attempts for this account")
		}
		conn.Close()
	}
	other := credentialSocket(t, address)
	login(other, newName, newPassword)
	credentialExpectLogin(t, other)
	other.Close()

	// Closure observation can race the next read pump; allow bounded ordinary
	// resume retries without sleeping through a rate window or changing time.
	resumed := credentialSocket(t, address)
	var reply Message
	for attempt := 0; attempt < 8; attempt++ {
		resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": currentToken})
		reply = credentialControlReply(t, resumed)
		if reply.Type == MsgResumeSession {
			break
		}
		var rejection string
		if reply.Type != MsgError || json.Unmarshal(reply.Payload, &rejection) != nil || !strings.Contains(rejection, "Session token invalid or expired") {
			t.Fatal("unexpected ordinary resume rejection")
		}
		time.Sleep(25 * time.Millisecond)
	}
	var resumedReply struct {
		ResumeToken string `json:"resumeToken"`
	}
	if reply.Type != MsgResumeSession || json.Unmarshal(reply.Payload, &resumedReply) != nil || resumedReply.ResumeToken == "" || resumedReply.ResumeToken == currentToken {
		t.Fatal("live-token probe burned the legitimate disconnect resume")
	}
	wellRestedReadActor(t, resumed, name, func(entity *statepb.Entity) bool { return entity.Health > 0 })
	stale := credentialSocket(t, address)
	resourceSend(t, stale, MsgResumeSession, map[string]string{"token": currentToken})
	credentialExpectError(t, stale, "Session token invalid or expired")
	stale.Close()
	resumed.Close()
	stop()
	t.Log("ordinary legacy login, fresh-socket budgets, takeover/token privacy, new registration and one-use resume passed")
}
