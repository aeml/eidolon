package database

import (
	"testing"
	"time"
)

func listingTimeFixture() AuctionBidOperation {
	start := time.Date(2026, 9, 8, 12, 0, 0, 0, time.UTC)
	return AuctionBidOperation{ID: "listing-op", AuctionID: "auction", Kind: AuctionOperationListing,
		PlayerID: "player-seller", CharacterName: "seller", Amount: 25,
		ItemPayload: `{"id":"earned-item","name":"Earned Item","stack":1,"maxStack":1}`,
		ListingBid:  100, ListingBuyout: 500, ListingHours: 24, ListingStart: start, EndTime: start.Add(24 * time.Hour)}
}

func TestAuctionListingFullDurationStartsAtPublication(t *testing.T) {
	op := listingTimeFixture()
	for _, delay := range []time.Duration{0, time.Minute, 3 * 24 * time.Hour} {
		published := op.ListingStart.Add(delay)
		a, err := AuctionFromListingOperation(op, published)
		if err != nil || !a.StartTime.Equal(published) || !a.EndTime.Equal(published.Add(24*time.Hour)) {
			t.Fatal("publication delay consumed listing duration", delay, a, err)
		}
		if !matchesPublishedListing(op, a) {
			t.Fatal("replay rejected first publication")
		}
	}
	if _, err := AuctionFromListingOperation(op, time.Time{}); err == nil {
		t.Fatal("missing publication time accepted")
	}
	a, err := AuctionFromListingOperation(op, op.ListingStart.Add(-time.Hour))
	if err != nil || !a.StartTime.Equal(op.ListingStart) {
		t.Fatal("backwards clock published before preparation", a, err)
	}
}

func TestAuctionListingReplayMatchesStoredWindowAndExactTerms(t *testing.T) {
	op := listingTimeFixture()
	a, err := AuctionFromListingOperation(op, op.ListingStart.Add(72*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"start", "end", "duration", "deposit", "item", "bid", "buyout", "status", "owner", "receipt", "claimed"} {
		t.Run(mode, func(t *testing.T) {
			changed := *a
			switch mode {
			case "start":
				changed.StartTime = op.ListingStart.Add(-time.Hour)
				changed.EndTime = changed.StartTime.Add(24 * time.Hour)
			case "end":
				changed.EndTime = changed.EndTime.Add(time.Hour)
			case "duration":
				changed.Duration++
			case "deposit":
				changed.Deposit++
			case "item":
				changed.Item.ID = "different-item"
			case "bid":
				changed.Bid++
			case "buyout":
				changed.Buyout++
			case "status":
				changed.Status = "EXPIRED"
			case "owner":
				changed.SellerID = "player-other"
			case "receipt":
				changed.LastBidOperationID = "other-op"
			case "claimed":
				changed.ItemClaimed = true
			}
			if matchesPublishedListing(op, &changed) {
				t.Fatal("conflicting published listing accepted")
			}
		})
	}
	if matchesPublishedListing(op, nil) {
		t.Fatal("missing publication accepted")
	}
	// A listing created by the earlier candidate at preparation time remains
	// recoverable without extending its window or rejecting an existing owner.
	legacy, err := AuctionFromListingOperation(op, op.ListingStart)
	if err != nil || !matchesPublishedListing(op, legacy) {
		t.Fatal("existing preparation-time publication lost")
	}
}
