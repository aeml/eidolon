package game

import (
	"eidolon-server/internal/database"
	"errors"
)

// Caller holds the account work lock through the subsequent journal/save.
func (w *World) ExchangeGoldForEP(playerID, id string, amount int) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil || p.Type != TypePlayer {
		return errors.New("character not found")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if err := w.loadoutAccess(p, 0); err != nil {
		return errors.New("exchange Gold for EP in town, alive and out of combat")
	}
	applied, err := database.ApplyEPExchange(&p.Gold, &p.EP, &p.EPExchangeReceipts, id, amount)
	if err != nil {
		return err
	}
	if applied {
		w.Economy.RecordSink("ep_exchange", amount*database.GoldPerEP)
		p.UnjournaledSave = true
	}
	return nil
}
