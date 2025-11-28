package database

import (
	"os"
	"testing"
	"time"
)

func TestDBIntegration(t *testing.T) {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		t.Skip("Skipping DB integration test: MONGO_URI not set")
	}

	db, err := New(mongoURI)
	if err != nil {
		t.Fatalf("Failed to connect to DB: %v", err)
	}

	// Use a unique username for testing
	username := "testuser_" + time.Now().Format("20060102150405")
	email := username + "@example.com"
	password := "secret123"

	// Test CreateUser
	err = db.CreateUser(username, email, password)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Test Duplicate User
	err = db.CreateUser(username, email, password)
	if err == nil {
		t.Error("Expected error for duplicate user, got nil")
	}

	// Test Authenticate Success
	ok, err := db.Authenticate(username, password)
	if err != nil {
		t.Errorf("Authenticate failed: %v", err)
	}
	if !ok {
		t.Error("Authenticate returned false for valid credentials")
	}

	// Test Authenticate Failure (Wrong Password)
	ok, err = db.Authenticate(username, "wrongpassword")
	if err != nil {
		t.Errorf("Authenticate failed: %v", err)
	}
	if ok {
		t.Error("Authenticate returned true for invalid password")
	}

	// Test Authenticate Failure (Non-existent User)
	ok, err = db.Authenticate("nonexistentuser", password)
	if err != nil {
		t.Errorf("Authenticate failed: %v", err)
	}
	if ok {
		t.Error("Authenticate returned true for non-existent user")
	}
}
