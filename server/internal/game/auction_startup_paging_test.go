package game

import (
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func auctionStartupPages(t *testing.T, count int) ([]*database.Auction, []database.AuctionBidOperation) {
	t.Helper()
	auctions := make([]*database.Auction, count)
	decisions := make([]database.AuctionBidOperation, count)
	for i := range auctions {
		id := fmt.Sprintf("auction-%04d", i)
		auctions[i] = &database.Auction{ID: id, SellerID: "player-owner", Status: "SOLD", ItemClaimed: true,
			LastBidOperationID: "saved-intent", PendingRefunds: []database.AuctionRefund{{ID: id + "-refund", Amount: 17, PlayerID: "player-owner", CharacterName: "owner"}}}
		decisions[i] = database.AuctionBidOperation{ID: fmt.Sprintf("decision-%04d", i), AuctionID: id,
			PlayerID: "player-owner", CharacterName: "owner", Amount: 43, EndTime: time.Date(2026, 10, 4, 1, 0, 0, 0, time.UTC)}
	}
	return auctions, decisions
}

func TestAuctionPagedStartupRetainsAllClaimsRefundsAndLegacyDecisions(t *testing.T) {
	auctions, decisions := auctionStartupPages(t, 100)
	ts := NewTradingSystem(nil)
	auctionCalls, decisionCalls := 0, 0
	ts.loadAuctionPages(func(after string, limit int) ([]*database.Auction, error) {
		if limit != 50 || auctionCalls > 0 && after != auctions[auctionCalls*50-1].ID {
			t.Fatal("auction startup lost its page bound/cursor", after, limit)
		}
		start := auctionCalls * 50
		auctionCalls++
		return auctions[start:min(start+limit, len(auctions))], nil
	})
	ts.loadBidOperationPages(func(after string, limit int) ([]database.AuctionBidOperation, error) {
		if limit != 50 || decisionCalls > 0 && after != decisions[decisionCalls*50-1].ID {
			t.Fatal("decision startup lost its page bound/cursor", after, limit)
		}
		start := decisionCalls * 50
		decisionCalls++
		return decisions[start:min(start+limit, len(decisions))], nil
	})
	// Exactly two full pages require a third, empty terminal query.
	if ts.ReadinessError() != nil || auctionCalls != 3 || decisionCalls != 3 || len(ts.Auctions) != 100 || len(ts.pendingBids) != 100 || pendingRefundCount(ts) != 100 {
		t.Fatal("startup truncated outstanding state", auctionCalls, decisionCalls, ts.ReadinessError())
	}
	for i, saved := range auctions {
		actual := ts.Auctions[saved.ID]
		if actual.Status != AuctionSold || !actual.ItemClaimed || actual.SellerClaimed || actual.LastBidOperationID != saved.LastBidOperationID ||
			!reflect.DeepEqual(actual.PendingRefunds, saved.PendingRefunds) || ts.pendingBids[saved.ID] != decisions[i] {
			t.Fatal("startup changed private claims/refunds/frozen decisions", saved.ID)
		}
	}
}

func TestAuctionPagedStartupFailuresNeverPublishPartialState(t *testing.T) {
	auctions, decisions := auctionStartupPages(t, 51)
	unavailable := errors.New("second page unavailable")
	for _, kind := range []string{"auction", "decision", "missing auction", "conflicting auction", "invalid decision", "oversized page", "repeated cursor"} {
		t.Run(kind, func(t *testing.T) {
			ts := NewTradingSystem(nil)
			original := &Auction{ID: "original", PendingRefunds: []database.AuctionRefund{{ID: "original-refund", Amount: 9}}}
			ts.Auctions[original.ID] = original
			ts.pendingBids[original.ID] = database.AuctionBidOperation{ID: "original-decision"}
			if kind == "auction" || kind == "oversized page" || kind == "repeated cursor" {
				ts.loadAuctionPages(func(after string, _ int) ([]*database.Auction, error) {
					if kind == "oversized page" {
						return auctions, nil
					}
					if after == "" {
						return auctions[:50], nil
					}
					if kind == "repeated cursor" {
						return auctions[:1], nil
					}
					return nil, unavailable
				})
			} else {
				// Existing market state is the reference for pending decisions.
				for _, a := range auctions {
					ts.Auctions[a.ID] = ts.fromDBAuction(a)
				}
				ts.loadBidOperationPages(func(after string, _ int) ([]database.AuctionBidOperation, error) {
					if after == "" {
						return decisions[:50], nil
					}
					last := decisions[50]
					switch kind {
					case "missing auction":
						last.AuctionID = "missing"
					case "conflicting auction":
						last.AuctionID = decisions[0].AuctionID
					case "invalid decision":
						last.Kind = "unknown"
					default:
						return nil, unavailable
					}
					return []database.AuctionBidOperation{last}, nil
				})
			}
			if ts.ReadinessError() == nil || ts.RetryPendingRefunds() == nil || ts.Auctions[original.ID] != original || len(ts.pendingBids) != 1 || ts.pendingBids[original.ID].ID != "original-decision" {
				t.Fatal("failed paged startup published partial state or allowed refund delivery")
			}
		})
	}
}
