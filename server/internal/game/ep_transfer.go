package game

import "eidolon-server/internal/database"

// Caller holds the account work lock until the full character snapshot is saved.
// Settlement deliberately does not require current VIP eligibility: a funded
// hand must pay even after membership expiry, leaving the venue, or disconnect.
// New wagers must check trusted membership before creating the table intent.
func (w *World) ApplyDurablePlayerEPTransfer(playerID, operationID string, amount int) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return false, nil
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if err := database.ApplyEPTransfer(&p.EP, &p.EPCasinoReceipts, operationID, amount); err != nil {
		return true, err
	}
	p.UnjournaledSave = true
	return true, nil
}
