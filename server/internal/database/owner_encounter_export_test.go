package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerEncounterRewardItemBoundsAndPrivateSources(t *testing.T) {
	payload := `{"id":"earned","stack":1,"maxStack":2,"stats":{"strength":9},"potency":4,"gems":[{"type":"Ruby","quality":"Rare","stats":{"wisdom":3},"private":"private-gem"}],"forgeBasis":{"private":"private-basis"},"privateCustody":"private-item"}`
	items, err := snapshotOwnerRewardItems([]string{payload}, 2)
	if err != nil || len(items) != 1 || items[0].Stats["strength"] != 9 || items[0].Potency != 4 || items[0].Gems[0].Stats["wisdom"] != 3 {
		t.Fatal("gameplay reward fields lost", err)
	}
	data, _ := json.Marshal(items)
	if strings.Contains(string(data), "private-") {
		t.Fatal("opaque reward metadata leaked")
	}
	for _, payloads := range [][]string{{payload, payload}, {`null`}, {`{"id":"earned","stack":0}`}, {`{"id":"earned","stack":3,"maxStack":2}`}, {strings.Repeat("x", 65537)}} {
		if _, err := snapshotOwnerRewardItems(payloads, 2); err == nil {
			t.Fatal("malformed/shared/oversized reward items accepted")
		}
	}
	if _, err := snapshotOwnerRewardItems([]string{payload}, 0); err == nil {
		t.Fatal("reward item limit bypassed")
	}
	if items, err := snapshotOwnerRewardItems(nil, 2); err != nil || items == nil || len(items) != 0 {
		t.Fatal("empty reward invented data")
	}
	for _, source := range []any{ownerEncounterSource{}, ownerEncounterRecipientSource{}, ownerMarketItemSource{}} {
		data, err := json.Marshal(source)
		if err != nil || string(data) != "{}" {
			t.Fatal("private source DTO leaked")
		}
	}
}

func TestOwnerEncounterAndMarketItemExportFences(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	now := time.Now().UTC()
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, section := range []string{"rooms", "bosses", "market-items"} {
		for _, scenario := range []string{"valid", "empty", "oversized", "wrong-owner", "duplicate-own", "malformed-item", "invalid-credit", "reset-after-read", "output-limit"} {
			mt.Run(section+"/"+scenario, func(mt *mtest.T) {
				ns := mt.DB.Name() + "." + mt.Coll.Name()
				proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
				row := bson.M{"_id": ownerOperationPrefix(section) + strings.Repeat("a", 64), "version": 1, "created_at": now, "state": "pending", "dungeon_type": "verdant_bastion_catacombs", "difficulty": "normal", "run_level": 30, "room_index": 2}
				before := strings.Repeat("b", 64)
				if section == "market-items" {
					id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234560")
					row = bson.M{"_id": id, "id": "public-auction", "owner_seller": true, "item": bson.M{"id": "earned", "name": "Earned Blade", "stats": bson.M{"strength": 9}, "potency": 4, "sockets": 1, "gems": bson.A{bson.M{"type": "Ruby", "quality": "Rare", "stats": bson.M{"wisdom": 3}}}}}
					before = "0123456789abcdef01234565"
					if scenario == "wrong-owner" {
						row["owner_seller"] = false
					}
					if scenario == "duplicate-own" {
						row["item"] = nil
					}
					if scenario == "malformed-item" {
						row["item"] = bson.M{"id": "earned", "stats": bson.M{"strength": "wrong-type"}}
					}
					if scenario == "invalid-credit" {
						row["id"] = ""
					}
				} else {
					own := bson.M{"player_id": "player-owner", "gold": 17, "xp": 23, "items": bson.A{`{"id":"earned","stack":1,"stats":{"strength":9}}`}}
					if scenario == "wrong-owner" {
						own["player_id"] = "player-other"
					}
					if scenario == "malformed-item" {
						own["items"] = bson.A{`{"id":"earned","stack":0}`}
					}
					if section == "rooms" {
						row["room_type"] = "elite"
						row["room_hook"] = "shrine"
						row["objective"] = -1
						own["health"] = 5
						own["mana"] = 7
						if scenario == "invalid-credit" {
							row["room_hook"] = "chest"
						}
					} else {
						row["boss_type"] = "HollowSentinel"
						own["quests"] = bson.A{bson.M{"quest_id": "story-earth", "target": "HollowSentinel", "amount": 1, "maximum": 1}}
						if scenario == "invalid-credit" {
							own["quests"] = bson.A{bson.M{"quest_id": "story-earth", "target": "HollowSentinel", "amount": 2, "maximum": 1}}
						}
					}
					row["own"] = bson.A{own}
					if scenario == "duplicate-own" {
						row["own"] = bson.A{own, own}
					}
				}
				page := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "within_bound", Value: scenario != "oversized"}, {Key: "entry", Value: row}})
				if scenario == "empty" {
					page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				last := proof
				if scenario == "reset-after-read" {
					last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				mt.AddMockResponses(proof, page, last)
				db := &DB{users: mt.Coll, dungeonRoomRewards: mt.Coll, bossVictories: mt.Coll, auctions: mt.Coll}
				budget := maximumOwnerExportResponse
				if scenario == "output-limit" {
					budget = 1
				}
				data, err := db.readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: section, Before: before}, now, budget)
				if scenario == "valid" || scenario == "empty" {
					if err != nil || !json.Valid(data) {
						mt.Fatal("valid owner file failed", err)
					}
					for _, private := range []string{`"player_id"`, `"username"`, `"participants"`, `"fingerprint"`, `"instance_id"`, `"drops"`} {
						if strings.Contains(string(data), private) {
							mt.Fatal("private shared data leaked", private)
						}
					}
					if scenario == "valid" && !strings.Contains(string(data), `"strength":9`) {
						mt.Fatal("own item stats omitted")
					}
				} else if err != errOwnerExportSection || data != nil {
					mt.Fatal("invalid/reset owner row returned partial data")
				}
				for _, event := range mt.GetAllStartedEvents() {
					if event.CommandName != "find" && event.CommandName != "aggregate" {
						mt.Fatal("read executed rewards/custody mutation", event.CommandName)
					}
					if event.CommandName == "aggregate" {
						stages, _ := event.Command.Lookup("pipeline").Array().Values()
						projection := stages[3].Document().Lookup("$project").Document()
						for _, field := range []string{"participants", "fingerprint", "instance_id", "boss_id", "drops", "dungeon_clear", "seller_id", "bidder_id", "buyer_id", "pending_refunds", "item.forge_basis", "item.icon"} {
							if projection.Lookup(field).Type != 0 {
								mt.Fatal("raw private projection widened", field)
							}
						}
					}
				}
			})
		}
	}
}
