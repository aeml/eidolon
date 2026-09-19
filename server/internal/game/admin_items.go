package game

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
)

// Administrative creation selects canonical definitions, never client-provided
// stats, IDs, prices, effects or sockets. Authorization belongs to the server
// handler. Generate once and journal the exact result before delivery/replay.
type AdminItemSpec struct {
	Item     string     `json:"item"`
	Rarity   ItemRarity `json:"rarity"`
	Level    int        `json:"level"`
	Quantity int        `json:"quantity"`
}

type AdminItemDefinition struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Material bool   `json:"material"`
}

func adminItemID(base BaseItem) string {
	return strings.ReplaceAll(strings.ToLower(base.Name), " ", "-")
}

func AdminItemCatalog() []AdminItemDefinition {
	result := make([]AdminItemDefinition, 0, len(BaseItems))
	for _, base := range BaseItems {
		result = append(result, AdminItemDefinition{ID: adminItemID(base), Name: base.Name,
			Material: base.Type == ItemMaterial || base.Type == ItemRelic})
	}
	return result
}

func (spec AdminItemSpec) Validate() error {
	_, err := spec.base()
	return err
}

func (spec AdminItemSpec) base() (BaseItem, error) {
	for _, base := range BaseItems {
		if spec.Item != adminItemID(base) {
			continue
		}
		if base.Type == ItemMaterial || base.Type == ItemRelic {
			if spec.Rarity != RarityEidolic || spec.Level != 1 || spec.Quantity < 1 || spec.Quantity > 1000 {
				return BaseItem{}, errors.New("materials require Eidolic rarity, level 1 and quantity 1–1000")
			}
		} else {
			if spec.Level < 1 || spec.Level > 100 || spec.Quantity < 1 || spec.Quantity > MaxInventorySize {
				return BaseItem{}, errors.New("equipment requires level 1–100 and quantity 1–25")
			}
			switch spec.Rarity {
			case RarityCommon, RarityUncommon, RarityRare, RarityLegendary:
			default:
				return BaseItem{}, errors.New("invalid equipment rarity")
			}
		}
		return base, nil
	}
	return BaseItem{}, errors.New("unknown canonical item")
}

func GenerateAdminItems(spec AdminItemSpec) ([]Item, error) {
	base, err := spec.base()
	if err != nil {
		return nil, err
	}
	multiplier, statCount := 1.0, 0
	switch spec.Rarity {
	case RarityUncommon:
		multiplier, statCount = 2, 1
	case RarityRare:
		multiplier, statCount = 5, 2
	case RarityLegendary:
		multiplier, statCount = 20, 5
	}
	if base.Type == ItemMaterial || base.Type == ItemRelic {
		item := createItem(base, spec.Rarity, multiplier, statCount, spec.Level)
		item.Stack = spec.Quantity
		return []Item{*item}, nil
	}
	items := make([]Item, spec.Quantity)
	for index := range items {
		items[index] = *createItem(base, spec.Rarity, multiplier, statCount, spec.Level)
	}
	return items, nil
}

// Caller holds the entity lock. This accepts only a server-generated, privately
// journaled batch, never a client payload. Plan the entire inventory change on a
// detached copy: no partial grant, stash spill, equipment change or ground loot.
func (e *Entity) ApplyAdminItemDelivery(operationID string, items []Item) error {
	if !strings.HasPrefix(operationID, "admin:") || len(operationID) != len("admin:")+64 || len(items) < 1 || len(items) > MaxInventorySize {
		return errors.New("invalid administration item delivery")
	}
	if _, err := hex.DecodeString(strings.TrimPrefix(operationID, "admin:")); err != nil {
		return errors.New("invalid administration operation identity")
	}
	payload, err := json.Marshal(items)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(payload)
	fingerprint := hex.EncodeToString(digest[:])
	if previous, exists := e.ItemDeliveryReceipts[operationID]; exists {
		if previous != fingerprint {
			return errors.New("administration delivery identity reused for different items")
		}
		return nil // Replay succeeds even if the items were subsequently consumed.
	}
	if len(e.Inventory) > MaxInventorySize {
		return errors.New("inventory exceeds supported capacity")
	}
	inventory := cloneItems(e.Inventory)
	inventory = append(inventory, make([]Item, MaxInventorySize-len(inventory))...)
	seen := make(map[string]bool, len(items))
	for _, item := range items {
		if item.ID == "" || seen[item.ID] || item.Stack < 1 || item.MaxStack < 1 || item.Stack > item.MaxStack {
			return errors.New("invalid administration item batch")
		}
		seen[item.ID] = true
		remaining := item.Stack
		for index := range inventory {
			existing := &inventory[index]
			if existing.ID == item.ID {
				return errors.New("administration item already exists without its receipt")
			}
			if remaining == 0 || existing.ID == "" || existing.Stack < 1 || existing.Stack >= existing.MaxStack || item.MaxStack <= 1 {
				continue
			}
			left, right := *existing, item
			left.ID, right.ID, left.Stack, right.Stack = "", "", 0, 0
			if reflect.DeepEqual(left, right) {
				amount := min(remaining, existing.MaxStack-existing.Stack)
				existing.Stack += amount
				remaining -= amount
			}
		}
		if remaining > 0 {
			for index := range inventory {
				if inventory[index].ID == "" {
					inventory[index] = cloneItem(item)
					inventory[index].Stack = remaining
					remaining = 0
					break
				}
			}
		}
		if remaining != 0 {
			return errors.New("not enough inventory space for the complete grant")
		}
	}
	e.Inventory = inventory
	if e.ItemDeliveryReceipts == nil {
		e.ItemDeliveryReceipts = make(map[string]string)
	}
	e.ItemDeliveryReceipts[operationID] = fingerprint
	return nil
}
