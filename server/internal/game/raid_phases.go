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
		eligible := player.InstanceID == instanceID && player.State != "DEAD"
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
	if phase <= boss.RaidPhase || boss.State == "DEAD" {
		boss.Mu.Unlock()
		return
	}
	boss.RaidPhase = phase
	if phase == 3 {
		boss.Health -= max(1, boss.MaxHealth*8/100)
		if boss.Health < 1 {
			boss.Health = 1
		}
	}
	boss.Mu.Unlock()

	for _, player := range players {
		player.Mu.Lock()
		if player.InstanceID != instanceID || player.State == "DEAD" {
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
