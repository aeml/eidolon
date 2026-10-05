package game

import (
	"fmt"
	"math"
	"time"
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
	return progressionRequirement(CurrentProgressionVersion, level)
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

// InitialPlayerStats is the existing authoritative new-character baseline for
// every class. Creation and explicit level overrides must share it; prepared
// QA characters must not receive an extra primary-stat bonus. This does not
// normalize or replace an existing character's saved stats.
func InitialPlayerStats() Stats {
	return Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
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

	player.BaseStats = applyLevelGrowth(InitialPlayerStats(), level)
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

// ExperienceRewardReceipt separates ordinary XP from actual cap overflow.
// Reward summaries retain their total XP field for older clients.
type ExperienceRewardReceipt struct {
	XP          int `json:"xp"`
	ResonanceXP int `json:"resonanceXP"`
}

// awardExperienceLocked owns the complete level-to-cap transition. Callers
// must hold the entity lock (or World.Mu in legacy quest code).
func (w *World) awardExperienceLocked(player *Entity, amount int) ExperienceRewardReceipt {
	if player == nil || player.Type != TypePlayer || amount <= 0 {
		return ExperienceRewardReceipt{}
	}
	if player.Level >= MaxPlayerLevel {
		player.Level = MaxPlayerLevel
		player.MaxExperience = experienceRequiredForLevel(MaxPlayerLevel)
		player.Experience = player.MaxExperience
		player.addResonanceExperienceLocked(amount)
		return ExperienceRewardReceipt{ResonanceXP: amount}
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
		// Shared kills can level a downed party member. Earned progression
		// must not heal a corpse or bypass the normal respawn flow.
		if player.Health > 0 && player.State != "DEAD" {
			player.Health = player.MaxHealth
		}
	}
	if player.Level >= MaxPlayerLevel {
		overflow := player.Experience
		player.Experience = player.MaxExperience
		player.addResonanceExperienceLocked(overflow)
		return ExperienceRewardReceipt{XP: amount - overflow, ResonanceXP: overflow}
	}
	return ExperienceRewardReceipt{XP: amount}
}

func (player *Entity) addResonanceExperienceLocked(amount int) {
	if amount <= 0 {
		return
	}
	player.ResonanceXP += amount
	earned := player.ResonanceXP / ResonanceXPPerLevel
	player.ResonanceXP %= ResonanceXPPerLevel
	player.ResonanceLevel += earned
	player.ResonancePoints += earned
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
	return player.EndgameProgress(), true
}

// EndgameProgress returns a detached snapshot shared by login, explicit menu
// requests and live world updates. The receiver may also be an entity copy.
func (player *Entity) EndgameProgress() EndgameProgress {
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	return player.endgameProgressLocked()
}

// Caller owns player.Mu. Both explicit menu reads and lightweight frame reads
// use identical normalization without recursively acquiring the actor lock.
func (player *Entity) endgameProgressLocked() EndgameProgress {
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
	}
}

type WeeklyRaidRewardReceipt struct {
	Gold, ResonanceXP int
	ItemGranted       bool
}

// Called while the death/reward path owns player.Mu. Persisted snapshots now
// retain an owed completion even if its asynchronous database handoff fails.
func (player *Entity) queueWeeklyRaidCompletionLocked(at time.Time) {
	if player.Type != TypePlayer || player.Level < MaxPlayerLevel {
		return
	}
	year, week := at.UTC().ISOWeek()
	key := fmt.Sprintf("%d-W%02d", year, week)
	if player.WeeklyRaidRewardReceipts[key] {
		return
	}
	if player.WeeklyRaidCompletions == nil {
		player.WeeklyRaidCompletions = make(map[string]time.Time)
	}
	if _, exists := player.WeeklyRaidCompletions[key]; !exists {
		player.WeeklyRaidCompletions[key] = at.UTC()
	}
}

// PendingWeeklyRaidCompletions captures only owed completion identities/times,
// including disconnected players. No inventory copies, sessions or IO under
// world/entity locks. Call outside combat callbacks, which may own those locks.
func (w *World) PendingWeeklyRaidCompletions() []WeeklyRaidCompletionEvent {
	w.Mu.RLock()
	players := make([]*Entity, 0, len(w.Entities))
	for _, entity := range w.Entities {
		players = append(players, entity)
	}
	w.Mu.RUnlock()
	var completions []WeeklyRaidCompletionEvent
	for _, player := range players {
		player.Mu.RLock()
		if player.Type == TypePlayer {
			for _, at := range player.WeeklyRaidCompletions {
				completions = append(completions, WeeklyRaidCompletionEvent{PlayerID: player.ID, CompletedAt: at})
			}
		}
		player.Mu.RUnlock()
	}
	return completions
}

func (w *World) ClearWeeklyRaidCompletion(playerID, week string) {
	w.Mu.RLock()
	player := w.Entities[playerID]
	w.Mu.RUnlock()
	if player == nil {
		return
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	delete(player.WeeklyRaidCompletions, week)
}

func (w *World) GrantWeeklyRaidReward(playerID string) bool {
	_, granted := w.GrantWeeklyRaidRewardWithReceipt(playerID)
	return granted
}

// Legacy unkeyed grant used by isolated reward-budget callers. Runtime delivery
// uses GrantWeeklyRaidRewardForWeek and saves its receipt with the actual grant.
func (w *World) GrantWeeklyRaidRewardWithReceipt(playerID string) (WeeklyRaidRewardReceipt, bool) {
	return w.grantWeeklyRaidReward(playerID, "")
}

// GrantWeeklyRaidRewardForWeek applies a prepared entitlement at most once.
// Save the receipt and the full grant together before acknowledging delivery.
func (w *World) GrantWeeklyRaidRewardForWeek(playerID, week string) (WeeklyRaidRewardReceipt, bool) {
	if week == "" {
		return WeeklyRaidRewardReceipt{}, false
	}
	return w.grantWeeklyRaidReward(playerID, week)
}

func (w *World) grantWeeklyRaidReward(playerID, week string) (WeeklyRaidRewardReceipt, bool) {
	w.Mu.RLock()
	player := w.Entities[playerID]
	w.Mu.RUnlock()
	if player == nil {
		return WeeklyRaidRewardReceipt{}, false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	receipt, granted := player.grantWeeklyRaidRewardLocked(week)
	if granted && w.Economy != nil {
		w.Economy.RecordSource("weekly_raid", receipt.Gold)
	}
	return receipt, granted
}

// ApplyWeeklyRaidRewardForWeek also supports a detached, persisted character
// while its account work lock prevents concurrent login or saving.
func (player *Entity) ApplyWeeklyRaidRewardForWeek(week string) (WeeklyRaidRewardReceipt, bool) {
	if week == "" {
		return WeeklyRaidRewardReceipt{}, false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	return player.grantWeeklyRaidRewardLocked(week)
}

func (player *Entity) grantWeeklyRaidRewardLocked(week string) (WeeklyRaidRewardReceipt, bool) {
	if player.Level < MaxPlayerLevel || (week != "" && player.WeeklyRaidRewardReceipts[week]) {
		return WeeklyRaidRewardReceipt{}, false
	}
	goldReward := 15_000
	itemGranted := false
	planned := &Entity{Inventory: cloneItems(player.Inventory)}
	if item := GenerateGuaranteedUniqueEquipment(MaxPlayerLevel); item != nil {
		if planned.AddItemToInventory(*item) > 0 {
			// Never burn a weekly lockout because the inventory was full.
			goldReward += 5_000
		} else {
			itemGranted = true
		}
	}
	// Plan placement and full-bag compensation before touching the character.
	// Refuse unrepresentable wallets/counters without consuming the entitlement
	// or leaving a partial unique-item grant behind.
	if player.Gold < 0 || player.Gold > math.MaxInt-goldReward || player.ResonanceXP < 0 || player.ResonanceXP > math.MaxInt-1_000_000 {
		return WeeklyRaidRewardReceipt{}, false
	}
	earned := (player.ResonanceXP + 1_000_000) / ResonanceXPPerLevel
	if player.ResonanceLevel < 0 || player.ResonancePoints < 0 || player.ResonanceLevel > math.MaxInt-earned || player.ResonancePoints > math.MaxInt-earned {
		return WeeklyRaidRewardReceipt{}, false
	}
	player.Inventory = planned.Inventory
	player.addResonanceExperienceLocked(1_000_000)
	player.Gold += goldReward
	if week != "" {
		if player.WeeklyRaidRewardReceipts == nil {
			player.WeeklyRaidRewardReceipts = make(map[string]bool)
		}
		player.WeeklyRaidRewardReceipts[week] = true
	}
	return WeeklyRaidRewardReceipt{Gold: goldReward, ResonanceXP: 1_000_000, ItemGranted: itemGranted}, true
}
