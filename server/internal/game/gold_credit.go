package game

import (
	"eidolon-server/internal/database"
	"strings"
)

func (w *World) ApplyDurablePlayerGoldDebit(playerID, operationID string, amount int) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	_, replay := player.GoldCreditReceipts[operationID]
	if err := database.ApplyGoldDebit(&player.Gold, &player.GoldCreditReceipts, operationID, amount); err != nil {
		return true, err
	}
	if !replay && strings.HasPrefix(operationID, "casino:") {
		w.Economy.RecordSink("casino_wagers", amount)
	}
	player.UnjournaledSave = true
	return true, nil
}

// Caller serializes account work. Find, mutate and pin atomically against the
// disconnected expiry sweep: there must never be a credited detached entity.
// The following complete journal save clears the pin only after durable IO.
func (w *World) ApplyDurablePlayerGoldCredit(playerID, creditID string, amount int) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	_, replay := player.GoldCreditReceipts[creditID]
	if err := database.ApplyGoldCredit(&player.Gold, &player.GoldCreditReceipts, creditID, amount); err != nil {
		return true, err
	}
	if !replay && strings.HasPrefix(creditID, "casino:") {
		w.Economy.RecordSource("casino_returns", amount)
	}
	player.UnjournaledSave = true
	return true, nil
}
