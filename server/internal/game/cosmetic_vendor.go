package game

import (
	_ "embed"
	"encoding/json"
	"errors"
	"math"
)

const CosmeticVendorID = "vip-cosmetic-vendor"

//go:embed content/cosmetics.json
var cosmeticCatalogueJSON []byte

type CosmeticOffer struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Realm       string              `json:"realm"`
	Base        string              `json:"base"`
	PriceEP     int                 `json:"priceEP"`
	Description string              `json:"description"`
	Primary     int                 `json:"primary"`
	Secondary   int                 `json:"secondary"`
	Appearance  EquipmentAppearance `json:"appearance"`
}

var cosmeticCatalogue []CosmeticOffer

func init() {
	if err := json.Unmarshal(cosmeticCatalogueJSON, &cosmeticCatalogue); err != nil {
		panic(err)
	}
	ids, names := map[string]bool{}, map[string]bool{}
	for i := range cosmeticCatalogue {
		offer := &cosmeticCatalogue[i]
		for _, base := range BaseItems {
			if base.Name == offer.Base {
				offer.Appearance = EquipmentAppearance{BaseName: offer.Name, Rarity: RarityCommon, Slot: base.Slot}
				break
			}
		}
		if offer.ID == "" || offer.Name == "" || offer.PriceEP <= 0 || offer.Appearance.Slot == "" || ids[offer.ID] || names[offer.Name] {
			panic("invalid cosmetic catalogue")
		}
		ids[offer.ID], names[offer.Name] = true, true
	}
}

func CosmeticCatalogue() []CosmeticOffer { return append([]CosmeticOffer(nil), cosmeticCatalogue...) }

func (w *World) spawnCosmeticVendor() {
	w.AddEntity(&Entity{ID: CosmeticVendorID, Name: "Veyra · VIP Outfitter", Type: TypeNPC,
		SubType: "CosmeticVendor", X: 12, Y: .5, Z: 185, SpawnX: 12, SpawnZ: 185, State: "IDLE", Scale: 1})
}

func (w *World) cosmeticVendorAccess(p *Entity) error {
	if err := w.loadoutAccess(p, 0); err != nil {
		return errors.New("visit Veyra in town, alive and out of combat")
	}
	vendor := w.Entities[CosmeticVendorID]
	if vendor == nil || !finiteCoordinate(p.X) || !finiteCoordinate(p.Z) || math.Hypot(p.X-vendor.X, p.Z-vendor.Z) > 5 {
		return errors.New("approach Veyra, the VIP Outfitter beside the casino entrance")
	}
	return nil
}

func (w *World) CanUseCosmeticVendor(playerID string) error {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	p := w.Entities[playerID]
	if p == nil {
		return errors.New("character not found")
	}
	p.Mu.RLock()
	defer p.Mu.RUnlock()
	return w.cosmeticVendorAccess(p)
}

// A permanent, unique collection entry is the receipt. Duplicate requests can
// never buy the same unlock twice, even after spending the remaining EP. The
// caller saves EP and the collection atomically in the full character journal.
func (w *World) BuyCosmetic(playerID, offerID string, quotedPrice int) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return false, errors.New("character not found")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if err := w.cosmeticVendorAccess(p); err != nil {
		return false, err
	}
	var offer *CosmeticOffer
	for i := range cosmeticCatalogue {
		if cosmeticCatalogue[i].ID == offerID {
			offer = &cosmeticCatalogue[i]
			break
		}
	}
	if offer == nil {
		return false, errors.New("unknown cosmetic")
	}
	key := AppearanceKey(offer.Appearance)
	if look, owned := p.AppearanceCollection[key]; owned {
		if look != offer.Appearance {
			return false, errors.New("cosmetic collection needs recovery")
		}
		return false, nil
	}
	if quotedPrice != offer.PriceEP {
		return false, errors.New("the cosmetic price changed; review the current EP price before buying")
	}
	if p.EP < offer.PriceEP {
		return false, errors.New("not enough EP; Gold cannot pay for this cosmetic")
	}
	if p.AppearanceCollection == nil {
		p.AppearanceCollection = make(map[string]EquipmentAppearance)
	}
	p.EP -= offer.PriceEP
	p.AppearanceCollection[key] = offer.Appearance
	p.UnjournaledSave = true
	return true, nil
}
