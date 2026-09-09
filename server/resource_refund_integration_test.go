package main

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func resourceRefundAuction(fixture *database.Character) *database.Auction {
	return &database.Auction{ID: fmt.Sprintf("refund-%d", time.Now().UnixNano()),
		SellerID: "player-prepared-seller", SellerName: "prepared-seller", Status: "ACTIVE",
		BidderID: "player-" + fixture.Name, BidderName: fixture.Name, Bid: 43, Buyout: 500,
		EndTime: time.Now().Add(time.Hour), Item: database.Item{ID: "prepared-auction-item", Stack: 1, MaxStack: 1}}
}

func resourceWaitRefundAuction(t *testing.T, repo *database.DB, id string, wanted func(*database.Auction) bool) *database.Auction {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		auctions, err := repo.LoadAuctions()
		if err != nil {
			t.Fatal(err)
		}
		for _, auction := range auctions {
			if auction.ID == id && wanted(auction) {
				return auction
			}
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatal("expected durable auction state never arrived")
	return nil
}

// Explicit prepared escrow and saved-resource fixture. Startup must replay the
// older never-committed character snapshot before applying an offline refund.
func TestResourceActualOfflineRefundOrdersPendingSnapshot(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	fixture.Gold = 900
	fixture.Resources = &database.CharacterResources{Version: 1, Dead: true}
	fixture.WellRested = &database.CharacterWellRested{Version: 1, RemainingSeconds: 123.456789}
	if _, err := journal.Write(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	auction := resourceRefundAuction(fixture)
	auction.BidderID, auction.BidderName, auction.Bid = "player-next-bidder", "next-bidder", 50
	refund := database.AuctionRefund{ID: "offline-" + auction.ID, PlayerID: "player-" + fixture.Name, CharacterName: fixture.Name, Amount: 43}
	auction.PendingRefunds = []database.AuctionRefund{refund}
	if err := repo.CreateAuction(auction); err != nil {
		t.Fatal(err)
	}
	for phase := 70; phase < 73; phase++ {
		address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
		resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool { return len(a.PendingRefunds) == 0 })
		connection := resourceOpenCharacter(t, address, fixture.Name, password)
		resourceProbe(t, connection, 0, true)
		saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
		if saved.Gold != 943 || saved.GoldCreditReceipts[refund.ID] != 43 ||
			!reflect.DeepEqual(saved.Resources, fixture.Resources) || !reflect.DeepEqual(saved.WellRested, fixture.WellRested) || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) {
			t.Fatal("offline refund lost/duplicated credit or overwrote pending dead/resource/gear snapshot")
		}
		stop()
	}
}

// Ordinary bid displaces prepared escrow. Faults are real Mongo validators on
// ONLY the opted-in disposable database: user save rejection, or an auction
// acknowledgement rejection after successful credit. Neither is a network outage.
func TestResourceActualOutbidRefundSurvivesSaveAndAcknowledgementFailure(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	admin, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Disconnect(context.Background()) })
	for _, fault := range []string{"character_save", "refund_ack"} {
		t.Run(fault, func(t *testing.T) {
			fixture, password := resourceJournalFixture(t, repo)
			fixture.Gold -= 43 // Prepared already-escrowed previous bid.
			if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
				t.Fatal(err)
			}
			bidder, bidderPassword := resourceJournalFixture(t, repo)
			auction := resourceRefundAuction(fixture)
			if err := repo.CreateAuction(auction); err != nil {
				t.Fatal(err)
			}
			dir := t.TempDir()
			address, stop := compatStartServer(t, binary, uri, 74, "-save-journal-dir", dir)
			connection := resourceOpenCharacter(t, address, fixture.Name, password)
			townFixtureFireball(t, connection, fixture)
			bidConnection := resourceOpenCharacter(t, address, bidder.Name, bidderPassword)
			collection, validator := "users", bson.M{"$or": bson.A{
				bson.M{"username": bson.M{"$ne": fixture.Name}}, bson.M{"refund_fault_probe": bson.M{"$exists": true}},
			}}
			if fault == "refund_ack" {
				collection, validator = "auctions", bson.M{"pending_refunds.0": bson.M{"$exists": true}}
			}
			setValidator := func(value bson.M) {
				t.Helper()
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if err := admin.Database("eidolon").RunCommand(ctx, bson.D{
					{Key: "collMod", Value: collection}, {Key: "validator", Value: value},
					{Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"},
				}).Err(); err != nil {
					t.Fatal(err)
				}
			}
			setValidator(validator)
			t.Cleanup(func() { setValidator(bson.M{}) })
			resourceSend(t, bidConnection, MsgTradingBid, TradingBidPayload{AuctionID: auction.ID, Amount: 50})
			var result string
			resourceReadMessage(t, bidConnection, MsgError, &result) // Existing protocol sends its success notice here.
			if result != "Bid placed!" {
				t.Fatalf("ordinary bid failed: %+v", result)
			}
			pendingAuction := resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool {
				return a.BidderID == "player-"+bidder.Name && a.Bid == 50 && len(a.PendingRefunds) == 1
			})
			refund := pendingAuction.PendingRefunds[0]
			if fault == "refund_ack" {
				// Shutdown now seals new refund admission. Observe the intended
				// post-payment fault boundary before stopping; do not assume a
				// merely queued delivery has already committed the recipient.
				paid := false
				deadline := time.Now().Add(10 * time.Second)
				for time.Now().Before(deadline) {
					current, err := repo.GetCharacter(fixture.Name, fixture.Name)
					if err != nil {
						t.Fatal(err)
					}
					if current.Gold == 1234 && current.GoldCreditReceipts[refund.ID] == 43 {
						paid = true
						break
					}
					time.Sleep(25 * time.Millisecond)
				}
				if !paid {
					t.Fatal("refund acknowledgement fault never reached the durable-payment boundary")
				}
			}
			// Shutdown drains the ordinary queued refund/save work while the fault
			// stays active. Failed writes must leave both recovery records intact.
			stop()
			stillPending := resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool { return len(a.PendingRefunds) == 1 })
			if stillPending.PendingRefunds[0] != refund {
				t.Fatal("failed refund intent changed")
			}
			before, err := repo.GetCharacter(fixture.Name, fixture.Name)
			if err != nil {
				t.Fatal(err)
			}
			if fault == "character_save" && before.Gold != 1191 {
				t.Fatal("write rejection did not retain prior database gold")
			}
			if fault == "refund_ack" && (before.Gold != 1234 || before.GoldCreditReceipts[refund.ID] != 43) {
				t.Fatal("ack failure did not occur after durable credit")
			}
			durable := before
			journal, err := database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			pending, err := journal.Read(fixture.Name)
			if err != nil {
				t.Fatal(err)
			}
			if pending != nil && pending.SaveID != before.LastSaveID {
				durable, err = pending.Character()
				if err != nil {
					t.Fatal(err)
				}
			}
			assertTownMarketResources(t, fixture, durable, 30)
			bidDurable, err := repo.GetCharacter(bidder.Name, bidder.Name)
			if err != nil {
				t.Fatal(err)
			}
			assertTownMarketResources(t, bidder, bidDurable, 0)
			setValidator(bson.M{})
			for phase := 75; phase < 77; phase++ {
				address, stopRecovered := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool { return len(a.PendingRefunds) == 0 })
				restored, err := repo.GetCharacter(fixture.Name, fixture.Name)
				if err != nil || !reflect.DeepEqual(restored.Resources, durable.Resources) || !reflect.DeepEqual(restored.WellRested, durable.WellRested) {
					t.Fatal("refund recovery changed exact durable resources/rest before login")
				}
				bidRestored, err := repo.GetCharacter(bidder.Name, bidder.Name)
				if err != nil || !reflect.DeepEqual(bidRestored.Resources, bidDurable.Resources) || !reflect.DeepEqual(bidRestored.WellRested, bidDurable.WellRested) {
					t.Fatal("refund recovery changed winning bidder's offline resources/rest")
				}
				connection := resourceOpenCharacter(t, address, fixture.Name, password)
				townFixtureProbe(t, connection, restored)
				saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
				assertTownMarketResources(t, restored, saved, 0)
				if saved.Gold != 1234 || saved.GoldCreditReceipts[refund.ID] != 43 || saved.Level != fixture.Level || saved.XP != fixture.XP ||
					!reflect.DeepEqual(saved.Equipment, fixture.Equipment) {
					t.Fatal("recovered outbid refund duplicated/lost gold or resources/gear")
				}
				bidConnection := resourceOpenCharacter(t, address, bidder.Name, bidderPassword)
				townFixtureProbe(t, bidConnection, bidRestored)
				bidSaved := resourceCloseAndWait(t, repo, bidConnection, bidder.Name)
				assertTownMarketResources(t, bidRestored, bidSaved, 0)
				if bidSaved.Gold != 1184 {
					t.Fatal("winning bid debit changed across controlled restart")
				}
				stopRecovered()
				durable, bidDurable = saved, bidSaved
			}
		})
	}
}
