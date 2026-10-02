package database

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

// Fixed public vectors from the previously pinned x/crypto v0.14.0 bcrypt
// tests, not freshly generated hashes or production account credentials.
func TestLegacyBcryptHashesRemainCompatible(t *testing.T) {
	for _, tc := range []struct{ password, hash string }{
		{"allmine", "$2a$10$XajjQvNhvvRt5GSeFk1xFeyqRrsxkhBkUiQeg0dt.wU1qD4aFDcga"},
		{"012345678901234567890123456789012345678901234567890123456", "$2a$10$XajjQvNhvvRt5GSeFk1xFe5l47dONXg781AmZtd869sO8zfsHuw7C"},
	} {
		if err := bcrypt.CompareHashAndPassword([]byte(tc.hash), []byte(tc.password)); err != nil {
			t.Fatal("saved legacy bcrypt vector stopped authenticating", err)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(tc.hash), []byte(tc.password+"wrong")); err == nil {
			t.Fatal("legacy bcrypt accepted a wrong password")
		}
		if cost, err := bcrypt.Cost([]byte(tc.hash)); err != nil || cost != 10 {
			t.Fatal("saved legacy bcrypt cost not retained")
		}
	}
}
