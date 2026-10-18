package database

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// Observe actual server-side connections for this constructor, including idle
// monitor sockets. A successful constructor below is the positive control for
// the observer; Close must then remove precisely those connections.
// https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/currentOp/
func startupClientConnections(t *testing.T, control *mongo.Client, app string) int {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()
	cursor, err := control.Database("admin").Aggregate(ctx, mongo.Pipeline{
		{{Key: "$currentOp", Value: bson.D{{Key: "allUsers", Value: true}, {Key: "idleConnections", Value: true}}}},
		{{Key: "$match", Value: bson.D{{Key: "appName", Value: app}}}},
		{{Key: "$count", Value: "connections"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Connections int `bson:"connections"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		t.Fatal(err)
	}
	if len(rows) == 0 {
		return 0
	}
	return rows[0].Connections
}

func requireStartupClientReleased(t *testing.T, control *mongo.Client, app string) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for {
		remaining := startupClientConnections(t, control, app)
		if remaining == 0 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("constructor-owned connections remain after return/Close: %d", remaining)
		}
		time.Sleep(25 * time.Millisecond)
	}
}

func TestDBStartupClientOwnership(t *testing.T) {
	control, uri := startupBudgetMongo(t)
	for _, command := range []string{"ping", "createIndexes"} {
		t.Run(command+"-refusal", func(t *testing.T) {
			app := fmt.Sprintf("eidolon-owned-startup-%s-%d", command, time.Now().UnixNano())
			if err := control.Database("admin").RunCommand(t.Context(), bson.D{
				{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: bson.M{"times": 1}},
				{Key: "data", Value: bson.M{"failCommands": bson.A{command}, "errorCode": 13}},
			}).Err(); err != nil {
				t.Fatal(err)
			}
			db, err := New(uri + "/?appName=" + app)
			if db != nil {
				_ = db.Close(t.Context())
				t.Fatal("a refused startup must not hand off a database")
			}
			var commandError mongo.CommandError
			if !errors.As(err, &commandError) || commandError.Code != 13 {
				t.Fatalf("expected the real %s command refusal, got %v", command, err)
			}
			requireStartupClientReleased(t, control, app)
		})
	}
	t.Run("successful-handoff-and-close", func(t *testing.T) {
		app := fmt.Sprintf("eidolon-owned-startup-success-%d", time.Now().UnixNano())
		db, err := New(uri + "/?appName=" + app)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = db.Close(context.Background()) })
		if err := db.Ping(t.Context()); err != nil {
			t.Fatalf("successful constructor handed off a closed client: %v", err)
		}
		if connections := startupClientConnections(t, control, app); connections == 0 {
			t.Fatal("positive control must observe the live handed-off client")
		}
		if err := db.Close(t.Context()); err != nil {
			t.Fatal(err)
		}
		requireStartupClientReleased(t, control, app)
	})
}
