package game

import (
	"reflect"
	"testing"

	"eidolon-server/internal/arena"
)

func TestSeasonCosmeticsRequireSettledHistoryAndRemainOutsideEPShop(t *testing.T) {
	if len(SeasonCosmeticAppearances(nil)) != 0 {
		t.Fatal("unfinished season granted a look")
	}
	history := []arena.SeasonRecord{
		{Season: "2026-Q3", Medal: "Gold"}, // Projected/unsettled, even if named.
		{Medal: "Silver", SettledAt: 10},
		{Season: "2026-Q3", Medal: "Unqualified", SettledAt: 10},
		{Season: "2026-Q3", Medal: "Bronze", SettledAt: 10},
		{Season: "2026-Q4", Medal: "Bronze", SettledAt: 20},
	}
	looks := SeasonCosmeticAppearances(history)
	if len(looks) != 1 || looks[0].BaseName != "Bronze Arena Medallion" || looks[0].Slot != "neck" || looks[0].Rarity != RarityCommon {
		t.Fatal("unsettled, unqualified or repeated season granted the wrong looks", looks)
	}
	for _, earned := range SeasonCosmeticCatalogue() {
		for _, sold := range CosmeticCatalogue() {
			if earned.ID == sold.ID || earned.Name == sold.Name {
				t.Fatal("earned medal leaked into EP shop", earned.ID)
			}
		}
		qualified := SeasonCosmeticAppearances([]arena.SeasonRecord{{Season: "2026-Q3", Medal: earned.Medal, SettledAt: 10}})
		if len(qualified) != 1 || qualified[0] != earned.Appearance {
			t.Fatal("highest-tier settlement awarded extra or wrong styles", earned.Medal, qualified)
		}
	}
	copy := SeasonCosmeticCatalogue()
	copy[0].Name = "mutated"
	looks[0].BaseName = "mutated"
	if SeasonCosmeticCatalogue()[0].Name == "mutated" || SeasonCosmeticAppearances(history)[0].BaseName == "mutated" {
		t.Fatal("caller can mutate shared earned catalogue")
	}
}

func TestWardrobeClaimsSettledSeasonCosmeticsOnceWithoutPowerOrCurrency(t *testing.T) {
	w, p := loadoutFixture()
	p.Gold, p.EP = 123, 10
	p.Equipment["neck"] = Item{ID: "real-pendant", Name: "Pendant", Type: ItemNeck, Slot: "neck", Stack: 1, Stats: map[string]int{"vitality": 7}}
	p.RecalculateStats()
	w.SetPvPProfile(PvPProfile{PlayerID: p.ID, Rating: 2000, SeasonVictories: 100, Honor: 500,
		SeasonHistory: []arena.SeasonRecord{
			{Season: "2026-Q3", Medal: "Bronze", SettledAt: 10},
			{Season: "2026-Q4", Medal: "Bronze", SettledAt: 20},
			{Season: "2027-Q1", Medal: "Gold"},
		}})
	before := w.GetEntityCopy(p.ID)
	profile := w.PvPStatus(p.ID)["profile"].(PvPProfile)
	count, err := w.CollectOwnedAppearances(p.ID)
	if err != nil || count != 2 {
		t.Fatal("expected one owned Pendant and one settled Bronze look", count, err)
	}
	bronze := SeasonCosmeticCatalogue()[0].Appearance
	if p.AppearanceCollection[AppearanceKey(bronze)] != bronze || len(p.AppearanceCollection) != 2 {
		t.Fatal("projected or duplicate medal granted extra looks", p.AppearanceCollection)
	}
	if count, err = w.CollectOwnedAppearances(p.ID); count != 0 || err != nil {
		t.Fatal("repeated collection minted another prize", count, err)
	}
	if err = w.SelectAppearance(p.ID, "neck", AppearanceKey(bronze)); err != nil || p.Appearances["neck"] != bronze {
		t.Fatal("earned style was not usable over equipped gear", err)
	}
	if !reflect.DeepEqual(before.Equipment, p.Equipment) || !reflect.DeepEqual(before.Inventory, p.Inventory) ||
		p.Stats != before.Stats || p.BaseStats != before.BaseStats || p.Health != before.Health || p.Mana != before.Mana ||
		p.Gold != before.Gold || p.EP != before.EP || !reflect.DeepEqual(profile, w.PvPStatus(p.ID)["profile"]) {
		t.Fatal("cosmetic claim changed combat, resources, currency or ranked records")
	}
	p.Z = 500
	p.AppearanceCollection = nil
	if _, err = w.CollectOwnedAppearances(p.ID); err == nil || len(p.AppearanceCollection) != 0 {
		t.Fatal("unsafe wardrobe request unlocked a season look")
	}
	p.Z = 200
	if err = w.SelectAppearance(p.ID, "neck", AppearanceKey(bronze)); err == nil {
		t.Fatal("unowned season look was accepted")
	}
}
