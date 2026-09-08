package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/crypto/bcrypt"
)

// Real schema7 bridge -> schema8 gameplay/crash -> refused bridge -> schema8
// recovery. Starts with a prepared legacy character, not earned leveling/gear.
func TestResourceActualSchemaUpgradeRefusalAndRecovery(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" || os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo with failpoints")
	}
	uri, binary, bridge := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY"), os.Getenv("EIDOLON_SCHEMA_BRIDGE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) || !filepath.IsAbs(bridge) {
		t.Fatal("requires isolated loopback Mongo and absolute owned binary paths")
	}
	admin := resourceRefundAdmin(t, uri)
	raw := admin.Database("eidolon")
	ctx := context.Background()
	collections, err := raw.ListCollectionNames(ctx, bson.M{})
	if err != nil || len(collections) != 0 {
		t.Fatal("requires fresh empty owned database", err)
	}
	name := fmt.Sprintf("schema-upgrade-%d", time.Now().UnixNano())
	password := name + "-prepared-only"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	item := database.Item{ID: "bridge-item-one", Name: "Wooden Staff", Type: "WEAPON", Slot: "mainHand", Rarity: "RARE",
		Level: 1, Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion}
	second := item
	second.ID = "bridge-item-two"
	legacy := &database.Character{Name: name, Class: "Wizard", Level: 31, XP: 17, Gold: 1234,
		SelectedBranch: "C", UnlockedSkills: []string{"Fireball", "Arcane Shield"},
		ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200, LastDailyQuest: time.Now().Truncate(time.Millisecond),
		Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10}, Inventory: []database.Item{item, second},
		Equipment: map[string]database.Item{"chest": {ID: "bridge-chest", Name: "Robes", Type: "ARMOR", Slot: "chest", Rarity: "RARE",
			Level: 1, Stack: 1, MaxStack: 1, Stats: map[string]int{"intelligence": 5}, StatScaleVersion: game.ItemStatScaleVersion}}}
	if _, err := raw.Collection("users").InsertOne(ctx, database.User{Username: name, Email: name + "@example.invalid",
		PasswordHash: string(hash), Characters: []*database.Character{legacy}}); err != nil {
		t.Fatal(err)
	}
	readLegacy := func() *database.Character {
		var user database.User
		if err := raw.Collection("users").FindOne(ctx, bson.M{"username": name}).Decode(&user); err != nil || len(user.Characters) != 1 {
			t.Fatal("legacy fixture unreadable", err)
		}
		return user.Characters[0]
	}
	address, stopBridge := compatStartServer(t, bridge, uri, 170)
	t.Log("phase170 uses the legacy shutdown path; its disconnect save is verified before process exit")
	connection := resourceOpenCharacter(t, address, name, password)
	closedAt := time.Now()
	connection.Close()
	deadline := time.Now().Add(10 * time.Second)
	for !readLegacy().LastLogout.After(closedAt) && time.Now().Before(deadline) {
		time.Sleep(25 * time.Millisecond)
	}
	before := readLegacy()
	if !before.LastLogout.After(closedAt) || before.Resources != nil || before.Gold != 1234 || before.XP != 17 ||
		!reflect.DeepEqual(before.Equipment, legacy.Equipment) || !reflect.DeepEqual(before.Inventory, legacy.Inventory) {
		t.Fatal("normal bridge session changed legacy progress or did not save")
	}
	stopBridge() // Never migrate while the older writer is still running.
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	address, crash := compatStartServerWithCrash(t, binary, uri, 171, true, "-save-journal-dir", dir)
	connection = resourceOpenCharacter(t, address, name, password)
	// Zero Wisdom/Vitality isolates persistence from elapsed regen. Legacy login
	// preserves its100-mana baseline, not the larger derived capacity. Ordinary
	// Fireball30 + Fireball30 + Arcane Shield40 consume that baseline exactly.
	cast := func(skill string, want int) {
		resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: skill})
		var result game.AbilityResult
		resourceReadMessage(t, connection, MsgAbilityResult, &result)
		if !result.Accepted || result.Mana != want {
			t.Fatal("ordinary cast did not consume the expected mana", result, want)
		}
	}
	cast("Fireball", 70)
	time.Sleep(2050 * time.Millisecond) // Respect the real Fireball cooldown.
	cast("Fireball", 40)
	time.Sleep(550 * time.Millisecond) // Respect the global cooldown before the shield.
	resourceSend(t, connection, MsgTradingCreate, TradingCreatePayload{SlotIndex: 0, Bid: 100, Buyout: 500, Duration: 24,
		ExpectedItemID: item.ID, ExpectedStack: 1})
	var listings []game.Auction
	resourceReadMessage(t, connection, "trading_my_list", &listings)
	if len(listings) != 1 || listings[0].Item.ID != item.ID {
		t.Fatal("first ordinary listing failed")
	}
	first := listings[0]
	firstSaved, err := repo.GetCharacter(name, name)
	if err != nil || firstSaved.Resources == nil || firstSaved.Resources.Mana != 40 || firstSaved.Resources.Health <= 0 || firstSaved.Gold != 1209 {
		t.Fatal("first listing did not save the actual legacy resource baseline", err)
	}
	baselineHealth := firstSaved.Resources.Health
	cast("Arcane Shield", 0)
	configureFault := func(enabled bool) {
		faultCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		var mode any = "off"
		if enabled {
			mode = bson.M{"skip": 2} // Permit predecision/preflight, reject escrow save.
		}
		if err := admin.Database("admin").RunCommand(faultCtx, bson.D{{Key: "configureFailPoint", Value: "failCommand"},
			{Key: "mode", Value: mode}, {Key: "data", Value: bson.M{"failCommands": []string{"update"}, "namespace": "eidolon.users", "errorCode": 121}}}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { configureFault(false) })
	configureFault(true)
	resourceSend(t, connection, MsgTradingCreate, TradingCreatePayload{SlotIndex: 1, Bid: 100, Buyout: 500, Duration: 24,
		ExpectedItemID: second.ID, ExpectedStack: 1})
	var reply string
	resourceReadMessage(t, connection, MsgError, &reply)
	if reply != "Your auction listing is awaiting recovery. Please try again shortly." {
		t.Fatal("escrow fault missed", reply)
	}
	pending, err := journal.Read(name)
	if err != nil || pending == nil {
		t.Fatal("missing pending full-character journal", err)
	}
	expected, err := pending.Character()
	if err != nil || expected.Resources == nil || expected.Resources.Mana != 0 || expected.Resources.Health != baselineHealth || expected.Gold != 1184 ||
		len(expected.Inventory) != 0 || len(expected.ItemDeliveryReceipts) != 2 || len(expected.GoldCreditReceipts) != 2 {
		t.Fatal("journal separated zero mana, items, deposits or receipts", err)
	}
	op := listingDecision(t, repo, name)
	saved, err := repo.GetCharacter(name, name)
	if err != nil || op == nil || saved.Gold != 1209 || saved.Resources.Mana != 0 || len(saved.Inventory) != 1 || saved.Inventory[0].ID != second.ID {
		t.Fatal("fault missed the intended committed-decision/uncommitted-escrow boundary", err)
	}
	crash()
	configureFault(false)
	var protected bson.Raw
	if err := raw.Collection("users").FindOne(ctx, bson.M{"username": name}).Decode(&protected); err != nil {
		t.Fatal(err)
	}
	refusalCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	command := exec.CommandContext(refusalCtx, bridge, "-addr", "127.0.0.1:0", "-mongo-uri", uri,
		"-log-file", "", "-suspicious-log-file", "", "-economy-metrics-file", "")
	output, refused := command.CombinedOutput()
	cancel()
	exitErr, exited := refused.(*exec.ExitError)
	if !exited || exitErr.ExitCode() != 1 || !strings.Contains(string(output), "database schema 8") ||
		!strings.Contains(string(output), "refusing startup before writes") || strings.Contains(string(output), "Server started") {
		t.Fatalf("older bridge did not refuse before admission: %v\n%s", refused, output)
	}
	t.Logf("owned_expected_startup_refusal: %s", output)
	var after bson.Raw
	if err := raw.Collection("users").FindOne(ctx, bson.M{"username": name}).Decode(&after); err != nil || !reflect.DeepEqual(protected, after) {
		t.Fatal("refused bridge changed the newer character", err)
	}
	retained, err := journal.Read(name)
	if err != nil || !reflect.DeepEqual(retained, pending) || !reflect.DeepEqual(listingDecision(t, repo, name), op) {
		t.Fatal("refused bridge changed pending journal/operation", err)
	}
	for phase := 172; phase < 174; phase++ {
		address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
		if listingDecision(t, repo, name) != nil {
			t.Fatal("recovery admitted before finishing pending auction")
		}
		saved, err := repo.GetCharacter(name, name)
		if err != nil || !reflect.DeepEqual(saved.Resources, expected.Resources) || saved.Gold != 1184 || saved.Level != 31 || saved.XP != 17 ||
			len(saved.Inventory) != 0 || !reflect.DeepEqual(saved.Equipment, legacy.Equipment) ||
			!reflect.DeepEqual(saved.GoldCreditReceipts, expected.GoldCreditReceipts) || !reflect.DeepEqual(saved.ItemDeliveryReceipts, expected.ItemDeliveryReceipts) {
			if err != nil {
				t.Fatal(err)
			}
			t.Fatalf("compatible recovery mismatch: resources=%+v expectedResources=%+v gold=%d level=%d xp=%d bag=%d equipmentMatch=%t goldReceiptsMatch=%t itemReceiptsMatch=%t", saved.Resources, expected.Resources, saved.Gold, saved.Level, saved.XP, len(saved.Inventory), reflect.DeepEqual(saved.Equipment, legacy.Equipment), reflect.DeepEqual(saved.GoldCreditReceipts, expected.GoldCreditReceipts), reflect.DeepEqual(saved.ItemDeliveryReceipts, expected.ItemDeliveryReceipts))
		}
		if retained, err := journal.Read(name); err != nil || retained != nil {
			t.Fatal("recovered journal not acknowledged", err)
		}
		auctions := listingAuctions(t, repo, name)
		if len(auctions) != 2 {
			t.Fatal("recovery lost or duplicated listings")
		}
		for _, a := range auctions {
			if a.ID == first.ID {
				if a.Item.ID != item.ID || !a.EndTime.Equal(first.EndTime) {
					t.Fatal("recovery changed prior completed auction")
				}
			} else if a.ID != op.AuctionID || a.Item.ID != second.ID || a.LastBidOperationID != op.ID {
				t.Fatal("recovery published wrong second listing")
			}
		}
		connection = resourceOpenCharacter(t, address, name, password)
		resourceProbe(t, connection, 0, false)
		resourceCloseAndWait(t, repo, connection, name)
		stop()
	}
}
