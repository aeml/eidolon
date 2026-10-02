package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"testing"
)

func TestPublicNameOnlineTargetUsesStableKeysAndRejectsAmbiguousAliases(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	alice := addChatTestClient("alice", "")
	bob := addChatTestClient("bob", "")
	setClientPublicName(alice, "Arcanis Dawn")
	if activeClientByPublicName("arcanis dawn") != alice || activeClientByPublicName("alice") != alice {
		t.Fatal("public alias or stable key failed")
	}
	setClientPublicName(bob, "Arcanis Dawn")
	if activeClientByPublicName("Arcanis Dawn") != nil || activeClientByPublicName("alice") != alice {
		t.Fatal("ambiguous alias redirected a stable key")
	}
	bob.retired.Store(true)
	if activeClientByPublicName("Arcanis Dawn") != alice {
		t.Fatal("retired session remained a target")
	}
	alice.transportClosed.Store(true)
	if activeClientByPublicName("alice") != nil || activeClientByPublicName("Arcanis Dawn") != nil {
		t.Fatal("closed session remained a target")
	}
}

func TestPublicNameFinancialViewsDoNotRewriteOwnership(t *testing.T) {
	previousDB := db
	db = nil
	t.Cleanup(func() { db = previousDB })
	auction := &game.Auction{ID: "listing", SellerID: "player-alice", SellerName: "alice", BidderID: "player-bob", BidderName: "bob", Bid: 400, Buyout: 1000}
	views := publicAuctionViews([]*game.Auction{auction})
	if len(views) != 1 || views[0] == auction || views[0].SellerID != auction.SellerID || views[0].BidderID != auction.BidderID || views[0].Bid != 400 || views[0].Buyout != 1000 {
		t.Fatal("view changed ownership or money", views)
	}
	views[0].SellerName = "Arcanis Dawn"
	if auction.SellerName != "alice" {
		t.Fatal("view rewrote settlement identity")
	}
	profile := database.PvPProfile{PlayerID: "player-bob", Rating: 1200}
	ranked := publicPvPProfiles([]database.PvPProfile{profile})
	if len(ranked) != 1 || ranked[0].Name != "bob" || ranked[0].PlayerID != profile.PlayerID || ranked[0].Rating != profile.Rating {
		t.Fatal(ranked)
	}
}

func TestPublicNameSnapshotKeepsIdentityAndDetectsStationaryRename(t *testing.T) {
	w := game.NewWorld(nil)
	player := &game.Entity{ID: "player-original", Name: "original", Type: game.TypePlayer, State: "IDLE", Level: 1, PublicName: "Arcanis Dawn"}
	w.AddEntity(player)
	snapshot := entityToSnapshot(player)
	if snapshot.PublicName != "Arcanis Dawn" || entityToProto(player).Name != "Arcanis Dawn" {
		t.Fatal("public label absent from wire or delta baseline")
	}
	if !w.SetPlayerPublicName(player.ID, "Moon Keeper") || !hasEntityChanged(player, snapshot) {
		t.Fatal("stationary rename was not delta-visible")
	}
	copy := w.GetEntityCopy(player.ID)
	if copy.Name != "original" || copy.ID != "player-original" || copy.DisplayName() != "Moon Keeper" {
		t.Fatal("display correction changed ownership or was lost in snapshot", copy.Name, copy.ID, copy.PublicName)
	}
	if entityToProto(copy).Name != "Moon Keeper" {
		t.Fatal("detached protobuf lost public label")
	}
	w.SetPlayerPublicName(player.ID, "Third Label")
	if copy.DisplayName() != "Moon Keeper" {
		t.Fatal("public-name copy aliases live state")
	}
	w.AddEntity(&game.Entity{ID: "npc", Name: "Archmage Ilyra", Type: game.TypeNPC, PublicName: "ignored"})
	if w.SetPlayerPublicName("npc", "bad") || w.GetEntityCopy("npc").DisplayName() != "Archmage Ilyra" || w.SetPlayerPublicName("missing", "bad") || w.SetPlayerPublicName(player.ID, "") {
		t.Fatal("public-name update accepted invalid target")
	}
}
