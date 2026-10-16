package registrationinvites

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T) ([]byte, time.Time, *Policy, string, Claims) {
	t.Helper()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	now := time.Unix(1900000000, 0)
	p, err := NewPolicy(key, "private-qa", []string{"Alice", "Mira 雨", " beta, guest "}, nil)
	if err != nil {
		t.Fatal(err)
	}
	token, c, err := Issue(key, "private-qa", "Alice", now, now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	return key, now, p, token, c
}
func TestInvitationAuthority(t *testing.T) {
	key, now, p, token, c := fixture(t)
	tests := []struct {
		name, user, token string
		at                time.Time
		allowed           bool
	}{
		{"intended account", "Alice", token, now, true}, {"clipboard whitespace", "Alice", " " + token + "\n", now, true},
		{"other account", "Bob", token, now, false}, {"case variant", "alice", token, now, false}, {"missing", "Alice", "", now, false},
		{"expired boundary", "Alice", token, time.Unix(c.Expires, 0), false}, {"expired", "Alice", token, now.Add(2 * time.Hour), false},
		{"bad format", "Alice", "not-an-invitation", now, false}, {"oversized", "Alice", strings.Repeat("x", MaxTokenBytes+1), now, false},
		{"tampered signature", "Alice", corruptSignature(token), now, false}, {"extra part", "Alice", token + ".other", now, false},
	}
	for _, x := range tests {
		t.Run(x.name, func(t *testing.T) {
			if (p.Check(x.user, x.token, x.at) == nil) != x.allowed {
				t.Fatal("incorrect invitation decision")
			}
		})
	}
	other, _, err := Issue(key, "other-cohort", "Alice", now, now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if p.Check("Alice", other, now) == nil {
		t.Fatal("foreign cohort accepted")
	}
	otherKey := append([]byte(nil), key...)
	otherKey[0] ^= 1
	other, _, err = Issue(otherKey, "private-qa", "Alice", now, now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if p.Check("Alice", other, now) == nil {
		t.Fatal("foreign key accepted")
	}
	revoked, err := NewPolicy(key, "private-qa", []string{"Alice"}, []string{c.ID})
	if err != nil {
		t.Fatal(err)
	}
	if revoked.Check("Alice", token, now) == nil {
		t.Fatal("revoked invitation accepted")
	}
	absent, err := NewPolicy(key, "private-qa", []string{"Bob"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if absent.Check("Alice", token, now) == nil {
		t.Fatal("non-roster account accepted")
	}
	for _, name := range []string{"Mira 雨", " beta, guest "} {
		s, _, err := Issue(key, "private-qa", name, now, now.Add(time.Hour))
		if err != nil || p.Check(name, s, now) != nil {
			t.Fatal("exact supported account name changed")
		}
	}
	if fmt.Sprint(p) != "registration(invitation)" || strings.Contains(fmt.Sprintf("%+v", p), base64.RawURLEncoding.EncodeToString(key)) {
		t.Fatal("policy formatting leaks private settings")
	}
	// The policy owns copies, so later caller edits cannot replace its key.
	key[0] ^= 0xff
	if p.Check("Alice", token, now) != nil {
		t.Fatal("caller mutation changed admission")
	}
}
func TestInvitationConfigurationFailsClosed(t *testing.T) {
	key, _, _, _, _ := fixture(t)
	encoded, _ := EncodeKey(key)
	good := map[string]string{"EIDOLON_REGISTRATION_MODE": "invitation", "EIDOLON_INVITATION_KEY": encoded, "EIDOLON_INVITATION_COHORT": "private-qa", "EIDOLON_INVITATION_ROSTER_BASE64": base64.RawURLEncoding.EncodeToString([]byte("[\"Alice\"]"))}
	tests := []struct {
		name, key, value string
		guard            bool
	}{
		{"missing guard", "", "", false}, {"invalid mode", "EIDOLON_REGISTRATION_MODE", "invite", true},
		{"missing key", "EIDOLON_INVITATION_KEY", "", true}, {"short key", "EIDOLON_INVITATION_KEY", "abc", true},
		{"weak repeated key", "EIDOLON_INVITATION_KEY", base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32)), true},
		{"missing roster", "EIDOLON_INVITATION_ROSTER_BASE64", "[]", true}, {"duplicate namespace", "EIDOLON_INVITATION_ROSTER_BASE64", "[\"Alice\",\"alice\"]", true},
		{"malformed roster", "EIDOLON_INVITATION_ROSTER_BASE64", "{}", true}, {"control name", "EIDOLON_INVITATION_ROSTER_BASE64", "[\"bad\\nname\"]", true},
		{"invalid cohort", "EIDOLON_INVITATION_COHORT", "beta/a", true}, {"invalid revoked ID", "EIDOLON_INVITATION_REVOKED_BASE64", "[\"x\"]", true},
		{"implicit open with settings", "EIDOLON_REGISTRATION_MODE", "", false},
	}
	for _, x := range tests {
		t.Run(x.name, func(t *testing.T) {
			env := map[string]string{}
			for k, v := range good {
				env[k] = v
			}
			if x.key != "" {
				env[x.key] = x.value
				if strings.HasSuffix(x.key, "_BASE64") {
					env[x.key] = base64.RawURLEncoding.EncodeToString([]byte(x.value))
				}
			}
			if _, err := FromEnv(func(k string) string { return env[k] }, x.guard); err == nil {
				t.Fatal("unsafe configuration accepted")
			}
		})
	}
	p, err := FromEnv(func(k string) string { return good[k] }, true)
	if err != nil || p.Mode() != ModeInvitation {
		t.Fatal("valid guarded invitation configuration rejected")
	}
	p, err = FromEnv(func(string) string { return "" }, false)
	if err != nil || p.Check("legacy", "", time.Now()) != nil || p.Mode() != ModeOpen {
		t.Fatal("default public registration changed")
	}
	if _, err := FromEnv(func(string) string { return "" }, true); err == nil {
		t.Fatal("guard silently became public")
	}
	for _, invalid := range []string{"%%%", "W10=", strings.Repeat("A", base64.RawURLEncoding.EncodedLen(MaxRosterJSONBytes)+1)} {
		good["EIDOLON_INVITATION_ROSTER_BASE64"] = invalid
		if _, err := FromEnv(func(k string) string { return good[k] }, true); err == nil {
			t.Fatal("malformed roster encoding accepted")
		}
	}
}
func TestInvitationRosterBoundsAndEntropy(t *testing.T) {
	key, now, _, _, _ := fixture(t)
	roster := make([]string, 100)
	for i := range roster {
		roster[i] = fmt.Sprintf("Guest%d", i)
	}
	if _, err := NewPolicy(key, "qa", roster, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := NewPolicy(key, "qa", append(roster, "Overflow"), nil); err == nil {
		t.Fatal("over100 cohort accepted")
	}
	if _, _, err := Issue(key, "qa", "Alice", now, now); err == nil {
		t.Fatal("past expiration accepted")
	}
	a, ca, err := Issue(key, "qa", "Alice", now, now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	b, cb, err := Issue(key, "qa", "Alice", now, now.Add(time.Hour))
	if err != nil || a == b || ca.ID == cb.ID || !ValidID(ca.ID) {
		t.Fatal("invitation IDs lack independent entropy")
	}
}

func TestLongestSupportedNamesRemainInvitable(t *testing.T) {
	key, now, _, _, _ := fixture(t)
	for _, name := range []string{strings.Repeat("\"", 128), strings.Repeat("\\", 128), strings.Repeat("&", 128), strings.Repeat("<", 128), strings.Repeat("雨", 42)} {
		p, e := NewPolicy(key, "qa", []string{name}, nil)
		if e != nil {
			t.Fatal(e)
		}
		token, _, e := Issue(key, "qa", name, now, now.Add(time.Hour))
		if e != nil || p.Check(name, token, now) != nil {
			t.Fatal("supported account name became impossible to invite")
		}
	}
}

func corruptSignature(token string) string {
	parts := strings.Split(token, ".")
	first := "A"
	if parts[2][0] == 'A' {
		first = "B"
	}
	parts[2] = first + parts[2][1:]
	return strings.Join(parts, ".")
}
