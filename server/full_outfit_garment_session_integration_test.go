package main

import (
	"fmt"
	"maps"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

// Prepared returning wardrobe, real production sockets/Mongo/restarts. This
// covers persistence and public replication, not GPU model fit or earned EP.
func TestFullOutfitGarmentActualSavedSessions(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	name := fmt.Sprintf("garment-returning-%d", time.Now().UnixNano())
	password := name + "-disposable-only"
	legacy := map[string]game.EquipmentAppearance{
		"head":     {BaseName: "Silk Hood", Rarity: game.RarityRare, Slot: "head"},
		"mainHand": {BaseName: "Iron Sword", Rarity: game.RarityCommon, Slot: "mainHand"},
		"offHand":  {BaseName: "Wooden Shield", Rarity: game.RarityRare, Slot: "offHand"},
	}
	collection := make(map[string]game.EquipmentAppearance)
	for _, look := range legacy {
		collection[game.AppearanceKey(look)] = look
	}
	equipment := make(map[string]database.Item)
	for slot, baseName := range map[string]string{"head": "Iron Helm", "chest": "Plate Mail", "mainHand": "Iron Sword", "offHand": "Wooden Shield"} {
		for _, base := range game.BaseItems {
			if base.Name != baseName {
				continue
			}
			equipment[slot] = databaseItem(game.Item{ID: name + "-" + slot, Name: base.Name, Type: base.Type,
				Slot: base.Slot, Rarity: game.RarityCommon, Level: 1, Stack: 1, MaxStack: 1,
				StatScaleVersion: game.ItemStatScaleVersion, Stats: map[string]int{base.BaseStat: game.SquishFlatItemStat(base.BaseStat, base.BaseValue)}})
		}
	}
	if len(equipment) != 4 {
		t.Fatal("missing canonical prepared equipment")
	}
	fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion,
		X: 12, Z: 185, Gold: 1234, EP: 100, LastDailyQuest: time.Now(),
		Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10},
		Equipment: equipment, Appearances: databaseAppearances(legacy), AppearanceCollection: databaseAppearances(collection),
		Resources: &database.CharacterResources{Version: 1, Health: 80, Mana: 20}}
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	observerName := name + "-observer"
	if err := repo.CreateUser(observerName, observerName+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 610, "-save-journal-dir", journal)
	defer stop()
	owner, _ := resourceLoginCharacter(t, address, name, password, "Fighter")
	observer, _ := resourceLoginCharacter(t, address, observerName, password, "Cleric")
	defer observer.Close()
	baseline := wellRestedReadActor(t, owner, name, func(e *statepb.Entity) bool { return len(e.Equipment) == 4 })
	expected := maps.Clone(legacy)
	remaining := fixture.EP
	var wardrobe cosmeticSocketResult
	readWardrobe := func() {
		t.Helper()
		resourceSend(t, owner, MsgGetWardrobe, map[string]any{})
		wardrobe = cosmeticSocketResult{}
		resourceReadMessage(t, owner, MsgWardrobeResult, &wardrobe)
		if !wardrobe.Success || !reflect.DeepEqual(wardrobe.Appearances, expected) || !reflect.DeepEqual(wardrobe.Collection, collection) {
			t.Fatal("returning wardrobe lost independent choices or collection")
		}
	}
	readWardrobe()
	resourceSend(t, owner, MsgGetCosmeticVendor, map[string]any{})
	var vendor cosmeticSocketResult
	resourceReadMessage(t, owner, MsgCosmeticVendorResult, &vendor)
	if !vendor.Success || vendor.EP != remaining {
		t.Fatal("ordinary non-VIP vendor unavailable")
	}
	offers := make(map[string]game.CosmeticOffer)
	for _, offer := range vendor.Catalogue {
		if offer.Name == "Iron Oath Regalia" || offer.Name == "Grovekeeper Blade" || offer.Name == "Grovekeeper Shield" {
			offers[offer.Appearance.Slot] = offer
		}
	}
	if len(offers) != 3 {
		t.Fatal("missing actual full outfit/weapon/offhand catalogue entries")
	}
	buy := func(offer game.CosmeticOffer, first bool) {
		t.Helper()
		resourceSend(t, owner, MsgBuyCosmetic, map[string]any{"id": offer.ID, "confirmed": true, "priceEP": offer.PriceEP})
		var result cosmeticSocketResult
		resourceReadMessage(t, owner, MsgCosmeticVendorResult, &result)
		if first {
			remaining -= offer.PriceEP
			collection[game.AppearanceKey(offer.Appearance)] = offer.Appearance
		}
		if !result.Success || result.Pending || result.EP != remaining || !reflect.DeepEqual(result.Collection, collection) || !reflect.DeepEqual(result.Appearances, expected) {
			t.Fatal("garment purchase/replay changed selection, lost legacy looks or charged incorrectly")
		}
	}
	checkPublic := func(e *statepb.Entity) bool {
		if len(e.Appearances) != len(expected) {
			return false
		}
		for slot, look := range expected {
			actual := e.Appearances[slot]
			if actual == nil || actual.BaseName != look.BaseName || actual.Rarity != string(look.Rarity) || actual.Slot != look.Slot {
				return false
			}
		}
		return true
	}
	assertGear := func(recipient string, e *statepb.Entity) {
		t.Helper()
		if len(e.Equipment) != len(baseline.Equipment) || !proto.Equal(e.Stats, baseline.Stats) || e.Damage != baseline.Damage || e.Defense != baseline.Defense {
			t.Fatalf("%s cosmetic update: gear %d/%d, stats %v/%v, damage %d/%d, defense %d/%d", recipient,
				len(e.Equipment), len(baseline.Equipment), e.Stats, baseline.Stats, e.Damage, baseline.Damage, e.Defense, baseline.Defense)
		}
		for slot, item := range baseline.Equipment {
			if !proto.Equal(e.Equipment[slot], item) {
				t.Fatal("public cosmetic update replaced real gear", slot)
			}
		}
	}
	selectLook := func(slot, key string) {
		t.Helper()
		started := time.Now()
		resourceSend(t, owner, MsgSelectAppearance, map[string]string{"slot": slot, "key": key})
		if key == "" {
			delete(expected, slot)
		} else {
			expected[slot] = collection[key]
		}
		wardrobe = cosmeticSocketResult{}
		resourceReadMessage(t, owner, MsgWardrobeResult, &wardrobe)
		if !wardrobe.Success || !reflect.DeepEqual(wardrobe.Appearances, expected) || !reflect.DeepEqual(wardrobe.Collection, collection) {
			t.Fatal("garment selection lost independent choices")
		}
		assertGear("owner", wellRestedReadActorAfter(t, owner, name, started, checkPublic))
		assertGear("observer", wellRestedReadActorAfter(t, observer, name, started, checkPublic))
	}
	for _, slot := range []string{"mainHand", "offHand", "outfit"} {
		buy(offers[slot], true)
		selectLook(slot, game.AppearanceKey(offers[slot].Appearance))
	}
	assertSave := func(saved *database.Character) {
		t.Helper()
		if saved.Gold != fixture.Gold || saved.EP != remaining || saved.Level != fixture.Level || saved.XP != 0 || saved.Stats != fixture.Stats ||
			!reflect.DeepEqual(saved.Equipment, fixture.Equipment) || len(saved.Inventory) != 0 || len(saved.Stash) != 0 ||
			!reflect.DeepEqual(gameAppearances(saved.Appearances), expected) || !reflect.DeepEqual(gameAppearances(saved.AppearanceCollection), collection) ||
			len(saved.GoldCreditReceipts) != 0 || len(saved.VIPAllowanceReceipts) != 0 {
			t.Fatal("saved garments changed power/wallet/items or lost selected/legacy looks")
		}
	}
	assertSave(resourceCloseAndWait(t, repo, owner, name))
	observer.Close()
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 611, "-save-journal-dir", journal)
	defer stopAgain()
	owner, _ = resourceLoginCharacter(t, address, name, password, "Fighter")
	observer, _ = resourceLoginCharacter(t, address, observerName, password, "Cleric")
	defer observer.Close()
	readWardrobe()
	assertGear("observer after restart", wellRestedReadActor(t, observer, name, checkPublic))
	for _, slot := range []string{"mainHand", "offHand", "outfit"} {
		buy(offers[slot], false)
	}
	selectLook("outfit", "")
	if expected["head"] != legacy["head"] || expected["mainHand"] != offers["mainHand"].Appearance || expected["offHand"] != offers["offHand"].Appearance {
		t.Fatal("clearing outfit lost retained head or independent held looks")
	}
	assertSave(resourceCloseAndWait(t, repo, owner, name))
	observer.Close()
	stopAgain()
	address, stopFinal := compatStartServer(t, binary, uri, 612, "-save-journal-dir", journal)
	defer stopFinal()
	owner, _ = resourceLoginCharacter(t, address, name, password, "Fighter")
	readWardrobe()
	assertSave(resourceCloseAndWait(t, repo, owner, name))
	t.Log("returning legacy collection, three purchases, owner/remote protobuf, three process lifetimes, replay and outfit removal preserved real gear/power/Gold and exact EP")
}
