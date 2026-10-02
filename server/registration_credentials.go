package main

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	registrationUsernameMaxBytes = 128
	registrationPasswordMinChars = 15
	registrationPasswordMaxBytes = 72 // Existing bcrypt encoder rejects longer input.
)

// A small local baseline, not a breach service or a comprehensive compromised
// password corpus. Compare the complete candidate; never ban substrings or
// transform the password that will be hashed. No credential is sent elsewhere.
var registrationBlockedPasswords = map[string]struct{}{
	"passwordpassword":             {},
	"passwordpasswordpassword":     {},
	"password123456789":            {},
	"password1234567890":           {},
	"123456789012345":              {},
	"1234567890123456":             {},
	"12345678901234567890":         {},
	"0123456789012345":             {},
	"abcdefghijklmnop":             {},
	"qwertyqwertyqwerty":           {},
	"qwertyuiopasdfgh":             {},
	"qwertyuiopasdfghjkl":          {},
	"letmeinletmeinletmein":        {},
	"iloveyouiloveyou":             {},
	"aaaaaaaaaaaaaaa":              {},
	"aaaaaaaaaaaaaaaa":             {},
	"111111111111111":              {},
	"1111111111111111":             {},
	"correct horse battery staple": {},
	"eidolonrealms.com":            {},
	"play.eidolonrealms.com":       {},
	"eidolon realms game":          {},
}

// Applied only to the public registration boundary, before query/hash admission.
// Trusted legacy fixture/import creation and existing login remain unchanged.
// Spaces, Unicode, case and the exact chosen hash input are preserved.
func validateRegistrationCredentials(payload AuthPayload) error {
	if !utf8.ValidString(payload.Username) || len(payload.Username) > registrationUsernameMaxBytes ||
		strings.TrimSpace(payload.Username) == "" || strings.IndexFunc(payload.Username, unicode.IsControl) >= 0 {
		return errors.New("Username must contain 1-128 UTF-8 bytes and no control characters.")
	}
	if isReservedBootstrapRegistrationName(payload.Username) {
		return errors.New("This account name is reserved. Choose another name or contact the game operator.")
	}
	return validateNewPassword(payload.Username, payload.Password)
}

// Shared by new registration and an authenticated password change. This does
// not revalidate or reserve an existing account name, nor alter legacy login.
func validateNewPassword(username, password string) error {
	if !utf8.ValidString(password) || utf8.RuneCountInString(password) < registrationPasswordMinChars {
		return errors.New("New passwords need at least 15 characters. Use a unique passphrase or password manager.")
	}
	if len(password) > registrationPasswordMaxBytes {
		return errors.New("Password exceeds 72 UTF-8 bytes. Use a shorter unique passphrase or password-manager password; it will not be truncated.")
	}
	_, blocked := registrationBlockedPasswords[strings.ToLower(password)]
	if blocked || strings.EqualFold(password, username) {
		return errors.New("Choose a unique password, not a common password, the game address or your username. Use a password manager or a unique passphrase.")
	}
	return nil
}
