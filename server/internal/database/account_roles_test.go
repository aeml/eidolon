package database

import (
	"context"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestUserRolesBSONRoundTrip(t *testing.T) {
	grantedAt := time.Date(2026, time.September, 15, 12, 0, 0, 0, time.UTC)
	original := User{
		Username: "donveetz",
		Roles: map[string]AccountRoleAssignment{
			AccountRoleAdmin: {GrantedAt: grantedAt, GrantedBy: "donveetz", Source: "bootstrap_chat"},
		},
	}
	encoded, err := bson.Marshal(original)
	if err != nil {
		t.Fatal(err)
	}
	var decoded User
	if err := bson.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	assignment, ok := decoded.Roles[AccountRoleAdmin]
	if !ok || !assignment.GrantedAt.Equal(grantedAt) || assignment.GrantedBy != "donveetz" || assignment.Source != "bootstrap_chat" {
		t.Fatalf("unexpected role round trip: %+v", decoded.Roles)
	}
}

func TestAdminRoleIntegrationIsDurableAndIdempotent(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI is required for admin role integration coverage")
	}
	repository, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repository.Close(context.Background())

	username := fmt.Sprintf("admin-role-%d", time.Now().UnixNano())
	defer repository.users.DeleteOne(context.Background(), bson.M{"username": username})
	if err := repository.CreateUser(username, username+"@example.invalid", "local-test-password"); err != nil {
		t.Fatal(err)
	}
	if hasRole, err := repository.HasAdminRole(username); err != nil || hasRole {
		t.Fatalf("new account must not be admin: hasRole=%v err=%v", hasRole, err)
	}
	var grantedCount atomic.Int32
	errorsSeen := make(chan error, 8)
	var grants sync.WaitGroup
	for range 8 {
		grants.Add(1)
		go func() {
			defer grants.Done()
			granted, grantErr := repository.GrantAdminRole(username, username, "bootstrap_chat")
			if grantErr != nil {
				errorsSeen <- grantErr
				return
			}
			if granted {
				grantedCount.Add(1)
			}
		}()
	}
	grants.Wait()
	close(errorsSeen)
	for grantErr := range errorsSeen {
		t.Fatalf("concurrent grant failed: %v", grantErr)
	}
	if grantedCount.Load() != 1 {
		t.Fatalf("expected one atomic first grant, got %d", grantedCount.Load())
	}
	first, err := repository.GetUser(username)
	if err != nil {
		t.Fatal(err)
	}
	granted, err := repository.GrantAdminRole(username, username, "bootstrap_chat")
	if err != nil || granted {
		t.Fatalf("expected idempotent grant: granted=%v err=%v", granted, err)
	}
	second, err := repository.GetUser(username)
	if err != nil {
		t.Fatal(err)
	}
	if !second.Roles[AccountRoleAdmin].GrantedAt.Equal(first.Roles[AccountRoleAdmin].GrantedAt) {
		t.Fatal("idempotent grant must preserve original metadata")
	}
	if hasRole, err := repository.HasAdminRole(username); err != nil || !hasRole {
		t.Fatalf("granted account must remain admin: hasRole=%v err=%v", hasRole, err)
	}
	if _, err := repository.users.UpdateOne(context.Background(), bson.M{"username": username},
		bson.M{"$set": bson.M{"roles.admin": nil}}); err != nil {
		t.Fatal(err)
	}
	if hasRole, err := repository.HasAdminRole(username); err != nil || hasRole {
		t.Fatalf("malformed role data must fail closed: hasRole=%v err=%v", hasRole, err)
	}
}
