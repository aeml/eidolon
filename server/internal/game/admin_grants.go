package game

import (
	"errors"
	"fmt"

	"eidolon-server/internal/database"
)

var ErrAdminGrantRejected = errors.New("administration grant rejected")

// This is a private server-built plan, not an inbound item payload. Its exact
// generated items are stored before execution; replays never reroll equipment.
type AdminGrant struct {
	Action string `json:"action"`
	Amount int    `json:"amount,omitempty"`
	Items  []Item `json:"items,omitempty"`
}

// Caller holds the entity lock (or owns a detached offline entity). The receipt
// is written with the effect and travels through every full character save.
func (e *Entity) ApplyAdminGrant(id, fingerprint string, grant AdminGrant) (bool, error) {
	if replay, err := database.AdminOperationApplied(e.AdminOperationReceipts, id, fingerprint); err != nil || replay {
		return false, err
	}
	if e.Type != TypePlayer || e.Health <= 0 || e.State == "DEAD" {
		return false, fmt.Errorf("%w: recipient must be a living character", ErrAdminGrantRejected)
	}
	switch grant.Action {
	case "admin_grant_gold":
		if len(grant.Items) != 0 {
			return false, errors.New("Gold plan unexpectedly contains items")
		}
		if err := database.ValidateAdminGoldGrant(e.Gold, grant.Amount); err != nil {
			return false, fmt.Errorf("%w: %v", ErrAdminGrantRejected, err)
		}
		e.Gold += grant.Amount
	case "admin_grant_item":
		if grant.Amount != 0 {
			return false, errors.New("item plan unexpectedly contains Gold")
		}
		if err := e.ApplyAdminItemDelivery(id, grant.Items); err != nil {
			return false, fmt.Errorf("%w: %v", ErrAdminGrantRejected, err)
		}
	default:
		return false, errors.New("unknown administration grant action")
	}
	if e.AdminOperationReceipts == nil {
		e.AdminOperationReceipts = make(map[string]string)
	}
	e.AdminOperationReceipts[id] = fingerprint
	return true, nil
}

// Find, mutate and pin together against disconnected-entity expiry. The caller
// owns the account work lock and must persist a complete snapshot before success.
func (w *World) ApplyDurableAdminGrant(playerID, id, fingerprint string, grant AdminGrant) (found, changed bool, err error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	changed, err = player.ApplyAdminGrant(id, fingerprint, grant)
	if changed {
		player.UnjournaledSave = true
	}
	return true, changed, err
}
