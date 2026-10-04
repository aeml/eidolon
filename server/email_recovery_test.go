package main

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeEmailRecoveryStore struct {
	calls                              int
	username, address, password, token string
	changed, attempted                 bool
	err                                error
}

func (s *fakeEmailRecoveryStore) BeginRecoveryEmail(user, password, address, token string, _ time.Time) (bool, error) {
	s.calls++
	s.username, s.password, s.address, s.token = user, password, address, token
	return s.changed, s.err
}
func (s *fakeEmailRecoveryStore) ConfirmRecoveryEmail(user, token string, _ time.Time) (bool, error) {
	s.calls++
	s.username, s.token = user, token
	return s.changed, s.err
}
func (s *fakeEmailRecoveryStore) BeginPasswordRecovery(user, token string, _ time.Time) (string, error) {
	s.calls++
	s.username, s.token = user, token
	return s.address, s.err
}
func (s *fakeEmailRecoveryStore) CompletePasswordRecovery(user, token, next string, _ time.Time) (bool, bool, error) {
	s.calls++
	s.username, s.token, s.password = user, token, next
	return s.changed, s.attempted, s.err
}
func (s *fakeEmailRecoveryStore) RecoveryNotificationAddress(string) (string, error) {
	return s.address, nil
}

func emailRecoveryFixture(t *testing.T) (*emailRecoveryService, *fakeEmailRecoveryStore) {
	t.Helper()
	previous, gate := accountRecovery, credentialAdmission
	store := &fakeEmailRecoveryStore{changed: true, attempted: true, address: "owner@example.invalid"}
	service := &emailRecoveryService{store: store, queue: make(chan recoveryMailJob, 32), ctx: context.Background()}
	accountRecovery, credentialAdmission = service, newCredentialWorkGate(4)
	t.Cleanup(func() { accountRecovery, credentialAdmission = previous, gate })
	return service, store
}

func emailRecoveryMessage(kind, user, token string) Message {
	payload, _ := json.Marshal(emailRecoveryPayload{RequestID: "recovery-fixture", Username: user, Token: token, Email: "owner@example.invalid", CurrentPassword: "legacy-pass", NewPassword: "A unique new recovery passphrase"})
	return Message{Type: kind, Payload: payload}
}

func emailRecoveryReply(t *testing.T, c *Client) (bool, string) {
	t.Helper()
	select {
	case encoded := <-c.prioritySend:
		var envelope Message
		var result struct {
			RequestID string
			Success   bool
			Message   string
		}
		if json.Unmarshal(encoded, &envelope) != nil || envelope.Type != "email_recovery_result" || json.Unmarshal(envelope.Payload, &result) != nil || result.RequestID != "recovery-fixture" {
			t.Fatal("missing/mismatched recovery receipt")
		}
		if strings.Contains(string(encoded), "legacy-pass") || strings.Contains(string(encoded), "unique new recovery") || strings.Contains(string(encoded), strings.Repeat("a", 64)) {
			t.Fatal("receipt leaked proof material")
		}
		return result.Success, result.Message
	default:
		t.Fatal("missing recovery receipt")
		return false, ""
	}
}

func TestEmailRecoveryRequestAcknowledgesBeforeLookupAndBoundsQueue(t *testing.T) {
	service, store := emailRecoveryFixture(t)
	var prior string
	for _, user := range []string{"known-owner", "unknown-owner"} {
		c := &Client{prioritySend: make(chan []byte, 4)}
		handleEmailRecovery(c, emailRecoveryMessage(MsgRequestPasswordRecovery, user, ""))
		ok, message := emailRecoveryReply(t, c)
		if !ok || store.calls != 0 {
			t.Fatal("request exposed eligibility via synchronous lookup")
		}
		if prior != "" && prior != message {
			t.Fatal("eligibility changed request response")
		}
		prior = message
	}
	if len(service.queue) != 2 {
		t.Fatal("eligible/unknown admission differs")
	}
	for len(service.queue) < cap(service.queue) {
		service.queue <- recoveryMailJob{kind: "request"}
	}
	c := &Client{prioritySend: make(chan []byte, 4)}
	handleEmailRecovery(c, emailRecoveryMessage(MsgRequestPasswordRecovery, "independent-owner", ""))
	if ok, _ := emailRecoveryReply(t, c); ok || store.calls != 0 {
		t.Fatal("full queue launched unbounded mail/lookup work")
	}
}

func TestEmailRecoverySetupUsesOnlyCurrentAuthenticatedAccount(t *testing.T) {
	c, _, _, _ := passwordChangeFixture(t)
	service, store := emailRecoveryFixture(t)
	handleEmailRecovery(c, emailRecoveryMessage(MsgSetRecoveryEmail, "forged-account", ""))
	if ok, _ := emailRecoveryReply(t, c); !ok || store.calls != 1 || store.username != c.username || store.password != "legacy-pass" || len(store.token) != 64 {
		t.Fatal("mail setup lost authenticated password/owner proof")
	}
	job := <-service.queue
	if job.username != c.username || job.kind != "verify" || job.recipient != "owner@example.invalid" || job.token != store.token {
		t.Fatal("verification mail lost exact proof")
	}
	for _, kind := range []string{MsgRequestPasswordRecovery, MsgConfirmRecoveryEmail, MsgCompletePasswordRecovery} {
		handleEmailRecovery(c, emailRecoveryMessage(kind, "other-account", strings.Repeat("a", 64)))
		if ok, _ := emailRecoveryReply(t, c); ok || store.calls != 1 {
			t.Fatal("authenticated socket changed a public recovery target")
		}
	}
}

func TestEmailRecoveryResetInvalidationRequiresProvedMutation(t *testing.T) {
	for _, scenario := range []string{"invalid-proof", "changed", "uncertain-after-proof", "read-error-before-proof", "cas-lost"} {
		t.Run(scenario, func(t *testing.T) {
			owner, _, _, oldToken := passwordChangeFixture(t)
			sessionActivityFixture(t)
			oldWorld := world
			world = nil
			t.Cleanup(func() { world = oldWorld })
			_, store := emailRecoveryFixture(t)
			switch scenario {
			case "invalid-proof":
				store.changed, store.attempted = false, false
			case "uncertain-after-proof":
				store.changed = false
				store.err = errors.New("private write acknowledgement")
			case "read-error-before-proof":
				store.changed, store.attempted = false, false
				store.err = errors.New("private read outage")
			case "cas-lost":
				store.changed, store.attempted = false, true
			}
			guest := &Client{prioritySend: make(chan []byte, 4)}
			handleEmailRecovery(guest, emailRecoveryMessage(MsgCompletePasswordRecovery, owner.username, strings.Repeat("a", 64)))
			ok, message := emailRecoveryReply(t, guest)
			if ok != (scenario == "changed") || strings.Contains(message, "private") {
				t.Fatal("wrong reset result/private diagnostics")
			}
			expectRevoke := scenario == "changed" || scenario == "uncertain-after-proof"
			if owner.retired.Load() != expectRevoke {
				t.Fatal("unproved reset revoked session or proved reset left it live")
			}
			resumeTokensMu.Lock()
			exists := resumeTokens[oldToken] != nil
			resumeTokensMu.Unlock()
			if exists == expectRevoke {
				t.Fatal("reset token invalidation crossed proof boundary")
			}
			if store.username != owner.username || store.password != "A unique new recovery passphrase" {
				t.Fatal("reset proof bound to wrong account/password")
			}
		})
	}
}

func TestEmailRecoveryProtocolAccessAndSharedAdmission(t *testing.T) {
	for kind, access := range map[string]messageAccess{MsgSetRecoveryEmail: accessAuthenticated, MsgRequestPasswordRecovery: accessPublic, MsgConfirmRecoveryEmail: accessPublic, MsgCompletePasswordRecovery: accessPublic} {
		if p := inboundMessagePolicies[kind]; p.access != access || p.maxPayloadBytes != 1<<10 || messageHandlers[kind] == nil {
			t.Fatal("missing recovery admission boundary", kind)
		}
		gate := newCredentialWorkGate(1)
		for i := 0; i < inboundMessagePolicies[kind].burst; i++ {
			done, err := gate.begin(kind, "owner", time.Unix(100, 0))
			if err != nil {
				t.Fatal(err)
			}
			done()
		}
		if _, err := gate.begin(kind, "owner", time.Unix(100, 0)); err != errCredentialRate {
			t.Fatal("shared recovery rate bypass", kind)
		}
	}
}

func TestEmailRecoveryWorkersJoinShutdownAndDisableUnconfiguredMail(t *testing.T) {
	loops := newServerLoops()
	if newEmailRecoveryService(&fakeEmailRecoveryStore{}, nil, loops) != nil {
		t.Fatal("unconfigured provider exposed recovery")
	}
	service := newEmailRecoveryService(&fakeEmailRecoveryStore{}, &recoveryMailer{}, loops)
	if service == nil || cap(service.queue) != 32 {
		t.Fatal("mail queue is unbounded or missing")
	}
	done := make(chan struct{})
	go func() { loops.Stop(); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("mail workers did not join shutdown")
	}
	if service.enqueue(recoveryMailJob{kind: "request", username: "owner"}) {
		t.Fatal("stopped mail service admitted work")
	}
}
