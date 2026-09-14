package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type cosmeticSocketResult struct {
	Success, Pending bool
	EP               int
	Catalogue        []game.CosmeticOffer
	Collection       map[string]game.EquipmentAppearance
	Appearances      map[string]game.EquipmentAppearance
}

func TestCosmeticVendorActualSocketPurchaseAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable Mongo and built server required")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	name := fmt.Sprintf("cosmetic-%d", time.Now().UnixNano())
	if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
		t.Fatal(err)
	}
	defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
	defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteOne(context.Background(), bson.M{"player_id": "player-" + name})
	// Prepared before first login. No membership is provisioned: Veyra must also
	// serve non-VIP owners of EP. No grants or repository edits during purchase.
	armor := databaseItem(*game.GenerateLootForSlot("chest", 1))
	fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion,
		X: 12, Z: 185, Gold: 1234, EP: 100, LastDailyQuest: time.Now(),
		Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10},
		Equipment: map[string]database.Item{"chest": armor}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 101, "-save-journal-dir", journal)
	defer stop()
	conn, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
	resourceSend(t, conn, MsgGetCosmeticVendor, map[string]any{})
	var result cosmeticSocketResult
	resourceReadMessage(t, conn, MsgCosmeticVendorResult, &result)
	if !result.Success || result.Pending || result.EP != 100 || len(result.Catalogue) == 0 {
		t.Fatal("non-VIP vendor catalogue unavailable", result.Success, result.EP)
	}
	var offer game.CosmeticOffer
	for _, entry := range result.Catalogue {
		if entry.Appearance.Slot == "chest" {
			offer = entry
			break
		}
	}
	if offer.ID == "" || offer.PriceEP <= 1 || offer.PriceEP > 100 {
		t.Fatal("no affordable chest appearance in actual catalogue")
	}
	key := game.AppearanceKey(offer.Appearance)
	buy := func(confirmed bool, price int, success bool, balance int) {
		t.Helper()
		resourceSend(t, conn, MsgBuyCosmetic, map[string]any{"id": offer.ID, "confirmed": confirmed, "priceEP": price})
		result = cosmeticSocketResult{}
		resourceReadMessage(t, conn, MsgCosmeticVendorResult, &result)
		if result.Success != success || result.Pending || result.EP != balance {
			t.Fatal("purchase confirmation/price/debit mismatch", result.Success, result.Pending, result.EP)
		}
	}
	buy(false, offer.PriceEP, false, 100)
	buy(true, offer.PriceEP-1, false, 100)
	if len(result.Collection) != 0 {
		t.Fatal("rejected quote unlocked an appearance")
	}
	remaining := 100 - offer.PriceEP
	buy(true, offer.PriceEP, true, remaining)
	if result.Collection[key] != offer.Appearance || len(result.Appearances) != 0 {
		t.Fatal("purchase failed unlock or auto-applied appearance")
	}
	buy(true, offer.PriceEP, true, remaining)
	resourceSend(t, conn, MsgSelectAppearance, map[string]string{"slot": "chest", "key": key})
	result = cosmeticSocketResult{}
	resourceReadMessage(t, conn, MsgWardrobeResult, &result)
	if !result.Success || result.Appearances["chest"] != offer.Appearance {
		t.Fatal("purchased appearance did not apply over equipped gear")
	}
	assertSave := func(saved *database.Character) {
		t.Helper()
		if saved.Gold != fixture.Gold || saved.EP != remaining || saved.Level != 1 || saved.XP != 0 || saved.Stats != fixture.Stats ||
			!reflect.DeepEqual(saved.Equipment, fixture.Equipment) || len(saved.Inventory) != 0 || len(saved.Stash) != 0 ||
			len(saved.AppearanceCollection) != 1 || saved.AppearanceCollection[key].BaseName != offer.Name || saved.Appearances["chest"].BaseName != offer.Name ||
			len(saved.GoldCreditReceipts) != 0 || len(saved.VIPAllowanceReceipts) != 0 {
			t.Fatal("purchase changed power/Gold/items or lost durable EP/appearance state")
		}
	}
	assertSave(resourceCloseAndWait(t, repo, conn, name))
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 102, "-save-journal-dir", journal)
	defer stopAgain()
	conn, _ = resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
	resourceSend(t, conn, MsgGetWardrobe, map[string]any{})
	result = cosmeticSocketResult{}
	resourceReadMessage(t, conn, MsgWardrobeResult, &result)
	if !result.Success || result.Collection[key] != offer.Appearance || result.Appearances["chest"] != offer.Appearance {
		t.Fatal("fresh login after restart lost wardrobe selection")
	}
	buy(true, offer.PriceEP, true, remaining)
	assertSave(resourceCloseAndWait(t, repo, conn, name))
	t.Logf("non-VIP cosmetic %s: rejected unconfirmed/stale quote, charged %dEP once, applied over unchanged %s, restart/replay saved balance=%dEP Gold=%d", offer.ID, offer.PriceEP, armor.Name, remaining, fixture.Gold)
}
