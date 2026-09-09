package main

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func auctionItemFixture(t *testing.T, repo *database.DB, status, storage string) (*database.Character, string, *database.Auction) {
	t.Helper()
	p, password := resourceJournalFixture(t, repo)
	fill := func(size int) []database.Item {
		items := make([]database.Item, size)
		for i := range items {
			items[i] = database.Item{ID: fmt.Sprintf("occupied-%d", i), Name: "Occupied", Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion}
		}
		return items
	}
	if storage != "" {
		p.Inventory = fill(game.MaxInventorySize)
	}
	if storage == "full" {
		p.Stash = fill(game.MaxStashSize)
	}
	if err := repo.SaveCharacter(p.Name, p); err != nil {
		t.Fatal(err)
	}
	a := resourceRefundAuction(p)
	a.Status, a.BuyerID = status, "player-"+p.Name
	if status != "SOLD" {
		a.SellerID, a.SellerName = "player-"+p.Name, p.Name
		a.BuyerID, a.BidderID, a.BidderName, a.Bid = "", "", "", 0
	}
	a.Item = database.Item{ID: "earned-auction-staff", Name: "Earned Staff", Type: "WEAPON", Slot: "mainHand", Rarity: "EPIC", Level: 70,
		Stack: 1, MaxStack: 1, Stats: map[string]int{"intelligence": 31}, Potency: 4, Sockets: 1, Icon: "staff", Description: "Preserve this exact earned item",
		StatScaleVersion: game.ItemStatScaleVersion, ForgeBasis: &forging.Basis{Level: 68, Potency: 3, Stats: map[string]int{"intelligence": 30}, Value: 120}}
	if err := repo.CreateAuction(a); err != nil {
		t.Fatal(err)
	}
	return p, password, a
}

func verifyAuctionItemCharacter(t *testing.T, saved, baseline *database.Character, item database.Item, copies int) {
	t.Helper()
	assertTownFixtureSave(t, baseline, saved, 0)
	count := 0
	for _, items := range [][]database.Item{saved.Inventory, saved.Stash} {
		for _, candidate := range items {
			if candidate.ID == item.ID {
				if !reflect.DeepEqual(candidate, item) {
					t.Fatalf("delivered item metadata changed: got%+v want%+v", candidate, item)
				}
				count++
			}
		}
	}
	if count != copies || len(saved.ItemDeliveryReceipts) != copies || saved.Gold != baseline.Gold || saved.XP != baseline.XP || saved.Level != baseline.Level ||
		!reflect.DeepEqual(saved.Equipment, baseline.Equipment) || !reflect.DeepEqual(saved.GoldCreditReceipts, baseline.GoldCreditReceipts) {
		t.Fatal("item delivery/replay changed quantity, receipt, resources, gear or gold")
	}
}

func TestAuctionItemActualCollectionAndCapacity(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	for _, mode := range []string{"buyer", "expired", "cancelled", "stash", "full"} {
		t.Run(mode, func(t *testing.T) {
			status, storage := "SOLD", ""
			if mode == "expired" || mode == "cancelled" {
				status = strings.ToUpper(mode)
			}
			if mode == "stash" || mode == "full" {
				storage = mode
			}
			p, password, a := auctionItemFixture(t, repo, status, storage)
			dir := t.TempDir()
			var baseline *database.Character
			for phase := 130; phase < 132; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				connection := resourceOpenCharacter(t, address, p.Name, password)
				if phase == 130 {
					townFixtureFireball(t, connection, p)
					baseline = resourceCloseAndWait(t, repo, connection, p.Name)
					assertTownFixtureSave(t, p, baseline, 30)
					connection = resourceOpenCharacter(t, address, p.Name, password)
				}
				townFixtureProbe(t, connection, baseline)
				resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: a.ID})
				var reply string
				resourceReadMessage(t, connection, MsgError, &reply)
				want := "Item collected into your inventory or stash"
				if phase == 131 {
					want = "nothing to collect"
				}
				if mode == "full" {
					want = game.ErrAuctionStorageFull.Error()
				}
				if reply != want {
					t.Fatalf("claim reply=%q want%q", reply, want)
				}
				saved, err := repo.GetCharacter(p.Name, p.Name)
				if err != nil {
					t.Fatal(err)
				}
				copies := 1
				if mode == "full" {
					copies = 0
				}
				verifyAuctionItemCharacter(t, saved, baseline, a.Item, copies)
				current, err := repo.GetAuction(a.ID)
				if err != nil || current.ItemClaimed != (copies == 1) || current.SellerClaimed != (status != "SOLD" && copies == 1) || pendingAuctionBid(t, repo, a.ID) != nil {
					t.Fatal("claim state/reservation not finalized correctly")
				}
				if mode == "full" && (!reflect.DeepEqual(saved.Inventory, baseline.Inventory) || !reflect.DeepEqual(saved.Stash, baseline.Stash)) {
					t.Fatal("full storage rejection modified contents")
				}
				if mode == "stash" && (len(saved.Stash) != 1 || saved.Stash[0].ID != a.Item.ID) {
					t.Fatal("full bag did not use stash")
				}
				final := resourceCloseAndWait(t, repo, connection, p.Name)
				verifyAuctionItemCharacter(t, final, baseline, a.Item, copies)
				stop()
				baseline = final
			}
		})
	}
}

func TestAuctionItemActualCrashBoundaries(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	if os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires disposable Mongo failpoints")
	}
	admin := resourceRefundAdmin(t, uri)
	for _, boundary := range []string{"decision_rejected", "decision_reply_lost", "before_delivery", "delivery_journal", "before_finalize", "final_reply_lost"} {
		t.Run(boundary, func(t *testing.T) {
			p, password, a := auctionItemFixture(t, repo, "SOLD", "")
			dir := t.TempDir()
			address, crash := compatStartServerWithCrash(t, binary, uri, 134, true, "-save-journal-dir", dir)
			connection := resourceOpenCharacter(t, address, p.Name, password)
			townFixtureFireball(t, connection, p)
			baseline := resourceCloseAndWait(t, repo, connection, p.Name)
			assertTownFixtureSave(t, p, baseline, 30)
			connection = resourceOpenCharacter(t, address, p.Name, password)
			collection, validator := "", bson.M{}
			command, namespace := "", ""
			switch boundary {
			case "decision_rejected":
				collection, validator = "auction_bid_operations", bson.M{"deliberate_rejection": true}
			case "decision_reply_lost":
				command, namespace = "insert", "eidolon.auction_bid_operations"
			case "before_delivery":
				collection, validator = "users", bson.M{"username": bson.M{"$ne": p.Name}}
			case "delivery_journal":
				collection, validator = "users", bson.M{"$or": bson.A{
					bson.M{"username": bson.M{"$ne": p.Name}}, bson.M{"characters": bson.M{"$elemMatch": bson.M{"name": p.Name, "inventory": bson.M{"$not": bson.M{"$elemMatch": bson.M{"id": a.Item.ID}}}}}},
				}}
			case "before_finalize":
				collection, validator = "auctions", bson.M{"$or": bson.A{bson.M{"id": bson.M{"$ne": a.ID}}, bson.M{"item_claimed": bson.M{"$ne": true}}}}
			case "final_reply_lost":
				command, namespace = "update", "eidolon.auctions"
			}
			configure := func(enabled bool) {
				t.Helper()
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if command != "" {
					mode := "off"
					if enabled {
						mode = "alwaysOn"
					}
					if err := admin.Database("admin").RunCommand(ctx, bson.D{{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: mode},
						{Key: "data", Value: bson.M{"failCommands": []string{command}, "namespace": namespace, "writeConcernError": bson.M{"code": 64, "errmsg": "prepared item acknowledgement failure"}}}}).Err(); err != nil {
						t.Fatal(err)
					}
				} else {
					value := bson.M{}
					if enabled {
						value = validator
					}
					if err := admin.Database("eidolon").RunCommand(ctx, bson.D{{Key: "collMod", Value: collection}, {Key: "validator", Value: value}, {Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"}}).Err(); err != nil {
						t.Fatal(err)
					}
				}
			}
			t.Cleanup(func() { configure(false) })
			configure(true)
			resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: a.ID})
			var reply string
			resourceReadMessage(t, connection, MsgError, &reply)
			if reply != "Your auction item is awaiting recovery. Please try again shortly." {
				t.Fatalf("fault reply=%q", reply)
			}
			op := pendingAuctionBid(t, repo, a.ID)
			if boundary == "decision_rejected" {
				if op != nil {
					t.Fatal("rejected decision committed")
				}
			} else if op == nil || op.Kind != database.AuctionOperationItemClaim || !op.Valid() {
				t.Fatal("durable item decision missing")
			}
			before, err := repo.GetCharacter(p.Name, p.Name)
			if err != nil {
				t.Fatal(err)
			}
			wantCopies := 0
			if boundary == "before_finalize" || boundary == "final_reply_lost" {
				wantCopies = 1
			}
			verifyAuctionItemCharacter(t, before, baseline, a.Item, wantCopies)
			current, err := repo.GetAuction(a.ID)
			if err != nil || current.ItemClaimed != (boundary == "final_reply_lost") {
				t.Fatal("fault missed requested claim boundary")
			}
			durable := before
			journal, err := database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			pending, err := journal.Read(p.Name)
			if err != nil {
				t.Fatal(err)
			}
			if pending != nil && pending.SaveID != before.LastSaveID {
				durable, err = pending.Character()
				if err != nil {
					t.Fatal(err)
				}
				assertTownFixtureSave(t, baseline, durable, 0)
			}
			if boundary == "delivery_journal" {
				journal, err := database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				pending, err := journal.Read(p.Name)
				if err != nil || pending == nil {
					t.Fatal("uncommitted delivery not journaled")
				}
				saved, err := pending.Character()
				if err != nil {
					t.Fatal(err)
				}
				verifyAuctionItemCharacter(t, saved, baseline, a.Item, 1)
			}
			crash()
			configure(false)
			for phase := 135; phase < 137; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				if pendingAuctionBid(t, repo, a.ID) != nil {
					t.Fatal("startup admitted before item recovery")
				}
				restored, err := repo.GetCharacter(p.Name, p.Name)
				if err != nil || !reflect.DeepEqual(restored.Resources, durable.Resources) || !reflect.DeepEqual(restored.WellRested, durable.WellRested) {
					t.Fatal("item recovery changed durable resources/rest before login")
				}
				if restored.Gold != baseline.Gold || restored.XP != baseline.XP || restored.Level != baseline.Level ||
					!reflect.DeepEqual(restored.Equipment, baseline.Equipment) || !reflect.DeepEqual(restored.GoldCreditReceipts, baseline.GoldCreditReceipts) {
					t.Fatal("item recovery changed the original gold, equipment or progression")
				}
				connection := resourceOpenCharacter(t, address, p.Name, password)
				townFixtureProbe(t, connection, restored)
				if boundary != "decision_rejected" {
					resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: a.ID})
					resourceReadMessage(t, connection, MsgError, &reply)
					if reply != "nothing to collect" {
						t.Fatal("recovered claim accepted twice", reply)
					}
				}
				saved := resourceCloseAndWait(t, repo, connection, p.Name)
				copies := 1
				if boundary == "decision_rejected" {
					copies = 0
				}
				verifyAuctionItemCharacter(t, saved, restored, a.Item, copies)
				current, err := repo.GetAuction(a.ID)
				if err != nil || current.ItemClaimed != (copies == 1) || current.SellerClaimed || !reflect.DeepEqual(current.Item, a.Item) {
					t.Fatal("recovery changed claim/auction metadata")
				}
				stop()
				durable = saved
			}
		})
	}
}
