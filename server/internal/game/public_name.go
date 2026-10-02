package game

// Caller holds the entity read lock or uses an immutable entity copy. Never
// replace Name: auction, character and social ownership still use that key.
func (e *Entity) DisplayName() string {
	if e.Type == TypePlayer && e.PublicName != "" {
		return e.PublicName
	}
	return e.Name
}

func (w *World) SetPlayerPublicName(playerID, name string) bool {
	e := w.GetEntity(playerID)
	if e == nil || name == "" {
		return false
	}
	e.Mu.Lock()
	defer e.Mu.Unlock()
	if e.Type != TypePlayer {
		return false
	}
	e.PublicName = name
	return true
}
