package game

import (
	_ "embed"
	"encoding/json"

	"eidolon-server/internal/arena"
)

// These earned styles are deliberately separate from the EP shop catalogue.
// A settled season medal is their entitlement, never a wallet balance or a
// projected medal from an unfinished season. Combat items remain unchanged.
type SeasonCosmeticOffer struct {
	ID         string              `json:"id"`
	Name       string              `json:"name"`
	Medal      string              `json:"medal"`
	Base       string              `json:"base"`
	Primary    int                 `json:"primary"`
	Secondary  int                 `json:"secondary"`
	Appearance EquipmentAppearance `json:"appearance"`
}

//go:embed content/season-cosmetics.json
var seasonCosmeticCatalogueJSON []byte

var seasonCosmeticCatalogue []SeasonCosmeticOffer

func init() {
	if err := json.Unmarshal(seasonCosmeticCatalogueJSON, &seasonCosmeticCatalogue); err != nil {
		panic(err)
	}
	ids, names, medals := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for i := range seasonCosmeticCatalogue {
		offer := &seasonCosmeticCatalogue[i]
		for _, base := range BaseItems {
			if base.Name == offer.Base {
				offer.Appearance = EquipmentAppearance{BaseName: offer.Name, Rarity: RarityCommon, Slot: base.Slot}
				break
			}
		}
		validMedal := offer.Medal == "Bronze" || offer.Medal == "Silver" || offer.Medal == "Gold"
		if !validMedal || offer.ID == "" || offer.Name == "" || offer.Appearance.Slot == "" || ids[offer.ID] || names[offer.Name] || medals[offer.Medal] {
			panic("invalid earned season cosmetic catalogue")
		}
		ids[offer.ID], names[offer.Name], medals[offer.Medal] = true, true, true
	}
}

func SeasonCosmeticCatalogue() []SeasonCosmeticOffer {
	return append([]SeasonCosmeticOffer(nil), seasonCosmeticCatalogue...)
}

// Call only with server-owned, durably settled history. Highest-tier settlement
// remains unchanged: a Gold record grants its Gold style, not three new prizes.
// Multiple seasons of the same medal unlock the same permanent look once.
func SeasonCosmeticAppearances(history []arena.SeasonRecord) []EquipmentAppearance {
	owned := map[string]bool{}
	for _, record := range history {
		if record.Season != "" && record.SettledAt > 0 {
			owned[record.Medal] = true
		}
	}
	looks := make([]EquipmentAppearance, 0, len(seasonCosmeticCatalogue))
	for _, offer := range seasonCosmeticCatalogue {
		if owned[offer.Medal] {
			looks = append(looks, offer.Appearance)
		}
	}
	return looks
}

func (w *World) seasonCosmeticAppearances(playerID string) []EquipmentAppearance {
	if w.PvP == nil {
		return nil
	}
	w.PvP.mu.RLock()
	defer w.PvP.mu.RUnlock()
	return SeasonCosmeticAppearances(w.PvP.Profiles[playerID].SeasonHistory)
}
