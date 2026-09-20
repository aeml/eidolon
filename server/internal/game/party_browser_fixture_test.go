package game

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"
)

var partyFixturePrimaryStats = map[string]string{
	"Fighter": "strength", "Rogue": "dexterity", "Wizard": "intelligence", "Cleric": "wisdom",
}

// Fresh prepared actors only: calculate legal equipped pools using the server,
// rather than waiting for town regeneration in an isolated boss-room fixture.
func TestPartyBrowserDiagnosticResources(t *testing.T) {
	raw := os.Getenv("EIDOLON_DIAGNOSTIC_CHARACTER_JSON")
	if raw == "" {
		t.Skip("explicit prepared character only")
	}
	var c struct {
		Class       string           `json:"class"`
		Level       int              `json:"level"`
		Stats       Stats            `json:"stats"`
		Equipment   map[string]Item  `json:"equipment"`
		TalentRanks map[string]int   `json:"talent_ranks"`
	}
	if err := json.Unmarshal([]byte(raw), &c); err != nil || c.Level != 70 || partyFixturePrimaryStats[c.Class] == "" || len(c.Equipment) != 14 {
		t.Fatal("invalid prepared diagnostic character")
	}
	p := newTestPlayer("diagnostic-resource-catalog", c.Class)
	p.Level, p.BaseStats, p.Equipment, p.TalentRanks = c.Level, c.Stats, c.Equipment, c.TalentRanks
	p.RecalculateStats()
	if p.MaxHealth <= 0 || p.MaxMana <= 0 {
		t.Fatal("invalid prepared resource caps")
	}
	fmt.Printf("[diagnostic-resources]{\"version\":1,\"health\":%d,\"mana\":%d,\"dead\":false}\n", p.MaxHealth, p.MaxMana)
}

func TestPartyProgressedGearUsesNormalRoleAffixes(t *testing.T) {
	for _, level := range []int{30, 60, 70, 100} {
		for class, primary := range partyFixturePrimaryStats {
			for _, rarity := range []ItemRarity{RarityUncommon, RarityRare} {
				for _, base := range BaseItems {
					if base.Type == ItemMaterial || base.Type == ItemRelic {
						continue
					}
					item := partyFixtureRoleItemAtLevel(t, base, rarity, primary, level)
					multiplier := 2.0
					if rarity == RarityRare {
						multiplier = 5.0
					}
					want := map[string]int{base.BaseStat: int(float64(base.BaseValue) * (1 + float64(level)*0.15) * multiplier)}
					budget := int(3 * float64(level) * multiplier)
					if rarity == RarityRare {
						want[primary] += budget / 2
						want["vitality"] += budget - budget/2
					} else {
						want[primary] += budget
					}
					if item.Level != level || item.Rarity != rarity || item.Potency != 0 ||
						item.StatScaleVersion != ItemStatScaleVersion || !reflect.DeepEqual(item.Stats, SquishItemStats(want)) {
						t.Fatalf("%s %s %s is not a normal level%d role roll: %+v", class, rarity, base.Name, level, item)
					}
				}
			}
		}
	}
}

// Select attainable role rolls from the real item generator. Do not write stats
// or potency into a Common item and relabel it. The bound fails explicitly.
func partyFixtureRoleItem(t *testing.T, base BaseItem, rarity ItemRarity, primary string) *Item {
	t.Helper()
	return partyFixtureRoleItemAtLevel(t, base, rarity, primary, 30)
}

func partyFixtureRoleItemAtLevel(t *testing.T, base BaseItem, rarity ItemRarity, primary string, level int) *Item {
	t.Helper()
	multiplier, count := 2.0, 1
	if rarity == RarityRare {
		multiplier, count = 5.0, 2
	} else if rarity != RarityUncommon {
		t.Fatal("unsupported progressed gear rarity")
	}
	for attempt := 0; attempt < 512; attempt++ {
		item := createItem(base, rarity, multiplier, count, level)
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
	level := 30
	if raw := os.Getenv("EIDOLON_PARTY_FIXTURE_LEVEL"); raw != "" {
		var err error
		level, err = strconv.Atoi(raw)
		if err != nil || level < 30 || level > MaxPlayerLevel || level%10 != 0 {
			t.Fatal("party fixture level must be a ten-level band from30 through100")
		}
	}
	w := newTestWorld()
	p := newTestPlayer("fixture-catalog", "Fighter")
	w.AddEntity(p)
	if _, ok := w.SetPlayerLevel(p.ID, level); !ok {
		t.Fatal("party level preparation failed")
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
						roleItems[class][rarity][base.Name] = partyFixtureRoleItemAtLevel(t, base, rarity, primary, level)
					}
				}
			}
		}
	}
	for _, base := range BaseItems {
		if base.Type == ItemMaterial || base.Type == ItemRelic {
			continue
		}
		item := createItem(base, RarityCommon, 1, 0, level)
		if item.Level != level || item.Rarity != RarityCommon || item.Potency != 0 {
			t.Fatal("nonbaseline item")
		}
		items[base.Name] = item
	}
	result := map[string]interface{}{"stats": p.BaseStats, "items": items,
		"level": level, "quests": chronicleQuestCatalog(), "gearProfile": profile, "roleItems": roleItems,
		"raids": elementalRaidDefinitions}
	if boss := os.Getenv("EIDOLON_E2E_DIAGNOSTIC_BOSS"); boss != "" {
		if boss != "ObsidianGuardian" || level != 70 {
			t.Fatal("unsupported isolated boss diagnostic")
		}
		layout := w.generateDungeonLayoutWithSeed("dungeon_diagnostic", DifficultyNormal, "molten_core", 7811600862583822555)
		assignDungeonRoomHooks(&layout)
		if err := ValidateDungeonLayout(layout); err != nil {
			t.Fatal(err)
		}
		result["diagnosticLayout"] = layout
	}
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("[party-fixture-catalog]%s\n", data)
}
