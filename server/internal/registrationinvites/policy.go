// Package registrationinvites restricts new-account admission only. An invite
// authorizes one exact immutable account name; the existing unique account
// namespace prevents replay from creating another account. It grants no login,
// role, character, currency or QA permission. Retained accounts remain intact.
package registrationinvites

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	UsernameMaxBytes   = 128
	MaxInvitees        = 100
	MaxTokenBytes      = 1024
	MaxRosterJSONBytes = 131072
	ModeOpen           = "open"
	ModeInvitation     = "invitation"
)

var ErrRequired = errors.New("A valid invitation is required to create a new account. Existing accounts can sign in normally.")

type Claims struct {
	Username string `json:"username"`
	Cohort   string `json:"cohort"`
	Expires  int64  `json:"expires"`
	ID       string `json:"id"`
}

type Policy struct {
	mode    string
	key     []byte
	cohort  string
	roster  map[string]struct{}
	revoked map[string]struct{}
}

func OpenPolicy() *Policy { return &Policy{mode: ModeOpen} }
func (p *Policy) Mode() string {
	if p == nil {
		return "unavailable"
	}
	return p.mode
}

// Do not expose key bytes or the private roster through diagnostic formatting.
func (p Policy) String() string   { return "registration(" + p.mode + ")" }
func (p Policy) GoString() string { return p.String() }

func ValidUsername(name string) bool {
	return utf8.ValidString(name) && len(name) <= UsernameMaxBytes && strings.TrimSpace(name) != "" && strings.IndexFunc(name, unicode.IsControl) < 0
}
func validCohort(s string) bool {
	if len(s) == 0 || len(s) > 64 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.') {
			return false
		}
	}
	return true
}
func canonicalDecode(s string) ([]byte, error) {
	b, e := base64.RawURLEncoding.Strict().DecodeString(s)
	if e != nil || base64.RawURLEncoding.EncodeToString(b) != s {
		return nil, errors.New("invalid encoding")
	}
	return b, nil
}
func validKey(key []byte) bool {
	if len(key) != 32 {
		return false
	}
	for _, b := range key[1:] {
		if b != key[0] {
			return true
		}
	}
	return false
}
func ValidID(id string) bool { b, e := canonicalDecode(id); return e == nil && len(b) == 16 }

func NewPolicy(key []byte, cohort string, roster, revoked []string) (*Policy, error) {
	if !validKey(key) {
		return nil, errors.New("Invitation signing key must contain 32 random bytes.")
	}
	if !validCohort(cohort) {
		return nil, errors.New("Invitation cohort needs 1-64 ASCII letters, digits, dots, underscores or hyphens.")
	}
	if len(roster) == 0 || len(roster) > MaxInvitees {
		return nil, errors.New("Invitation roster needs 1-100 account names.")
	}
	p := &Policy{mode: ModeInvitation, key: append([]byte(nil), key...), cohort: cohort, roster: map[string]struct{}{}, revoked: map[string]struct{}{}}
	folded := map[string]bool{}
	for _, name := range roster {
		if !ValidUsername(name) || folded[strings.ToLower(name)] {
			return nil, errors.New("Invitation roster contains an invalid or duplicate account name.")
		}
		folded[strings.ToLower(name)] = true
		p.roster[name] = struct{}{}
	}
	if len(revoked) > 1000 {
		return nil, errors.New("Too many revoked invitation IDs; rotate the cohort/key instead.")
	}
	for _, id := range revoked {
		if !ValidID(id) {
			return nil, errors.New("Invalid revoked invitation ID.")
		}
		p.revoked[id] = struct{}{}
	}
	return p, nil
}

// FromEnv fails before connecting to storage. The separate persistent Compose
// guard is installed only at owner-approved activation; its required flag also
// makes older binaries fail closed instead of silently ignoring a new env mode.
func FromEnv(get func(string) string, requireGuard bool) (*Policy, error) {
	mode := get("EIDOLON_REGISTRATION_MODE")
	keyText, cohort, rosterText, revokedText := get("EIDOLON_INVITATION_KEY"), get("EIDOLON_INVITATION_COHORT"), get("EIDOLON_INVITATION_ROSTER_BASE64"), get("EIDOLON_INVITATION_REVOKED_BASE64")
	if mode == "" {
		if keyText != "" || cohort != "" || rosterText != "" || revokedText != "" {
			return nil, errors.New("Set registration mode explicitly when supplying invitation settings.")
		}
		mode = ModeOpen
	}
	if mode != ModeOpen && mode != ModeInvitation {
		return nil, errors.New("Registration mode must be open or invitation.")
	}
	if (mode == ModeInvitation) != requireGuard {
		return nil, errors.New("Invitation admission requires its persistent deployment guard; open mode requires that guard to be removed explicitly.")
	}
	if mode == ModeOpen {
		return OpenPolicy(), nil
	}
	key, err := canonicalDecode(strings.TrimSpace(keyText))
	if err != nil {
		return nil, errors.New("Invitation signing key must be canonical base64url.")
	}
	// Encode JSON so exact names containing quotes, dollar signs or backticks
	// survive both shell-sourced .env and Compose without being interpreted.
	decodeList := func(text string) ([]string, error) {
		if len(text) > base64.RawURLEncoding.EncodedLen(MaxRosterJSONBytes) {
			return nil, errors.New("invalid list")
		}
		data, err := canonicalDecode(text)
		var list []string
		if err != nil || len(data) > MaxRosterJSONBytes || json.Unmarshal(data, &list) != nil {
			return nil, errors.New("invalid list")
		}
		return list, nil
	}
	roster, err := decodeList(rosterText)
	if err != nil {
		return nil, errors.New("Invitation roster must be canonical base64url of a bounded JSON account-name array.")
	}
	var revoked []string
	if revokedText != "" {
		revoked, err = decodeList(revokedText)
		if err != nil {
			return nil, errors.New("Revoked invitations must be canonical base64url of a bounded JSON ID array.")
		}
	}
	return NewPolicy(key, cohort, roster, revoked)
}

func Issue(key []byte, cohort, username string, now, expires time.Time) (string, Claims, error) {
	if !validKey(key) || !validCohort(cohort) || !ValidUsername(username) || expires.Unix() <= now.Unix() {
		return "", Claims{}, errors.New("Choose a valid signing key, cohort, account name and explicit future expiration.")
	}
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", Claims{}, errors.New("Cannot generate invitation entropy.")
	}
	claims := Claims{Username: username, Cohort: cohort, Expires: expires.Unix(), ID: base64.RawURLEncoding.EncodeToString(nonce)}
	var encoded bytes.Buffer
	encoder := json.NewEncoder(&encoded)
	encoder.SetEscapeHTML(false) // Claims are encoded into a token, never HTML.
	if err := encoder.Encode(claims); err != nil {
		return "", Claims{}, errors.New("Cannot encode invitation.")
	}
	body := "v1." + base64.RawURLEncoding.EncodeToString(bytes.TrimSuffix(encoded.Bytes(), []byte{'\n'}))
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(body))
	token := body + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if len(token) > MaxTokenBytes {
		return "", Claims{}, errors.New("Invitation exceeds the supported size.")
	}
	return token, claims, nil
}

func (p *Policy) Check(username, token string, now time.Time) error {
	if p != nil && p.mode == ModeOpen {
		return nil
	}
	if p == nil || p.mode != ModeInvitation {
		return ErrRequired
	}
	if len(token) > MaxTokenBytes {
		return ErrRequired
	}
	token = strings.TrimSpace(token)
	pieces := strings.Split(token, ".")
	if len(pieces) != 3 || pieces[0] != "v1" {
		return ErrRequired
	}
	signature, err := canonicalDecode(pieces[2])
	if err != nil || len(signature) != sha256.Size {
		return ErrRequired
	}
	mac := hmac.New(sha256.New, p.key)
	mac.Write([]byte(pieces[0] + "." + pieces[1]))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return ErrRequired
	}
	body, err := canonicalDecode(pieces[1])
	if err != nil {
		return ErrRequired
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	var claims Claims
	if decoder.Decode(&claims) != nil || decoder.Decode(&struct{}{}) != io.EOF || claims.Username != username || claims.Cohort != p.cohort || claims.Expires <= now.Unix() || !ValidID(claims.ID) {
		return ErrRequired
	}
	if _, ok := p.roster[username]; !ok {
		return ErrRequired
	}
	if _, ok := p.revoked[claims.ID]; ok {
		return ErrRequired
	}
	return nil
}

// EncodeKey is used by the private operator tool, never by a public endpoint.
func EncodeKey(key []byte) (string, error) {
	if !validKey(key) {
		return "", fmt.Errorf("Invalid invitation key.")
	}
	return base64.RawURLEncoding.EncodeToString(key), nil
}
