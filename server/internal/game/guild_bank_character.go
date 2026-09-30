package game

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"eidolon-server/internal/database"
)

var ErrGuildBankCharacterRejected = errors.New("guild bank character effect cannot be applied")

// Caller owns the entity lock or a detached offline character. Only pass an
// immutable intent read from the repository, never a client-supplied item.
// The receipt and effect must reach a durable full save before acknowledging.
func (e *Entity) ApplyGuildBankCharacterOperation(op database.GuildBankOperation) (bool, error) {
	if err := op.Validate(); err != nil {
		return false, err
	}
	if op.State != database.GuildBankPending {
		return false, errors.New("only a pending guild bank intent can apply to a character")
	}
	if e.Type != TypePlayer || e.ID != op.PlayerID {
		return false, fmt.Errorf("%w: character identity differs", ErrGuildBankCharacterRejected)
	}
	if e.GuildBankOpID == op.ID {
		if e.GuildBankOpFingerprint != op.Fingerprint || e.GuildBankRevision != op.CharacterBankRevision+1 {
			return false, database.ErrGuildBankOperationConflict
		}
		return false, nil
	}
	if e.GuildBankRevision != op.CharacterBankRevision {
		return false, fmt.Errorf("%w: saved bank revision differs", ErrGuildBankCharacterRejected)
	}
	// Plan on detached visible storage. A partial stack merge or metadata repair
	// cannot leak an item when a later capacity check rejects the operation.
	gold := e.Gold
	var inventory []Item
	switch op.Action {
	case database.GuildBankDepositGold:
		if gold < op.Gold {
			return false, fmt.Errorf("%w: insufficient Gold", ErrGuildBankCharacterRejected)
		}
		gold -= op.Gold
	case database.GuildBankWithdrawGold:
		if gold < 0 || gold > math.MaxInt-op.Gold {
			return false, fmt.Errorf("%w: Gold limit reached", ErrGuildBankCharacterRejected)
		}
		gold += op.Gold
	case database.GuildBankDepositItem, database.GuildBankWithdrawItem:
		var item Item
		// database.Item's JSON names differ only in case from Item's explicit
		// names. Decode without ordinary hydration's stat-scale normalization;
		// recovery must use the exact saved potency, stats and Forge basis.
		if err := json.Unmarshal([]byte(op.ItemPayload), &item); err != nil {
			return false, err
		}
		if IsChronicleQuestItem(item) {
			return false, fmt.Errorf("%w: story items are personal", ErrGuildBankCharacterRejected)
		}
		inventory = cloneItems(e.Inventory)
		if op.Action == database.GuildBankDepositItem {
			index := -1
			for i := 0; i < min(len(inventory), MaxInventorySize); i++ {
				if inventory[i].ID == item.ID {
					index = i
					break
				}
			}
			if index < 0 {
				return false, fmt.Errorf("%w: inventory item is missing", ErrGuildBankCharacterRejected)
			}
			actual := inventory[index]
			if actual.Stack == 0 {
				actual.Stack = 1
			}
			actualJSON, _ := json.Marshal(actual)
			plannedJSON, _ := json.Marshal(item)
			if !bytes.Equal(actualJSON, plannedJSON) {
				return false, fmt.Errorf("%w: inventory item differs from the saved plan", ErrGuildBankCharacterRejected)
			}
			inventory[index] = Item{}
		} else {
			if len(inventory) < MaxInventorySize {
				inventory = append(inventory, make([]Item, MaxInventorySize-len(inventory))...)
			}
			staged := &Entity{Inventory: inventory[:MaxInventorySize]}
			if staged.AddItemToInventory(item) != 0 {
				return false, fmt.Errorf("%w: inventory is full", ErrGuildBankCharacterRejected)
			}
		}
	default:
		return false, errors.New("unsupported guild bank character action")
	}
	e.Gold = gold
	if inventory != nil {
		e.Inventory = inventory
	}
	e.GuildBankRevision++
	e.GuildBankOpID, e.GuildBankOpFingerprint = op.ID, op.Fingerprint
	return true, nil
}

// Mutation and expiry pin are atomic. Caller holds the account work lock and
// must journal/commit the complete snapshot before the intent can complete.
func (w *World) ApplyDurableGuildBankCharacterOperation(op database.GuildBankOperation) (found, changed bool, err error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[op.PlayerID]
	if player == nil {
		return false, false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	changed, err = player.ApplyGuildBankCharacterOperation(op)
	if changed {
		player.UnjournaledSave = true
	}
	return true, changed, err
}
