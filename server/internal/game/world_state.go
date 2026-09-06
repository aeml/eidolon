package game

import "log"

func (w *World) GetState() map[string]*Entity {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	// Return a copy or the map itself?
	// For JSON marshaling, we can just return the map, but need to be careful about concurrency during marshal
	// So we copy.
	state := make(map[string]*Entity, len(w.Entities))
	for k, v := range w.Entities {
		v.Mu.RLock()
		// Shallow copy of entity struct is fine for now
		// Manual copy to avoid copying mutex
		e := Entity{
			ID:                v.ID,
			Name:              v.Name,
			PartyID:           v.PartyID,
			SocialStatus:      v.SocialStatus,
			GuildID:           v.GuildID,
			GuildTag:          v.GuildTag,
			Type:              v.Type,
			SubType:           v.SubType,
			X:                 v.X,
			Y:                 v.Y,
			Z:                 v.Z,
			Rotation:          v.Rotation,
			Health:            v.Health,
			MaxHealth:         v.MaxHealth,
			Mana:              v.Mana,
			MaxMana:           v.MaxMana,
			Level:             v.Level,
			Experience:        v.Experience,
			MaxExperience:     v.MaxExperience,
			ResonanceLevel:    v.ResonanceLevel,
			ResonanceXP:       v.ResonanceXP,
			ResonancePoints:   v.ResonancePoints,
			ResonanceRanks:    nil,
			Gold:              v.Gold,
			LastDailyQuest:    v.LastDailyQuest,
			SkillPoints:       v.SkillPoints,
			SelectedBranch:    v.SelectedBranch,
			UnlockedSkills:    v.UnlockedSkills,
			BaseStats:         v.BaseStats,
			Stats:             v.Stats,
			Damage:            v.Damage,
			Defense:           v.Defense,
			BaseSpeed:         v.BaseSpeed,
			Speed:             v.Speed,
			AttackSpeed:       v.AttackSpeed,
			CooldownReduction: v.CooldownReduction,
			HpRegen:           v.HpRegen,
			ManaRegen:         v.ManaRegen,
			CastSpeed:         v.CastSpeed,
			TargetX:           v.TargetX,
			TargetZ:           v.TargetZ,
			SpawnX:            v.SpawnX,
			SpawnZ:            v.SpawnZ,
			State:             v.State,
			LastMoveSequence:  v.LastMoveSequence,
			LastAttackTime:    v.LastAttackTime,
			AttackCooldown:    v.AttackCooldown,
			LastAbilityTime:   v.LastAbilityTime,
			AbilityCooldown:   v.AbilityCooldown,
			LastRespawnTime:   v.LastRespawnTime,
			MoveLockUntil:     v.MoveLockUntil,
			LootItem:          v.LootItem,
			LootTime:          v.LootTime,
			LootPartyID:       v.LootPartyID,
			CreatedAt:         v.CreatedAt,
			OwnerID:           v.OwnerID,
			VelX:              v.VelX,
			VelZ:              v.VelZ,
			Radius:            v.Radius,
			SpiritsActive:     v.SpiritsActive,
			WhirlwindActive:   v.WhirlwindActive && !v.Disconnected,
			WhirlwindEndTime:  v.WhirlwindEndTime,
			SpiritEndTime:     v.SpiritEndTime,
			LastSpiritTick:    v.LastSpiritTick,
			IsCharging:        v.IsCharging,
			ChargeTargetX:     v.ChargeTargetX,
			ChargeTargetZ:     v.ChargeTargetZ,
			JumpStartX:        v.JumpStartX,
			JumpStartY:        v.JumpStartY,
			JumpStartZ:        v.JumpStartZ,
			JumpTargetX:       v.JumpTargetX,
			JumpTargetY:       v.JumpTargetY,
			JumpTargetZ:       v.JumpTargetZ,
			JumpDuration:      v.JumpDuration,
			JumpElapsed:       v.JumpElapsed,
			JumpHeight:        v.JumpHeight,
			JumpProgress:      v.JumpProgress,
			Equipment:         v.Equipment, // Shallow copy of map is fine if we don't modify it
		}

		// Optimize Equipment for network: Strip descriptions to save bandwidth
		if len(e.Equipment) > 0 {
			newEquip := make(map[string]Item)
			for slot, item := range e.Equipment {
				newItem := item
				newItem.Description = "" // Strip description
				newEquip[slot] = newItem
			}
			e.Equipment = newEquip
		}
		if v.UnlockedSkills != nil {
			e.UnlockedSkills = append([]string(nil), v.UnlockedSkills...)
		}
		if v.ResonanceRanks != nil {
			e.ResonanceRanks = make(map[string]int, len(v.ResonanceRanks))
			for trait, rank := range v.ResonanceRanks {
				e.ResonanceRanks[trait] = rank
			}
		}
		v.Mu.RUnlock()

		state[k] = &e
	}
	return state
}

func (w *World) GetStateForPlayer(playerID string, viewDistance float64) map[string]*Entity {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return make(map[string]*Entity)
	}

	player.Mu.RLock()
	playerX, playerZ, playerInstanceID := player.X, player.Z, player.InstanceID
	player.Mu.RUnlock()

	// Query Grid
	nearby := w.Grid.Nearby(playerX, playerZ, viewDistance, playerInstanceID)

	// Optimization: Pre-allocate map with expected capacity
	// +10 for self, NPCs, and some buffer
	state := make(map[string]*Entity, len(nearby)+10)

	// Always include self
	state[playerID] = w.copyEntity(player)

	// Pre-compute squared view distance to avoid sqrt in loop
	viewDistSq := viewDistance * viewDistance

	for _, v := range nearby {
		if v.ID == playerID {
			continue
		}
		v.Mu.RLock()
		vID, vInstanceID := v.ID, v.InstanceID
		dx := v.X - playerX
		dz := v.Z - playerZ
		v.Mu.RUnlock()
		if vInstanceID != playerInstanceID {
			log.Printf("CRITICAL: GetStateForPlayer LEAK! Player %s (Inst: %s) sees %s (Inst: %s)", playerID, playerInstanceID, vID, vInstanceID)
			continue
		}
		// Precise distance check using squared distance (avoids sqrt)
		distSq := dx*dx + dz*dz

		if distSq <= viewDistSq {
			state[vID] = w.copyEntity(v)
		}
	}
	return state
}
