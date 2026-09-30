package game

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"
)

// The browser lifetime fixture must cover the live catalog, not a reduced
// invented layout. Keeping its snapshot checked in avoids compiling Go inside
// every frontend/browser job.
func TestCasinoBrowserFixtureMatchesCatalog(t *testing.T) {
	data, err := os.ReadFile("../../../tests/fixtures/casino-browser-catalog.json")
	if err != nil {
		t.Fatal(err)
	}
	live, err := json.Marshal(CasinoTables())
	if err != nil {
		t.Fatal(err)
	}
	var fixture, canonical any
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(live, &canonical); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(fixture, canonical) {
		t.Fatal("Browser casino catalog differs from CasinoTables; regenerate from TestCasinoBrowserFixtureCatalog")
	}
}

// Read-only canonical layout for the controlled busy-floor rendering check.
// This does not create accounts, grant currency or simulate multiplayer games.
func TestCasinoBrowserFixtureCatalog(t *testing.T) {
	if os.Getenv("EIDOLON_CASINO_FIXTURE_CATALOG") != "1" {
		t.Skip("Explicit local casino rendering diagnostic only")
	}
	data, err := json.Marshal(CasinoTables())
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("[casino-fixture-catalog]%s\n", data)
}
