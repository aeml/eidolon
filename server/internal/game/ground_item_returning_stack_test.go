package game

import (
	"reflect"
	"testing"

	"eidolon-server/internal/database"
)

// A cold character normalizes its saved items; an immutable retained ground
// remainder keeps its original payload. Neither side may be rewritten to make
// the identity check pass, and unrelated metadata must still reject merging.
func TestGroundItemReturningPartialStackUsesKnownScaleMigration(t *testing.T) {
	for _, mode := range []string{"relic", "stats", "reverse", "different-affix", "different-legacy-affix", "different-description", "future-version", "negative-version"} {
		t.Run(mode, func(t *testing.T) {
			incoming := Item{ID: "chronicle-item-retained", Name: "Retained seed", Type: ItemRelic,
				Stack: 3, MaxStack: 8, Rarity: RarityUncommon}
			if mode != "relic" {
				incoming.Stats = map[string]int{"strength": 100}
			}
			owned := cloneItem(incoming)
			owned.Stack = 1
			NormalizeItemStatScale(&owned)
			accept := mode == "relic" || mode == "stats" || mode == "reverse"
			switch mode {
			case "reverse":
				incoming, owned = owned, incoming
				incoming.Stack, owned.Stack = 3, 1
			case "different-affix":
				owned.Stats["strength"]++
			case "different-legacy-affix":
				owned.StatScaleVersion = 0
				owned.Stats["strength"] = 101 // Same rounded result is not legacy identity.
			case "different-description":
				owned.Description = "Different original fragment"
			case "future-version":
				owned.StatScaleVersion = ItemStatScaleVersion + 1
			case "negative-version":
				incoming.StatScaleVersion = -1
			}
			player := &Entity{Inventory: []Item{owned}}
			before, original := cloneItems(player.Inventory), cloneItem(incoming)
			placed, remainder, err := planGroundPickup(player, incoming, database.GroundItemOperationID("returning-partial"))
			if !reflect.DeepEqual(player.Inventory, before) || !reflect.DeepEqual(incoming, original) {
				t.Fatal("compatibility mutated saved metadata or frozen ground payload")
			}
			if !accept {
				if err != ErrGroundItemIdentity {
					t.Fatal("incompatible original identity was accepted", err)
				}
				return
			}
			if err != nil || remainder != 0 || placed[0].Stack != 4 {
				t.Fatal("returning compatible partial stack rejected or duplicated", err, remainder)
			}
			placed[0].Stack = owned.Stack
			if !reflect.DeepEqual(placed[0], owned) {
				t.Fatal("merging changed the saved stack's original metadata")
			}
			for _, item := range placed[1:] {
				if item.ID != "" {
					t.Fatal("compatible remainder created an extra bag identity")
				}
			}
		})
	}
}
