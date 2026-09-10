package game

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

// An opt-in, disposable browser-fixture catalog, not a gameplay command. Use
// production creation/scaling rather than hand-authoring inflated equipment.
func TestPartyBrowserFixtureCatalog(t *testing.T) {
	if os.Getenv("EIDOLON_PARTY_FIXTURE_CATALOG") != "1" {
		t.Skip("Explicit local four-client diagnostic only")
	}
	w := newTestWorld()
	p := newTestPlayer("fixture-catalog", "Fighter")
	w.AddEntity(p)
	if _, ok := w.SetPlayerLevel(p.ID, 30); !ok {
		t.Fatal("level30 preparation failed")
	}
	items := map[string]*Item{}
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
	data, err := json.Marshal(map[string]interface{}{"stats": p.BaseStats, "items": items})
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("[party-fixture-catalog]%s\n", data)
}
