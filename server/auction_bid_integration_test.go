package main

import (
	"context"
	"os"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
)

func pendingAuctionBid(t *testing.T, repo *database.DB, auctionID string) *database.AuctionBidOperation {
	t.Helper()
	ops, err := repo.LoadAuctionBidOperations()
	if err != nil {
		t.Fatal(err)
	}
	for _, op := range ops {
		if op.AuctionID == auctionID {
			copy := op
			return &copy
		}
	}
	return nil
}

// Prepared previous escrow, ordinary cast/save/reconnect and bid input. Kill the
// owned API after each observed durable boundary; Mongo and the journal survive.
// Committed-but-errored replies use test-only Mongo writeConcernError failpoints.
func TestAuctionBidActualCrashBoundaries(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	if os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires disposable Mongo failpoints")
	}
	admin := resourceRefundAdmin(t, uri)
	for _, boundary := range []string{"decision_rejected", "decision_reply_lost", "before_debit", "debit_journal", "before_finalize", "final_reply_lost"} {
		t.Run(boundary, func(t *testing.T) {
			old, oldPassword := resourceJournalFixture(t, repo)
			old.Gold = 1191 // 43 already escrowed in the prepared auction.
			if err := repo.SaveCharacter(old.Name, old); err != nil {
				t.Fatal(err)
			}
			bidder, password := resourceJournalFixture(t, repo)
			auction := resourceRefundAuction(old)
			if err := repo.CreateAuction(auction); err != nil {
				t.Fatal(err)
			}
			dir := t.TempDir()
			address, crash := compatStartServerWithCrash(t, binary, uri, 100, true, "-save-journal-dir", dir)
			connection := resourceOpenCharacter(t, address, bidder.Name, password)
			townFixtureFireball(t, connection, bidder)
			baseline := resourceCloseAndWait(t, repo, connection, bidder.Name)
			assertTownFixtureSave(t, bidder, baseline, 30)
			connection = resourceOpenCharacter(t, address, bidder.Name, password)
			townFixtureProbe(t, connection, baseline)
			// Baseline bars were saved normally before the deliberate process kill;
			// this does not claim durability for arbitrary unsaved combat ticks.
			collection := ""
			validator := bson.M{}
			failpoint := false
			configure := func(enabled bool) {
				t.Helper()
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if failpoint {
					var mode any = "off"
					command := "insert"
					namespace := "eidolon.auction_bid_operations"
					if enabled {
						mode = "alwaysOn"
					}
					if boundary == "final_reply_lost" {
						command = "update"
						namespace = "eidolon.auctions"
					}
					// Mongo 7 supports namespace filtering. Counting unrelated
					// updates is not a reliable way to select the final write.
					if err := admin.Database("admin").RunCommand(ctx, bson.D{
						{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: mode},
						{Key: "data", Value: bson.M{"failCommands": []string{command}, "namespace": namespace, "writeConcernError": bson.M{"code": 64, "errmsg": "prepared bid acknowledgement failure"}}},
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
			switch boundary {
			case "decision_rejected":
				collection, validator = "auction_bid_operations", bson.M{"deliberate_rejection": true}
			case "decision_reply_lost", "final_reply_lost":
				failpoint = true
			case "before_debit":
				collection, validator = "users", bson.M{"username": bson.M{"$ne": bidder.Name}}
			case "debit_journal":
				collection, validator = "users", bson.M{"$or": bson.A{
					bson.M{"username": bson.M{"$ne": bidder.Name}}, bson.M{"characters": bson.M{"$elemMatch": bson.M{"name": bidder.Name, "gold": 1234}}},
				}}
			case "before_finalize":
				collection, validator = "auctions", bson.M{"$or": bson.A{
					bson.M{"id": bson.M{"$ne": auction.ID}}, bson.M{"bid": 43},
				}}
			}
			configure(true)
			t.Cleanup(func() { configure(false) })
			resourceSend(t, connection, MsgTradingBid, TradingBidPayload{AuctionID: auction.ID, Amount: 50})
			var message string
			resourceReadMessage(t, connection, MsgError, &message)
			if message != "Your bid is awaiting recovery. Please try again shortly." {
				t.Fatalf("wrong bid failure boundary response: %s", message)
			}
			op := pendingAuctionBid(t, repo, auction.ID)
			if boundary == "decision_rejected" {
				if op != nil {
					t.Fatal("rejected decision was persisted")
				}
			} else if op == nil || op.Amount != 50 || op.PlayerID != "player-"+bidder.Name {
				t.Fatal("durable decision missing at crash boundary")
			}
			before, err := repo.GetCharacter(bidder.Name, bidder.Name)
			if err != nil {
				t.Fatal(err)
			}
			wantGold, wantBid := 1234, 43
			if boundary == "before_finalize" || boundary == "final_reply_lost" {
				wantGold = 1184
			}
			if boundary == "final_reply_lost" {
				wantBid = 50
			}
			current, err := repo.GetAuction(auction.ID)
			if err != nil || before.Gold != wantGold || current.Bid != wantBid {
				t.Fatalf("fault missed intended boundary: gold=%d want=%d bid=%d want=%d auctionError=%v", before.Gold, wantGold, current.Bid, wantBid, err)
			}
			if wantGold == 1184 && before.GoldCreditReceipts["bid:"+op.ID] != -50 {
				t.Fatal("committed debit has no receipt")
			}
			assertTownMarketResources(t, baseline, before, 0)
			durable := before
			journal, err := database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			pending, err := journal.Read(bidder.Name)
			if err != nil {
				t.Fatal(err)
			}
			if pending != nil && pending.SaveID != before.LastSaveID {
				durable, err = pending.Character()
				if err != nil {
					t.Fatal(err)
				}
				assertTownMarketResources(t, baseline, durable, 0)
			}
			if boundary == "debit_journal" {
				journal, err := database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				pending, err := journal.Read(bidder.Name)
				if err != nil || pending == nil {
					t.Fatal("uncommitted debit has no durable journal")
				}
				value, err := pending.Character()
				if err != nil || value.Gold != 1184 || value.GoldCreditReceipts["bid:"+op.ID] != -50 {
					t.Fatal("journaled debit/receipt boundary missing")
				}
			}
			crash()
			configure(false)
			oldResources := old
			for phase := 101; phase < 103; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				if pendingAuctionBid(t, repo, auction.ID) != nil {
					t.Fatal("startup admitted players before recovering the bid decision")
				}
				restored, err := repo.GetCharacter(bidder.Name, bidder.Name)
				if err != nil || !reflect.DeepEqual(restored.Resources, durable.Resources) || !reflect.DeepEqual(restored.WellRested, durable.WellRested) {
					t.Fatal("bid recovery changed durable resources/rest before login")
				}
				oldRestored, err := repo.GetCharacter(old.Name, old.Name)
				if err != nil || !reflect.DeepEqual(oldRestored.Resources, oldResources.Resources) || !reflect.DeepEqual(oldRestored.WellRested, oldResources.WellRested) {
					t.Fatal("offline escrow refund changed the previous bidder's resources/rest")
				}
				connection := resourceOpenCharacter(t, address, bidder.Name, password)
				townFixtureProbe(t, connection, restored)
				saved := resourceCloseAndWait(t, repo, connection, bidder.Name)
				assertTownMarketResources(t, restored, saved, 0)
				oldConnection := resourceOpenCharacter(t, address, old.Name, oldPassword)
				townFixtureProbe(t, oldConnection, oldRestored)
				oldSaved := resourceCloseAndWait(t, repo, oldConnection, old.Name)
				assertTownMarketResources(t, oldRestored, oldSaved, 0)
				current, err := repo.GetAuction(auction.ID)
				if err != nil {
					t.Fatal(err)
				}
				if boundary == "decision_rejected" {
					if saved.Gold != 1234 || oldSaved.Gold != 1191 || current.Bid != 43 || len(saved.GoldCreditReceipts) != 0 {
						t.Fatal("rejected decision changed funds on recovery")
					}
				} else {
					if saved.Gold != 1184 || oldSaved.Gold != 1234 || current.Bid != 50 || current.LastBidOperationID != op.ID ||
						saved.GoldCreditReceipts["bid:"+op.ID] != -50 || oldSaved.GoldCreditReceipts[op.RefundID] != 43 || len(current.PendingRefunds) != 0 {
						t.Fatal("recovery duplicated/lost bid debit, preceding escrow refund or final marker")
					}
				}
				if saved.XP != bidder.XP || saved.Level != bidder.Level || oldSaved.XP != old.XP || oldSaved.Level != old.Level ||
					!reflect.DeepEqual(saved.Equipment, bidder.Equipment) || !reflect.DeepEqual(oldSaved.Equipment, old.Equipment) {
					t.Fatal("bid recovery changed saved resources/equipment")
				}
				stop()
				durable, oldResources = saved, oldSaved
			}
		})
	}
}
