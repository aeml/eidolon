package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateDisposableCredentialsProducesUniqueStrongValues(t *testing.T) {
	first, err := generateDisposableCredentials()
	if err != nil {
		t.Fatal(err)
	}
	second, err := generateDisposableCredentials()
	if err != nil {
		t.Fatal(err)
	}
	if first.Username == second.Username || first.Password == second.Password {
		t.Fatal("expected independently generated credentials")
	}
	if len(first.Password) != 48 {
		t.Fatalf("expected a 24-byte hex password, got %d characters", len(first.Password))
	}
}

func TestAdmissionRequiresOwnAuthoritativePlayerAndCountsOnce(t *testing.T) {
	state := map[string]Entity{"other": {Type: "Player"}, "self": {Type: "Enemy"}}
	joined := false
	if observeOwnAdmission(state, "self", &joined) || joined {
		t.Fatal("another player or enemy was counted as own admission")
	}
	delete(state, "self")
	if observeOwnAdmission(state, "self", &joined) || joined {
		t.Fatal("sending a request without a snapshot was counted as admission")
	}
	state["self"] = Entity{Type: "Player"}
	if !observeOwnAdmission(state, "self", &joined) || !joined {
		t.Fatal("actual own player was not counted")
	}
	if observeOwnAdmission(state, "self", &joined) {
		t.Fatal("subsequent snapshots counted the player twice")
	}
}

func TestEmptyCredentialPathDoesNotReadOrWriteDefaultFile(t *testing.T) {
	temporaryDirectory := t.TempDir()
	originalDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(temporaryDirectory); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(originalDirectory) })

	credentials, err := loadCredentials("")
	if err != nil {
		t.Fatal(err)
	}
	if len(credentials) != 0 {
		t.Fatalf("expected no file credentials, got %d", len(credentials))
	}
	if _, err := os.Stat(filepath.Join(temporaryDirectory, "bot_data.json")); !os.IsNotExist(err) {
		t.Fatalf("expected no bot_data.json to be written, stat error: %v", err)
	}
}
