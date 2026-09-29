package game

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func TestRespecPricesMatchAdvertisedBoundaryContract(t *testing.T) {
	data, err := os.ReadFile("testdata/respec_prices.json")
	if err != nil {
		t.Fatal(err)
	}
	var prices []map[string]int
	if err := json.Unmarshal(data, &prices); err != nil {
		t.Fatal(err)
	}
	for _, entry := range prices {
		for _, kind := range []string{"talents", "skills", "both"} {
			t.Run(fmt.Sprintf("level%d/%s", entry["level"], kind), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("priced-respec", "Fighter")
				p.Level, p.Gold = entry["level"], entry[kind]-1
				w.AddEntity(p)
				if quote := w.GetRespecCost(p.ID, kind); quote != entry[kind] {
					t.Fatalf("quote=%d expected=%d", quote, entry[kind])
				}
				if _, ok, _ := w.PerformRespec(p.ID, kind); ok || p.Gold != entry[kind]-1 {
					t.Fatal("unaffordable reset was accepted or spent gold")
				}
				p.Gold++
				if _, ok, msg := w.PerformRespec(p.ID, kind); !ok || p.Gold != 0 {
					t.Fatalf("exact-price reset failed: accepted=%v gold=%d message=%s", ok, p.Gold, msg)
				}
			})
		}
	}
}
