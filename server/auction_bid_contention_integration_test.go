package main

import (
	"reflect"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"github.com/gorilla/websocket"
)

// Starting escrow is prepared; every raise/competing request uses ordinary
// authenticated sockets. No production player data or server test hooks.
func TestAuctionBidActualRaisesAndCompetingRequests(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	for _, mode := range []string{"same_bidder", "competing_bidders"} {
		t.Run(mode, func(t *testing.T) {
			old, oldPassword := resourceJournalFixture(t, repo)
			old.Gold = 1191 // Prepared 43-gold escrow; total wealth is 1234.
			if err := repo.SaveCharacter(old.Name, old); err != nil {
				t.Fatal(err)
			}
			auction := resourceRefundAuction(old)
			if err := repo.CreateAuction(auction); err != nil {
				t.Fatal(err)
			}
			dir := t.TempDir()
			address, stop := compatStartServer(t, binary, uri, 110, "-save-journal-dir", dir)
			fixtures := []*database.Character{old}
			passwords := []string{oldPassword}
			connections := []*websocket.Conn{resourceOpenCharacter(t, address, old.Name, oldPassword)}
			wantedGold := []int{1174}
			wantedReceipts := []int{4} // Two signed debits and two displaced-bid refunds.
			winner, finalAmount := 0, 60
			if mode == "same_bidder" {
				for _, amount := range []int{50, 60} {
					resourceSend(t, connections[0], MsgTradingBid, TradingBidPayload{AuctionID: auction.ID, Amount: amount})
					var reply string
					resourceReadMessage(t, connections[0], MsgError, &reply)
					if reply != "Bid placed!" {
						t.Fatalf("ordinary same-bidder raise failed: %s", reply)
					}
					resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool {
						return a.Bid == amount && len(a.PendingRefunds) == 0
					})
				}
			} else {
				for i := 0; i < 2; i++ {
					fixture, password := resourceJournalFixture(t, repo)
					fixtures, passwords = append(fixtures, fixture), append(passwords, password)
					connections = append(connections, resourceOpenCharacter(t, address, fixture.Name, password))
				}
				// Independent writers are released together; read each socket only
				// from the test goroutine so a transport race cannot fake contention.
				start, sent := make(chan struct{}), make(chan error, 2)
				for _, connection := range connections[1:] {
					go func(c *websocket.Conn) {
						<-start
						sent <- c.WriteJSON(map[string]any{"type": MsgTradingBid,
							"payload": TradingBidPayload{AuctionID: auction.ID, Amount: 50}})
					}(connection)
				}
				close(start)
				for i := 0; i < 2; i++ {
					if err := <-sent; err != nil {
						t.Fatal(err)
					}
				}
				accepted := 0
				for i := 1; i < len(connections); i++ {
					var reply string
					resourceReadMessage(t, connections[i], MsgError, &reply)
					if reply == "Bid placed!" {
						accepted++
						winner = i
					} else if reply != "auction bid is still being saved; please retry shortly" && !strings.HasPrefix(reply, "bid too low") {
						t.Fatalf("unexpected competing bid result: %s", reply)
					}
				}
				if accepted != 1 {
					t.Fatalf("competing equal bids accepted %d winners", accepted)
				}
				finalAmount = 50
				wantedGold, wantedReceipts = []int{1234, 1234, 1234}, []int{1, 0, 0}
				wantedGold[winner], wantedReceipts[winner] = 1184, 1
			}
			settled := resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool {
				return a.Bid == finalAmount && len(a.PendingRefunds) == 0
			})
			if settled.BidderID != "player-"+fixtures[winner].Name || settled.LastBidOperationID == "" || pendingAuctionBid(t, repo, auction.ID) != nil {
				t.Fatal("winning bid was not fully settled")
			}
			// A repeated already accepted request must neither charge nor refund again.
			resourceSend(t, connections[winner], MsgTradingBid, TradingBidPayload{AuctionID: auction.ID, Amount: finalAmount})
			var repeated string
			resourceReadMessage(t, connections[winner], MsgError, &repeated)
			if !strings.HasPrefix(repeated, "bid too low") {
				t.Fatalf("repeated request was not rejected: %s", repeated)
			}
			var firstSaves []*database.Character
			check := func(saved, fixture, resources *database.Character, i int) {
				t.Helper()
				assertTownMarketResources(t, resources, saved, 0)
				if saved.Gold != wantedGold[i] || len(saved.GoldCreditReceipts) != wantedReceipts[i] ||
					!reflect.DeepEqual(saved.Equipment, fixture.Equipment) ||
					saved.Level != fixture.Level || saved.XP != fixture.XP {
					t.Fatalf("%s participant%d lost/duplicated funds, receipts or character state", mode, i)
				}
				if i == winner && saved.GoldCreditReceipts["bid:"+settled.LastBidOperationID] != -finalAmount {
					t.Fatal("winning debit receipt does not match the settled operation")
				}
			}
			for i, connection := range connections {
				saved := resourceCloseAndWait(t, repo, connection, fixtures[i].Name)
				check(saved, fixtures[i], fixtures[i], i)
				firstSaves = append(firstSaves, saved)
			}
			stop()
			address, stopRecovered := compatStartServer(t, binary, uri, 111, "-save-journal-dir", dir)
			for i, fixture := range fixtures {
				restored, err := repo.GetCharacter(fixture.Name, fixture.Name)
				if err != nil || !reflect.DeepEqual(restored.Resources, firstSaves[i].Resources) || !reflect.DeepEqual(restored.WellRested, firstSaves[i].WellRested) {
					t.Fatal("contention restart changed durable resources/rest before login")
				}
				connection := resourceOpenCharacter(t, address, fixture.Name, passwords[i])
				townFixtureProbe(t, connection, restored)
				saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
				check(saved, fixture, restored, i)
				if !reflect.DeepEqual(saved.GoldCreditReceipts, firstSaves[i].GoldCreditReceipts) || !reflect.DeepEqual(saved.Inventory, firstSaves[i].Inventory) {
					t.Fatal("restart changed receipts or inventory")
				}
			}
			stopRecovered()
		})
	}
}
