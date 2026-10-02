package game

import (
	"maps"
	"reflect"
	"strings"
	"testing"
)

// Exercise the real item movement paths, not invented cosmetic inventory items.
// EP buys an account-owned appearance; the underlying earned sword alone moves.
func TestEPCosmeticCannotTravelWithResoldAuctionedTradedOrBankedGear(t *testing.T) {
	var offer CosmeticOffer
	for _, candidate := range CosmeticCatalogue() {
		if candidate.ID == "grovekeeper-blade-v1" {
			offer = candidate
		}
	}
	if offer.ID == "" {
		t.Fatal("missing sword cosmetic")
	}
	for _, path := range []string{"vendor", "auction", "direct-trade", "guild-bank"} {
		t.Run(path, func(t *testing.T) {
			w, p := loadoutFixture()
			p.X, p.Z, p.Gold, p.EP = 12, 185, 50, 100
			item := Item{ID: "earned-sword", Name: offer.Base, Type: ItemWeapon, Slot: "mainHand",
				Stack: 1, MaxStack: 1, Value: 17, Rarity: RarityCommon,
				Stats: map[string]int{"strength": 3}, StatScaleVersion: ItemStatScaleVersion}
			p.Inventory = make([]Item, MaxInventorySize)
			p.Equipment["mainHand"] = item
			p.RecalculateStats()
			before := w.GetEntityCopy(p.ID)
			if bought, err := w.BuyCosmetic(p.ID, offer.ID, offer.PriceEP); err != nil || !bought {
				t.Fatal("cannot buy appearance", err)
			}
			key := AppearanceKey(offer.Appearance)
			if err := w.SelectAppearance(p.ID, "mainHand", key); err != nil {
				t.Fatal(err)
			}
			p.RecalculateStats()
			if p.Gold != before.Gold || p.Stats != before.Stats || p.Experience != before.Experience ||
				p.ResonanceXP != before.ResonanceXP || !reflect.DeepEqual(p.Equipment, before.Equipment) {
				t.Fatal("applying purchased look created power, currency or a replacement item")
			}
			if _, sold := w.PerformSell(p.ID, offer.ID); sold {
				t.Fatal("appearance sold as an inventory item")
			}
			if _, ok := w.PerformUnequip(p.ID, "mainHand", item.ID); !ok || !reflect.DeepEqual(p.Inventory[0], item) {
				t.Fatal("unequip attached a purchased look to transferable gear")
			}
			recipient := &Entity{ID: "player-recipient", Name: "Recipient", Type: TypePlayer, SubType: "Fighter",
				Level: 30, Health: 25, State: "IDLE", X: 13, Z: 185, Gold: 100, EP: 5, Inventory: make([]Item, MaxInventorySize)}
			w.AddEntity(recipient)
			expectedGold := 50
			switch path {
			case "vendor":
				if _, ok := w.PerformSell(p.ID, item.ID); !ok {
					t.Fatal("ordinary earned gear cannot be sold")
				}
				expectedGold += item.Value
			case "auction":
				payload := auctionDeliveryPayload(t, item)
				if err := p.ApplyAuctionListing("owned-gear-listing", payload, 25); err != nil {
					t.Fatal("cannot escrow ordinary earned gear", err)
				}
				if err := recipient.ApplyAuctionPurchase("owned-gear-purchase", payload, 23); err != nil {
					t.Fatal("cannot deliver purchased ordinary gear", err)
				}
				if recipient.Gold != 77 {
					t.Fatal("ordinary auction purchase did not debit its Gold price")
				}
				expectedGold -= 25
			case "direct-trade":
				trade, err := w.StartDirectTrade(p.ID, recipient.ID)
				if err != nil {
					t.Fatal(err)
				}
				if _, err = w.SetDirectTradeOffer(p.ID, trade.ID, []string{item.ID}, 0); err != nil {
					t.Fatal(err)
				}
				if _, err = w.SetDirectTradeOffer(recipient.ID, trade.ID, nil, 23); err != nil {
					t.Fatal(err)
				}
				if _, _, err = w.ConfirmDirectTrade(p.ID, trade.ID); err != nil {
					t.Fatal(err)
				}
				if _, done, err := w.ConfirmDirectTrade(recipient.ID, trade.ID); err != nil || !done {
					t.Fatal("ordinary trade failed", err)
				}
				expectedGold += 23
			case "guild-bank":
				escrow, err := w.DebitPlayerItem(p.ID, item.ID)
				if err != nil || !reflect.DeepEqual(escrow, item) {
					t.Fatal("bank escrow changed item identity", err)
				}
				if err = w.CreditPlayerItem(recipient.ID, escrow); err != nil {
					t.Fatal(err)
				}
			}
			if p.EP != 100-offer.PriceEP || p.Gold != expectedGold || recipient.EP != 5 || p.AppearanceCollection[key] != offer.Appearance {
				t.Fatal("item movement converted EP or lost the owner's permanent appearance")
			}
			if path == "auction" || path == "direct-trade" || path == "guild-bank" {
				if !reflect.DeepEqual(recipient.Inventory[0], item) {
					t.Fatal("recipient received a changed or cosmetic-priced item")
				}
				if _, err := w.CollectOwnedAppearances(recipient.ID); err != nil {
					t.Fatal(err)
				}
				if _, owned := recipient.AppearanceCollection[key]; owned {
					t.Fatal("recipient inherited an EP unlock from transferred ordinary gear")
				}
				if err := w.SelectAppearance(recipient.ID, "mainHand", key); err == nil {
					t.Fatal("recipient could use another account's paid appearance")
				}
			}
		})
	}
}

func TestAdministrationGrantsDoNotConvertEPOrTransferCosmeticOwnership(t *testing.T) {
	for _, action := range []string{"admin_grant_gold", "admin_grant_item", "admin_grant_ep"} {
		t.Run(action, func(t *testing.T) {
			_, p := loadoutFixture()
			p.Gold, p.EP, p.Inventory = 50, 100, make([]Item, MaxInventorySize)
			offer := CosmeticCatalogue()[0]
			key := AppearanceKey(offer.Appearance)
			p.AppearanceCollection = map[string]EquipmentAppearance{key: offer.Appearance}
			p.Appearances = map[string]EquipmentAppearance{offer.Appearance.Slot: offer.Appearance}
			p.EPExchangeReceipts = map[string]int{"earlier-exchange": 3}
			p.EPCasinoReceipts = map[string]int{"casino:earlier-return": 20}
			p.VIPAllowanceReceipts = map[string]int{"vip-admin-2026-10": 100}
			collection, appearances := maps.Clone(p.AppearanceCollection), maps.Clone(p.Appearances)
			exchanges, casino, allowance := maps.Clone(p.EPExchangeReceipts), maps.Clone(p.EPCasinoReceipts), maps.Clone(p.VIPAllowanceReceipts)
			grant := AdminGrant{Action: action, Amount: 23}
			if action == "admin_grant_item" {
				items, err := GenerateAdminItems(AdminItemSpec{Item: "iron-sword", Rarity: RarityRare, Level: 30, Quantity: 1})
				if err != nil {
					t.Fatal(err)
				}
				grant.Amount, grant.Items = 0, items
			}
			id, fingerprint := "admin:"+strings.Repeat("a", 64), strings.Repeat("b", 64)
			changed, err := p.ApplyAdminGrant(id, fingerprint, grant)
			if action == "admin_grant_ep" {
				if changed || err == nil || len(p.AdminOperationReceipts) != 0 || p.Gold != 50 {
					t.Fatal("unsupported EP grant altered the character")
				}
			} else {
				if !changed || err != nil {
					t.Fatal("valid trusted grant failed", err)
				}
				if replay, err := p.ApplyAdminGrant(id, fingerprint, grant); replay || err != nil {
					t.Fatal("grant replay changed value", err)
				}
				if action == "admin_grant_gold" && p.Gold != 73 || action == "admin_grant_item" && (p.Gold != 50 || p.Inventory[0].ID != grant.Items[0].ID) {
					t.Fatal("ordinary grant effect or exactly-once receipt differs")
				}
			}
			if p.EP != 100 || !reflect.DeepEqual(exchanges, p.EPExchangeReceipts) || !reflect.DeepEqual(casino, p.EPCasinoReceipts) ||
				!reflect.DeepEqual(allowance, p.VIPAllowanceReceipts) || !reflect.DeepEqual(collection, p.AppearanceCollection) || !reflect.DeepEqual(appearances, p.Appearances) {
				t.Fatal("ordinary administration converted EP, changed EP receipts or moved owned appearances")
			}
		})
	}
}
