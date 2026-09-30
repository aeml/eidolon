package game

import (
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
