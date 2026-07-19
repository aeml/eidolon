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
