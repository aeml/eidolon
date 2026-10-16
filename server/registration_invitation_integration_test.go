package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/registrationinvites"
	"github.com/gorilla/websocket"
)

func invitationFixtureSettings(t *testing.T, roster []string, revoked []string) []byte {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal("fixture entropy unavailable")
	}
	invitationFixtureEnv(t, key, roster, revoked)
	return key
}

func TestRegistrationInvitationActualStartupRefusal(t *testing.T) {
	_, _, binary := resourceJournalIntegration(t)
	invitationFixtureSettings(t, []string{"synthetic-private-recipient"}, nil)
	for _, scenario := range []string{"missing-guard", "invalid-key", "open-with-guard"} {
		t.Run(scenario, func(t *testing.T) {
			args := []string{"--mongo-uri=mongodb://127.0.0.1:1"}
			if scenario != "missing-guard" {
				args = append(args, "--require-invitation-admission")
			}
			if scenario == "invalid-key" {
				t.Setenv("EIDOLON_INVITATION_KEY", "synthetic-private-invalid-key")
			}
			if scenario == "open-with-guard" {
				t.Setenv("EIDOLON_REGISTRATION_MODE", "open")
			}
			ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, binary, args...)
			cmd.Env = os.Environ()
			output, err := cmd.CombinedOutput()
			failure, ok := err.(*exec.ExitError)
			if ctx.Err() != nil || !ok || failure.ExitCode() != 2 {
				t.Fatal("unsafe admission configuration did not fail before database startup")
			}
			if len(output) > 500 || strings.Contains(string(output), "synthetic-private") {
				t.Fatal("startup refusal exposed private configuration")
			}
		})
	}
}
func invitationFixtureEnv(t *testing.T, key []byte, roster, revoked []string) {
	t.Helper()
	encoded, err := registrationinvites.EncodeKey(key)
	if err != nil {
		t.Fatal("invalid fixture key")
	}
	names, _ := json.Marshal(roster)
	ids, _ := json.Marshal(revoked)
	t.Setenv("EIDOLON_REGISTRATION_MODE", "invitation")
	t.Setenv("EIDOLON_INVITATION_KEY", encoded)
	t.Setenv("EIDOLON_INVITATION_COHORT", "private-socket-qa")
	t.Setenv("EIDOLON_INVITATION_ROSTER_BASE64", base64.RawURLEncoding.EncodeToString(names))
	t.Setenv("EIDOLON_INVITATION_REVOKED_BASE64", base64.RawURLEncoding.EncodeToString(ids))
}

// Ordinary WebSockets, the real unique account indexes and real password hashes
// in an explicitly disposable database. No production invitations are issued.
func TestRegistrationInvitationActualAdmissionAndReplay(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	existing, existingPassword := resourceJournalFixture(t, repo)
	prefix := fmt.Sprintf("invitation-qa-%d-", time.Now().UnixNano())
	roster := []string{}
	for _, suffix := range []string{"accepted", "missing", "expired", "forged", "wrong", "revoked", "cohort"} {
		roster = append(roster, prefix+suffix)
	}
	key := invitationFixtureSettings(t, roster, nil)
	now := time.Now()
	issue := func(name, cohort string, expiry time.Time) (string, registrationinvites.Claims) {
		t.Helper()
		token, claims, err := registrationinvites.Issue(key, cohort, name, now.Add(-time.Hour), expiry)
		if err != nil {
			t.Fatal("cannot prepare synthetic invitation")
		}
		return token, claims
	}
	revokedToken, revokedClaims := issue(prefix+"revoked", "private-socket-qa", now.Add(time.Hour))
	invitationFixtureEnv(t, key, roster, []string{revokedClaims.ID})
	address, stop := compatStartServer(t, binary, uri, 17960, "--require-invitation-admission", "-save-journal-dir", t.TempDir())
	defer stop()
	login := credentialSocket(t, address)
	resourceSend(t, login, MsgLogin, AuthPayload{Username: existing.Name, Password: existingPassword})
	credentialExpectLogin(t, login)
	login.Close()

	expired, _ := issue(prefix+"expired", "private-socket-qa", now.Add(-time.Minute))
	wrong, _ := issue(prefix+"accepted", "private-socket-qa", now.Add(time.Hour))
	outsider, _ := issue(prefix+"outside", "private-socket-qa", now.Add(time.Hour))
	foreignCohort, _ := issue(prefix+"cohort", "different-cohort", now.Add(time.Hour))
	for _, x := range []struct{ suffix, token string }{
		{"missing", ""}, {"expired", expired}, {"forged", wrong + "x"}, {"wrong", wrong}, {"revoked", revokedToken}, {"outside", outsider}, {"cohort", foreignCohort},
	} {
		conn := credentialSocket(t, address)
		resourceSend(t, conn, MsgRegister, AuthPayload{Username: prefix + x.suffix, Password: "Synthetic rejected account phrase 93!", Email: "qa@example.invalid", Invitation: x.token})
		var status struct {
			Mode string `json:"mode"`
		}
		resourceReadMessage(t, conn, "registration_status", &status)
		if status.Mode != "invitation" {
			t.Fatal("missing admission guidance")
		}
		credentialExpectError(t, conn, "A valid invitation is required")
		conn.Close()
		if user, err := repo.GetUser(prefix + x.suffix); err == nil || user != nil {
			t.Fatal("rejected invitation created an account")
		}
	}
	token, _ := issue(prefix+"accepted", "private-socket-qa", now.Add(time.Hour))
	const password = "Synthetic invited account phrase 93!"
	payload := AuthPayload{Username: prefix + "accepted", Password: password, Email: "qa@example.invalid", Invitation: token}
	one, two := credentialSocket(t, address), credentialSocket(t, address)
	// Both writes precede either read, exercising the unique-index race rather
	// than relying on a client-side consumed marker or a sequential fake store.
	resourceSend(t, one, MsgRegister, payload)
	resourceSend(t, two, MsgRegister, payload)
	successes, duplicates := 0, 0
	for _, conn := range []*websocket.Conn{one, two} {
		response := credentialControlReply(t, conn)
		var message string
		if response.Type != MsgError || json.Unmarshal(response.Payload, &message) != nil {
			t.Fatal("invalid registration receipt")
		}
		switch {
		case strings.Contains(message, "Registration successful"):
			successes++
		case strings.Contains(message, "username already exists"):
			duplicates++
		default:
			t.Fatal("unexpected concurrent registration result")
		}
		conn.Close()
	}
	if successes != 1 || duplicates != 1 {
		t.Fatal("invitation admitted more or fewer than one account")
	}
	replay := credentialSocket(t, address)
	payload.Password = "A replay must never replace the original password"
	resourceSend(t, replay, MsgRegister, payload)
	credentialExpectError(t, replay, "username already exists")
	replay.Close()
	authenticated, err := repo.Authenticate(payload.Username, password)
	if err != nil || !authenticated {
		t.Fatal("replay changed account credentials")
	}
	conn := credentialSocket(t, address)
	resourceSend(t, conn, MsgLogin, AuthPayload{Username: payload.Username, Password: password})
	credentialExpectLogin(t, conn)
	conn.Close()
	stop()
	// Rotation blocks unused links but does not lock out retained accounts.
	invitationFixtureSettings(t, roster, nil)
	address, stopRotated := compatStartServer(t, binary, uri, 17961, "--require-invitation-admission", "-save-journal-dir", t.TempDir())
	defer stopRotated()
	conn = credentialSocket(t, address)
	resourceSend(t, conn, MsgLogin, AuthPayload{Username: payload.Username, Password: password})
	credentialExpectLogin(t, conn)
	conn.Close()
	unused, _ := issue(prefix+"missing", "private-socket-qa", now.Add(time.Hour))
	conn = credentialSocket(t, address)
	resourceSend(t, conn, MsgRegister, AuthPayload{Username: prefix + "missing", Password: password, Email: "qa@example.invalid", Invitation: unused})
	credentialExpectError(t, conn, "A valid invitation is required")
	conn.Close()
	t.Log("private admission, invalid-link storage isolation, concurrent one-account use, replay and existing login after rotation passed")
}
