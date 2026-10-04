package game

import (
	"errors"
	"strings"

	"eidolon-server/internal/database"
)

// The account work lock remains held through the following complete journal
// save. A canonical table intent owns the effect; seats/VIP are irrelevant to
// paying an already funded hand after exit, expiry or disconnect.
func (w *World) ApplyDurableCasinoWalletCheckpoint(op database.BlackjackTransfer) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[op.PlayerID]
	if p == nil {
		return false, nil
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if p.Type != TypePlayer || p.Name != strings.TrimPrefix(op.PlayerID, "player-") {
		return true, errors.New("casino wallet owner changed")
	}
	changed, err := database.ApplyCasinoWalletCheckpoint(&p.Gold, &p.EP, p.GoldCreditReceipts, p.EPCasinoReceipts, &p.CasinoWalletCheckpoints, op)
	if err != nil {
		return true, err
	}
	if changed && op.Currency == "gold" {
		if op.Amount < 0 {
			w.Economy.RecordSink("casino_wagers", -op.Amount)
		} else {
			w.Economy.RecordSource("casino_returns", op.Amount)
		}
	}
	p.UnjournaledSave = true
	return true, nil
}
