package game

import "eidolon-server/internal/database"

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
	if err := database.ApplyGoldCredit(&player.Gold, &player.GoldCreditReceipts, creditID, amount); err != nil {
		return true, err
	}
	player.UnjournaledSave = true
	return true, nil
}
