package database

import (
	"bytes"
	"context"
	"fmt"
	"maps"
	"os"
	"regexp"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/event"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestCharacterRepositoryQueriesOnlyRequestedCharacter(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, durable := range []bool{false, true} {
		name := "ordinary"
		if durable {
			name = "durable-recovery"
		}
		mt.Run(name, func(mt *mtest.T) {
			privateState, err := bson.Marshal(bson.M{"version": 9, "future_private_state": "preserve"})
			if err != nil {
				mt.Fatal(err)
			}
			want := &Character{Name: "second-character", Class: "Wizard", Gold: 99, EP: 43,
				DirectTradeState: privateState, PendingBossLoot: []string{"retained-private-roll"},
				ItemDeliveryReceipts: map[string]string{"original-operation": "original-fingerprint"}}
			mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Characters: []*Character{want}})))
			var got *Character
			if durable {
				got, err = (&DB{users: mt.Coll}).GetDirectTradeCharacter("account", want.Name)
			} else {
				got, err = newMongoCharacterRepository(mt.Coll).LoadCharacter("account", want.Name)
			}
			if err != nil || got == nil || got.Name != want.Name || got.Gold != want.Gold || got.EP != want.EP || !maps.Equal(got.ItemDeliveryReceipts, want.ItemDeliveryReceipts) || !bytes.Equal(got.DirectTradeState, want.DirectTradeState) || len(got.PendingBossLoot) != 1 {
				mt.Fatal("projection lost requested character/private recovery state", got, err)
			}
			command := mt.GetStartedEvent().Command
			filter := command.Lookup("filter").Document()
			if filter.Lookup("username").StringValue() != "account" || filter.Lookup("characters.name").StringValue() != want.Name {
				mt.Fatal("character query lost exact authenticated account/name scope", command)
			}
			value, err := command.LookupErr("projection")
			if err != nil {
				mt.Fatal("character load fetched the entire credential/account document", command)
			}
			projection := value.Document()
			elements, elemErr := projection.Elements()
			if elemErr != nil || len(elements) != 2 || projection.Lookup("_id").Int32() != 0 || projection.Lookup("characters").Document().Lookup("$elemMatch").Document().Lookup("name").StringValue() != want.Name {
				mt.Fatal("character load did not isolate requested array member", command)
			}
			if durable && command.Lookup("readConcern").Document().Lookup("level").StringValue() != "majority" {
				mt.Fatal("projection weakened durable recovery concern", command)
			}
		})
	}
}

func TestCharacterRepositoryActualMongoProjectionAndSaveIsolation(t *testing.T) {
	uri := os.Getenv("EIDOLON_PERSISTENCE_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" || !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	var mu sync.Mutex
	var findReply bson.Raw
	client, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri).SetMonitor(&event.CommandMonitor{
		Succeeded: func(_ context.Context, command *event.CommandSucceededEvent) {
			if command.CommandName == "find" {
				mu.Lock()
				findReply = append(bson.Raw(nil), command.Reply...)
				mu.Unlock()
			}
		},
	}))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	users := client.Database("eidolon").Collection(fmt.Sprintf("character_projection_%d", time.Now().UnixNano()))
	t.Cleanup(func() {
		ctx, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if err := users.Drop(ctx); err != nil {
			t.Error(err)
		}
	})
	privateState, err := bson.Marshal(bson.M{"version": 9, "future_private_state": "preserve"})
	if err != nil {
		t.Fatal(err)
	}
	other := &Character{Name: "unrelated-character", Class: "Fighter", Gold: 777, ItemDeliveryReceipts: persistenceReceiptMap(10000)}
	target := &Character{Name: "requested-character", Class: "Wizard", Gold: 99, EP: 43, ItemDeliveryReceipts: persistenceReceiptMap(1000),
		DirectTradeState: privateState, PendingBossLoot: []string{"retained-private-roll"}}
	owner := User{Username: "projection-owner", Email: "synthetic-private@example.invalid", PasswordHash: "synthetic-private-hash",
		Characters: []*Character{other, target}}
	if _, err := users.InsertOne(t.Context(), owner); err != nil {
		t.Fatal(err)
	}
	repository := newMongoCharacterRepository(users)
	for _, durable := range []bool{false, true} {
		var got *Character
		if durable {
			got, err = (&DB{users: users}).GetDirectTradeCharacter(owner.Username, target.Name)
		} else {
			got, err = repository.LoadCharacter(owner.Username, target.Name)
		}
		if err != nil || got == nil || got.Gold != target.Gold || got.EP != target.EP || !maps.Equal(got.ItemDeliveryReceipts, target.ItemDeliveryReceipts) || !bytes.Equal(got.DirectTradeState, target.DirectTradeState) || len(got.PendingBossLoot) != 1 {
			t.Fatal("projected read lost complete requested recovery state", durable, err)
		}
		mu.Lock()
		encoded := append(bson.Raw(nil), findReply...)
		mu.Unlock()
		var reply struct {
			Cursor struct {
				FirstBatch []bson.M `bson:"firstBatch"`
			} `bson:"cursor"`
		}
		if err := bson.Unmarshal(encoded, &reply); err != nil || len(reply.Cursor.FirstBatch) != 1 || len(reply.Cursor.FirstBatch[0]) != 1 {
			t.Fatal("actual Mongo reply included account/credential fields", durable, err)
		}
		document, err := bson.Marshal(reply.Cursor.FirstBatch[0])
		if err != nil {
			t.Fatal(err)
		}
		var projected User
		if err := bson.Unmarshal(document, &projected); err != nil || len(projected.Characters) != 1 || projected.Characters[0].Name != target.Name {
			t.Fatal("actual Mongo reply included unrelated character", durable, err)
		}
		full, err := bson.Marshal(owner)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("character_projection durable=%t account_bson_bytes=%d projected_bson_bytes=%d requested_receipts=1000 unrelated_receipts=10000", durable, len(full), len(document))
	}
	target.Gold++
	if err := repository.SaveCharacter(owner.Username, target); err != nil {
		t.Fatal(err)
	}
	var saved User
	if err := users.FindOne(t.Context(), bson.M{"username": owner.Username}).Decode(&saved); err != nil {
		t.Fatal(err)
	}
	if saved.Email != owner.Email || saved.PasswordHash != owner.PasswordHash || len(saved.Characters) != 2 || saved.Characters[0].Gold != other.Gold || !maps.Equal(saved.Characters[0].ItemDeliveryReceipts, other.ItemDeliveryReceipts) || saved.Characters[1].Gold != 100 || !maps.Equal(saved.Characters[1].ItemDeliveryReceipts, target.ItemDeliveryReceipts) {
		t.Fatal("targeted save damaged unrelated character or account fields")
	}
	if got, err := repository.LoadCharacter("different-owner", target.Name); err == nil || got != nil {
		t.Fatal("character projection crossed account ownership", got, err)
	}
	if got, err := repository.LoadCharacter(owner.Username, "missing-character"); err == nil || got != nil {
		t.Fatal("missing character fell back to another character", got, err)
	}
}
