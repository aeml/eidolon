package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerOperationExportSelectionAndItemPrivacy(t *testing.T) {
	for _, section := range []string{"trades", "bank"} {
		for _, cursor := range []string{"", strings.Repeat("0", 64), strings.Repeat("a", 64)} {
			if !ValidOwnerExportQuery(OwnerExportQuery{Section: section, Before: cursor}) {
				t.Fatal("valid operation cursor rejected")
			}
		}
		for _, cursor := range []string{strings.Repeat("a", 24), strings.Repeat("A", 64), ownerOperationPrefix(section) + strings.Repeat("a", 64), strings.Repeat("a", 65)} {
			if ValidOwnerExportQuery(OwnerExportQuery{Section: section, Before: cursor}) {
				t.Fatal("invalid operation cursor accepted")
			}
		}
		if ValidOwnerExportQuery(OwnerExportQuery{Section: section, CharacterName: "other"}) {
			t.Fatal("client character target accepted")
		}
	}
	if ValidOwnerExportQuery(OwnerExportQuery{Section: "reports", Before: strings.Repeat("a", 64)}) {
		t.Fatal("cursor leaked across ID kinds")
	}
	payload := `{"gold":7,"items":[{"id":"earned","name":"Earned sword","stack":1,"maxStack":1,"potency":4,"stats":{"strength":9},"gems":[{"type":"Ruby","quality":"Rare","stats":{"strength":2}}],"uniqueEffect":"flame","forgeBasis":{"private":"private-basis"},"privateRecovery":"private-item"}]}`
	offer, err := snapshotOwnerTradeOffer(payload)
	if err != nil || offer.Gold != 7 || len(offer.Items) != 1 || offer.Items[0].Stats["strength"] != 9 || offer.Items[0].Potency != 4 || offer.Items[0].Gems[0].Stats["strength"] != 2 || offer.Items[0].UniqueEffect != "flame" {
		t.Fatal("earned item fields lost", err)
	}
	data, err := json.Marshal(offer)
	if err != nil || strings.Contains(string(data), "private-") || strings.Contains(string(data), "forgeBasis") {
		t.Fatal("private opaque item metadata leaked")
	}
	// The existing custody validator accepts an empty legacy object as a zero
	// offer. Preserve that read semantics instead of inventing a new restriction.
	if offer, err := snapshotOwnerTradeOffer(`{}`); err != nil || offer.Gold != 0 || len(offer.Items) != 0 {
		t.Fatal("legacy empty offer changed")
	}
	for _, bad := range []string{`null`, `{"gold":-1}`, `{"gold":1,"ep":2}`, `{"items":[{"id":"chronicle-item-personal"}]}`, `{"items":[{"id":"same"},{"id":"same"}]}`, strings.Repeat("x", MaxDirectTradeOfferBytes+1)} {
		if _, err := snapshotOwnerTradeOffer(bad); err == nil {
			t.Fatal("malformed trade offer accepted", bad[:min(len(bad), 80)])
		}
	}
	for _, source := range []any{ownerTradeSource{}, ownerTradePartySource{}, ownerBankSource{}} {
		data, err := json.Marshal(source)
		if err != nil || string(data) != "{}" {
			t.Fatal("source DTO is not private")
		}
	}
	for _, payload := range []string{`null`, `{"id":"earned","stack":0}`, "{\"id\":\"earned\",\"stack\":1,\"name\":\"" + string([]byte{0xff}) + "\"}"} {
		if _, err := snapshotOwnerBankItem(ownerBankSource{Action: GuildBankDepositItem, ItemPayload: payload}); err == nil {
			t.Fatal("malformed bank item accepted")
		}
	}
}

func TestOwnerOperationExportFencesAndNoMutation(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	now := time.Now().UTC()
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, section := range []string{"trades", "bank"} {
		for _, scenario := range []string{"valid", "empty", "oversized", "wrong-owner", "duplicate-own", "malformed-item", "nondecreasing", "wrong-prefix", "reset-after-read", "output-limit"} {
			mt.Run(section+"/"+scenario, func(mt *mtest.T) {
				ns := mt.DB.Name() + "." + mt.Coll.Name()
				proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
				id := ownerOperationPrefix(section) + strings.Repeat("a", 64)
				if scenario == "nondecreasing" {
					id = ownerOperationPrefix(section) + strings.Repeat("b", 64)
				}
				if scenario == "wrong-prefix" {
					id = "other:" + strings.Repeat("a", 64)
				}
				row := bson.M{"_id": id, "version": 1, "created_at": now, "state": "complete"}
				playerID := "player-owner"
				if scenario == "wrong-owner" {
					playerID = "player-other"
				}
				if section == "trades" {
					party := bson.M{"player_id": playerID, "character_name": "Owner Hero", "offer_payload": `{"gold":7,"items":[{"id":"earned","stack":1,"stats":{"strength":9}}]}`}
					if scenario == "malformed-item" {
						party["offer_payload"] = `{"gold":-1}`
					}
					row["own"] = bson.A{party}
					if scenario == "duplicate-own" {
						row["own"] = bson.A{party, party}
					}
					row["decision"] = "settle"
					row["participant_count"] = 2
					row["incoming"] = bson.A{bson.M{"offer_payload": `{"gold":0,"items":[]}`}}
				} else {
					row["username"] = "owner"
					row["player_id"] = playerID
					row["character_name"] = "Owner Hero"
					row["guild_id"] = "public-guild"
					row["action"] = GuildBankDepositItem
					row["gold"] = 0
					row["item_payload"] = `{"id":"earned","stack":1,"stats":{"strength":9}}`
					if scenario == "malformed-item" {
						row["item_payload"] = `null`
					}
					if scenario == "duplicate-own" {
						row["username"] = "other"
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
				db := &DB{users: mt.Coll, directTradeOperations: mt.Coll, guildBankOperations: mt.Coll}
				budget := maximumOwnerExportResponse
				if scenario == "output-limit" {
					budget = 1
				}
				data, err := db.readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: section, Before: strings.Repeat("b", 64)}, now, budget)
				if scenario == "valid" || scenario == "empty" {
					if err != nil || !json.Valid(data) {
						mt.Fatal("valid operation export failed", err)
					}
					for _, private := range []string{`"username"`, `"player_id"`, `"offer_payload"`, `"item_payload"`, ownerOperationPrefix(section), `"fingerprint"`} {
						if strings.Contains(string(data), private) {
							mt.Fatal("private source metadata exported", private)
						}
					}
				} else if err != errOwnerExportSection || data != nil {
					mt.Fatal("invalid operation returned partial data")
				}
				for _, event := range mt.GetAllStartedEvents() {
					if event.CommandName != "find" && event.CommandName != "aggregate" {
						mt.Fatal("export mutated transaction state", event.CommandName)
					}
					if event.CommandName == "aggregate" {
						if event.Command.Lookup("collation").Document().Lookup("locale").StringValue() != "simple" {
							mt.Fatal("string cursor ordering not binary")
						}
						stages, _ := event.Command.Lookup("pipeline").Array().Values()
						projection := stages[3].Document().Lookup("$project").Document()
						for _, field := range []string{"participants", "fingerprint", "trade_id", "request_id", "guild_version", "character_bank_revision"} {
							if projection.Lookup(field).Type != 0 {
								mt.Fatal("raw private/shared projection widened", field)
							}
						}
					}
				}
			})
		}
	}
}
