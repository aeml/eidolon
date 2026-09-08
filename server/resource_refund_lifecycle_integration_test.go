package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func resourceRefundAdmin(t *testing.T, uri string) *mongo.Client {
	t.Helper()
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Disconnect(context.Background()) })
	return client
}

// Test-only Mongo failpoint support is separately opted in and enabled ONLY in
// the owned disposable mongod. A delayed rejected update is not a power loss.
func TestResourceActualRefundBacklogBoundsDelayedDatabaseFailure(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	if os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires explicitly enabled disposable Mongo failpoints")
	}
	admin := resourceRefundAdmin(t, uri)
	fixture, password := resourceJournalFixture(t, repo)
	auction := resourceRefundAuction(fixture)
	auction.BidderID, auction.BidderName, auction.Bid = "player-next", "next", 50
	for i := 0; i < 100; i++ {
		auction.PendingRefunds = append(auction.PendingRefunds, database.AuctionRefund{
			ID: fmt.Sprintf("backlog-%03d", i), PlayerID: "player-" + fixture.Name, CharacterName: fixture.Name, Amount: 1,
		})
	}
	if err := repo.CreateAuction(auction); err != nil {
		t.Fatal(err)
	}
	configure := func(enabled bool) int64 {
		t.Helper()
		mode := "off"
		if enabled {
			mode = "alwaysOn"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var result struct {
			Count int64 `bson:"count"`
		}
		if err := admin.Database("admin").RunCommand(ctx, bson.D{
			{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: mode},
			{Key: "data", Value: bson.M{"failCommands": []string{"update"}, "blockConnection": true, "blockTimeMS": 500, "errorCode": 2}},
		}).Decode(&result); err != nil {
			t.Fatal(err)
		}
		return result.Count
	}
	beforeCount := configure(true)
	t.Cleanup(func() { configure(false) })
	dir := t.TempDir()
	started := time.Now()
	_, stop := compatStartServer(t, binary, uri, 80, "-save-journal-dir", dir)
	if elapsed := time.Since(started); elapsed > 5*time.Second {
		t.Fatalf("startup multiplied delayed failures across refund backlog: %s", elapsed)
	}
	stop() // No new refund admission while draining this still-faulted server.
	if attempts := configure(false) - beforeCount; attempts != 1 {
		t.Fatalf("expected one delayed rejected update, got %d", attempts)
	}
	resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool { return len(a.PendingRefunds) == 100 })
	saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || saved.Gold != 1234 {
		t.Fatal("rejected first refund unexpectedly changed Mongo gold")
	}
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := journal.Read(fixture.Name)
	if err != nil || pending == nil {
		t.Fatal("failed first delivery lost its durable pending snapshot")
	}
	queued, err := pending.Character()
	if err != nil || queued.Gold != 1235 || len(queued.GoldCreditReceipts) != 1 {
		t.Fatal("pending refund gold and receipt were not atomic")
	}
	remaining := 100
	for phase := 81; phase < 91 && remaining > 0; phase++ {
		_, stopRecovered := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
		current := resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool { return len(a.PendingRefunds) < remaining })
		remaining = len(current.PendingRefunds)
		stopRecovered()
	}
	if remaining != 0 {
		t.Fatal("bounded healthy retries starved part of the backlog")
	}
	address, stopRecovered := compatStartServer(t, binary, uri, 91, "-save-journal-dir", dir)
	defer stopRecovered()
	connection := resourceOpenCharacter(t, address, fixture.Name, password)
	resourceProbe(t, connection, 100, false)
	saved = resourceCloseAndWait(t, repo, connection, fixture.Name)
	if saved.Gold != 1334 || len(saved.GoldCreditReceipts) != 100 || saved.Resources.Health != 17 || saved.Resources.Mana != 100 {
		t.Fatal("backlog recovery lost/duplicated refunds or changed resources")
	}
}

// A genuinely unreadable durable auction record must stop startup before HTTP
// admission. Repair only the owned malformed fixture, then recover real refunds.
func TestResourceActualUnreadableAuctionRefusesStartupAndRecovers(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	admin := resourceRefundAdmin(t, uri)
	fixture, password := resourceJournalFixture(t, repo)
	auction := resourceRefundAuction(fixture)
	auction.PendingRefunds = []database.AuctionRefund{{ID: "valid-pending-" + auction.ID, PlayerID: "player-" + fixture.Name, CharacterName: fixture.Name, Amount: 43}}
	if err := repo.CreateAuction(auction); err != nil {
		t.Fatal(err)
	}
	brokenID := "broken-" + auction.ID
	if _, err := admin.Database("eidolon").Collection("auctions").InsertOne(context.Background(), bson.M{
		"id": brokenID, "pending_refunds": "not a refund array",
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.DeleteAuction(brokenID) })
	evidence, err := os.MkdirTemp("", "eidolon-expected-startup-failure-")
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("owned_expected_startup_failure=%s", evidence)
	output, err := os.Create(filepath.Join(evidence, "server.log"))
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, binary, "-addr", "127.0.0.1:0", "-mongo-uri", uri,
		"-log-file", "", "-suspicious-log-file", "", "-economy-metrics-file", "", "-save-journal-dir", dir)
	command.Stdout, command.Stderr = output, output
	err = command.Run()
	output.Close()
	if ctx.Err() != nil || err == nil || command.ProcessState == nil || command.ProcessState.ExitCode() != 1 {
		t.Fatalf("unreadable auction did not cause explicit startup failure: %v", err)
	}
	contents, err := os.ReadFile(filepath.Join(evidence, "server.log"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(contents), "Cannot load durable auction state; refusing an empty market") || strings.Contains(string(contents), "WARNING: DATA RACE") || strings.Contains(string(contents), "panic:") {
		t.Fatal("server failed for a reason other than the deliberate auction-load guard")
	}
	// Delete only the exact intentionally corrupt disposable fixture. The valid
	// auction and its unpaid refund must remain untouched and recover normally.
	if err := repo.DeleteAuction(brokenID); err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 92, "-save-journal-dir", dir)
	defer stop()
	resourceWaitRefundAuction(t, repo, auction.ID, func(a *database.Auction) bool { return len(a.PendingRefunds) == 0 })
	connection := resourceOpenCharacter(t, address, fixture.Name, password)
	resourceProbe(t, connection, 100, false)
	saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
	if saved.Gold != 1277 || saved.GoldCreditReceipts[auction.PendingRefunds[0].ID] != 43 {
		t.Fatal("repairing unreadable fixture lost or duplicated independent refund")
	}
}
