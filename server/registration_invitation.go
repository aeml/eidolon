package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Prepared closed-beta signup only. Never apply this policy to login, resume,
// character ownership or saved progression. No production mode is enabled here.
const (
	registrationOpenMode          = "open"
	registrationInvitedMode       = "invited"
	registrationInviteMaxLifetime = 7 * 24 * time.Hour
	registrationInviteTokenBytes  = 57 // version, UTC expiry, random nonce, HMAC
)

type registrationInvitationPolicy struct {
	mode          string
	key           [32]byte
	keyConfigured bool
}

// Main replaces this immutable startup policy after validating configuration.
// Existing tests/tools that do not execute main preserve ordinary public signup.
var registrationInvitations = registrationInvitationPolicy{mode: registrationOpenMode}

// Empty mode preserves public signup. A restricted mode without a full random
// key must fail configuration, never silently open registrations.
func newRegistrationInvitationPolicy(mode, encodedKey string) (registrationInvitationPolicy, error) {
	policy := registrationInvitationPolicy{mode: mode}
	if policy.mode == "" {
		policy.mode = registrationOpenMode
	}
	if policy.mode != registrationOpenMode && policy.mode != registrationInvitedMode {
		return policy, errors.New("registration mode must be open or invited")
	}
	if encodedKey != "" {
		decoded, err := hex.DecodeString(encodedKey)
		if err != nil || len(decoded) != len(policy.key) {
			return policy, errors.New("invitation signing key must contain 64 hexadecimal characters")
		}
		if hmac.Equal(decoded, make([]byte, len(policy.key))) {
			return policy, errors.New("invitation signing key must not be all zero")
		}
		copy(policy.key[:], decoded)
		policy.keyConfigured = true
	}
	if policy.mode == registrationInvitedMode && !policy.keyConfigured {
		return policy, errors.New("invited registration requires an invitation signing key")
	}
	return policy, nil
}

func validInvitationIdentity(username, email string) bool {
	return utf8.ValidString(username) && len(username) <= registrationUsernameMaxBytes &&
		strings.TrimSpace(username) != "" && strings.IndexFunc(username, unicode.IsControl) < 0 &&
		utf8.ValidString(email) && len(email) <= 320 && strings.IndexFunc(email, unicode.IsControl) < 0
}

func (policy registrationInvitationPolicy) invitationSignature(prefix []byte, username, email string) []byte {
	mac := hmac.New(sha256.New, policy.key[:])
	// Domain separation and JSON array binding avoid concatenation ambiguity.
	mac.Write([]byte("eidolon-registration-invitation-v1\x00"))
	mac.Write(prefix)
	identity, _ := json.Marshal([]string{username, email})
	mac.Write(identity)
	return mac.Sum(nil)
}

// The eventual authenticated, audited admin route must call this only after
// checking current authority. This pure helper neither grants access nor writes
// accounts/audit records. Tokens do not contain readable username/email.
func (policy registrationInvitationPolicy) issue(username, email string, now, expires time.Time) (string, error) {
	if !policy.keyConfigured {
		return "", errors.New("invitations are not configured")
	}
	if !validInvitationIdentity(username, email) || now.Unix() < 0 ||
		expires.Unix() <= now.Unix() || expires.Sub(now) > registrationInviteMaxLifetime {
		return "", errors.New("invitation requires a valid identity and a future expiry within seven days")
	}
	token := make([]byte, registrationInviteTokenBytes)
	token[0] = 1
	binary.BigEndian.PutUint64(token[1:9], uint64(expires.Unix()))
	if _, err := rand.Read(token[9:25]); err != nil {
		return "", errors.New("invitation generation unavailable")
	}
	copy(token[25:], policy.invitationSignature(token[:25], username, email))
	return base64.RawURLEncoding.EncodeToString(token), nil
}

// Verification is bounded and contains no credential, database, mail or role
// work. All invalid proofs get the same public feedback, without echoing proof.
// Existing unique account-name creation must still enforce admission/replay.
func (policy registrationInvitationPolicy) authorize(username, email, code string, now time.Time) error {
	if policy.mode == registrationOpenMode {
		return nil
	}
	denied := errors.New("A valid invitation for this exact username and email is required.")
	if policy.mode != registrationInvitedMode || !policy.keyConfigured ||
		!validInvitationIdentity(username, email) || len(code) != 76 || now.Unix() < 0 {
		return denied
	}
	token, err := base64.RawURLEncoding.Strict().DecodeString(code)
	if err != nil || len(token) != registrationInviteTokenBytes || token[0] != 1 {
		return denied
	}
	expires := binary.BigEndian.Uint64(token[1:9])
	if expires <= uint64(now.Unix()) || expires > uint64(now.Add(registrationInviteMaxLifetime).Unix()) ||
		!hmac.Equal(token[25:], policy.invitationSignature(token[:25], username, email)) {
		return denied
	}
	return nil
}
