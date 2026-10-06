package main

import (
	"context"
	"crypto/sha256"
	"eidolon-server/internal/database"
	statepb "eidolon-server/internal/proto"
	"fmt"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Explicitly disposable same-name replacement, never a production erasure API.
func TestSessionIdentityActualSocketsRejectReplacementAccount(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	name := fmt.Sprintf("codex-session-generation-%d", time.Now().UnixNano())
	const password = "synthetic generation proof"
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	oldUser, err := repo.GetUser(name)
	if err != nil {
		t.Fatal(err)
	}
	journalDir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 175, "-save-journal-dir", journalDir)
	defer stop()
	owner := credentialSocket(t, address)
	resourceSend(t, owner, MsgLogin, AuthPayload{Username: name, Password: password})
	token := credentialExpectLogin(t, owner)
	resourceSend(t, owner, MsgJoin, JoinPayload{Type: "Wizard"})
	wellRestedReadActor(t, owner, name, func(entity *statepb.Entity) bool { return entity.Health > 0 })
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Disconnect(context.Background())
	users := client.Database("eidolon").Collection("users")
	if _, err := users.DeleteOne(ctx, bson.M{"_id": oldUser.ID, "username": name}); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	replacement, err := repo.GetUser(name)
	if err != nil || replacement.ID == oldUser.ID {
		t.Fatal("replacement fixture did not change generation", err)
	}
	row, err := users.FindOne(ctx, bson.M{"_id": replacement.ID}).DecodeBytes()
	if err != nil {
		t.Fatal(err)
	}
	before := sha256.Sum256(row)
	newLogin := credentialSocket(t, address)
	resourceSend(t, newLogin, MsgLogin, AuthPayload{Username: name, Password: password})
	credentialExpectError(t, newLogin, "Account identity could not be restored")
	// The original token must not authenticate the replacement, even after its
	// transport closes. Refusal occurs before recovery/session installation.
	owner.Close()
	resume := credentialSocket(t, address)
	resourceSend(t, resume, MsgResumeSession, map[string]string{"token": token})
	credentialExpectError(t, resume, "Session identity changed or is unavailable")
	row, err = users.FindOne(ctx, bson.M{"_id": replacement.ID}).DecodeBytes()
	if err != nil || sha256.Sum256(row) != before {
		t.Fatal("refused old generation changed replacement account", err)
	}
	stop()
	journal, err := database.OpenCharacterSaveJournal(journalDir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := journal.Read(name)
	if err != nil || pending == nil || pending.Version != 2 || pending.AccountID != oldUser.ID {
		t.Fatal("shutdown discarded/rebound old generation journal", err)
	}
	row, err = users.FindOne(ctx, bson.M{"_id": replacement.ID}).DecodeBytes()
	if err != nil || sha256.Sum256(row) != before {
		t.Fatal("old-session shutdown changed replacement", err)
	}
}
