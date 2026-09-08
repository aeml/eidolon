package main

import (
	"context"
	"os"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

// Unlike the interruption fixtures, this checks the success acknowledgement
// itself and a cast which has not first been saved by disconnecting.
func TestAuctionSellerPayoutActualNormalCollection(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	seller, password := resourceJournalFixture(t, repo)
	auction := resourceRefundAuction(seller)
	auction.SellerID, auction.SellerName = "player-"+seller.Name, seller.Name
	auction.BidderID, auction.BidderName, auction.BuyerID = "player-prepared-winner", "prepared-winner", "player-prepared-winner"
	auction.Status, auction.Bid, auction.SalePrice, auction.Deposit = "SOLD", 100, 100, 5
	if err := repo.CreateAuction(auction); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 124, "-save-journal-dir", dir)
	connection := resourceOpenCharacter(t, address, seller.Name, password)
	baseline := resourceCloseAndWait(t, repo, connection, seller.Name)
	connection = resourceOpenCharacter(t, address, seller.Name, password)
	resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
	var cast game.AbilityResult
	resourceReadMessage(t, connection, MsgAbilityResult, &cast)
	if !cast.Accepted || cast.Mana != 70 {
		t.Fatal("ordinary pre-collection cast failed")
	}
	resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: auction.ID})
	var reply string
	resourceReadMessage(t, connection, MsgError, &reply)
	if reply != "Collected 100 gold" {
		t.Fatalf("normal payout acknowledgement=%q", reply)
	}
	verify := func() {
		t.Helper()
		saved, err := repo.GetCharacter(seller.Name, seller.Name)
		if err != nil {
			t.Fatal(err)
		}
		current, err := repo.GetAuction(auction.ID)
		if err != nil {
			t.Fatal(err)
		}
		if saved.Gold != 1334 || saved.Resources == nil || saved.Resources.Health != 17 || saved.Resources.Mana != 70 || saved.Resources.Dead ||
			!current.SellerClaimed || current.LastBidOperationID == "" || saved.GoldCreditReceipts["seller-payout:"+current.LastBidOperationID] != 100 ||
			len(saved.GoldCreditReceipts) != 1 || pendingAuctionBid(t, repo, auction.ID) != nil {
			t.Fatal("normal acknowledgement/retry did not retain exactly one durable payout and current resources")
		}
		if current.ItemClaimed || current.BuyerID != auction.BuyerID || current.Bid != 100 || len(current.PendingRefunds) != 0 || !reflect.DeepEqual(current.Item, auction.Item) {
			t.Fatal("normal seller collection changed the outstanding buyer item/escrow")
		}
		if !reflect.DeepEqual(saved.Equipment, baseline.Equipment) || !reflect.DeepEqual(saved.Inventory, baseline.Inventory) ||
			saved.XP != baseline.XP || saved.Level != baseline.Level {
			t.Fatal("normal seller collection changed gear/inventory/progression")
		}
	}
	verify() // Success must mean the character/claim are durable already.
	for phase := 124; phase < 126; phase++ {
		if phase == 125 {
			address, stop = compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
			connection = resourceOpenCharacter(t, address, seller.Name, password)
		}
		resourceProbe(t, connection, 70, false)
		resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: auction.ID})
		resourceReadMessage(t, connection, MsgError, &reply)
		if reply != "nothing to collect" {
			t.Fatalf("settled seller claim accepted again: %q", reply)
		}
		resourceCloseAndWait(t, repo, connection, seller.Name)
		verify()
		stop()
	}
}

// Starting sale/deposit are explicit fixtures. Collection, saved cast, crash
// recovery and repeated claims all use ordinary production sessions/handlers.
func TestAuctionSellerPayoutActualCrashBoundaries(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	if os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires disposable Mongo failpoints")
	}
	admin := resourceRefundAdmin(t, uri)
	for _, boundary := range []string{"decision_rejected", "decision_reply_lost", "before_credit", "credit_journal", "before_finalize", "final_reply_lost"} {
		t.Run(boundary, func(t *testing.T) {
			seller, password := resourceJournalFixture(t, repo)
			auction := resourceRefundAuction(seller)
			auction.SellerID, auction.SellerName = "player-"+seller.Name, seller.Name
			auction.BidderID, auction.BidderName, auction.BuyerID = "player-prepared-winner", "prepared-winner", "player-prepared-winner"
			auction.Status, auction.Bid, auction.SalePrice, auction.Deposit = "SOLD", 100, 100, 5
			if err := repo.CreateAuction(auction); err != nil {
				t.Fatal(err)
			}
			dir := t.TempDir()
			address, crash := compatStartServerWithCrash(t, binary, uri, 120, true, "-save-journal-dir", dir)
			connection := resourceOpenCharacter(t, address, seller.Name, password)
			resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
			var cast game.AbilityResult
			resourceReadMessage(t, connection, MsgAbilityResult, &cast)
			if !cast.Accepted || cast.Mana != 70 {
				t.Fatal("ordinary pre-payout cast failed")
			}
			baseline := resourceCloseAndWait(t, repo, connection, seller.Name)
			connection = resourceOpenCharacter(t, address, seller.Name, password)
			resourceProbe(t, connection, 70, false)
			collection, validator := "", bson.M{}
			command, namespace := "", ""
			switch boundary {
			case "decision_rejected":
				collection, validator = "auction_bid_operations", bson.M{"deliberate_rejection": true}
			case "decision_reply_lost":
				command, namespace = "insert", "eidolon.auction_bid_operations"
			case "before_credit":
				collection, validator = "users", bson.M{"username": bson.M{"$ne": seller.Name}}
			case "credit_journal":
				collection, validator = "users", bson.M{"$or": bson.A{
					bson.M{"username": bson.M{"$ne": seller.Name}}, bson.M{"characters": bson.M{"$elemMatch": bson.M{"name": seller.Name, "gold": 1234}}},
				}}
			case "before_finalize":
				collection, validator = "auctions", bson.M{"$or": bson.A{
					bson.M{"id": bson.M{"$ne": auction.ID}}, bson.M{"seller_claimed": bson.M{"$ne": true}},
				}}
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
					if err := admin.Database("admin").RunCommand(ctx, bson.D{
						{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: mode},
						{Key: "data", Value: bson.M{"failCommands": []string{command}, "namespace": namespace,
							"writeConcernError": bson.M{"code": 64, "errmsg": "prepared payout acknowledgement failure"}}},
					}).Err(); err != nil {
						t.Fatal(err)
					}
				} else {
					value := bson.M{}
					if enabled {
						value = validator
					}
					if err := admin.Database("eidolon").RunCommand(ctx, bson.D{
						{Key: "collMod", Value: collection}, {Key: "validator", Value: value},
						{Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"},
					}).Err(); err != nil {
						t.Fatal(err)
					}
				}
			}
			configure(true)
			t.Cleanup(func() { configure(false) })
			resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: auction.ID})
			var reply string
			resourceReadMessage(t, connection, MsgError, &reply)
			if reply != "Your auction payout is awaiting recovery. Please try again shortly." {
				t.Fatalf("wrong payout boundary response: %s", reply)
			}
			op := pendingAuctionBid(t, repo, auction.ID)
			if boundary == "decision_rejected" {
				if op != nil {
					t.Fatal("rejected payout decision was persisted")
				}
			} else if op == nil || op.Kind != database.AuctionOperationSellerPayout || op.Amount != 100 || op.Fee != 5 || op.PlayerID != "player-"+seller.Name {
				t.Fatal("durable seller decision missing or altered")
			}
			before, err := repo.GetCharacter(seller.Name, seller.Name)
			if err != nil {
				t.Fatal(err)
			}
			wantGold := 1234
			if boundary == "before_finalize" || boundary == "final_reply_lost" {
				wantGold = 1334
			}
			current, err := repo.GetAuction(auction.ID)
			if err != nil || before.Gold != wantGold || current.SellerClaimed != (boundary == "final_reply_lost") {
				t.Fatal("fault did not reach intended payout/claim boundary")
			}
			if wantGold == 1334 && before.GoldCreditReceipts["seller-payout:"+op.ID] != 100 {
				t.Fatal("committed payout lacks matching receipt")
			}
			if boundary == "credit_journal" {
				journal, err := database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				pending, err := journal.Read(seller.Name)
				if err != nil || pending == nil {
					t.Fatal("uncommitted payout has no durable journal")
				}
				value, err := pending.Character()
				if err != nil || value.Gold != 1334 || value.GoldCreditReceipts["seller-payout:"+op.ID] != 100 {
					t.Fatal("journaled payout/receipt boundary missing")
				}
			}
			crash()
			configure(false)
			for phase := 121; phase < 123; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				if pendingAuctionBid(t, repo, auction.ID) != nil {
					t.Fatal("startup admitted players before reconciling payout")
				}
				connection := resourceOpenCharacter(t, address, seller.Name, password)
				resourceProbe(t, connection, 70, false)
				if boundary != "decision_rejected" {
					resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: auction.ID})
					resourceReadMessage(t, connection, MsgError, &reply)
					if reply != "nothing to collect" {
						t.Fatal("repeated settled seller claim was not rejected")
					}
				}
				saved := resourceCloseAndWait(t, repo, connection, seller.Name)
				current, err := repo.GetAuction(auction.ID)
				if err != nil {
					t.Fatal(err)
				}
				if boundary == "decision_rejected" {
					if saved.Gold != 1234 || current.SellerClaimed || len(saved.GoldCreditReceipts) != 0 {
						t.Fatal("rejected decision changed payout on restart")
					}
				} else if saved.Gold != 1334 || !current.SellerClaimed || current.LastBidOperationID != op.ID ||
					saved.GoldCreditReceipts["seller-payout:"+op.ID] != 100 || len(saved.GoldCreditReceipts) != 1 {
					t.Fatal("recovery duplicated/lost seller payout or its receipt")
				}
				if current.ItemClaimed || current.BuyerID != auction.BuyerID || current.Bid != 100 || len(current.PendingRefunds) != 0 || !reflect.DeepEqual(current.Item, auction.Item) {
					t.Fatal("seller payout changed the outstanding buyer item/escrow")
				}
				if !reflect.DeepEqual(saved.Resources, baseline.Resources) || !reflect.DeepEqual(saved.Equipment, baseline.Equipment) ||
					!reflect.DeepEqual(saved.Inventory, baseline.Inventory) || saved.XP != baseline.XP || saved.Level != baseline.Level {
					t.Fatal("seller payout changed saved resources/equipment/inventory/progression")
				}
				stop()
			}
		})
	}
}
