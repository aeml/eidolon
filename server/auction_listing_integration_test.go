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

func auctionListingFixture(t *testing.T, repo *database.DB, mode string) (*database.Character, string, database.Item) {
	t.Helper()
	p, password := resourceJournalFixture(t, repo)
	item := database.Item{ID: "earned-listing-item", Name: "Earned Listing Item", Type: "WEAPON", Rarity: "EPIC", Level: 70, Potency: 3,
		Stack: 1, MaxStack: 1, Stats: map[string]int{"wisdom": 4}, StatScaleVersion: game.ItemStatScaleVersion, Icon: "staff", Description: "Keep the complete earned item"}
	if mode == "stack" {
		item.Type = "MATERIAL"
		item.Stack = 7
		item.MaxStack = 10
	}
	if mode == "legacy" {
		item.Stats = map[string]int{"wisdom": 100}
		item.StatScaleVersion = 0
	}
	if mode == "bound" {
		item.ID = "chronicle-item-bound"
	}
	if mode == "insufficient" {
		p.Gold = 24
	}
	p.Inventory = []database.Item{item}
	if err := repo.SaveCharacter(p.Name, p); err != nil {
		t.Fatal(err)
	}
	expected := item
	if mode == "legacy" {
		expected.Stats = map[string]int{"wisdom": 4}
		expected.StatScaleVersion = game.ItemStatScaleVersion
	}
	return p, password, expected
}

func listingAuctions(t *testing.T, repo *database.DB, name string) []*database.Auction {
	t.Helper()
	all, err := repo.LoadAuctions()
	if err != nil {
		t.Fatal(err)
	}
	var found []*database.Auction
	for _, a := range all {
		if a.SellerID == "player-"+name {
			found = append(found, a)
		}
	}
	return found
}

func listingDecision(t *testing.T, repo *database.DB, name string) *database.AuctionBidOperation {
	t.Helper()
	ops, err := repo.LoadAuctionBidOperations()
	if err != nil {
		t.Fatal(err)
	}
	var found *database.AuctionBidOperation
	for _, op := range ops {
		if op.PlayerID == "player-"+name {
			if found != nil {
				t.Fatal("multiple listing decisions for one request")
			}
			copy := op
			found = &copy
		}
	}
	return found
}

func verifyListingState(t *testing.T, repo *database.DB, baseline *database.Character, item database.Item, published bool, resources *database.Character, manaSpent int) *database.Auction {
	t.Helper()
	saved, err := repo.GetCharacter(baseline.Name, baseline.Name)
	if err != nil {
		t.Fatal(err)
	}
	gold := baseline.Gold
	if published {
		gold -= 25
	}
	assertTownMarketResources(t, resources, saved, manaSpent)
	if saved.Gold != gold || saved.Resources == nil || saved.Resources.Dead ||
		saved.XP != baseline.XP || saved.Level != baseline.Level || !reflect.DeepEqual(saved.Equipment, baseline.Equipment) {
		t.Fatal("listing changed resources/gear/progression or deposit")
	}
	auctions := listingAuctions(t, repo, baseline.Name)
	if !published {
		if len(auctions) != 0 || len(saved.Inventory) != 1 || !reflect.DeepEqual(saved.Inventory[0], item) || len(saved.ItemDeliveryReceipts) != 0 || len(saved.GoldCreditReceipts) != 0 {
			t.Fatal("unpublished listing lost item or charged deposit")
		}
		return nil
	}
	if len(auctions) != 1 {
		t.Fatal("listing duplicated or missing")
	}
	a := auctions[0]
	if len(saved.Inventory) != 0 || len(saved.ItemDeliveryReceipts) != 1 || saved.ItemDeliveryReceipts[a.LastBidOperationID] == "" ||
		len(saved.GoldCreditReceipts) != 1 || saved.GoldCreditReceipts["listing:"+a.LastBidOperationID] != -25 {
		t.Fatal("listing lacks exact escrow receipt pair")
	}
	if a.Status != "ACTIVE" || a.ItemClaimed || a.SellerClaimed || a.Deposit != 25 || a.Bid != 100 || a.Buyout != 500 || a.Duration != 24 ||
		!a.EndTime.Equal(a.StartTime.Add(24*time.Hour)) || !reflect.DeepEqual(a.Item, item) || a.LastBidOperationID == "" {
		t.Fatalf("published listing differs from intended item/terms: %+v", a)
	}
	return a
}

func TestAuctionListingActualNormalAndRejections(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	for _, mode := range []string{"gear", "stack", "legacy", "insufficient", "bound", "invalid_price", "stale_item", "stale_stack", "missing_selection"} {
		t.Run(mode, func(t *testing.T) {
			p, password, item := auctionListingFixture(t, repo, mode)
			dir := t.TempDir()
			published := mode == "gear" || mode == "stack" || mode == "legacy"
			resources := p
			for phase := 150; phase < 152; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				connection := resourceOpenCharacter(t, address, p.Name, password)
				manaSpent := 0
				if phase == 150 {
					townFixtureFireball(t, connection, resources)
					manaSpent = 30
				} else {
					townFixtureProbe(t, connection, resources)
				}
				payload := TradingCreatePayload{SlotIndex: 0, Bid: 100, Buyout: 500, Duration: 24, ExpectedItemID: item.ID, ExpectedStack: item.Stack}
				switch mode {
				case "stale_item":
					payload.ExpectedItemID = "previously-selected-item"
				case "stale_stack":
					payload.ExpectedStack++
				case "missing_selection":
					payload.ExpectedItemID, payload.ExpectedStack = "", 0
				}
				if mode == "invalid_price" {
					payload.Bid = 501
				}
				resourceSend(t, connection, MsgTradingCreate, payload)
				if published && phase == 150 {
					var list []game.Auction
					resourceReadMessage(t, connection, "trading_my_list", &list)
					if len(list) != 1 {
						t.Fatal("ordinary listing response missing")
					}
					a := verifyListingState(t, repo, p, item, true, resources, manaSpent) // Reply requires already-durable latest cast and escrow.
					if list[0].ID != a.ID {
						t.Fatal("response refers to wrong listing")
					}
				} else {
					var reply string
					resourceReadMessage(t, connection, MsgError, &reply)
					want := "No item in slot"
					switch mode {
					case "insufficient":
						want = database.ErrInsufficientGold.Error()
					case "bound":
						want = "Chronicle artifacts are soulbound"
					case "invalid_price":
						want = "invalid price"
					case "stale_item", "stale_stack", "missing_selection":
						want = game.ErrAuctionListingItemUnavailable.Error()
					}
					if reply != want {
						t.Fatal("unexpected listing rejection", reply, want)
					}
				}
				saved := resourceCloseAndWait(t, repo, connection, p.Name)
				verifyListingState(t, repo, p, item, published, resources, manaSpent)
				if listingDecision(t, repo, p.Name) != nil {
					t.Fatal("completed request retained decision")
				}
				stop()
				resources = saved
			}
		})
	}
}

func TestAuctionListingActualCrashBoundaries(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	if os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires disposable Mongo failpoints")
	}
	admin := resourceRefundAdmin(t, uri)
	for _, boundary := range []string{"preflight_rejected", "decision_rejected", "decision_reply_lost", "before_escrow", "escrow_journal", "before_publish", "final_reply_lost"} {
		t.Run(boundary, func(t *testing.T) {
			p, password, item := auctionListingFixture(t, repo, "legacy")
			dir := t.TempDir()
			address, crash := compatStartServerWithCrash(t, binary, uri, 154, true, "-save-journal-dir", dir)
			connection := resourceOpenCharacter(t, address, p.Name, password)
			townFixtureFireball(t, connection, p)
			collection, validator := "", bson.M{}
			command, namespace := "", ""
			skip := false
			switch boundary {
			case "preflight_rejected":
				collection, validator = "users", bson.M{"username": bson.M{"$ne": p.Name}}
			case "decision_rejected":
				collection, validator = "auction_bid_operations", bson.M{"deliberate_rejection": true}
			case "decision_reply_lost":
				command, namespace = "insert", "eidolon.auction_bid_operations"
			case "before_escrow":
				command, namespace, skip = "update", "eidolon.users", true
			case "escrow_journal":
				collection, validator = "users", bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": p.Name}}, bson.M{"characters": bson.M{"$elemMatch": bson.M{"name": p.Name, "gold": 1234}}}}}
			case "before_publish":
				collection, validator = "auctions", bson.M{"deliberate_rejection": true}
			case "final_reply_lost":
				command, namespace = "insert", "eidolon.auctions"
			}
			configure := func(enabled bool) {
				t.Helper()
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if command != "" {
					var mode any = "off"
					if enabled {
						mode = "alwaysOn"
						if skip {
							mode = bson.M{"skip": 1}
						}
					}
					data := bson.M{"failCommands": []string{command}, "namespace": namespace, "writeConcernError": bson.M{"code": 64, "errmsg": "prepared listing acknowledgement failure"}}
					if skip {
						delete(data, "writeConcernError")
						data["errorCode"] = 121
					}
					if err := admin.Database("admin").RunCommand(ctx, bson.D{{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: mode}, {Key: "data", Value: data}}).Err(); err != nil {
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
			resourceSend(t, connection, MsgTradingCreate, TradingCreatePayload{SlotIndex: 0, Bid: 100, Buyout: 500, Duration: 24, ExpectedItemID: item.ID, ExpectedStack: item.Stack})
			var reply string
			resourceReadMessage(t, connection, MsgError, &reply)
			if reply != "Your auction listing is awaiting recovery. Please try again shortly." {
				t.Fatal("fault missed listing", reply)
			}
			op := listingDecision(t, repo, p.Name)
			rejected := boundary == "preflight_rejected" || boundary == "decision_rejected"
			if rejected {
				if op != nil {
					t.Fatal("rejected decision committed")
				}
			} else if op == nil || op.Kind != database.AuctionOperationListing || !op.Valid() {
				t.Fatal("durable listing decision missing")
			}
			before, err := repo.GetCharacter(p.Name, p.Name)
			if err != nil {
				t.Fatal(err)
			}
			escrowed := boundary == "before_publish" || boundary == "final_reply_lost"
			gold := 1234
			inventoryCount := 1
			if escrowed {
				gold = 1209
				inventoryCount = 0
			}
			if before.Gold != gold || len(before.Inventory) != inventoryCount || len(before.ItemDeliveryReceipts) != 1-inventoryCount || len(before.GoldCreditReceipts) != 1-inventoryCount {
				t.Fatal("fault missed escrow boundary")
			}
			if boundary != "preflight_rejected" {
				assertTownMarketResources(t, p, before, 30)
				if !escrowed && !reflect.DeepEqual(before.Inventory[0], item) {
					t.Fatal("decision preceded complete current-bag save")
				}
			} else if !reflect.DeepEqual(before.Resources, p.Resources) || !reflect.DeepEqual(before.WellRested, p.WellRested) {
				t.Fatal("rejected preflight changed the older durable resources")
			}
			auctions := listingAuctions(t, repo, p.Name)
			wantListings := 0
			if boundary == "final_reply_lost" {
				wantListings = 1
			}
			if len(auctions) != wantListings {
				t.Fatal("uncommitted escrow became a visible listing")
			}
			durable := before
			if boundary == "escrow_journal" || boundary == "preflight_rejected" {
				journal, err := database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				pending, err := journal.Read(p.Name)
				if err != nil || pending == nil {
					t.Fatal("pending listing snapshot missing")
				}
				saved, err := pending.Character()
				if err != nil {
					t.Fatal(err)
				}
				assertTownMarketResources(t, p, saved, 30)
				durable = saved
				if boundary == "escrow_journal" && (saved.Gold != 1209 || len(saved.Inventory) != 0 || saved.GoldCreditReceipts["listing:"+op.ID] != -25 || saved.ItemDeliveryReceipts[op.ID] == "") {
					t.Fatal("journal separated item/deposit escrow")
				}
			}
			crash()
			configure(false)
			for phase := 155; phase < 157; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				if listingDecision(t, repo, p.Name) != nil {
					t.Fatal("startup admitted before listing recovery")
				}
				restored, err := repo.GetCharacter(p.Name, p.Name)
				if err != nil || !reflect.DeepEqual(restored.Resources, durable.Resources) || !reflect.DeepEqual(restored.WellRested, durable.WellRested) {
					t.Fatal("listing recovery changed durable resources/rest before login")
				}
				connection := resourceOpenCharacter(t, address, p.Name, password)
				townFixtureProbe(t, connection, restored)
				if !rejected {
					resourceSend(t, connection, MsgTradingCreate, TradingCreatePayload{SlotIndex: 0, Bid: 100, Buyout: 500, Duration: 24, ExpectedItemID: item.ID, ExpectedStack: item.Stack})
					resourceReadMessage(t, connection, MsgError, &reply)
					if reply != "No item in slot" {
						t.Fatal("recovered escrow item listed twice", reply)
					}
				}
				saved := resourceCloseAndWait(t, repo, connection, p.Name)
				a := verifyListingState(t, repo, p, item, !rejected, restored, 0)
				if !rejected && (a.ID != op.AuctionID || a.LastBidOperationID != op.ID) {
					t.Fatal("recovery changed immutable listing identity")
				}
				if boundary == "final_reply_lost" && (!a.StartTime.Equal(auctions[0].StartTime) || !a.EndTime.Equal(auctions[0].EndTime)) {
					t.Fatal("acknowledgement recovery extended the already-published listing")
				}
				stop()
				durable = saved
			}
		})
	}
}

func TestAuctionListingActualDelayedPublication(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	admin := resourceRefundAdmin(t, uri)
	p, password, item := auctionListingFixture(t, repo, "legacy")
	dir := t.TempDir()
	address, crash := compatStartServerWithCrash(t, binary, uri, 160, true, "-save-journal-dir", dir)
	connection := resourceOpenCharacter(t, address, p.Name, password)
	townFixtureFireball(t, connection, p)
	configure := func(blocked bool) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		validator := bson.M{}
		if blocked {
			validator["deliberate_rejection"] = true
		}
		if err := admin.Database("eidolon").RunCommand(ctx, bson.D{{Key: "collMod", Value: "auctions"},
			{Key: "validator", Value: validator}, {Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"}}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { configure(false) })
	configure(true)
	resourceSend(t, connection, MsgTradingCreate, TradingCreatePayload{SlotIndex: 0, Bid: 100, Buyout: 500, Duration: 24,
		ExpectedItemID: item.ID, ExpectedStack: item.Stack})
	var reply string
	resourceReadMessage(t, connection, MsgError, &reply)
	if reply != "Your auction listing is awaiting recovery. Please try again shortly." {
		t.Fatal("publication failure missed", reply)
	}
	op := listingDecision(t, repo, p.Name)
	if op == nil || op.Kind != database.AuctionOperationListing || !op.Valid() || len(listingAuctions(t, repo, p.Name)) != 0 {
		t.Fatal("failed publication lost its pending decision or published early")
	}
	before, err := repo.GetCharacter(p.Name, p.Name)
	if err != nil || before.Gold != 1209 || len(before.Inventory) != 0 ||
		before.GoldCreditReceipts["listing:"+op.ID] != -25 || before.ItemDeliveryReceipts[op.ID] == "" {
		t.Fatal("delayed publication did not retain exact committed escrow", err)
	}
	assertTownMarketResources(t, p, before, 30)
	crash()

	// Prepared age fixture: simulate a three-day outage without a three-day test
	// sleep. Only the immutable decision's two preparation timestamps are aged,
	// after the real request, escrow save and process crash. No auction exists.
	op.ListingStart = op.ListingStart.Add(-72 * time.Hour)
	op.EndTime = op.EndTime.Add(-72 * time.Hour)
	if !op.Valid() || !op.EndTime.Before(time.Now()) {
		t.Fatal("aged decision fixture is not valid and overdue")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := admin.Database("eidolon").Collection("auction_bid_operations").UpdateOne(ctx,
		bson.M{"id": op.ID, "auction_id": op.AuctionID},
		bson.M{"$set": bson.M{"listing_start": op.ListingStart, "end_time": op.EndTime}})
	if err != nil || result.MatchedCount != 1 {
		t.Fatal("could not prepare aged durable decision", err)
	}
	configure(false)
	publicationFloor := time.Now().UTC().Truncate(time.Millisecond)
	var published *database.Auction
	durable := before
	for phase := 161; phase < 163; phase++ {
		address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
		restored, err := repo.GetCharacter(p.Name, p.Name)
		if err != nil || !reflect.DeepEqual(restored.Resources, durable.Resources) || !reflect.DeepEqual(restored.WellRested, durable.WellRested) {
			t.Fatal("delayed publication changed durable resources/rest before login")
		}
		a := verifyListingState(t, repo, p, item, true, restored, 0)
		if a.ID != op.AuctionID || a.LastBidOperationID != op.ID || a.StartTime.Before(publicationFloor) ||
			a.StartTime.After(time.Now()) || a.EndTime.Before(time.Now().Add(23*time.Hour)) || listingDecision(t, repo, p.Name) != nil {
			t.Fatal("publication consumed the paid window during the simulated outage")
		}
		if published != nil && (!a.StartTime.Equal(published.StartTime) || !a.EndTime.Equal(published.EndTime)) {
			t.Fatal("restart extended published duration")
		}
		published = a
		connection := resourceOpenCharacter(t, address, p.Name, password)
		resourceSend(t, connection, "trading_my_auctions", struct{}{})
		var list []game.Auction
		resourceReadMessage(t, connection, "trading_my_list", &list)
		if len(list) != 1 || list[0].ID != a.ID || !list[0].StartTime.Equal(a.StartTime) || !list[0].EndTime.Equal(a.EndTime) {
			t.Fatal("ordinary market view did not expose the recovered full-duration listing")
		}
		saved := resourceCloseAndWait(t, repo, connection, p.Name)
		verifyListingState(t, repo, p, item, true, restored, 0)
		stop()
		durable = saved
	}
}
