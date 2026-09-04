package game

import (
	"fmt"
	"math"
)

const (
	ResonanceXPPerLevel = 5_000_000
	MaxResonanceRank    = 50
)

var resonanceTraits = map[string]struct{}{"power": {}, "ward": {}, "fortune": {}}

type EndgameProgress struct {
	Unlocked        bool           `json:"unlocked"`
	Level           int            `json:"level"`
	XP              int            `json:"xp"`
	XPToNext        int            `json:"xpToNext"`
	AvailablePoints int            `json:"availablePoints"`
	Ranks           map[string]int `json:"ranks"`
}

func experienceRequiredForLevel(level int) int {
	if level <= 1 {
		return 100
	}
	return int(100 * math.Pow(1.2, float64(level-1)))
}

func ExperienceRequiredForLevel(level int) int {
	return experienceRequiredForLevel(level)
}

// NormalizeResonanceProgress rejects corrupted or legacy values before an
// entity enters the authoritative world. Trait spending can never exceed the
// number of earned Resonance levels.
func (player *Entity) NormalizeResonanceProgress() {
	if player.ResonanceLevel < 0 {
		player.ResonanceLevel = 0
	}
	player.ResonanceXP = max(0, min(ResonanceXPPerLevel-1, player.ResonanceXP))
	remaining := player.ResonanceLevel
	normalized := make(map[string]int, len(resonanceTraits))
	for _, trait := range []string{"power", "ward", "fortune"} {
		rank := max(0, min(MaxResonanceRank, player.ResonanceRanks[trait]))
		rank = min(rank, remaining)
		normalized[trait] = rank
		remaining -= rank
	}
	player.ResonanceRanks = normalized
	player.ResonancePoints = max(0, min(player.ResonancePoints, remaining))
}

func canonicalBaseStatsForClass(classType string) Stats {
	switch classType {
	case "Fighter":
		return Stats{Strength: 20, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
	case "Rogue":
		return Stats{Strength: 10, Dexterity: 20, Intelligence: 10, Wisdom: 10, Vitality: 10}
	case "Wizard":
		return Stats{Strength: 10, Dexterity: 10, Intelligence: 20, Wisdom: 10, Vitality: 10}
	case "Cleric":
		return Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 20, Vitality: 10}
	default:
		return Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
	}
}

func applyLevelGrowth(base Stats, level int) Stats {
	if level <= 1 {
		return base
	}
	growth := level - 1
	base.Vitality += growth * 2
	base.Strength += growth * 2
	base.Dexterity += growth
	base.Intelligence += growth
	base.Wisdom += growth
	return base
}

func (w *World) SetPlayerLevel(playerID string, level int) (*Entity, bool) {
	if level < 1 || level > MaxPlayerLevel {
		return nil, false
	}

	w.Mu.Lock()
	player, ok := w.Entities[playerID]
	if !ok {
		w.Mu.Unlock()
		return nil, false
	}

	player.BaseStats = applyLevelGrowth(canonicalBaseStatsForClass(player.SubType), level)
	player.Level = level
	player.Experience = 0
	player.MaxExperience = experienceRequiredForLevel(level)
	player.SkillPoints = max(0, level/10)
	w.Mu.Unlock()

	player.recomputeTalentPoints()
	if player.SelectedBranch != "" {
		w.UpdateUnlockedSkills(player)
	}
	player.RecalculateStats()
	player.Mu.Lock()
	player.Health = player.MaxHealth
	player.Mana = player.MaxMana
	player.Mu.Unlock()

	return player, true
}

// awardExperienceLocked owns the complete level-to-cap transition. Callers
// must hold the entity lock (or World.Mu in legacy quest code).
func (w *World) awardExperienceLocked(player *Entity, amount int) {
	if player == nil || player.Type != TypePlayer || amount <= 0 {
		return
	}
	if player.Level >= MaxPlayerLevel {
		player.Level = MaxPlayerLevel
		player.MaxExperience = experienceRequiredForLevel(MaxPlayerLevel)
		player.Experience = player.MaxExperience
		player.addResonanceExperienceLocked(amount)
		return
	}
	if player.MaxExperience <= 0 {
		player.MaxExperience = experienceRequiredForLevel(max(1, player.Level))
	}
	player.Experience += amount
	for player.Level < MaxPlayerLevel && player.Experience >= player.MaxExperience {
		player.Experience -= player.MaxExperience
		player.Level++
		player.MaxExperience = experienceRequiredForLevel(player.Level)
		player.recomputeTalentPoints()
		w.UpdateUnlockedSkills(player)
		player.BaseStats.Vitality += 2
		player.BaseStats.Strength += 2
		player.BaseStats.Dexterity++
		player.BaseStats.Intelligence++
		player.BaseStats.Wisdom++
		player.RecalculateStats()
		player.Health = player.MaxHealth
	}
	if player.Level >= MaxPlayerLevel {
		overflow := player.Experience
		player.Experience = player.MaxExperience
		player.addResonanceExperienceLocked(overflow)
	}
}

func (player *Entity) addResonanceExperienceLocked(amount int) {
	if amount <= 0 {
		return
	}
	player.ResonanceXP += amount
	for player.ResonanceXP >= ResonanceXPPerLevel {
		player.ResonanceXP -= ResonanceXPPerLevel
		player.ResonanceLevel++
		player.ResonancePoints++
	}
}

func awardRoomExperienceLocked(player *Entity, amount int) {
	if player == nil || amount <= 0 {
		return
	}
	if player.Level >= MaxPlayerLevel {
		player.Level = MaxPlayerLevel
		player.MaxExperience = experienceRequiredForLevel(MaxPlayerLevel)
		player.Experience = player.MaxExperience
		player.addResonanceExperienceLocked(amount)
		return
	}
	// Room rewards historically accumulate toward the next level while boss,
	// combat, and quest completion own the actual level-up transition.
	player.Experience += amount
}

func (w *World) SpendResonancePoint(playerID, trait string) (*Entity, error) {
	if _, ok := resonanceTraits[trait]; !ok {
		return nil, fmt.Errorf("unknown resonance trait")
	}
	w.Mu.RLock()
	player := w.Entities[playerID]
	w.Mu.RUnlock()
	if player == nil {
		return nil, fmt.Errorf("player not found")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Level < MaxPlayerLevel {
		return nil, fmt.Errorf("resonance unlocks at level %d", MaxPlayerLevel)
	}
	if player.ResonancePoints <= 0 {
		return nil, fmt.Errorf("no resonance points available")
	}
	if player.ResonanceRanks == nil {
		player.ResonanceRanks = make(map[string]int)
	}
	if player.ResonanceRanks[trait] >= MaxResonanceRank {
		return nil, fmt.Errorf("resonance trait is at maximum rank")
	}
	player.ResonanceRanks[trait]++
	player.ResonancePoints--
	player.RecalculateStats()
	return player, nil
}

func resonanceRewardMultiplier(player *Entity) float64 {
	if player == nil || player.ResonanceRanks == nil {
		return 1
	}
	rank := max(0, min(MaxResonanceRank, player.ResonanceRanks["fortune"]))
	return 1 + float64(rank)*0.01
}

func (w *World) EndgameProgressForPlayer(playerID string) (EndgameProgress, bool) {
	w.Mu.RLock()
	player := w.Entities[playerID]
	w.Mu.RUnlock()
	if player == nil {
		return EndgameProgress{}, false
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	ranks := map[string]int{"power": 0, "ward": 0, "fortune": 0}
	for trait, rank := range player.ResonanceRanks {
		if _, exists := resonanceTraits[trait]; exists {
			ranks[trait] = max(0, min(MaxResonanceRank, rank))
		}
	}
	return EndgameProgress{
		Unlocked: player.Level >= MaxPlayerLevel, Level: player.ResonanceLevel,
		XP: player.ResonanceXP, XPToNext: ResonanceXPPerLevel,
		AvailablePoints: player.ResonancePoints, Ranks: ranks,
	}, true
}

func (w *World) GrantWeeklyRaidReward(playerID string) bool {
	w.Mu.RLock()
	player := w.Entities[playerID]
	w.Mu.RUnlock()
	if player == nil {
		return false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Level < MaxPlayerLevel {
		return false
	}
	player.addResonanceExperienceLocked(ResonanceXPPerLevel)
	player.Gold += 50_000
	if item := GenerateGuaranteedUniqueEquipment(MaxPlayerLevel); item != nil {
		if player.AddItemToInventory(*item) > 0 {
			// Never burn a weekly lockout because the inventory was full.
			player.Gold += 10_000
		}
	}
	if w.Economy != nil {
		w.Economy.RecordSource("weekly_raid", 50_000)
	}
	return true
}
