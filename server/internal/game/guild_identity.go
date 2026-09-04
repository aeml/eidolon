package game

// SetPlayerGuildIdentity updates the compact public guild identity replicated
// with player state. Guild membership and permissions remain database-owned.
func (w *World) SetPlayerGuildIdentity(playerID, guildID, guildTag string) bool {
	w.Mu.RLock()
	player := w.Entities[playerID]
	w.Mu.RUnlock()
	if player == nil || player.Type != TypePlayer {
		return false
	}

	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.GuildID == guildID && player.GuildTag == guildTag {
		return false
	}
	player.GuildID = guildID
	player.GuildTag = guildTag
	return true
}
