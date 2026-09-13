package game

import (
	"errors"
	"maps"
	"strings"
)

type EquipmentAppearance struct {
	BaseName string     `json:"baseName" bson:"base_name"`
	Rarity   ItemRarity `json:"rarity" bson:"rarity"`
	Slot     string     `json:"slot" bson:"slot"`
}

func appearanceForItem(item Item) (EquipmentAppearance, bool) {
	if item.ID == "" || item.Stack > 1 {
		return EquipmentAppearance{}, false
	}
	var base *BaseItem
	for i := range BaseItems {
		candidate := &BaseItems[i]
		if strings.Contains(item.Name, candidate.Name) && (base == nil || len(candidate.Name) > len(base.Name)) {
			base = candidate
		}
	}
	if base == nil || item.Slot != base.Slot {
		return EquipmentAppearance{}, false
	}
	slot := base.Slot
	if slot == "ring" {
		slot = "ring1"
	}
	if slot == "trinket" {
		slot = "trinket1"
	}
	if !itemFitsEquipmentSlot(item, slot) {
		return EquipmentAppearance{}, false
	}
	rarity := item.Rarity
	if rarity == "" {
		rarity = RarityCommon
	}
	switch rarity {
	case RarityCommon, RarityUncommon, RarityRare, RarityLegendary, RarityEidolic:
	default:
		return EquipmentAppearance{}, false
	}
	return EquipmentAppearance{BaseName: base.Name, Rarity: rarity, Slot: base.Slot}, true
}

func AppearanceKey(look EquipmentAppearance) string { return look.BaseName + "|" + string(look.Rarity) }

// Explicitly learn from owned gear, never from client-provided style descriptors.
// The item remains intact; the earned cosmetic survives later sale or disposal.
func (w *World) CollectOwnedAppearances(playerID string) (int, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return 0, errors.New("Character not found")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if err := w.loadoutAccess(p, 0); err != nil {
		return 0, err
	}
	collection := maps.Clone(p.AppearanceCollection)
	if collection == nil {
		collection = make(map[string]EquipmentAppearance)
	}
	count := 0
	learn := func(item Item) {
		if look, valid := appearanceForItem(item); valid {
			key := AppearanceKey(look)
			if _, known := collection[key]; !known {
				collection[key] = look
				count++
			}
		}
	}
	for _, item := range p.Inventory {
		learn(item)
	}
	for _, item := range p.Stash {
		learn(item)
	}
	for _, item := range p.Equipment {
		learn(item)
	}
	p.AppearanceCollection = collection
	return count, nil
}

func (w *World) SelectAppearance(playerID, slot, key string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return errors.New("Character not found")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if err := w.loadoutAccess(p, 0); err != nil {
		return err
	}
	if !isEquipmentSlot(slot) {
		return errors.New("Choose a real equipment slot")
	}
	look, owned := p.AppearanceCollection[key]
	if key != "" {
		if !owned || AppearanceKey(look) != key {
			return errors.New("Learn this look from gear you own first")
		}
		if !itemFitsEquipmentSlot(Item{Slot: look.Slot, Type: ItemArmor}, slot) {
			return errors.New("That appearance does not fit this equipment slot")
		}
		item := p.Equipment[slot]
		if item.ID == "" || !activeEquipmentItem(slot, item) {
			return errors.New("Equip an item in this slot before choosing its appearance")
		}
	}
	selection := maps.Clone(p.Appearances)
	if selection == nil {
		selection = make(map[string]EquipmentAppearance)
	}
	if key == "" {
		delete(selection, slot)
	} else {
		selection[slot] = look
	}
	p.Appearances = selection
	p.EquipmentRevision++ // The ordinary state/delta path publishes cosmetic changes.
	return nil
}
