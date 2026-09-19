package game

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

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
