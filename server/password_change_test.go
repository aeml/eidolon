package main

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

type passwordChangeFake struct {
	calls               int
	user, current, next string
	changed             bool
	err                 error
}

func (s *passwordChangeFake) ChangePassword(user, current, next string) (bool, error) {
	s.calls++
	s.user, s.current, s.next = user, current, next
	return s.changed, s.err
}

func passwordChangeFixture(t *testing.T) (*Client, Message, *passwordChangeFake, string) {
	t.Helper()
	isolatedResumeTokens(t)
	oldGate, oldSessions := credentialAdmission, activeSessions
	credentialAdmission = newCredentialWorkGate(1)
	client := &Client{username: "password-fixture", prioritySend: make(chan []byte, 16)}
	activeSessions = map[string]*Client{client.username: client}
	t.Cleanup(func() { credentialAdmission, activeSessions = oldGate, oldSessions })
	token, err := issueResumeToken(client.username, client)
	if err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]string{"requestId": "change-fixture", "username": "forged-other-account",
		"currentPassword": "oldpass", "newPassword": "  A unique updated phrase  "})
	return client, Message{Type: MsgChangePassword, Payload: payload}, &passwordChangeFake{changed: true}, token
}

func passwordChangeReply(t *testing.T, c *Client) (bool, string, string) {
	t.Helper()
	message := <-c.prioritySend
	var envelope Message
	if json.Unmarshal(message, &envelope) != nil || envelope.Type != "password_change_result" {
		t.Fatal("wrong password receipt")
	}
	var result struct {
		RequestID   string
		Success     bool
		Message     string
		ResumeToken string
	}
	if json.Unmarshal(envelope.Payload, &result) != nil || result.RequestID != "change-fixture" {
		t.Fatal("lost request identity")
	}
	if strings.Contains(string(message), "oldpass") || strings.Contains(string(message), "unique updated") {
		t.Fatal("receipt exposed a credential")
	}
	return result.Success, result.Message, result.ResumeToken
}

func TestPasswordChangeUsesAuthenticatedOwnerAndRotatesToken(t *testing.T) {
	c, msg, store, oldToken := passwordChangeFixture(t)
	handlePasswordChangeWithStore(c, msg, store)
	ok, _, token := passwordChangeReply(t, c)
	if !ok || store.calls != 1 || store.user != c.username || store.current != "oldpass" || store.next != "  A unique updated phrase  " || len(token) != 64 || token == oldToken {
		t.Fatal("password change lost exact input, ownership or rotation")
	}
	if _, valid := validateAndConsumeResumeTokenAt(oldToken, time.Now()); valid {
		t.Fatal("old resume token survived password change")
	}
	c.markTransportClosed()
	if user, valid := validateAndConsumeResumeTokenAt(token, time.Now()); !valid || user != c.username {
		t.Fatal("fresh resume token was not bound to its current owner")
	}
}

func TestPasswordChangeRejectsBeforeCredentialWork(t *testing.T) {
	for _, scenario := range []string{"guest", "stale", "closed", "weak", "same", "missing-current", "reserved-existing"} {
		t.Run(scenario, func(t *testing.T) {
			c, msg, store, _ := passwordChangeFixture(t)
			var p passwordChangePayload
			_ = json.Unmarshal(msg.Payload, &p)
			switch scenario {
			case "guest":
				c.username = ""
			case "stale":
				activeSessions[c.username] = &Client{username: c.username}
			case "closed":
				c.markTransportClosed()
			case "weak":
				p.NewPassword = "short"
			case "same":
				p.CurrentPassword = p.NewPassword
			case "missing-current":
				p.CurrentPassword = ""
			case "reserved-existing":
				// Existing administrator names are not forbidden from changing a
				// password merely because new registrations reserve the name.
				previous := adminBootstrapUsernames
				adminBootstrapUsernames = map[string]struct{}{c.username: {}}
				defer func() { adminBootstrapUsernames = previous }()
			}
			msg.Payload, _ = json.Marshal(p)
			handlePasswordChangeWithStore(c, msg, store)
			ok, _, _ := passwordChangeReply(t, c)
			if scenario == "reserved-existing" {
				if !ok || store.calls != 1 {
					t.Fatal("reserved existing owner was blocked")
				}
			} else if ok || store.calls != 0 || len(credentialAdmission.accounts) != 0 || len(credentialAdmission.slots) != 0 {
				t.Fatal("invalid request reached credentials or acquired hash capacity")
			}
		})
	}
}

func TestPasswordChangeMismatchAndLostAckKeepHonestOutcome(t *testing.T) {
	for _, lostAck := range []bool{false, true} {
		t.Run(map[bool]string{false: "mismatch", true: "lost-ack"}[lostAck], func(t *testing.T) {
			c, msg, store, oldToken := passwordChangeFixture(t)
			store.changed = false
			if lostAck {
				store.err = errors.New("private database failure")
			}
			handlePasswordChangeWithStore(c, msg, store)
			ok, message, token := passwordChangeReply(t, c)
			if ok || token != "" || strings.Contains(message, "private database") || len(credentialAdmission.slots) != 0 {
				t.Fatal("failed change claimed success or leaked work/errors")
			}
			c.markTransportClosed()
			_, valid := validateAndConsumeResumeTokenAt(oldToken, time.Now())
			if valid == lostAck {
				t.Fatal("uncertain commit retained old token, or mismatch unnecessarily revoked it")
			}
		})
	}
}

func TestPasswordChangeReceiptExplicitlyInvalidatesUncertainResume(t *testing.T) {
	for _, uncertain := range []bool{false, true} {
		t.Run(map[bool]string{false: "mismatch", true: "uncertain"}[uncertain], func(t *testing.T) {
			c, msg, store, _ := passwordChangeFixture(t)
			store.changed = false
			if uncertain {
				store.err = errors.New("lost acknowledgement")
			}
			handlePasswordChangeWithStore(c, msg, store)
			var frame struct {
				Payload struct {
					ResumeInvalidated bool `json:"resumeInvalidated"`
				} `json:"payload"`
			}
			if err := json.Unmarshal(<-c.prioritySend, &frame); err != nil {
				t.Fatal(err)
			}
			if frame.Payload.ResumeInvalidated != uncertain {
				t.Fatal("client resume invalidation did not match uncertain outcome")
			}
		})
	}
}

func TestPasswordChangePolicyAndSharedRateAcrossConnections(t *testing.T) {
	c, msg, store, _ := passwordChangeFixture(t)
	if messageHandlers[MsgChangePassword] == nil || inboundMessagePolicies[MsgChangePassword].access != accessAuthenticated {
		t.Fatal("missing protected dispatch policy")
	}
	if (&Client{}).acceptInboundMessage(msg, time.Now()) == nil {
		t.Fatal("guest acquired password change access")
	}
	for i := 0; i < 6; i++ {
		// Each replacement has fresh local policy state but shares this budget.
		c = &Client{username: c.username, prioritySend: make(chan []byte, 1)}
		activeSessions[c.username] = c
		handlePasswordChangeWithStore(c, msg, store)
		ok, _, _ := passwordChangeReply(t, c)
		if ok != (i < 5) {
			t.Fatal("fresh connection bypassed shared password budget")
		}
	}
	if store.calls != 5 {
		t.Fatal("rate-rejected request reached password storage")
	}
	c.sendInboundRejection(msg, "retry later")
	ok, message, _ := passwordChangeReply(t, c)
	if ok || message != "retry later" {
		t.Fatal("admission rejection lost its correlated receipt")
	}
}

func TestPasswordChangeResumeWaitsForAccountBeforeConsumingToken(t *testing.T) {
	owner, _, _, oldToken := passwordChangeFixture(t)
	owner.markTransportClosed()
	replacement := &Client{username: owner.username}
	activeSessions[owner.username] = replacement
	unlock := lockCharacterWork(owner.username)
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(unlock) }
	defer release()
	resuming := &Client{prioritySend: make(chan []byte, 4)}
	payload, _ := json.Marshal(map[string]string{"token": oldToken})
	done := make(chan struct{})
	go func() { defer close(done); resuming.dispatchMessage(Message{Type: MsgResumeSession, Payload: payload}) }()
	// Confirm the actual dispatcher is queued for this account, not just that
	// the goroutine was started. It must not consume the token before that lock.
	deadline := time.Now().Add(time.Second)
	queued := false
	for time.Now().Before(deadline) {
		characterWork.Lock()
		entry := characterWork.entries[owner.username]
		queued = entry != nil && entry.users == 2
		characterWork.Unlock()
		if queued {
			break
		}
		time.Sleep(time.Millisecond)
	}
	resumeTokensMu.Lock()
	retained := resumeTokens[oldToken] != nil
	resumeTokensMu.Unlock()
	// Simulate password-change/session rotation while owning the account lock.
	newToken, err := issueResumeToken(replacement.username, replacement)
	release()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("resume dispatcher did not retire")
	}
	if !queued || !retained || err != nil {
		t.Fatal("resume consumed its credential before account serialization", err)
	}
	messages := drainSentMessages(resuming.prioritySend)
	if len(messages) != 1 || messages[0].Type != MsgError || !strings.Contains(string(messages[0].Payload), "invalid or expired") || resuming.username != "" {
		t.Fatal("queued stale token authenticated after rotation")
	}
	if account, ok := resumeTokenAccount(newToken, ""); !ok || account != replacement.username {
		t.Fatal("rejected old resume consumed the new token")
	}
}
