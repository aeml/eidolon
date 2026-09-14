package game

import (
	"eidolon-server/internal/database"
	"errors"
	"time"
)

// Caller owns the account work lock through journal/save confirmation.
func (w *World) RefreshVIP(playerID string, periods []database.VIPPeriod, now time.Time) (int, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil || p.Type != TypePlayer {
		return 0, errors.New("character unavailable")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	amount, until, err := database.ApplyVIPAllowance(&p.EP, &p.VIPAllowanceReceipts, periods, now)
	if err != nil {
		p.VIPUntil = time.Time{}
		return 0, err
	}
	p.VIPUntil = until
	if amount > 0 {
		p.UnjournaledSave = true
	}
	return amount, nil
}

func (w *World) ClearVIPAccess(playerID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if p := w.Entities[playerID]; p != nil {
		p.Mu.Lock()
		p.VIPUntil = time.Time{}
		p.Mu.Unlock()
	}
}
