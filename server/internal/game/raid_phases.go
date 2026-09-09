package game

// RaidPhaseEvent is the narrative and mechanical handoff between Malachar and
// one of the four restored Eidolons during the final encounter.
type RaidPhaseEvent struct {
	InstanceID string `json:"instanceId"`
	Phase      int    `json:"phase"`
	Eidolon    string `json:"eidolon"`
	Element    string `json:"element"`
	Title      string `json:"title"`
	Dialogue   string `json:"dialogue"`
	Effect     string `json:"effect"`
	Color      string `json:"color"`
}

func darkKingPhase(health, maxHealth int) int {
	if maxHealth <= 0 {
		return 1
	}
	ratio := float64(max(0, health)) / float64(maxHealth)
	switch {
	case ratio > 0.75:
		return 1
	case ratio > 0.50:
		return 2
	case ratio > 0.25:
		return 3
	default:
		return 4
	}
}

// Caller holds the target lock. A hit may finish the current quarter of the
// encounter, but cannot consume the next Eidolon's phase before its update/event.
// Every raw damage path must use this, including DoTs, reflection and explosions.
// Ordinary enemies and phase-four lethal damage retain their existing behavior.
func damageWithinDarkKingPhase(target *Entity, damage int) int {
	if target == nil || target.Type != TypeEnemy || target.SubType != "UmbraPrime" ||
		target.MaxHealth < 4 || damage <= 0 || target.RaidPhase >= 4 {
		return damage
	}
	floor := target.MaxHealth
	switch target.RaidPhase {
	case 1:
		floor = target.MaxHealth * 3 / 4
	case 2:
		floor = target.MaxHealth / 2
	case 3:
		floor = target.MaxHealth / 4
	}
	return min(damage, max(0, target.Health-floor))
}

func raidPhaseStory(phase int) RaidPhaseEvent {
	switch phase {
	case 1:
		return RaidPhaseEvent{
			Phase: 1, Eidolon: "Orun", Element: "Earth", Title: "Phase I · The Root Holds",
			Dialogue: "Malachar: I broke four crystals with a single truth: every guardian secretly wishes to rule what it protects. Kneel, and I will make that wish law.",
			Effect:   "Orun anchors the raid. Damage dealt by the Dark King is reduced by 20%.", Color: "#79c267",
		}
	case 2:
		return RaidPhaseEvent{
			Phase: 2, Eidolon: "Neris", Element: "Water", Title: "Phase II · The Tide Remembers",
			Dialogue: "Neris: You carried every stolen name home. Let memory become mercy—and rise with the tide.",
			Effect:   "Neris restores 25% of every living raider's maximum health.", Color: "#62c7ff",
		}
	case 3:
		return RaidPhaseEvent{
			Phase: 3, Eidolon: "Pyralis", Element: "Fire", Title: "Phase III · The Will to Burn",
			Dialogue: "Malachar: I offered Eidolon peace: one throne, one will, no uncertainty. Pyralis: A flame without choice is only ash.",
			Effect:   "Pyralis sears 8% of Malachar's maximum health and exposes him to 25% more player damage.", Color: "#ff7b3d",
		}
	default:
		return RaidPhaseEvent{
			Phase: 4, Eidolon: "Aeral", Element: "Air", Title: "Phase IV · The Unbound Sky",
			Dialogue: "Aeral: No crown can own the wind. Mortal—take the breath of every free horizon and finish this.",
			Effect:   "Aeral restores all mana and the full resonance increases player damage to Malachar by 35%.", Color: "#d6f2ff",
		}
	}
}

// updateDarkKingPhase runs without another entity lock held. A phase begins
// only after at least one living raider is present, so the opening revelation
// cannot be consumed while the instance is still being assembled.
func (w *World) updateDarkKingPhase(boss *Entity, players []*Entity) {
	if boss == nil {
		return
	}
	boss.Mu.RLock()
	instanceID := boss.InstanceID
	boss.Mu.RUnlock()
	hasRaider := false
	for _, player := range players {
		player.Mu.RLock()
		eligible := player.Type == TypePlayer && player.InstanceID == instanceID &&
			player.State != "DEAD" && player.Health > 0 && !player.Disconnected
		player.Mu.RUnlock()
		if eligible {
			hasRaider = true
			break
		}
	}
	if !hasRaider {
		return
	}

	boss.Mu.Lock()
	phase := darkKingPhase(boss.Health, boss.MaxHealth)
	// Recover an already-overshot snapshot in order as well. Health must never
	// cause the opening dialogue or an intervening Eidolon's aid to disappear.
	phase = min(phase, boss.RaidPhase+1)
	if phase <= boss.RaidPhase || boss.State == "DEAD" {
		boss.Mu.Unlock()
		return
	}
	boss.RaidPhase = phase
	if phase == 3 {
		// Eidolon aid cannot kill the boss, but still applies if an older
		// snapshot had already crossed a phase boundary before this update.
		boss.Health -= max(1, boss.MaxHealth*8/100)
		if boss.Health < 1 {
			boss.Health = 1
		}
	}
	boss.Mu.Unlock()

	for _, player := range players {
		player.Mu.Lock()
		if player.Type != TypePlayer || player.InstanceID != instanceID || player.State == "DEAD" ||
			player.Health <= 0 || player.Disconnected {
			player.Mu.Unlock()
			continue
		}
		if phase == 2 {
			player.Health = min(player.MaxHealth, player.Health+max(1, player.MaxHealth/4))
		}
		if phase == 4 {
			player.Mana = player.MaxMana
		}
		player.Mu.Unlock()
	}

	if w.OnEvent != nil {
		event := raidPhaseStory(phase)
		event.InstanceID = instanceID
		w.OnEvent("raid_phase", event)
	}
}
