package main

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestRegistrationInvitationDeniesBeforeCredentialOrStorageWork(t *testing.T) {
	oldPolicy, oldGate, oldDB := registrationInvitations, credentialAdmission, db
	policy, err := newRegistrationInvitationPolicy("invited", strings.Repeat("7a", 32))
	if err != nil {
		t.Fatal(err)
	}
	registrationInvitations = policy
	credentialAdmission = newCredentialWorkGate(1)
	db = nil // Uninvited requests must never reach account storage.
	t.Cleanup(func() {
		registrationInvitations, credentialAdmission, db = oldPolicy, oldGate, oldDB
	})
	for _, code := range []string{"", strings.Repeat("x", 76), strings.Repeat("x", 1000)} {
		client := &Client{send: make(chan []byte, 4)}
		payload, _ := json.Marshal(AuthPayload{Username: "New Player", Email: "player@example.invalid",
			Password: "Unique disposable signup phrase", InviteCode: code})
		client.dispatchMessage(Message{Type: MsgRegister, Payload: payload})
		messages := drainSentMessages(client.send)
		var feedback string
		if len(messages) != 1 || messages[0].Type != MsgError ||
			json.Unmarshal(messages[0].Payload, &feedback) != nil ||
			!strings.Contains(feedback, "valid invitation") ||
			(code != "" && strings.Contains(feedback, code)) {
			t.Fatal("missing bounded invitation rejection")
		}
		if len(credentialAdmission.accounts) != 0 || len(credentialAdmission.slots) != 0 || client.username != "" {
			t.Fatal("uninvited signup spent credential work or acquired identity")
		}
	}
}

func invitationPolicyFixture(t *testing.T) (registrationInvitationPolicy, time.Time, string) {
	t.Helper()
	policy, err := newRegistrationInvitationPolicy("invited", strings.Repeat("7a", 32))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 8, 17, 0, 0, 0, time.UTC)
	code, err := policy.issue("Invited Player", "player@example.invalid", now, now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	return policy, now, code
}

func TestRegistrationInvitationConfigurationPreservesOpenAndFailsClosed(t *testing.T) {
	for _, mode := range []string{"", "open"} {
		policy, err := newRegistrationInvitationPolicy(mode, "")
		if err != nil || policy.authorize("legacy", "", "ignored-extra-field", time.Now()) != nil {
			t.Fatal("ordinary public signup changed")
		}
		if _, err := policy.issue("player", "", time.Now(), time.Now().Add(time.Hour)); err == nil {
			t.Fatal("disabled signing key issued an invitation")
		}
	}
	for _, scenario := range [][2]string{
		{"INVITED", ""}, {"unknown", ""}, {"invited", ""}, {"open", "secret"},
		{"invited", strings.Repeat("7a", 31)}, {"invited", strings.Repeat("7a", 33)},
		{"invited", strings.Repeat("zz", 32)},
		{"invited", strings.Repeat("00", 32)},
	} {
		_, err := newRegistrationInvitationPolicy(scenario[0], scenario[1])
		if err == nil || strings.Contains(err.Error(), scenario[1]) && len(scenario[1]) > 0 {
			t.Fatal("invalid configuration accepted or key echoed")
		}
	}
}

func TestRegistrationInvitationBindsExactIdentityAndExpiry(t *testing.T) {
	policy, now, code := invitationPolicyFixture(t)
	if policy.authorize("Invited Player", "player@example.invalid", code, now) != nil {
		t.Fatal("issued invitation rejected")
	}
	for _, identity := range [][2]string{
		{"invited player", "player@example.invalid"}, {"Invited Player ", "player@example.invalid"},
		{"Other Player", "player@example.invalid"}, {"Invited Player", "other@example.invalid"},
		{"Invited Player", ""}, {"", "player@example.invalid"},
	} {
		if policy.authorize(identity[0], identity[1], code, now) == nil {
			t.Fatal("invitation reused for different identity")
		}
	}
	if policy.authorize("Invited Player", "player@example.invalid", code, now.Add(time.Hour)) == nil {
		t.Fatal("invitation valid at expiry")
	}
	rotated, _ := newRegistrationInvitationPolicy("invited", strings.Repeat("8b", 32))
	if rotated.authorize("Invited Player", "player@example.invalid", code, now) == nil {
		t.Fatal("rotated signing key retained pending invitation")
	}
}

func TestRegistrationInvitationRejectsMalformedForgedAndOversizedProofs(t *testing.T) {
	policy, now, code := invitationPolicyFixture(t)
	raw, _ := base64.RawURLEncoding.DecodeString(code)
	for _, index := range []int{0, 1, 8, 9, 24, 25, 56} {
		changed := append([]byte(nil), raw...)
		changed[index] ^= 1
		if policy.authorize("Invited Player", "player@example.invalid", base64.RawURLEncoding.EncodeToString(changed), now) == nil {
			t.Fatal("modified invitation accepted")
		}
	}
	for _, invalid := range []string{"", code + "=", code + " ", strings.Repeat("x", 8000), strings.Repeat("!", 76)} {
		err := policy.authorize("Invited Player", "player@example.invalid", invalid, now)
		if err == nil || strings.Contains(err.Error(), invalid) && invalid != "" {
			t.Fatal("invalid proof accepted or echoed")
		}
	}
	if (registrationInvitationPolicy{}).authorize("player", "", code, now) == nil {
		t.Fatal("unconfigured zero-value policy opened signup")
	}
}

func TestRegistrationInvitationIssuanceIsBoundedPrivateAndDistinct(t *testing.T) {
	policy, now, _ := invitationPolicyFixture(t)
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		code, err := policy.issue("主人", "", now, now.Add(registrationInviteMaxLifetime))
		if err != nil || len(code) != 76 || seen[code] {
			t.Fatal("invalid or duplicate nonce")
		}
		seen[code] = true
		raw, _ := base64.RawURLEncoding.DecodeString(code)
		if strings.Contains(string(raw), "主人") || policy.authorize("主人", "", code, now) != nil {
			t.Fatal("opaque Unicode invitation failed")
		}
	}
	for _, scenario := range []struct {
		username, email string
		expires         time.Time
	}{
		{"", "", now.Add(time.Hour)}, {strings.Repeat("a", 129), "", now.Add(time.Hour)},
		{"name\nforged", "", now.Add(time.Hour)}, {"player", "email\nforged", now.Add(time.Hour)},
		{"player", strings.Repeat("x", 321), now.Add(time.Hour)},
		{"player", "", now}, {"player", "", now.Add(registrationInviteMaxLifetime + time.Second)},
	} {
		if _, err := policy.issue(scenario.username, scenario.email, now, scenario.expires); err == nil {
			t.Fatal("unbounded invitation issued")
		}
	}
}
