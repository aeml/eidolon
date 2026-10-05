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

func TestOwnerEconomyExportPlanValidationAndSourcePrivacy(t *testing.T) {
	for _, source := range []any{ownerGroundSource{}, ownerAuctionOperationSource{}, ownerAdminOperationSource{}} {
		data, err := json.Marshal(source)
		if err != nil || string(data) != "{}" {
			t.Fatal("private source DTO exposed")
		}
	}
	item := `{"id":"earned","stack":1,"maxStack":1,"stats":{"strength":9},"privateCustody":"private-item","forgeBasis":{"private":"private-forge"}}`
	row := ownerAuctionOperationSource{Kind: AuctionOperationBuyout, Amount: 17, ItemPayload: item}
	out, err := ownerAuctionOperationItem(row)
	if err != nil || out == nil || out.Stats["strength"] != 9 {
		t.Fatal("planned auction item lost", err)
	}
	data, _ := json.Marshal(out)
	if strings.Contains(string(data), "private-") {
		t.Fatal("opaque auction metadata leaked")
	}
	for _, kind := range []string{"future", "", "item_claim", "seller_payout"} {
		bad := row
		bad.Kind = kind
		if _, err := ownerAuctionOperationItem(bad); err == nil {
			t.Fatal("mismatched auction intent accepted", kind)
		}
	}
	gold := ownerAdminOperationSource{Action: "admin_grant_gold", State: AdminOperationPending, GrantPayload: []byte(`{"action":"admin_grant_gold","amount":17}`)}
	grant, err := snapshotOwnerAdminGrant(gold)
	if err != nil || grant == nil || grant.Gold != 17 {
		t.Fatal("own retained grant lost")
	}
	for _, payload := range []string{`null`, `{"action":"admin_grant_item","items":[]}`, `{"action":"admin_grant_gold","amount":0}`, `{"action":"admin_grant_gold","amount":100000001}`, strings.Repeat("x", 65537)} {
		bad := gold
		bad.GrantPayload = []byte(payload)
		if _, err := snapshotOwnerAdminGrant(bad); err == nil {
			t.Fatal("malformed grant accepted")
		}
	}
	if grant, err := snapshotOwnerAdminGrant(ownerAdminOperationSource{Action: "admin_grant_gold", State: AdminOperationComplete}); err != nil || grant != nil {
		t.Fatal("invented discarded grant payload")
	}
	if _, err := snapshotOwnerAdminGrant(ownerAdminOperationSource{Action: "admin_grant_gold", State: AdminOperationPending}); err == nil {
		t.Fatal("pending missing grant plan accepted")
	}
	now := time.Now().UTC()
	zero := time.Time{}
	if !validOwnerGroundSource(ownerGroundSource{Version: 1, Username: "owner", PlayerID: "player-owner", Kind: GroundItemDrop, State: GroundItemPending, CreatedAt: now, AvailableAt: &zero, ExpiresAt: &zero}, "owner") {
		t.Fatal("valid legacy zero-time pending drop changed")
	}
}

func TestOwnerEconomyExportFencesAndReadOnlyProjection(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	now := time.Now().UTC()
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, section := range []string{"ground", "auction-ops", "admin-ops"} {
		for _, scenario := range []string{"valid", "empty", "oversized", "wrong-owner", "malformed-plan", "reset-after-read", "output-limit"} {
			mt.Run(section+"/"+scenario, func(mt *mtest.T) {
				ns := mt.DB.Name() + "." + mt.Coll.Name()
				proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
				before := strings.Repeat("b", 64)
				row := bson.M{"_id": ownerOperationPrefix(section) + strings.Repeat("a", 64), "version": 1}
				switch section {
				case "ground":
					row["username"] = "owner"
					row["player_id"] = "player-owner"
					row["kind"] = "pickup"
					row["state"] = "complete"
					row["created_at"] = now
					row["available_at"] = now
					row["expires_at"] = now.Add(time.Minute)
					row["moved_payload"] = `{"id":"earned","stack":1,"maxStack":1,"stats":{"strength":9}}`
					if scenario == "wrong-owner" {
						row["username"] = "other"
					}
					if scenario == "malformed-plan" {
						row["expires_at"] = now
					}
				case "auction-ops":
					id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234560")
					row = bson.M{"_id": id, "auction_id": "public-auction", "player_id": "player-owner", "character_name": "owner", "kind": AuctionOperationBuyout, "amount": 17, "end_time": now.Add(time.Hour), "item_payload": `{"id":"earned","stack":1,"maxStack":1,"stats":{"strength":9}}`}
					before = "0123456789abcdef01234565"
					if scenario == "wrong-owner" {
						row["player_id"] = "player-other"
					}
					if scenario == "malformed-plan" {
						row["item_payload"] = `null`
					}
				case "admin-ops":
					row["target"] = "owner"
					row["action"] = "admin_grant_item"
					row["state"] = "pending"
					row["audit"] = bson.M{"at": now, "result": "success"}
					row["grant_payload"] = []byte(`{"action":"admin_grant_item","items":[{"id":"earned","stack":1,"maxStack":1,"stats":{"strength":9},"privateCustody":"private-plan-item"}]}`)
					if scenario == "wrong-owner" {
						row["target"] = "other"
					}
					if scenario == "malformed-plan" {
						row["grant_payload"] = []byte(`{"action":"admin_grant_gold","amount":17}`)
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
				db := &DB{users: mt.Coll, groundItemOperations: mt.Coll, auctionBids: mt.Coll, adminOperations: mt.Coll}
				budget := maximumOwnerExportResponse
				if scenario == "output-limit" {
					budget = 1
				}
				data, err := db.readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: section, Before: before}, now, budget)
				if scenario == "valid" || scenario == "empty" {
					if err != nil || !json.Valid(data) {
						mt.Fatal("valid economy export failed", err)
					}
					for _, private := range []string{`"username"`, `"target"`, `"player_id"`, `"grant_payload"`, `"moved_payload"`, `"item_payload"`, "private-plan-item"} {
						if strings.Contains(string(data), private) {
							mt.Fatal("private source leaked", private)
						}
					}
					if scenario == "valid" && !strings.Contains(string(data), `"strength":9`) {
						mt.Fatal("own item fields lost")
					}
				} else if err != errOwnerExportSection || data != nil {
					mt.Fatal("invalid owner source returned partial data")
				}
				for _, event := range mt.GetAllStartedEvents() {
					if event.CommandName != "find" && event.CommandName != "aggregate" {
						mt.Fatal("export executed economic/admin mutation", event.CommandName)
					}
					if event.CommandName == "aggregate" {
						stages, _ := event.Command.Lookup("pipeline").Array().Values()
						projection := stages[3].Document().Lookup("$project").Document()
						for _, field := range []string{"actor", "fingerprint", "request_id", "payload", "audit.summary", "audit.reason", "audit.actor", "before_payload", "remaining_payload", "loot_owner_id", "loot_party_id", "instance_id", "x", "z", "previous_bidder_id", "previous_bidder_name", "refund_id"} {
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
