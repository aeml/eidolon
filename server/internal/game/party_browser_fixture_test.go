package game

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
)

var partyFixturePrimaryStats = map[string]string{
	"Fighter": "strength", "Rogue": "dexterity", "Wizard": "intelligence", "Cleric": "wisdom",
}

func TestPartyProgressedGearUsesNormalRoleAffixes(t *testing.T) {
	for class, primary := range partyFixturePrimaryStats {
		for _, rarity := range []ItemRarity{RarityUncommon, RarityRare} {
			for _, base := range BaseItems {
				if base.Type == ItemMaterial || base.Type == ItemRelic {
					continue
				}
				item := partyFixtureRoleItem(t, base, rarity, primary)
				multiplier := 2.0
				if rarity == RarityRare {
					multiplier = 5.0
				}
				want := map[string]int{base.BaseStat: int(float64(base.BaseValue) * 5.5 * multiplier)}
				budget := int(90 * multiplier)
				if rarity == RarityRare {
					want[primary] += budget / 2
					want["vitality"] += budget - budget/2
				} else {
					want[primary] += budget
				}
				if item.Level != 30 || item.Rarity != rarity || item.Potency != 0 ||
					item.StatScaleVersion != ItemStatScaleVersion || !reflect.DeepEqual(item.Stats, SquishItemStats(want)) {
					t.Fatalf("%s %s %s is not a normal level30 role roll: %+v", class, rarity, base.Name, item)
				}
			}
		}
	}
}

// Select attainable role rolls from the real item generator. Do not write stats
// or potency into a Common item and relabel it. The bound fails explicitly.
func partyFixtureRoleItem(t *testing.T, base BaseItem, rarity ItemRarity, primary string) *Item {
	t.Helper()
	multiplier, count := 2.0, 1
	if rarity == RarityRare {
		multiplier, count = 5.0, 2
	} else if rarity != RarityUncommon {
		t.Fatal("unsupported progressed gear rarity")
	}
	for attempt := 0; attempt < 512; attempt++ {
		item := createItem(base, rarity, multiplier, count, 30)
		if strings.HasPrefix(item.Name, StatNames[primary].Prefix+" ") &&
			(rarity != RarityRare || strings.HasSuffix(item.Name, " "+StatNames["vitality"].Suffix)) {
			return item
		}
	}
	t.Fatalf("could not generate legal %s %s %s roll", primary, rarity, base.Name)
	return nil
}

// An opt-in, disposable browser-fixture catalog, not a gameplay command. Use
// production creation/scaling rather than hand-authoring inflated equipment.
func TestPartyBrowserFixtureCatalog(t *testing.T) {
	if os.Getenv("EIDOLON_PARTY_FIXTURE_CATALOG") != "1" {
		t.Skip("Explicit local four-client diagnostic only")
	}
	profile := os.Getenv("EIDOLON_E2E_PARTY_GEAR")
	if profile == "" {
		profile = "progressed"
	}
	if profile != "common" && profile != "progressed" {
		t.Fatal("unknown party gear profile")
	}
	w := newTestWorld()
	p := newTestPlayer("fixture-catalog", "Fighter")
	w.AddEntity(p)
	if _, ok := w.SetPlayerLevel(p.ID, 30); !ok {
		t.Fatal("level30 preparation failed")
	}
	items := map[string]*Item{}
	roleItems := map[string]map[ItemRarity]map[string]*Item{}
	if profile == "progressed" {
		for class, primary := range partyFixturePrimaryStats {
			roleItems[class] = map[ItemRarity]map[string]*Item{}
			for _, rarity := range []ItemRarity{RarityUncommon, RarityRare} {
				roleItems[class][rarity] = map[string]*Item{}
				for _, base := range BaseItems {
					if base.Type != ItemMaterial && base.Type != ItemRelic {
						roleItems[class][rarity][base.Name] = partyFixtureRoleItem(t, base, rarity, primary)
					}
				}
			}
		}
	}
	for _, base := range BaseItems {
		if base.Type == ItemMaterial || base.Type == ItemRelic {
			continue
		}
		item := createItem(base, RarityCommon, 1, 0, 30)
		if item.Level != 30 || item.Rarity != RarityCommon || item.Potency != 0 {
			t.Fatal("nonbaseline item")
		}
		items[base.Name] = item
	}
	data, err := json.Marshal(map[string]interface{}{"stats": p.BaseStats, "items": items,
		"gearProfile": profile, "roleItems": roleItems})
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("[party-fixture-catalog]%s\n", data)
}
