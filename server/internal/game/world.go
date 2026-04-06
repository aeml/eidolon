package game

import (
	"eidolon-server/internal/database"
	"fmt"
	"hash/fnv"
	"log"
	"math"
	"math/rand"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type TalentBonus struct {
	// Generic stat bonuses (applied to all abilities)
	FlatStrength     int
	FlatDexterity    int
	FlatIntelligence int
	FlatWisdom       int
	FlatVitality     int
	FlatDamage       int
	FlatDefense      int
	PctMaxHealth     float64
	PctDamage        float64
	PctSpeed         float64
	AddCdr           float64

	// Skill-specific bonuses
	SkillName       string  // Which skill this bonus applies to (empty = generic)
	SkillDamage     float64 // +X% damage for this skill
	SkillCdr        float64 // +X% CDR for this skill
	SkillRange      float64 // +X% range for this skill
	SkillDuration   float64 // +X% duration for this skill
	SkillAoe        float64 // +X% AoE radius for this skill
	SkillManaCost   float64 // -X% mana cost for this skill (negative = reduction)
	SkillCritChance float64 // +X% crit chance for this skill
	SkillHealing    float64 // +X% healing for this skill (Cleric)
}

type TalentDef struct {
	MaxRank int
	PerRank TalentBonus
}

func talentDefForID(classType, talentID string) (TalentDef, bool) {
	// IDs are per-class and numeric: FTR_01..FTR_40, ROG_01..ROG_40, WIZ_01..WIZ_40, CLR_01..CLR_40
	prefix := ""
	switch classType {
	case "Fighter":
		prefix = "FTR_"
	case "Rogue":
		prefix = "ROG_"
	case "Wizard":
		prefix = "WIZ_"
	case "Cleric":
		prefix = "CLR_"
	default:
		return TalentDef{}, false
	}
	if !strings.HasPrefix(talentID, prefix) {
		return TalentDef{}, false
	}
	n, err := strconv.Atoi(strings.TrimPrefix(talentID, prefix))
	if err != nil || n < 1 || n > 40 {
		return TalentDef{}, false
	}

	// Talents 1-26: Skill-specific (13 skills × 2 talents each: Mastery=+damage, Technique=+utility)
	// Talents 27-40: Generic class talents
	switch classType {
	case "Fighter":
		return fighterTalentDef(n)
	case "Rogue":
		return rogueTalentDef(n)
	case "Wizard":
		return wizardTalentDef(n)
	case "Cleric":
		return clericTalentDef(n)
	}

	return TalentDef{}, false
}

// Fighter skill order: Charge, Whirlwind, Shield Slam, Iron Fortress, Guardian Roar,
// Sweeping Strike, Earthshaker, Unbreakable Grip, Juggernaut Charge, Berserker Edge,
// Shattering Charge, Executioner Spin, Last Stand Rampage
var fighterSkills = []string{
	"Charge", "Whirlwind", "Shield Slam", "Iron Fortress", "Guardian Roar",
	"Sweeping Strike", "Earthshaker", "Unbreakable Grip", "Juggernaut Charge", "Berserker Edge",
	"Shattering Charge", "Executioner Spin", "Last Stand Rampage",
}

func fighterTalentDef(n int) (TalentDef, bool) {
	// Talents 1-26: Skill-specific (odd=Mastery +damage, even=Technique +utility)
	if n <= 26 {
		skillIdx := (n - 1) / 2
		if skillIdx >= len(fighterSkills) {
			return TalentDef{}, false
		}
		skillName := fighterSkills[skillIdx]
		isMastery := (n % 2) == 1

		if isMastery {
			// Mastery: +4% skill damage per rank (max 20% at rank 5)
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillDamage: 0.04}}, true
		} else {
			// Technique: +3% CDR and +2% AoE/range per rank
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillCdr: 0.03, SkillAoe: 0.02}}, true
		}
	}

	// Talents 27-40: Generic Fighter talents
	switch n {
	case 27: // Combat Discipline - ability uptime
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.01}}, true
	case 28: // Battle Breathing - mana efficiency
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillManaCost: -0.03}}, true
	case 29: // Threat Mastery - damage
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctDamage: 0.02}}, true
	case 30: // Crowd Control Drills - stun effectiveness (duration via generic)
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDuration: 0.04}}, true
	case 31: // Frontliner Routine - survivability
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctMaxHealth: 0.02}}, true
	case 32: // Heavy Weapon Technique - damage patterns
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatStrength: 3}}, true
	case 33: // Lineholder Instinct - area coverage
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillAoe: 0.03}}, true
	case 34: // Rally Presence - party support
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatVitality: 2, PctMaxHealth: 0.01}}, true
	case 35: // Aggressor Footwork - repositioning
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctSpeed: 0.02}}, true
	case 36: // Shieldwall Training - defensive
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatDefense: 2}}, true
	case 37: // Breakthrough - debuffs
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDuration: 0.03}}, true
	case 38: // Enduring Rhythm - sustained AoE
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDamage: 0.02, SkillAoe: 0.02}}, true
	case 39: // Battlefield Awareness - consistency
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillCritChance: 0.02}}, true
	case 40: // Vanguard Momentum - chaining
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.015}}, true
	}
	return TalentDef{}, false
}

// Rogue skill order: Piercing Throw, Backstab, Weak Point Mark, Shadow Lunge, Death Spiral,
// Fan of Knives, Serrated Edges, Blade Storm, Phantom Volley, Smoke Bomb,
// Poison Coating, Tripwire, Cloak & Vanish
var rogueSkills = []string{
	"Piercing Throw", "Backstab", "Weak Point Mark", "Shadow Lunge", "Death Spiral",
	"Fan of Knives", "Serrated Edges", "Blade Storm", "Phantom Volley", "Smoke Bomb",
	"Poison Coating", "Tripwire", "Cloak & Vanish",
}

func rogueTalentDef(n int) (TalentDef, bool) {
	if n <= 26 {
		skillIdx := (n - 1) / 2
		if skillIdx >= len(rogueSkills) {
			return TalentDef{}, false
		}
		skillName := rogueSkills[skillIdx]
		isMastery := (n % 2) == 1

		if isMastery {
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillDamage: 0.04}}, true
		} else {
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillCdr: 0.03, SkillCritChance: 0.02}}, true
		}
	}

	switch n {
	case 27: // Opportunist's Flow - chaining
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.015}}, true
	case 28: // Dirty Tricks - debuffs
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDuration: 0.04}}, true
	case 29: // Quickhands - responsiveness
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctSpeed: 0.02}}, true
	case 30: // Shadow Poise - survivability
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatDefense: 1, PctMaxHealth: 0.01}}, true
	case 31: // Silent Balance - mobility
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctSpeed: 0.02}}, true
	case 32: // Needle Precision - single target
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillCritChance: 0.03}}, true
	case 33: // Lightstep - escape tools
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillCdr: 0.02, PctSpeed: 0.01}}, true
	case 34: // Fine Motor - multi-target
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillAoe: 0.03}}, true
	case 35: // Catlike Reflexes - cooldowns
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.01}}, true
	case 36: // Quick Draw - throws
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillRange: 0.03}}, true
	case 37: // Evasive Flow - defensive
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatDexterity: 3}}, true
	case 38: // Close-Quarters Grace - melee
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDamage: 0.02}}, true
	case 39: // Edge Awareness - positioning
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillCritChance: 0.02}}, true
	case 40: // Wrist Control - burst
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctDamage: 0.02}}, true
	}
	return TalentDef{}, false
}

// Wizard skill order: Fireball, Flame Whip, Flame Tornado, Meteor Drop, Inferno Cataclysm,
// Scorch Beam, Arcane Missiles, Spell Focus, Dragonfire Lance, Teleport,
// Arcane Shield, Gravity Well, Time Warp
var wizardSkills = []string{
	"Fireball", "Flame Whip", "Flame Tornado", "Meteor Drop", "Inferno Cataclysm",
	"Scorch Beam", "Arcane Missiles", "Spell Focus", "Dragonfire Lance", "Teleport",
	"Arcane Shield", "Gravity Well", "Time Warp",
}

func wizardTalentDef(n int) (TalentDef, bool) {
	if n <= 26 {
		skillIdx := (n - 1) / 2
		if skillIdx >= len(wizardSkills) {
			return TalentDef{}, false
		}
		skillName := wizardSkills[skillIdx]
		isMastery := (n % 2) == 1

		if isMastery {
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillDamage: 0.04}}, true
		} else {
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillCdr: 0.03, SkillManaCost: -0.02}}, true
		}
	}

	switch n {
	case 27: // Efficient Casting - mana
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillManaCost: -0.04}}, true
	case 28: // Quickened Formulae - CDR
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.015}}, true
	case 29: // Runic Precision - projectiles
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillRange: 0.03}}, true
	case 30: // Leyline Recall - mobility
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: "Teleport", SkillCdr: 0.05}}, true
	case 31: // Overchannel - burst
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctDamage: 0.02}}, true
	case 32: // Arcane Stability - defensive
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: "Arcane Shield", SkillDuration: 0.05}}, true
	case 33: // Elemental Rhythm - chaining
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.01}}, true
	case 34: // Prismatic Control - CC
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDuration: 0.04}}, true
	case 35: // Aether Reach - range
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillRange: 0.04}}, true
	case 36: // Volatile Insight - AoE
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillAoe: 0.03}}, true
	case 37: // Channel Discipline - reliability
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatIntelligence: 3}}, true
	case 38: // Mana Geometry - placement
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillAoe: 0.02, SkillRange: 0.02}}, true
	case 39: // Sigil Mastery - consistency
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillCritChance: 0.02}}, true
	case 40: // Contingency Wards - survivability
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctMaxHealth: 0.02, FlatWisdom: 2}}, true
	}
	return TalentDef{}, false
}

// Cleric skill order: Spirit Guardians, Healing Light, Guardian Embrace, Purifying Wave, Divine Intervention,
// Radiant Strike, Consecrated Ground, Spirit Guardians Boost, Avenging Seraph, Blessing of Resolve,
// Blessing of Zeal, Mark of Weakness, Heaven's Trumpet
var clericSkills = []string{
	"Spirit Guardians", "Healing Light", "Guardian Embrace", "Purifying Wave", "Divine Intervention",
	"Radiant Strike", "Consecrated Ground", "Spirit Guardians Boost", "Avenging Seraph", "Blessing of Resolve",
	"Blessing of Zeal", "Mark of Weakness", "Heaven's Trumpet",
}

func clericTalentDef(n int) (TalentDef, bool) {
	if n <= 26 {
		skillIdx := (n - 1) / 2
		if skillIdx >= len(clericSkills) {
			return TalentDef{}, false
		}
		skillName := clericSkills[skillIdx]
		isMastery := (n % 2) == 1

		if isMastery {
			// Cleric mastery: +healing or +damage depending on skill
			if skillName == "Healing Light" || skillName == "Guardian Embrace" ||
				skillName == "Divine Intervention" || skillName == "Purifying Wave" {
				return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillHealing: 0.04}}, true
			}
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillDamage: 0.04}}, true
		} else {
			return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: skillName, SkillCdr: 0.03, SkillDuration: 0.02}}, true
		}
	}

	switch n {
	case 27: // Efficient Rites - mana
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillManaCost: -0.04}}, true
	case 28: // Rites of Haste - CDR
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.015}}, true
	case 29: // Mercy Routine - sustained healing
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillHealing: 0.03}}, true
	case 30: // Sanctuary Practice - protective
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDuration: 0.04}}, true
	case 31: // Radiant Doctrine - damage
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctDamage: 0.02}}, true
	case 32: // Cleanse Discipline - cleansing
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillName: "Purifying Wave", SkillCdr: 0.05}}, true
	case 33: // Chorus of Faith - party buffs
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillDuration: 0.03}}, true
	case 34: // Battlefield Ministry - area effects
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillAoe: 0.03}}, true
	case 35: // Warden's Instinct - survivability
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctMaxHealth: 0.02}}, true
	case 36: // Blessed Footwork - repositioning
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{PctSpeed: 0.02}}, true
	case 37: // Hymncraft - chaining
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{AddCdr: 0.01}}, true
	case 38: // Pilgrim Patience - sustain
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatWisdom: 3}}, true
	case 39: // Mercy Doctrine - support
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{SkillHealing: 0.02, SkillDuration: 0.02}}, true
	case 40: // Ritekeeper - consistency
		return TalentDef{MaxRank: 5, PerRank: TalentBonus{FlatDefense: 2, AddCdr: 0.01}}, true
	}
	return TalentDef{}, false
}

// NormalizeTalentRank clamps a rank to the allowed range for the given class/talent ID.
// Returns (normalizedRank, true) if the talent ID is valid for the class and rank > 0.
func NormalizeTalentRank(classType, talentID string, rank int) (int, bool) {
	if talentID == "" || rank <= 0 {
		return 0, false
	}
	def, ok := talentDefForID(classType, talentID)
	if !ok {
		return 0, false
	}
	if rank > def.MaxRank {
		rank = def.MaxRank
	}
	return rank, true
}

// NormalizeTalentRanks removes invalid talent IDs and clamps ranks to max rank.
// This prevents cross-class or corrupted saves from consuming points.
func (e *Entity) NormalizeTalentRanks() {
	if e == nil || e.TalentRanks == nil {
		return
	}
	// Canonicalize keys (e.g., CLR_1 -> CLR_01) so client and server agree on IDs.
	// Also removes invalid talent IDs and clamps ranks to max rank.
	canon := make(map[string]int, len(e.TalentRanks))
	for tid, r := range e.TalentRanks {
		nr, ok := NormalizeTalentRank(e.SubType, tid, r)
		if !ok {
			continue
		}
		canonicalID, ok := CanonicalizeTalentID(e.SubType, tid)
		if !ok {
			continue
		}
		// If multiple legacy IDs collapse into the same canonical ID, keep the higher rank.
		if existing, exists := canon[canonicalID]; !exists || nr > existing {
			canon[canonicalID] = nr
		}
	}
	e.TalentRanks = canon
}

// CanonicalizeTalentID converts a talent ID into its zero-padded canonical form.
// Example: CLR_1 -> CLR_01. Returns (canonicalID, true) if the ID is valid for the class.
func CanonicalizeTalentID(classType, talentID string) (string, bool) {
	// IDs are per-class and numeric (accepts legacy unpadded forms like CLR_1),
	// canonical output is zero-padded: CLR_01.
	prefix := ""
	switch classType {
	case "Fighter":
		prefix = "FTR_"
	case "Rogue":
		prefix = "ROG_"
	case "Wizard":
		prefix = "WIZ_"
	case "Cleric":
		prefix = "CLR_"
	default:
		return "", false
	}
	if !strings.HasPrefix(talentID, prefix) {
		return "", false
	}
	n, err := strconv.Atoi(strings.TrimPrefix(talentID, prefix))
	if err != nil || n < 1 || n > 40 {
		return "", false
	}
	return fmt.Sprintf("%s%02d", prefix, n), true
}

// GetSkillBonus returns the total skill-specific bonus for a given skill from an entity's talents.
// Returns the accumulated bonuses from all relevant talents.
func (e *Entity) GetSkillBonus(skillName string) TalentBonus {
	if e == nil || e.TalentRanks == nil {
		return TalentBonus{}
	}

	var total TalentBonus
	for talentID, rank := range e.TalentRanks {
		if rank <= 0 {
			continue
		}
		def, ok := talentDefForID(e.SubType, talentID)
		if !ok {
			continue
		}
		bonus := def.PerRank
		// Only apply skill-specific bonuses if the skill matches
		if bonus.SkillName != "" && bonus.SkillName != skillName {
			continue
		}
		// Accumulate bonuses (multiply by rank)
		total.FlatStrength += bonus.FlatStrength * rank
		total.FlatDexterity += bonus.FlatDexterity * rank
		total.FlatIntelligence += bonus.FlatIntelligence * rank
		total.FlatWisdom += bonus.FlatWisdom * rank
		total.FlatVitality += bonus.FlatVitality * rank
		total.FlatDamage += bonus.FlatDamage * rank
		total.FlatDefense += bonus.FlatDefense * rank
		total.PctMaxHealth += bonus.PctMaxHealth * float64(rank)
		total.PctDamage += bonus.PctDamage * float64(rank)
		total.PctSpeed += bonus.PctSpeed * float64(rank)
		total.AddCdr += bonus.AddCdr * float64(rank)
		// Skill-specific
		if bonus.SkillName == skillName || bonus.SkillName == "" {
			total.SkillDamage += bonus.SkillDamage * float64(rank)
			total.SkillCdr += bonus.SkillCdr * float64(rank)
			total.SkillRange += bonus.SkillRange * float64(rank)
			total.SkillDuration += bonus.SkillDuration * float64(rank)
			total.SkillAoe += bonus.SkillAoe * float64(rank)
			total.SkillManaCost += bonus.SkillManaCost * float64(rank)
			total.SkillCritChance += bonus.SkillCritChance * float64(rank)
			total.SkillHealing += bonus.SkillHealing * float64(rank)
		}
	}
	return total
}

// GetSkillDamageMultiplier returns 1.0 + skill damage bonus for a given skill
func (e *Entity) GetSkillDamageMultiplier(skillName string) float64 {
	bonus := e.GetSkillBonus(skillName)
	return 1.0 + bonus.SkillDamage
}

// GetSkillCdrBonus returns the CDR bonus for a given skill (0.0 to 1.0)
func (e *Entity) GetSkillCdrBonus(skillName string) float64 {
	bonus := e.GetSkillBonus(skillName)
	return bonus.SkillCdr
}

func (e *Entity) maxTalentPoints() int {
	if e == nil {
		return 0
	}
	if e.Level < 5 {
		return 0
	}
	return e.Level / 5
}

func (e *Entity) recomputeTalentPoints() {
	if e == nil {
		return
	}
	spent := 0
	for tid, r := range e.TalentRanks {
		nr, ok := NormalizeTalentRank(e.SubType, tid, r)
		if !ok {
			continue
		}
		spent += nr
	}
	available := e.maxTalentPoints() - spent
	if available < 0 {
		available = 0
	}
	e.TalentPoints = available
}

func experienceRequiredForLevel(level int) int {
	if level <= 1 {
		return 100
	}
	return int(100 * math.Pow(1.2, float64(level-1)))
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

// ============================================================
// SKILL RUNE SYSTEM
// Each skill can have one rune equipped from 3 options
// Runes unlock at levels 50, 70, and 90
// ============================================================

// SkillRuneDef defines a single rune option for a skill
type SkillRuneDef struct {
	ID          string `json:"id"`          // Unique rune ID e.g. "charge_momentum"
	Name        string `json:"name"`        // Display name e.g. "Momentum"
	Skill       string `json:"skill"`       // Skill this modifies e.g. "Charge"
	UnlockLevel int    `json:"unlockLevel"` // 50, 70, or 90
	Description string `json:"description"` // Effect description
}

// GetAllRunesForClass returns all rune definitions for a class
func GetAllRunesForClass(classType string) []SkillRuneDef {
	switch classType {
	case "Fighter":
		return fighterRunes
	case "Rogue":
		return rogueRunes
	case "Wizard":
		return wizardRunes
	case "Cleric":
		return clericRunes
	default:
		return nil
	}
}

// GetRunesForSkill returns available runes for a specific skill
func GetRunesForSkill(classType, skillName string) []SkillRuneDef {
	allRunes := GetAllRunesForClass(classType)
	var result []SkillRuneDef
	for _, r := range allRunes {
		if r.Skill == skillName {
			result = append(result, r)
		}
	}
	return result
}

// GetRuneDef returns the rune definition for a given rune ID
func GetRuneDef(runeID string) (SkillRuneDef, bool) {
	allRunes := append(fighterRunes, rogueRunes...)
	allRunes = append(allRunes, wizardRunes...)
	allRunes = append(allRunes, clericRunes...)
	for _, r := range allRunes {
		if r.ID == runeID {
			return r, true
		}
	}
	return SkillRuneDef{}, false
}

// GetUnlockedRunes returns runes the player can equip based on their level
func GetUnlockedRunes(classType string, level int) []SkillRuneDef {
	allRunes := GetAllRunesForClass(classType)
	var result []SkillRuneDef
	for _, r := range allRunes {
		if level >= r.UnlockLevel {
			result = append(result, r)
		}
	}
	return result
}

// HasRune checks if the entity has a specific rune equipped
func (e *Entity) HasRune(runeID string) bool {
	if e == nil || e.SkillRunes == nil {
		return false
	}
	for _, r := range e.SkillRunes {
		if r == runeID {
			return true
		}
	}
	return false
}

// GetRuneForSkill returns the equipped rune ID for a skill (empty if none)
func (e *Entity) GetRuneForSkill(skillName string) string {
	if e == nil || e.SkillRunes == nil {
		return ""
	}
	runeID, ok := e.SkillRunes[skillName]
	if !ok {
		return ""
	}
	return runeID
}

// Fighter Runes (9 skills × 3 runes = 27 runes, but we'll focus on key skills)
var fighterRunes = []SkillRuneDef{
	// Charge Runes
	{ID: "charge_momentum", Name: "Momentum", Skill: "Charge", UnlockLevel: 50, Description: "+50% range, damage scales with distance traveled"},
	{ID: "charge_shockwave", Name: "Shockwave", Skill: "Charge", UnlockLevel: 70, Description: "Ends with knockback AoE (5 unit radius)"},
	{ID: "charge_unstoppable", Name: "Unstoppable", Skill: "Charge", UnlockLevel: 90, Description: "CC immune during charge, +20% armor for 5s after"},
	// Whirlwind Runes
	{ID: "whirlwind_extended", Name: "Extended", Skill: "Whirlwind", UnlockLevel: 50, Description: "+100% duration, -50% damage"},
	{ID: "whirlwind_bladestorm", Name: "Bladestorm", Skill: "Whirlwind", UnlockLevel: 70, Description: "Pulls enemies toward you"},
	{ID: "whirlwind_bloodwhirl", Name: "Bloodwhirl", Skill: "Whirlwind", UnlockLevel: 90, Description: "Heals 2% HP per enemy hit"},
	// Shield Slam Runes
	{ID: "shieldslam_concussion", Name: "Concussion", Skill: "Shield Slam", UnlockLevel: 50, Description: "Stun duration +1s"},
	{ID: "shieldslam_reverberation", Name: "Reverberation", Skill: "Shield Slam", UnlockLevel: 70, Description: "Hits twice"},
	{ID: "shieldslam_fortify", Name: "Fortify", Skill: "Shield Slam", UnlockLevel: 90, Description: "Grants shield equal to damage dealt"},
	// Iron Fortress Runes
	{ID: "ironfortress_extended", Name: "Extended", Skill: "Iron Fortress", UnlockLevel: 50, Description: "+50% duration"},
	{ID: "ironfortress_thorns", Name: "Thorns", Skill: "Iron Fortress", UnlockLevel: 70, Description: "Reflect 20% damage while active"},
	{ID: "ironfortress_immovable", Name: "Immovable", Skill: "Iron Fortress", UnlockLevel: 90, Description: "Cannot be knocked back or pulled"},
	// Earthshaker Runes
	{ID: "earthshaker_fissure", Name: "Fissure", Skill: "Earthshaker", UnlockLevel: 50, Description: "Creates line AoE instead of circle"},
	{ID: "earthshaker_aftershock", Name: "Aftershock", Skill: "Earthshaker", UnlockLevel: 70, Description: "Second smaller quake after 1s"},
	{ID: "earthshaker_seismic", Name: "Seismic", Skill: "Earthshaker", UnlockLevel: 90, Description: "+100% knockdown duration"},
}

// Rogue Runes
var rogueRunes = []SkillRuneDef{
	// Piercing Throw Runes
	{ID: "piercingthrow_ricochet", Name: "Ricochet", Skill: "Piercing Throw", UnlockLevel: 50, Description: "Bounces to 2 additional targets"},
	{ID: "piercingthrow_serrated", Name: "Serrated", Skill: "Piercing Throw", UnlockLevel: 70, Description: "Applies bleed (5s DoT)"},
	{ID: "piercingthrow_executioner", Name: "Executioner", Skill: "Piercing Throw", UnlockLevel: 90, Description: "+100% damage to targets below 30% HP"},
	// Backstab Runes
	{ID: "backstab_ambush", Name: "Ambush", Skill: "Backstab", UnlockLevel: 50, Description: "+50% crit chance"},
	{ID: "backstab_eviscerate", Name: "Eviscerate", Skill: "Backstab", UnlockLevel: 70, Description: "Ignores 50% armor"},
	{ID: "backstab_shadowstep", Name: "Shadowstep", Skill: "Backstab", UnlockLevel: 90, Description: "Teleport behind target before striking"},
	// Fan of Knives Runes
	{ID: "fanofknives_weighted", Name: "Weighted", Skill: "Fan of Knives", UnlockLevel: 50, Description: "Slows enemies hit by 30% for 3s"},
	{ID: "fanofknives_poisoned", Name: "Poisoned", Skill: "Fan of Knives", UnlockLevel: 70, Description: "Applies poison DoT"},
	{ID: "fanofknives_fury", Name: "Bladed Fury", Skill: "Fan of Knives", UnlockLevel: 90, Description: "Double the number of knives"},
	// Shadow Lunge Runes
	{ID: "shadowlunge_extended", Name: "Extended", Skill: "Shadow Lunge", UnlockLevel: 50, Description: "+50% range"},
	{ID: "shadowlunge_cripple", Name: "Cripple", Skill: "Shadow Lunge", UnlockLevel: 70, Description: "Slows target by 50% for 3s"},
	{ID: "shadowlunge_shadow", Name: "Shadow Clone", Skill: "Shadow Lunge", UnlockLevel: 90, Description: "Creates illusion that attacks once"},
	// Cloak and Vanish Runes
	{ID: "cloak_swift", Name: "Swift", Skill: "Cloak & Vanish", UnlockLevel: 50, Description: "+30% movement speed while invisible"},
	{ID: "cloak_longer", Name: "Lasting Shadow", Skill: "Cloak & Vanish", UnlockLevel: 70, Description: "+100% invisibility duration"},
	{ID: "cloak_ambush", Name: "Prepared Ambush", Skill: "Cloak & Vanish", UnlockLevel: 90, Description: "Next attack deals +100% damage"},
}

// Wizard Runes
var wizardRunes = []SkillRuneDef{
	// Fireball Runes
	{ID: "fireball_magma", Name: "Magma Orb", Skill: "Fireball", UnlockLevel: 50, Description: "Slower projectile, leaves burning ground for 3s"},
	{ID: "fireball_chain", Name: "Chain Reaction", Skill: "Fireball", UnlockLevel: 70, Description: "Bounces to 3 additional targets at 50% damage"},
	{ID: "fireball_empowered", Name: "Empowered", Skill: "Fireball", UnlockLevel: 90, Description: "+100% damage, +3s cooldown"},
	// Meteor Drop Runes
	{ID: "meteor_cluster", Name: "Cluster", Skill: "Meteor Drop", UnlockLevel: 50, Description: "3 smaller meteors instead of 1"},
	{ID: "meteor_extinction", Name: "Extinction", Skill: "Meteor Drop", UnlockLevel: 70, Description: "+50% explosion radius"},
	{ID: "meteor_apocalypse", Name: "Apocalypse", Skill: "Meteor Drop", UnlockLevel: 90, Description: "Meteors continue for 5s after cast"},
	// Teleport Runes
	{ID: "teleport_blink", Name: "Blink", Skill: "Teleport", UnlockLevel: 50, Description: "+50% range"},
	{ID: "teleport_phase", Name: "Phase", Skill: "Teleport", UnlockLevel: 70, Description: "Invulnerable for 1s after teleport"},
	{ID: "teleport_warp", Name: "Warp", Skill: "Teleport", UnlockLevel: 90, Description: "Damages enemies at start and end location"},
	// Arcane Shield Runes
	{ID: "arcaneshield_extended", Name: "Extended", Skill: "Arcane Shield", UnlockLevel: 50, Description: "+50% duration"},
	{ID: "arcaneshield_reflective", Name: "Reflective", Skill: "Arcane Shield", UnlockLevel: 70, Description: "Reflects 30% of absorbed damage"},
	{ID: "arcaneshield_explosive", Name: "Explosive", Skill: "Arcane Shield", UnlockLevel: 90, Description: "Explodes when broken dealing absorbed amount"},
	// Gravity Well Runes
	{ID: "gravitywell_expanded", Name: "Expanded", Skill: "Gravity Well", UnlockLevel: 50, Description: "+50% radius"},
	{ID: "gravitywell_crushing", Name: "Crushing", Skill: "Gravity Well", UnlockLevel: 70, Description: "+100% damage"},
	{ID: "gravitywell_blackhole", Name: "Black Hole", Skill: "Gravity Well", UnlockLevel: 90, Description: "Enemies cannot escape while active"},
}

// Cleric Runes
var clericRunes = []SkillRuneDef{
	// Spirit Guardians Runes
	{ID: "spirits_expanded", Name: "Expanded", Skill: "Spirit Guardians", UnlockLevel: 50, Description: "+50% radius"},
	{ID: "spirits_vengeful", Name: "Vengeful", Skill: "Spirit Guardians", UnlockLevel: 70, Description: "+50% damage, -25% healing"},
	{ID: "spirits_sanctuary", Name: "Sanctuary", Skill: "Spirit Guardians", UnlockLevel: 90, Description: "Also reduces damage taken by 20%"},
	// Healing Light Runes
	{ID: "healinglight_beacon", Name: "Beacon", Skill: "Healing Light", UnlockLevel: 50, Description: "Heals in AoE around target (5 unit radius)"},
	{ID: "healinglight_renewal", Name: "Renewal", Skill: "Healing Light", UnlockLevel: 70, Description: "Adds HoT for 5s (20% of initial heal)"},
	{ID: "healinglight_divine", Name: "Divine", Skill: "Healing Light", UnlockLevel: 90, Description: "Also cleanses 1 debuff"},
	// Divine Intervention Runes
	{ID: "divineintervention_quick", Name: "Quick Save", Skill: "Divine Intervention", UnlockLevel: 50, Description: "Cooldown reduced by 50%"},
	{ID: "divineintervention_guardian", Name: "Guardian Angel", Skill: "Divine Intervention", UnlockLevel: 70, Description: "Target gains 50% damage reduction for 5s"},
	{ID: "divineintervention_miracle", Name: "Miracle", Skill: "Divine Intervention", UnlockLevel: 90, Description: "Can affect 2 targets"},
	// Radiant Strike Runes
	{ID: "radiantstrike_smite", Name: "Smite", Skill: "Radiant Strike", UnlockLevel: 50, Description: "+50% damage"},
	{ID: "radiantstrike_chains", Name: "Chains of Light", Skill: "Radiant Strike", UnlockLevel: 70, Description: "Roots target for 2s"},
	{ID: "radiantstrike_purge", Name: "Purge", Skill: "Radiant Strike", UnlockLevel: 90, Description: "Removes 1 buff from target"},
	// Consecrated Ground Runes
	{ID: "consecratedground_expanded", Name: "Expanded", Skill: "Consecrated Ground", UnlockLevel: 50, Description: "+50% radius"},
	{ID: "consecratedground_lingering", Name: "Lingering", Skill: "Consecrated Ground", UnlockLevel: 70, Description: "+100% duration"},
	{ID: "consecratedground_sanctuary", Name: "Holy Ground", Skill: "Consecrated Ground", UnlockLevel: 90, Description: "Allies in area take 30% less damage"},
}

// Combo System - Skill sequences that trigger bonus effects within 3 seconds
type ComboDef struct {
	ID          string // Unique combo identifier
	Name        string // Display name
	Class       string // Fighter, Rogue, Wizard, Cleric
	FirstSkill  string // First skill in sequence
	SecondSkill string // Second skill that completes the combo
	Effect      string // Effect identifier for application
	Description string // What the combo does
}

// ComboWindow is the time window for combo detection (3 seconds)
const ComboWindow = 3 * time.Second

// Fighter Combos
var fighterCombos = []ComboDef{
	{ID: "momentum_strike", Name: "Momentum Strike", Class: "Fighter", FirstSkill: "Charge", SecondSkill: "Whirlwind", Effect: "whirlwind_damage_boost", Description: "+50% Whirlwind damage"},
	{ID: "tremor_rush", Name: "Tremor Rush", Class: "Fighter", FirstSkill: "Earthshaker", SecondSkill: "Charge", Effect: "charge_extended_knockdown", Description: "+2s knockdown on Charge"},
	{ID: "guardian_combo", Name: "Guardian Combo", Class: "Fighter", FirstSkill: "Shield Slam", SecondSkill: "Guardian Roar", Effect: "guardian_roar_extended", Description: "+50% taunt duration"},
	{ID: "iron_will", Name: "Iron Will", Class: "Fighter", FirstSkill: "Iron Fortress", SecondSkill: "Last Stand Rampage", Effect: "rampage_damage_reduction", Description: "Damage reduction persists during rampage"},
}

// Rogue Combos
var rogueCombos = []ComboDef{
	{ID: "ambush", Name: "Ambush", Class: "Rogue", FirstSkill: "Cloak & Vanish", SecondSkill: "Backstab", Effect: "backstab_guaranteed_crit", Description: "Guaranteed critical hit"},
	{ID: "venom_burst", Name: "Venom Burst", Class: "Rogue", FirstSkill: "Poison Coating", SecondSkill: "Death Spiral", Effect: "death_spiral_poison_boost", Description: "+100% poison damage"},
	{ID: "blade_tornado", Name: "Blade Tornado", Class: "Rogue", FirstSkill: "Fan of Knives", SecondSkill: "Phantom Volley", Effect: "volley_pierce", Description: "Volley pierces all targets"},
	{ID: "shadow_dance", Name: "Shadow Dance", Class: "Rogue", FirstSkill: "Shadow Lunge", SecondSkill: "Smoke Bomb", Effect: "smoke_bomb_instant", Description: "Smoke bomb instant cast"},
}

// Wizard Combos
var wizardCombos = []ComboDef{
	{ID: "implosion", Name: "Implosion", Class: "Wizard", FirstSkill: "Gravity Well", SecondSkill: "Fireball", Effect: "fireball_well_boost", Description: "+100% Fireball damage in well"},
	{ID: "arcane_barrage", Name: "Arcane Barrage", Class: "Wizard", FirstSkill: "Arcane Shield", SecondSkill: "Meteor Drop", Effect: "shield_meteor_explosion", Description: "Shield explodes on meteor impact"},
	{ID: "time_burn", Name: "Time Burn", Class: "Wizard", FirstSkill: "Time Warp", SecondSkill: "Inferno Cataclysm", Effect: "cataclysm_double_tick", Description: "Cataclysm ticks twice as fast"},
	{ID: "nova_cascade", Name: "Nova Cascade", Class: "Wizard", FirstSkill: "Teleport", SecondSkill: "Flame Whip", Effect: "flame_whip_360", Description: "360° Flame Whip"},
}

// Cleric Combos
var clericCombos = []ComboDef{
	{ID: "divine_storm", Name: "Divine Storm", Class: "Cleric", FirstSkill: "Heaven's Trumpet", SecondSkill: "Spirit Guardians", Effect: "spirits_holy_damage", Description: "Guardians deal holy damage"},
	{ID: "sanctuary_combo", Name: "Sanctuary", Class: "Cleric", FirstSkill: "Consecrated Ground", SecondSkill: "Guardian Embrace", Effect: "ground_damage_immunity", Description: "Ground also provides damage immunity"},
	{ID: "holy_fury", Name: "Holy Fury", Class: "Cleric", FirstSkill: "Mark of Weakness", SecondSkill: "Radiant Strike", Effect: "radiant_strike_boost", Description: "+100% Radiant Strike damage"},
	{ID: "mass_revival", Name: "Mass Revival", Class: "Cleric", FirstSkill: "Divine Intervention", SecondSkill: "Healing Light", Effect: "healing_light_party", Description: "Healing Light heals entire party"},
}

// GetComboForSkills checks if using secondSkill after firstSkill triggers a combo
func GetComboForSkills(class, firstSkill, secondSkill string) *ComboDef {
	var combos []ComboDef
	switch class {
	case "Fighter":
		combos = fighterCombos
	case "Rogue":
		combos = rogueCombos
	case "Wizard":
		combos = wizardCombos
	case "Cleric":
		combos = clericCombos
	default:
		return nil
	}

	for i := range combos {
		if combos[i].FirstSkill == firstSkill && combos[i].SecondSkill == secondSkill {
			return &combos[i]
		}
	}
	return nil
}

// HasSetBonus checks if the entity has a specific set bonus active.
// Example: e.HasSetBonus("warlordsFury", "chargeReset")
func (e *Entity) HasSetBonus(setID, bonusKey string) bool {
	if e == nil || e.ActiveSetBonuses == nil {
		return false
	}
	bonuses, ok := e.ActiveSetBonuses[setID]
	if !ok {
		return false
	}
	_, hasBonusKey := bonuses[bonusKey]
	return hasBonusKey
}

// HasAnySetBonus checks if any active set provides a specific bonus key.
// Example: e.HasAnySetBonus("chargeReset") - returns true if any set has this bonus
func (e *Entity) HasAnySetBonus(bonusKey string) bool {
	if e == nil || e.ActiveSetBonuses == nil {
		return false
	}
	for _, bonuses := range e.ActiveSetBonuses {
		if _, ok := bonuses[bonusKey]; ok {
			return true
		}
	}
	return false
}

// GetSetBonusValue returns the value of a specific set bonus, or 0 if not found.
// Example: e.GetSetBonusValue("warlordsFury", "armor") returns the armor bonus value
func (e *Entity) GetSetBonusValue(setID, bonusKey string) int {
	if e == nil || e.ActiveSetBonuses == nil {
		return 0
	}
	bonuses, ok := e.ActiveSetBonuses[setID]
	if !ok {
		return 0
	}
	return bonuses[bonusKey]
}

// HasUniqueEffect checks if the entity has a specific unique effect from equipment.
// Example: e.HasUniqueEffect("vampiric")
func (e *Entity) HasUniqueEffect(effectID string) bool {
	if e == nil || e.ActiveUniqueEffects == nil {
		return false
	}
	for _, effect := range e.ActiveUniqueEffects {
		if effect == effectID {
			return true
		}
	}
	return false
}

// CalculateFinalDamage applies unique effects and set bonuses to outgoing damage.
// Parameters:
//   - attacker: the entity dealing damage (must have lock held or be safe to read)
//   - target: the entity receiving damage (must have lock held or be safe to read)
//   - baseDamage: the raw damage amount before modifiers
//   - damageType: type of damage ("physical", "fire", "poison", "holy", "arcane", etc.)
//
// Returns the final damage amount and whether it was a lucky crit.
func CalculateFinalDamage(attacker, target *Entity, baseDamage int, damageType string) (int, bool) {
	if attacker == nil || baseDamage <= 0 {
		return baseDamage, false
	}

	finalDamage := baseDamage
	isCrit := false

	// Unique Effect: lucky - 10% chance for double damage
	if attacker.HasUniqueEffect("lucky") {
		if rand.Float64() < 0.10 {
			finalDamage *= 2
			isCrit = true
		}
	}

	if attacker.CritChanceBonus > 0 && rand.Float64() < attacker.CritChanceBonus {
		finalDamage *= 2
		isCrit = true
	}

	// Unique Effect: executioner - +25% damage vs targets below 25% HP
	if attacker.HasUniqueEffect("executioner") && target != nil {
		if target.MaxHealth > 0 && target.Health <= target.MaxHealth/4 {
			finalDamage = finalDamage * 125 / 100
		}
	}

	// Set Bonus: Warlord's Fury 6pc (ironFortressDamage) - Double damage during Iron Fortress
	if attacker.HasAnySetBonus("ironFortressDamage") && attacker.IronFortressActive {
		finalDamage *= 2
	}

	// Set Bonus: Shadow's Embrace 4pc (backstabAnyAngle) is handled in Backstab ability itself

	// Apply damage type bonuses from socketed gems and set bonuses.
	switch damageType {
	case "poison":
		if attacker.PoisonDamageBonus > 0 {
			finalDamage = int(float64(finalDamage) * (1.0 + attacker.PoisonDamageBonus))
		}
	case "fire":
		if attacker.FireDamageBonus > 0 {
			finalDamage = int(float64(finalDamage) * (1.0 + attacker.FireDamageBonus))
		}
	case "holy":
		if attacker.HolyDamageBonus > 0 {
			finalDamage = int(float64(finalDamage) * (1.0 + attacker.HolyDamageBonus))
		}
	}

	return finalDamage, isCrit
}

// ApplyDamageReflect handles damage reflection from set bonuses and unique effects.
// Call this after damage is dealt to reflect damage back to attacker.
// Returns the reflected damage amount.
func ApplyDamageReflect(attacker, defender *Entity, damageDealt int) int {
	if defender == nil || attacker == nil || damageDealt <= 0 {
		return 0
	}

	reflectedDamage := 0

	// Unique Effect: thorns - Reflect 10% damage taken
	if defender.HasUniqueEffect("thorns") {
		reflectedDamage += damageDealt * 10 / 100
	}

	// Set Bonus: Bulwark of Ages 4pc (damageReflect) - 5% damage reflect
	if defender.HasAnySetBonus("damageReflect") {
		reflectedDamage += damageDealt * 5 / 100
	}

	return reflectedDamage
}

// GetEffectiveManaCost calculates the mana cost after applying unique effect: efficient (-10% mana cost)
func (e *Entity) GetEffectiveManaCost(baseCost int) int {
	if e == nil || baseCost <= 0 {
		return baseCost
	}
	if e.HasUniqueEffect("efficient") {
		return baseCost * 90 / 100 // -10% mana cost
	}
	return baseCost
}

// ActivateSwiftIfEquipped activates the swift buff if the entity has the unique effect
// Call this after any skill usage
func (e *Entity) ActivateSwiftIfEquipped() {
	if e == nil {
		return
	}
	if e.HasUniqueEffect("swift") {
		e.SwiftActive = true
		e.SwiftEndTime = time.Now().Add(3 * time.Second)
	}
}

// GetEffectiveSpeed returns the entity's speed accounting for swift buff and slow debuff
func (e *Entity) GetEffectiveSpeed() float64 {
	if e == nil {
		return 0
	}
	speed := e.Speed

	// Unique Effect: swift - +20% speed for 3s after skill
	if e.SwiftActive && time.Now().Before(e.SwiftEndTime) {
		speed *= 1.20
	}

	// Apply slow debuff
	if e.Slowed && time.Now().Before(e.SlowEndTime) {
		speed *= e.SlowFactor
	}

	return speed
}

func (w *World) PerformUnlockTalent(playerID, talentID string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "unlockTalent: player not found"
	}
	if player.Type != TypePlayer {
		return nil, false, "unlockTalent: not a player"
	}

	// Lock the entity while mutating TalentRanks / derived fields.
	// This keeps protobuf serialization (which RLocks entity.Mu) consistent.
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if talentID == "" {
		return nil, false, "unlockTalent: empty talentId"
	}
	// Only allow known talent IDs (server-authoritative).
	def, ok := talentDefForID(player.SubType, talentID)
	if !ok {
		return nil, false, "unlockTalent: unknown talentId"
	}
	if player.TalentRanks == nil {
		player.TalentRanks = make(map[string]int)
	}
	currentRank := player.TalentRanks[talentID]
	if currentRank >= def.MaxRank {
		return nil, false, "unlockTalent: max rank reached"
	}

	player.recomputeTalentPoints()
	if player.TalentPoints <= 0 {
		return nil, false, "unlockTalent: no talent points available"
	}

	player.TalentRanks[talentID] = currentRank + 1
	player.recomputeTalentPoints()
	player.RecalculateStats()
	if player.Health > player.MaxHealth {
		player.Health = player.MaxHealth
	}
	if player.Mana > player.MaxMana {
		player.Mana = player.MaxMana
	}
	return player, true, ""
}

func (w *World) PerformResetTalents(playerID string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "resetTalents: player not found"
	}
	if player.Type != TypePlayer {
		return nil, false, "resetTalents: not a player"
	}

	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Clear all ranks and refund points (points are derived from level/ranks spent).
	player.TalentRanks = make(map[string]int)
	player.recomputeTalentPoints()
	player.RecalculateStats()
	if player.Health > player.MaxHealth {
		player.Health = player.MaxHealth
	}
	if player.Mana > player.MaxMana {
		player.Mana = player.MaxMana
	}
	return player, true, ""
}

// PerformRespec resets talents and/or skills for a gold cost.
// respecType: "talents", "skills", or "both"
// Cost: 1000 gold for talents, 1000 gold for skills, 1500 for both
func (w *World) PerformRespec(playerID string, respecType string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "respec: player not found"
	}
	if player.Type != TypePlayer {
		return nil, false, "respec: not a player"
	}

	player.Mu.Lock()
	defer player.Mu.Unlock()

	// Calculate cost based on respec type and player level
	baseCost := 1000
	levelMultiplier := 1 + (player.Level / 20) // 1x at level 1-19, 2x at 20-39, etc.
	var cost int

	switch respecType {
	case "talents":
		cost = baseCost * levelMultiplier
	case "skills":
		cost = baseCost * levelMultiplier
	case "both":
		cost = baseCost * levelMultiplier * 3 / 2 // 50% discount for both
	default:
		return nil, false, "respec: invalid respec type"
	}

	// Check if player has enough gold
	if player.Gold < cost {
		return nil, false, fmt.Sprintf("respec: need %d gold (have %d)", cost, player.Gold)
	}

	// Deduct gold
	player.Gold -= cost

	// Reset based on type
	if respecType == "talents" || respecType == "both" {
		player.TalentRanks = make(map[string]int)
		player.recomputeTalentPoints()
	}

	if respecType == "skills" || respecType == "both" {
		// Reset skills - keep only the base skill for the class
		baseSkills := w.getBaseSkillsForClass(player.SubType)
		player.UnlockedSkills = baseSkills
		// Refund skill points based on level
		player.SkillPoints = player.Level / 10 // 1 point per 10 levels
		if player.SkillPoints < 0 {
			player.SkillPoints = 0
		}
		// Reset branch selection
		player.SelectedBranch = ""
	}

	player.RecalculateStats()
	if player.Health > player.MaxHealth {
		player.Health = player.MaxHealth
	}
	if player.Mana > player.MaxMana {
		player.Mana = player.MaxMana
	}

	log.Printf("Player %s (%s) respecced %s for %d gold", player.Name, player.ID, respecType, cost)
	return player, true, ""
}

// getBaseSkillsForClass returns the default skills a class starts with
func (w *World) getBaseSkillsForClass(classType string) []string {
	switch classType {
	case "Fighter":
		return []string{"Charge"}
	case "Rogue":
		return []string{"Piercing Throw"}
	case "Wizard":
		return []string{"Fireball"}
	case "Cleric":
		return []string{"Spirit Guardians"}
	default:
		return []string{}
	}
}

// GetRespecCost calculates the respec cost for a player (for UI display)
func (w *World) GetRespecCost(playerID string, respecType string) int {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer {
		return 0
	}

	baseCost := 1000
	levelMultiplier := 1 + (player.Level / 20)

	switch respecType {
	case "talents":
		return baseCost * levelMultiplier
	case "skills":
		return baseCost * levelMultiplier
	case "both":
		return baseCost * levelMultiplier * 3 / 2
	default:
		return 0
	}
}

func hashAngle(key string) float64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	// Map uint32 -> [0, 2pi)
	return (float64(h.Sum32()) / float64(math.MaxUint32)) * (2.0 * math.Pi)
}

func addThreatLocked(enemy *Entity, playerID string, amount float64) {
	if enemy == nil || playerID == "" || amount <= 0 {
		return
	}
	if enemy.Threat == nil {
		enemy.Threat = make(map[string]float64)
	}
	enemy.Threat[playerID] += amount
}

func tauntThreatLocked(enemy *Entity, playerID string) {
	if enemy == nil || playerID == "" {
		return
	}
	if enemy.Threat == nil {
		enemy.Threat = make(map[string]float64)
	}

	maxThreat := 0.0
	for _, v := range enemy.Threat {
		if v > maxThreat {
			maxThreat = v
		}
	}
	// If nobody has threat yet, seed so taunt still works.
	if maxThreat < 1.0 {
		maxThreat = 1.0
	}
	enemy.Threat[playerID] = maxThreat * 1.10
}

type EntityType string

const (
	TypePlayer       EntityType = "Player"
	TypeEnemy        EntityType = "Enemy"
	TypeNPC          EntityType = "NPC"
	TypeLoot         EntityType = "Loot"
	TypeProjectile   EntityType = "Projectile"
	TypeFence        EntityType = "Fence"
	TypeStash        EntityType = "Stash"
	TypeForge        EntityType = "Forge"
	TypeTradingHouse EntityType = "TradingHouse"
	TypeHazard       EntityType = "Hazard"

	MaxInventorySize = 25
	MaxStashSize     = 100
)

type Quest struct {
	ID        string `json:"id"`
	Type      string `json:"type"` // "KILL"
	Target    string `json:"target"`
	Count     int    `json:"count"`
	MaxCount  int    `json:"maxCount"`
	RewardXP  int    `json:"rewardXP"`
	Completed bool   `json:"completed"`
	Accepted  bool   `json:"accepted"`
}

type Stats struct {
	Strength     int `json:"strength"`
	Dexterity    int `json:"dexterity"`
	Intelligence int `json:"intelligence"`
	Wisdom       int `json:"wisdom"`
	Vitality     int `json:"vitality"`
}

type Entity struct {
	Mu            sync.RWMutex // Protects concurrent access
	ID            string       `json:"id"`
	InstanceID    string       `json:"instanceId"`
	Name          string       `json:"name"`
	Type          EntityType   `json:"type"`
	SubType       string       `json:"subType"` // e.g., "Fighter", "Skeleton"
	X             float64      `json:"x"`
	Y             float64      `json:"y"`
	Z             float64      `json:"z"`
	Rotation      float64      `json:"rotation"` // Y-axis rotation in radians
	Health        int          `json:"health"`
	MaxHealth     int          `json:"maxHealth"`
	Mana          int          `json:"mana"`
	MaxMana       int          `json:"maxMana"`
	Level         int          `json:"level"`
	Experience    int          `json:"experience"`
	MaxExperience int          `json:"maxExperience"`
	Gold          int          `json:"gold"`

	// Inventory
	Inventory      []Item          `json:"-"`
	Stash          []Item          `json:"-"`
	Buyback        []Item          `json:"-"`
	Equipment      map[string]Item `json:"equipment"`
	Quests         []Quest         `json:"quests"`
	LastDailyQuest time.Time       `json:"-"`

	// Skills
	SkillPoints    int               `json:"skillPoints"`
	SelectedBranch string            `json:"selectedBranch"` // "A", "B", or "C"
	UnlockedSkills []string          `json:"unlockedSkills"`
	SkillRunes     map[string]string `json:"skillRunes"` // skill name -> rune ID

	// Passive Talents
	TalentPoints int            `json:"talentPoints"`
	TalentRanks  map[string]int `json:"talentRanks"`

	// Stats
	BaseStats Stats `json:"baseStats"` // Naked stats
	Stats     Stats `json:"stats"`     // Total stats (Base + Equipment)
	Damage    int   `json:"damage"`
	Defense   int   `json:"defense"`

	// Derived Stats
	Speed             float64 `json:"speed"`
	AttackSpeed       float64 `json:"attackSpeed"`
	CooldownReduction float64 `json:"cooldownReduction"`
	HpRegen           float64 `json:"hpRegen"`
	ManaRegen         float64 `json:"manaRegen"`
	CastSpeed         float64 `json:"castSpeed"`
	Scale             float64 `json:"scale,omitempty"` // Visual scale multiplier
	CritChanceBonus   float64 `json:"-"`
	FireDamageBonus   float64 `json:"-"`
	PoisonDamageBonus float64 `json:"-"`
	HolyDamageBonus   float64 `json:"-"`
	HealingDoneBonus  float64 `json:"-"`
	LifestealBonus    float64 `json:"-"`
	AllResistBonus    float64 `json:"-"`

	TargetX  float64 `json:"-"`
	TargetZ  float64 `json:"-"`
	TargetID string  `json:"-"`
	SpawnX   float64 `json:"-"`
	SpawnZ   float64 `json:"-"`
	State    string  `json:"state"` // IDLE, MOVING, ATTACKING, DEAD

	// Combat
	LastAttackTime    time.Time            `json:"-"`
	AttackCooldown    time.Duration        `json:"-"`
	LastAbilityTime   time.Time            `json:"-"`
	AbilityCooldown   time.Duration        `json:"-"`
	Cooldowns         map[string]time.Time `json:"-"`
	LastRespawnTime   time.Time            `json:"-"`
	LastSpecialAttack time.Time            `json:"-"` // Boss AoE slam cooldown

	// Threat (server-side only): playerID -> threat
	Threat map[string]float64 `json:"-"`

	// Loot
	LootItem  *Item     `json:"lootItem,omitempty"` // If Type == TypeLoot
	LootTime  time.Time `json:"-"`
	CreatedAt time.Time `json:"-"`

	// Projectile
	OwnerID string          `json:"ownerId,omitempty"`
	VelX    float64         `json:"velX"`
	VelZ    float64         `json:"velZ"`
	Radius  float64         `json:"-"`
	HitList map[string]bool `json:"-"`

	// Projectile Rune Effects
	ProjectileRuneID    string `json:"-"` // Rune applied to this projectile
	ProjectileBounces   int    `json:"-"` // Remaining bounces for ricochet-type runes
	ProjectileSkill     string `json:"-"` // Skill that created this projectile
	ProjectilePierce    bool   `json:"-"` // Whether projectile pierces through enemies (combo effect)
	FireballWellBoost   bool   `json:"-"` // Combo: Implosion - Fireball does +100% damage to slowed targets
	MeteorShieldExplode bool   `json:"-"` // Combo: Arcane Barrage - Meteor explodes shield on impact
	ZoneDoubleTick      bool   `json:"-"` // Combo: Time Burn - Zone ticks twice as fast

	// Abilities
	SpiritsActive  bool      `json:"spiritsActive"`
	SpiritsBoosted bool      `json:"spiritsBoosted"`
	SpiritEndTime  time.Time `json:"-"`
	LastSpiritTick time.Time `json:"-"`
	IsCharging     bool      `json:"isCharging,omitempty"`
	ChargeTargetX  float64   `json:"-"`
	ChargeTargetZ  float64   `json:"-"`
	JumpStartX     float64   `json:"jumpStartX,omitempty"`
	JumpStartY     float64   `json:"jumpStartY,omitempty"`
	JumpStartZ     float64   `json:"jumpStartZ,omitempty"`
	JumpTargetX    float64   `json:"jumpTargetX,omitempty"`
	JumpTargetY    float64   `json:"jumpTargetY,omitempty"`
	JumpTargetZ    float64   `json:"jumpTargetZ,omitempty"`
	JumpDuration   float64   `json:"jumpDuration,omitempty"`
	JumpElapsed    float64   `json:"jumpElapsed,omitempty"`
	JumpHeight     float64   `json:"jumpHeight,omitempty"`
	JumpProgress   float64   `json:"jumpProgress,omitempty"`

	// Buffs
	BerserkerModeActive  bool      `json:"berserkerModeActive,omitempty"`
	BerserkerModeEndTime time.Time `json:"-"`
	LastStandActive      bool      `json:"lastStandActive,omitempty"`
	LastStandEndTime     time.Time `json:"-"`
	StealthActive        bool      `json:"stealthActive,omitempty"`
	StealthEndTime       time.Time `json:"-"`
	ZealActive           bool      `json:"zealActive,omitempty"`
	ZealEndTime          time.Time `json:"-"`

	// New Buffs
	IronFortressActive        bool      `json:"ironFortressActive,omitempty"`
	IronFortressEndTime       time.Time `json:"-"`
	GuardianRoarActive        bool      `json:"guardianRoarActive,omitempty"`
	GuardianRoarEndTime       time.Time `json:"-"`
	SerratedEdgesActive       bool      `json:"serratedEdgesActive,omitempty"`
	SerratedEdgesEndTime      time.Time `json:"-"`
	PoisonCoatingActive       bool      `json:"poisonCoatingActive,omitempty"`
	PoisonCoatingEndTime      time.Time `json:"-"`
	SpellFocusActive          bool      `json:"spellFocusActive,omitempty"`
	SpellFocusEndTime         time.Time `json:"-"`
	ArcaneShieldActive        bool      `json:"arcaneShieldActive,omitempty"`
	ArcaneShieldHP            int       `json:"arcaneShieldHP,omitempty"`
	ArcaneShieldEndTime       time.Time `json:"-"`
	TimeWarpActive            bool      `json:"timeWarpActive,omitempty"`
	TimeWarpEndTime           time.Time `json:"-"`
	DivineInterventionActive  bool      `json:"divineInterventionActive,omitempty"`
	DivineInterventionEndTime time.Time `json:"-"`
	BlessingResolveActive     bool      `json:"blessingResolveActive,omitempty"`
	BlessingResolveEndTime    time.Time `json:"-"`
	GuardianEmbraceActive     bool      `json:"guardianEmbraceActive,omitempty"`
	GuardianEmbraceEndTime    time.Time `json:"-"`
	LastGuardianEmbraceTick   time.Time `json:"-"`

	// Debuffs / CC
	Stunned             bool      `json:"stunned,omitempty"`
	StunEndTime         time.Time `json:"-"`
	Slowed              bool      `json:"slowed,omitempty"`
	SlowEndTime         time.Time `json:"-"`
	SlowFactor          float64   `json:"slowFactor,omitempty"`
	Rooted              bool      `json:"rooted,omitempty"`
	RootEndTime         time.Time `json:"-"`
	WeakPointMarked     bool      `json:"weakPointMarked,omitempty"`
	WeakPointEndTime    time.Time `json:"-"`
	MarkWeakness        bool      `json:"markWeakness,omitempty"` // Cleric
	MarkWeaknessEndTime time.Time `json:"-"`
	Bleeding            bool      `json:"bleeding,omitempty"`
	BleedEndTime        time.Time `json:"-"`
	BleedDamage         int       `json:"-"`
	LastBleedTick       time.Time `json:"-"`
	Poisoned            bool      `json:"poisoned,omitempty"`
	PoisonEndTime       time.Time `json:"-"`
	PoisonDamage        int       `json:"-"`
	LastPoisonTick      time.Time `json:"-"`

	// Party
	PartyID string `json:"partyId,omitempty"`

	// Unique Effect: swift - Speed boost after skill use
	SwiftActive  bool      `json:"swiftActive,omitempty"`
	SwiftEndTime time.Time `json:"-"`

	// Rune Effects
	ChargeStartX          float64   `json:"-"` // For momentum rune distance calculation
	ChargeStartZ          float64   `json:"-"`
	ChargeRuneID          string    `json:"-"` // Which rune is active for current charge
	CCImmune              bool      `json:"ccImmune,omitempty"`
	CCImmuneEndTime       time.Time `json:"-"`
	RuneArmorBuff         float64   `json:"-"` // Temporary armor buff from runes
	RuneArmorBuffEndTime  time.Time `json:"-"`
	WhirlwindTickCount    int       `json:"-"` // For extended whirlwind duration
	WhirlwindActive       bool      `json:"whirlwindActive,omitempty"`
	WhirlwindEndTime      time.Time `json:"-"`
	WhirlwindRuneID       string    `json:"-"`
	IronFortressRuneID    string    `json:"-"` // For thorns/immovable effects
	IronFortressThorns    bool      `json:"-"`
	IronFortressImmovable bool      `json:"-"`
	ArcaneShieldRuneID    string    `json:"-"` // For reflective/explosive effects
	ArcaneShieldAbsorbed  int       `json:"-"` // Track absorbed damage for explosive rune
	InvulnerableEndTime   time.Time `json:"-"` // For teleport phase rune
	CloakNextAttackBonus  float64   `json:"-"` // For cloak prepared ambush rune
	CloakSwiftSpeedBonus  bool      `json:"-"` // For cloak swift rune

	// Cleric Rune Effects
	SpiritGuardiansRuneID       string    `json:"-"` // For spirit guardian rune effects
	SanctuaryDamageReduction    bool      `json:"-"` // Sanctuary rune: 20% damage reduction
	SanctuaryEndTime            time.Time `json:"-"`
	HealingLightHoTActive       bool      `json:"-"` // Renewal rune HoT
	HealingLightHoTAmount       int       `json:"-"` // HoT amount per tick
	HealingLightHoTEndTime      time.Time `json:"-"`
	LastHealingLightHoTTick     time.Time `json:"-"`
	DivineInterventionGuardian  bool      `json:"-"` // Guardian Angel rune: 50% damage reduction
	DivineInterventionGuardTime time.Time `json:"-"`
	ConsecratedGroundRuneID     string    `json:"-"` // Track which rune was used
	ConsecratedGroundEndTime    time.Time `json:"-"` // For lingering rune extended duration
	ConsecratedGroundSanctuary  bool      `json:"-"` // Sanctuary rune: allies take 30% less damage

	// Combo System
	LastSkillUsed      string    `json:"-"` // Last skill used for combo detection
	LastSkillTime      time.Time `json:"-"` // When the last skill was used
	ActiveCombo        string    `json:"-"` // Currently active combo effect
	ActiveComboEndTime time.Time `json:"-"` // When the combo effect expires

	// Set Bonuses (calculated from equipment)
	ActiveSetBonuses map[string]map[string]int `json:"activeSetBonuses,omitempty"` // setID -> bonusKey -> value

	// Unique Effects (collected from equipment)
	ActiveUniqueEffects []string `json:"activeUniqueEffects,omitempty"` // List of active unique effect IDs
}

type DungeonRoom struct {
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	Type   string  `json:"type"` // "start", "boss", "normal", "elite"
	Hook   string  `json:"hook,omitempty"`
	Color  int     `json:"color"`
}

type DungeonLayout struct {
	Rooms     []DungeonRoom     `json:"rooms"`
	WalkRects []DungeonWalkRect `json:"walkRects,omitempty"`
	Corridors []DungeonCorridor `json:"corridors,omitempty"`
}

type DungeonRoomProgress struct {
	Explored bool `json:"explored"`
	Cleared  bool `json:"cleared"`
	Rewarded bool `json:"-"`
}

type DungeonRoomSummaryEntry struct {
	Index    int     `json:"index"`
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
	Type     string  `json:"type"`
	Hook     string  `json:"hook,omitempty"`
	Explored bool    `json:"explored"`
	Cleared  bool    `json:"cleared"`
}

type DungeonRoomSummary struct {
	Rooms              []DungeonRoomSummaryEntry `json:"rooms"`
	CurrentRoomIndex   int                       `json:"currentRoomIndex"`
	ObjectiveRoomIndex int                       `json:"objectiveRoomIndex"`
}

type DungeonRoomState struct {
	Layout                DungeonLayout
	Rooms                 []DungeonRoomProgress
	CurrentRoomIndexValue int
}

func NewDungeonRoomState(layout DungeonLayout) *DungeonRoomState {
	rooms := make([]DungeonRoomProgress, len(layout.Rooms))
	return &DungeonRoomState{
		Layout:                layout,
		Rooms:                 rooms,
		CurrentRoomIndexValue: -1,
	}
}

func (s *DungeonRoomState) CurrentRoomIndexForPosition(x, z float64) int {
	for idx, room := range s.Layout.Rooms {
		halfW := room.Width / 2
		halfH := room.Height / 2
		if x >= room.X-halfW && x <= room.X+halfW && z >= room.Z-halfH && z <= room.Z+halfH {
			return idx
		}
	}
	return -1
}

func (s *DungeonRoomState) CurrentRoomIndex(x, z float64) int {
	return s.CurrentRoomIndexForPosition(x, z)
}

func (s *DungeonRoomState) MarkExploredAt(x, z float64) {
	idx := s.CurrentRoomIndexForPosition(x, z)
	if idx < 0 || idx >= len(s.Rooms) {
		return
	}
	s.Rooms[idx].Explored = true
	s.CurrentRoomIndexValue = idx
}

func (s *DungeonRoomState) MarkRoomCleared(index int) {
	if index < 0 || index >= len(s.Rooms) {
		return
	}
	s.Rooms[index].Explored = true
	s.Rooms[index].Cleared = true
}

func (s *DungeonRoomState) ObjectiveRoomIndex() int {
	for idx, room := range s.Layout.Rooms {
		if room.Type == "start" {
			continue
		}
		if idx >= len(s.Rooms) || !s.Rooms[idx].Cleared {
			return idx
		}
	}
	return -1
}

func (s *DungeonRoomState) Summary(x, z float64) DungeonRoomSummary {
	if x != 0 || z != 0 {
		s.MarkExploredAt(x, z)
	}
	entries := make([]DungeonRoomSummaryEntry, 0, len(s.Layout.Rooms))
	for idx, room := range s.Layout.Rooms {
		progress := DungeonRoomProgress{}
		if idx < len(s.Rooms) {
			progress = s.Rooms[idx]
		}
		entries = append(entries, DungeonRoomSummaryEntry{
			Index:    idx,
			X:        room.X,
			Z:        room.Z,
			Width:    room.Width,
			Height:   room.Height,
			Type:     room.Type,
			Hook:     room.Hook,
			Explored: progress.Explored,
			Cleared:  progress.Cleared,
		})
	}
	return DungeonRoomSummary{
		Rooms:              entries,
		CurrentRoomIndex:   s.CurrentRoomIndexValue,
		ObjectiveRoomIndex: s.ObjectiveRoomIndex(),
	}
}

type SpatialMap struct {
	cellSize float64
	cells    map[string]map[string]*Entity
	Mu       sync.RWMutex
}

func NewSpatialMap(cellSize float64) *SpatialMap {
	return &SpatialMap{
		cellSize: cellSize,
		cells:    make(map[string]map[string]*Entity),
	}
}

func (sm *SpatialMap) key(x, z float64, instanceID string) string {
	cx := int(math.Floor(x / sm.cellSize))
	cz := int(math.Floor(z / sm.cellSize))
	return fmt.Sprintf("%s:%d:%d", instanceID, cx, cz)
}
func (sm *SpatialMap) Add(e *Entity) {
	sm.Mu.Lock()
	defer sm.Mu.Unlock()
	k := sm.key(e.X, e.Z, e.InstanceID)
	if sm.cells[k] == nil {
		sm.cells[k] = make(map[string]*Entity)
	}
	sm.cells[k][e.ID] = e
}

func (sm *SpatialMap) Remove(e *Entity) {
	sm.Mu.Lock()
	defer sm.Mu.Unlock()
	k := sm.key(e.X, e.Z, e.InstanceID)
	if sm.cells[k] != nil {
		delete(sm.cells[k], e.ID)
		if len(sm.cells[k]) == 0 {
			delete(sm.cells, k)
		}
	}
}

func (sm *SpatialMap) Update(e *Entity, oldX, oldZ float64) {
	sm.Mu.Lock()
	defer sm.Mu.Unlock()
	// Note: We assume InstanceID doesn't change during a normal Update call.
	// If it does (EnterInstance), we should use Remove() then Add() manually.
	oldKey := sm.key(oldX, oldZ, e.InstanceID)
	newKey := sm.key(e.X, e.Z, e.InstanceID)
	if oldKey == newKey {
		return
	}
	if sm.cells[oldKey] != nil {
		delete(sm.cells[oldKey], e.ID)
		if len(sm.cells[oldKey]) == 0 {
			delete(sm.cells, oldKey)
		}
	}
	if sm.cells[newKey] == nil {
		sm.cells[newKey] = make(map[string]*Entity)
	}
	sm.cells[newKey][e.ID] = e
}

func (sm *SpatialMap) Nearby(x, z, radius float64, instanceID string) []*Entity {
	sm.Mu.RLock()
	defer sm.Mu.RUnlock()

	// Pre-allocate with estimated capacity to reduce allocations
	result := make([]*Entity, 0, 32)

	minX := int(math.Floor((x - radius) / sm.cellSize))
	maxX := int(math.Floor((x + radius) / sm.cellSize))
	minZ := int(math.Floor((z - radius) / sm.cellSize))
	maxZ := int(math.Floor((z + radius) / sm.cellSize))

	// Use strings.Builder to reduce string allocations in hot path
	var keyBuilder strings.Builder
	keyBuilder.Grow(32) // Pre-allocate for typical key size

	for cx := minX; cx <= maxX; cx++ {
		for cz := minZ; cz <= maxZ; cz++ {
			keyBuilder.Reset()
			fmt.Fprintf(&keyBuilder, "%s:%d:%d", instanceID, cx, cz)
			k := keyBuilder.String()
			if cell := sm.cells[k]; cell != nil {
				for _, e := range cell {
					result = append(result, e)
				}
			}
		}
	}
	return result
}

type DungeonDifficulty string

const (
	DifficultyNormal DungeonDifficulty = "normal"
	DifficultyHeroic DungeonDifficulty = "heroic"
	DifficultyMythic DungeonDifficulty = "mythic"
)

// DifficultyMultipliers returns (healthMult, damageMult, lootMult, xpMult) for a difficulty
func DifficultyMultipliers(difficulty DungeonDifficulty) (float64, float64, float64, float64) {
	switch difficulty {
	case DifficultyHeroic:
		return 2.0, 1.5, 2.0, 2.0 // 2x health, 1.5x damage, 2x loot/xp
	case DifficultyMythic:
		return 4.0, 2.5, 4.0, 4.0 // 4x health, 2.5x damage, 4x loot/xp
	default:
		return 1.0, 1.0, 1.0, 1.0 // Normal
	}
}

// MinLevelForDifficulty returns the minimum party level required for a difficulty
func MinLevelForDifficulty(difficulty DungeonDifficulty, dungeonType string) int {
	switch difficulty {
	case DifficultyHeroic, DifficultyMythic:
		return EndgameDifficultyUnlockLevel
	default:
		return DungeonUnlockLevel
	}
}

type DungeonInstance struct {
	ID                string
	Layout            DungeonLayout
	PartyID           string
	CreatedAt         time.Time
	EmptySince        time.Time
	PlayerCount       int
	Difficulty        DungeonDifficulty
	DungeonType       string
	RunLevel          int
	RoomState         *DungeonRoomState
	PlayerRoomSummary map[string]DungeonRoomSummary
}

type World struct {
	Entities        map[string]*Entity
	Parties         map[string]*Party
	Trading         *TradingSystem
	Grid            *SpatialMap
	InstanceLayouts map[string]*DungeonInstance
	Mu              sync.RWMutex

	// Elite Spawning
	EliteSpawnTimer time.Time

	// Global Regen Timer
	RegenTimer float64

	// Environmental Hazards
	Hazards           map[string]*Hazard
	HazardDamageTimer float64                       // Accumulator for hazard damage ticks
	PlayerHazardTicks map[string]map[string]float64 // PlayerID -> HazardID -> time since last tick

	// Event Callback
	OnEvent       func(eventType string, data interface{})
	OnQuestUpdate func(playerID string, quests []Quest)
}

type DamageEvent struct {
	TargetID string
	SourceID string
	Amount   int
}

type HealEvent struct {
	TargetID string
	SourceID string
	Amount   int
}

type AbilityEvent struct {
	SourceID  string  `json:"sourceId"`
	TargetID  string  `json:"targetId"` // Optional
	SkillName string  `json:"skillName"`
	TargetX   float64 `json:"targetX"`
	TargetZ   float64 `json:"targetZ"`
}

// HazardType defines the type of environmental hazard
type HazardType string

const (
	HazardLavaPool    HazardType = "lava_pool"      // Fire Realm - % health damage per second
	HazardSandstorm   HazardType = "sandstorm"      // Earth Realm - % health damage per second
	HazardLightning   HazardType = "lightning_zone" // Water Realm - % health damage per second
	HazardWindGust    HazardType = "wind_gust"      // Air Realm - % health damage per second
	HazardPoisonCloud HazardType = "poison_cloud"   // Future use
)

// Hazard represents an environmental hazard zone that deals % max health damage
type Hazard struct {
	ID           string     `json:"id"`
	HazardType   HazardType `json:"hazardType"`
	X            float64    `json:"x"`
	Z            float64    `json:"z"`
	Radius       float64    `json:"radius"`
	DamagePct    float64    `json:"damagePct"`    // % of max health per tick (0.05 = 5%)
	TickInterval float64    `json:"tickInterval"` // Seconds between damage ticks
}

// HazardDamageEvent is emitted when a player takes hazard damage
type HazardDamageEvent struct {
	PlayerID   string     `json:"playerId"`
	HazardID   string     `json:"hazardId"`
	HazardType HazardType `json:"hazardType"`
	Damage     int        `json:"damage"`
}

// TelegraphEvent is emitted when a boss telegraphs an incoming AoE attack.
// Clients render a warning indicator at (X, Z) with the given Radius for
// Duration seconds before the damage lands.
type TelegraphEvent struct {
	SourceID string  `json:"sourceId"`
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Radius   float64 `json:"radius"`
	Duration float64 `json:"duration"` // seconds before impact
}

type RewardSummaryEvent struct {
	PlayerID    string `json:"playerId"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle,omitempty"`
	Gold        int    `json:"gold"`
	XP          int    `json:"xp"`
	ItemCount   int    `json:"itemCount"`
	GemCount    int    `json:"gemCount"`
	HeartCount  int    `json:"heartCount"`
	BossName    string `json:"bossName,omitempty"`
	InstanceType string `json:"instanceType,omitempty"`
	Difficulty  string `json:"difficulty,omitempty"`
	RunLevel    int    `json:"runLevel,omitempty"`
	RoomsCleared int   `json:"roomsCleared,omitempty"`
	TotalRooms  int    `json:"totalRooms,omitempty"`
	EliteRoomsCleared int `json:"eliteRoomsCleared,omitempty"`
	TotalEliteRooms int `json:"totalEliteRooms,omitempty"`
	ExitHint    string `json:"exitHint,omitempty"`
}

type DungeonRoomClearRewardEvent struct {
	PlayerID             string `json:"playerId"`
	Title                string `json:"title"`
	Subtitle             string `json:"subtitle,omitempty"`
	Gold                 int    `json:"gold"`
	XP                   int    `json:"xp"`
	ItemCount            int    `json:"itemCount,omitempty"`
	GemCount             int    `json:"gemCount,omitempty"`
	HeartCount           int    `json:"heartCount,omitempty"`
	Hint                 string `json:"hint,omitempty"`
	RoomIndex            int    `json:"roomIndex"`
	ObjectiveRoomIndex   int    `json:"objectiveRoomIndex"`
	RoomType             string `json:"roomType,omitempty"`
	RoomHook             string `json:"roomHook,omitempty"`
	InstanceType         string `json:"instanceType,omitempty"`
	Difficulty           string `json:"difficulty,omitempty"`
	HealthRestored       int    `json:"healthRestored,omitempty"`
	ManaRestored         int    `json:"manaRestored,omitempty"`
	BuffName             string `json:"buffName,omitempty"`
	BuffDurationSeconds  int    `json:"buffDurationSeconds,omitempty"`
	DamageReductionPct   int    `json:"damageReductionPct,omitempty"`
}

func formatDungeonLabel(instanceType string) string {
	switch instanceType {
	case "verdant_bastion_catacombs":
		return "Verdant Bastion Catacombs"
	case "molten_core":
		return "Molten Core"
	case "tempest_spire":
		return "Tempest Spire"
	case "abyssal_well":
		return "Abyssal Well"
	default:
		return "Dungeon"
	}
}

func formatDungeonDifficultyLabel(difficulty DungeonDifficulty) string {
	switch difficulty {
	case DifficultyHeroic:
		return "Heroic"
	case DifficultyMythic:
		return "Mythic"
	default:
		return "Normal"
	}
}

func countRewardDrops(items []*Item) (itemCount, gemCount int) {
	for _, item := range items {
		if item == nil {
			continue
		}
		if item.Type == ItemGem {
			gemCount++
			continue
		}
		itemCount++
	}
	return itemCount, gemCount
}

func buildBossRewardSummary(playerID, bossName, instanceType string, difficulty DungeonDifficulty, runLevel, roomsCleared, eliteRoomsCleared, totalRooms, totalEliteRooms, gold, xp, heartCount int, lootItems []*Item) RewardSummaryEvent {
	itemCount, gemCount := countRewardDrops(lootItems)
	return RewardSummaryEvent{
		PlayerID:     playerID,
		Title:        fmt.Sprintf("Boss Defeated: %s", bossName),
		Subtitle:     fmt.Sprintf("%s • %s", formatDungeonLabel(instanceType), formatDungeonDifficultyLabel(difficulty)),
		Gold:         gold,
		XP:           xp,
		ItemCount:    itemCount,
		GemCount:     gemCount,
		HeartCount:   heartCount,
		BossName:     bossName,
		InstanceType: instanceType,
		Difficulty:   string(difficulty),
		RunLevel:     runLevel,
		RoomsCleared: roomsCleared,
		TotalRooms:   totalRooms,
		EliteRoomsCleared: eliteRoomsCleared,
		TotalEliteRooms:   totalEliteRooms,
		ExitHint:     "Return to the entrance to leave the dungeon.",
	}
}

func formatDungeonRoomLabel(roomType string, roomIndex int) string {
	switch roomType {
	case "elite":
		return fmt.Sprintf("Elite Chamber %d", roomIndex)
	case "boss":
		return "Boss Chamber"
	case "start":
		return "Entry Hall"
	default:
		return fmt.Sprintf("Room %d", roomIndex)
	}
}

func buildDungeonRoomClearRewardSummary(playerID string, roomIndex, objectiveRoomIndex, gold, xp, itemCount, gemCount, heartCount int, instanceType string, difficulty DungeonDifficulty, roomType, roomHook string, healthRestored, manaRestored int) DungeonRoomClearRewardEvent {
	hint := "Path opened deeper into the dungeon"
	buffName := ""
	buffDurationSeconds := 0
	damageReductionPct := 0
	if roomHook == "shrine" {
		hint = "Shrine restored your strength for the next push"
		buffName = "Sanctuary"
		buffDurationSeconds = 8
		damageReductionPct = 25
	} else if roomHook == "chest" {
		hint = "Treasure secured — cash in before the boss"
	} else if roomHook == "elite_ambush" {
		hint = "Ambush survived — momentum and spoils increased"
	} else if objectiveRoomIndex >= 0 {
		if roomType == "elite" {
			hint = "Elite cleared — push toward the next objective"
		} else {
			hint = "Path opened to the boss room"
		}
	}

	return DungeonRoomClearRewardEvent{
		PlayerID:            playerID,
		Title:               fmt.Sprintf("Room Cleared: %s", formatDungeonRoomLabel(roomType, roomIndex)),
		Subtitle:            fmt.Sprintf("%s • %s", formatDungeonLabel(instanceType), formatDungeonDifficultyLabel(difficulty)),
		Gold:                gold,
		XP:                  xp,
		ItemCount:           itemCount,
		GemCount:            gemCount,
		HeartCount:          heartCount,
		Hint:                hint,
		RoomIndex:           roomIndex,
		ObjectiveRoomIndex:  objectiveRoomIndex,
		RoomType:            roomType,
		RoomHook:            roomHook,
		InstanceType:        instanceType,
		Difficulty:          string(difficulty),
		HealthRestored:      healthRestored,
		ManaRestored:        manaRestored,
		BuffName:            buffName,
		BuffDurationSeconds: buffDurationSeconds,
		DamageReductionPct:  damageReductionPct,
	}
}

func NewWorld(db *database.DB) *World {
	w := &World{
		Entities:          make(map[string]*Entity),
		Parties:           make(map[string]*Party),
		Trading:           NewTradingSystem(db),
		Grid:              NewSpatialMap(50.0), // 50 unit cell size
		InstanceLayouts:   make(map[string]*DungeonInstance),
		EliteSpawnTimer:   time.Now(),
		RegenTimer:        0,
		Hazards:           make(map[string]*Hazard),
		HazardDamageTimer: 0,
		PlayerHazardTicks: make(map[string]map[string]float64),
		OnEvent:           func(eventType string, data interface{}) {}, // Default no-op
		OnQuestUpdate:     func(playerID string, quests []Quest) {},
	}
	w.initWorld()
	return w
}

func (w *World) GetAllParties() []*Party {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	parties := make([]*Party, 0, len(w.Parties))
	for _, p := range w.Parties {
		parties = append(parties, p)
	}
	return parties
}

func (w *World) initWorld() {
	w.spawnMerchant()
	w.spawnQuestNPC()
	w.spawnRespecNPC()
	w.spawnDungeonNPC()
	w.spawnStash()
	w.spawnForge()
	w.spawnTradingHouse()
	w.spawnEnemies()
	w.spawnInitialElites()
	w.spawnFence()
	w.spawnSnowWorld()
	w.spawnFireRealm()
	w.spawnAirRealm()
	w.spawnEnvironmentalHazards()
}

func (w *World) spawnFence() {
	// 1. Rectangular Fence around the "Earth Realm"
	// Bounds: X: -1000 to 1000, Z: -600 to 1000
	minX, maxX := -1000.0, 1000.0
	minZ, maxZ := -600.0, 1000.0

	// Gap in the North Wall (Z = -600) for access to Water Realm (Snow)
	// Small opening (-20 to 20)
	gapMinX := -20.0
	gapMaxX := 20.0

	// Gap in the West Wall (X = -1000) for access to Fire Realm (Lv 70+)
	// At Z = 200 (+/- 20)
	westGapMinZ := 180.0
	westGapMaxZ := 220.0

	// Gap in the East Wall (X = 1000) for access to Air Realm (Lv 70+)
	// At Z = 200 (+/- 20)
	eastGapMinZ := 180.0
	eastGapMaxZ := 220.0

	// Helper to create fence segment
	createSegment := func(x, z, rot float64) {
		fence := &Entity{
			ID:       fmt.Sprintf("fence-%d-%d", int(x), int(z)),
			Type:     TypeFence,
			X:        x,
			Y:        0,
			Z:        z,
			Rotation: rot,
			State:    "IDLE",
			Scale:    1.0,
		}
		w.AddEntity(fence)
	}

	segmentLen := 4.0

	// North Wall (Earth Realm)
	for x := minX; x <= maxX; x += segmentLen {
		if x > gapMinX && x < gapMaxX {
			continue
		}
		createSegment(x, minZ, 0)
	}
	// South Wall
	for x := minX; x <= maxX; x += segmentLen {
		createSegment(x, maxZ, 0)
	}
	// West Wall (with gap for Fire Realm)
	for z := minZ; z <= maxZ; z += segmentLen {
		if z > westGapMinZ && z < westGapMaxZ {
			continue // Gap for Fire Realm entrance
		}
		createSegment(minX, z, math.Pi/2)
	}
	// East Wall (with gap for Air Realm)
	for z := minZ; z <= maxZ; z += segmentLen {
		if z > eastGapMinZ && z < eastGapMaxZ {
			continue // Gap for Air Realm entrance
		}
		createSegment(maxX, z, math.Pi/2)
	}

	// 2. Rectangular Town Fence (Center of Earth Realm)
	// Center: (0, 200). Size: 200x200.
	// Bounds: X: -100 to 100, Z: 100 to 300
	townMinX, townMaxX := -100.0, 100.0
	townMinZ, townMaxZ := 100.0, 300.0

	// Town Exits (Centers)
	// North: (0, 100)
	// South: (0, 300)
	// East: (100, 200)
	// West: (-100, 200)
	exitGap := 20.0

	// Town North/South Walls
	for x := townMinX; x <= townMaxX; x += segmentLen {
		// North Exit
		if x > -exitGap/2 && x < exitGap/2 {
			continue
		}
		createSegment(x, townMinZ, 0) // North
		createSegment(x, townMaxZ, 0) // South
	}
	// Town East/West Walls
	for z := townMinZ; z <= townMaxZ; z += segmentLen {
		// East/West Exits (at Z=200)
		if z > 200-exitGap/2 && z < 200+exitGap/2 {
			continue
		}
		createSegment(townMinX, z, math.Pi/2) // West
		createSegment(townMaxX, z, math.Pi/2) // East
	}

	// 3. Rectangular Snow Area Fence (Water Realm)
	// Bounds: X: -1000 to 1000, Z: -2200 to -600
	// Connects to the gap in Earth Realm North Wall
	snowMinX, snowMaxX := -1000.0, 1000.0
	snowMinZ, snowMaxZ := -2200.0, -600.0

	// Snow North Wall
	for x := snowMinX; x <= snowMaxX; x += segmentLen {
		createSegment(x, snowMinZ, 0)
	}
	// Snow West Wall
	for z := snowMinZ; z <= snowMaxZ; z += segmentLen {
		createSegment(snowMinX, z, math.Pi/2)
	}
	// Snow East Wall
	for z := snowMinZ; z <= snowMaxZ; z += segmentLen {
		createSegment(snowMaxX, z, math.Pi/2)
	}
	// South is open to Earth Realm (handled by gap above)

	// 4. Fire Realm Fence (West Zone - Scorched Wastes)
	// Bounds: X: -3000 to -1000, Z: -600 to 1000
	// Entrance at X: -1000, Z: 200 (gap in Earth Realm West Wall)
	fireMinX, fireMaxX := -3000.0, -1000.0
	fireMinZ, fireMaxZ := -600.0, 1000.0

	// Fire North Wall
	for x := fireMinX; x <= fireMaxX; x += segmentLen {
		createSegment(x, fireMinZ, 0)
	}
	// Fire South Wall
	for x := fireMinX; x <= fireMaxX; x += segmentLen {
		createSegment(x, fireMaxZ, 0)
	}
	// Fire West Wall
	for z := fireMinZ; z <= fireMaxZ; z += segmentLen {
		createSegment(fireMinX, z, math.Pi/2)
	}
	// Fire East Wall connects to Earth Realm gap (no fence needed on east side)

	// 5. Air Realm Fence (East Zone - Skyward Peaks)
	// Bounds: X: 1000 to 3000, Z: -600 to 1000
	// Entrance at X: 1000, Z: 200 (gap in Earth Realm East Wall)
	airMinX, airMaxX := 1000.0, 3000.0
	airMinZ, airMaxZ := -600.0, 1000.0

	// Air North Wall
	for x := airMinX; x <= airMaxX; x += segmentLen {
		createSegment(x, airMinZ, 0)
	}
	// Air South Wall
	for x := airMinX; x <= airMaxX; x += segmentLen {
		createSegment(x, airMaxZ, 0)
	}
	// Air East Wall
	for z := airMinZ; z <= airMaxZ; z += segmentLen {
		createSegment(airMaxX, z, math.Pi/2)
	}
	// Air West Wall connects to Earth Realm gap (no fence needed on west side)
}

func (w *World) spawnSnowWorld() {
	// Area 1: 50-55 (Mountain Troll)
	// Z range: -600 to -1000
	// X range: -1000 to 1000

	count := 300
	minZ := -1000.0 + 5.0
	maxZ := -600.0 - 5.0
	minX := -1000.0 + 5.0
	maxX := 1000.0 - 5.0

	for i := 0; i < count; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := minZ + rand.Float64()*(maxZ-minZ)

		baseStats := Stats{Strength: 3500, Intelligence: 500, Dexterity: 800, Wisdom: 500, Vitality: 3500}
		maxHealth := baseStats.Vitality * 10
		damage := baseStats.Strength * 2

		// Attack Speed
		speedMult := 1.0 + (float64(baseStats.Dexterity) * 0.02)
		cooldown := 5.0 / speedMult
		if cooldown < 1.0 {
			cooldown = 1.0
		}
		attackSpeed := cooldown
		attackCooldown := time.Duration(cooldown * float64(time.Second))

		troll := &Entity{
			ID:             fmt.Sprintf("MountainTroll-%d", i),
			Type:           TypeEnemy,
			SubType:        "MountainTroll",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      baseStats,
			Health:         maxHealth,
			MaxHealth:      maxHealth,
			Damage:         damage,
			Level:          50 + rand.Intn(6),
			Speed:          5.0,
			State:          "IDLE",
			AttackSpeed:    attackSpeed,
			AttackCooldown: attackCooldown,
			Scale:          1.0,
		}
		w.AddEntity(troll)
	}

	// Area 2: 55-60 (Aqua Golem)
	// Z range: -1000 to -1400
	// X range: -1000 to 1000

	agCount := 300
	agMinZ := -1400.0 + 5.0
	agMaxZ := -1000.0 - 5.0

	for i := 0; i < agCount; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := agMinZ + rand.Float64()*(agMaxZ-agMinZ)

		baseStats := Stats{Strength: 4500, Intelligence: 1000, Dexterity: 500, Wisdom: 1000, Vitality: 5000}
		maxHealth := baseStats.Vitality * 10
		damage := baseStats.Strength * 2

		// Attack Speed
		speedMult := 1.0 + (float64(baseStats.Dexterity) * 0.02)
		cooldown := 5.0 / speedMult
		if cooldown < 1.0 {
			cooldown = 1.0
		}
		attackSpeed := cooldown
		attackCooldown := time.Duration(cooldown * float64(time.Second))

		golem := &Entity{
			ID:             fmt.Sprintf("AquaGolem-%d", i),
			Type:           TypeEnemy,
			SubType:        "AquaGolem",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      baseStats,
			Health:         maxHealth,
			MaxHealth:      maxHealth,
			Damage:         damage,
			Level:          55 + rand.Intn(6),
			Speed:          4.0,
			State:          "IDLE",
			AttackSpeed:    attackSpeed,
			AttackCooldown: attackCooldown,
			Scale:          1.0,
		}
		w.AddEntity(golem)
	}

	// Area 3: 60-65 (Siren) - Moved deeper
	// Z range: -1400 to -1800
	// X range: -1000 to 1000 (Width of the snow path)

	sirenCount := 300
	sirenMinZ := -1800.0 + 5.0
	sirenMaxZ := -1400.0 - 5.0

	for i := 0; i < sirenCount; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := sirenMinZ + rand.Float64()*(sirenMaxZ-sirenMinZ)

		baseStats := Stats{Strength: 4000, Intelligence: 2000, Dexterity: 1000, Wisdom: 2000, Vitality: 4000}
		maxHealth := baseStats.Vitality * 10
		damage := baseStats.Strength * 2

		// Attack Speed
		speedMult := 1.0 + (float64(baseStats.Dexterity) * 0.02)
		cooldown := 5.0 / speedMult
		if cooldown < 1.0 {
			cooldown = 1.0
		}
		attackSpeed := cooldown
		attackCooldown := time.Duration(cooldown * float64(time.Second))

		siren := &Entity{
			ID:             fmt.Sprintf("Siren-%d", i),
			Type:           TypeEnemy,
			SubType:        "Siren",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      baseStats,
			Health:         maxHealth,
			MaxHealth:      maxHealth,
			Damage:         damage,
			Level:          60 + rand.Intn(6),
			Speed:          5.4,
			State:          "IDLE",
			AttackSpeed:    attackSpeed,
			AttackCooldown: attackCooldown,
			Scale:          1.0,
		}
		w.AddEntity(siren)
	}

	// Area 4: 65-70 (Frost Guardian) - Moved deeper
	// Z range: -1800 to -2200
	// X range: -1000 to 1000

	fgCount := 300
	fgMinZ := -2200.0 + 5.0
	fgMaxZ := -1800.0 - 5.0

	for i := 0; i < fgCount; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := fgMinZ + rand.Float64()*(fgMaxZ-fgMinZ)

		baseStats := Stats{Strength: 5000, Intelligence: 1000, Dexterity: 800, Wisdom: 1000, Vitality: 6000}
		maxHealth := baseStats.Vitality * 10
		damage := baseStats.Strength * 2

		// Attack Speed
		speedMult := 1.0 + (float64(baseStats.Dexterity) * 0.02)
		cooldown := 5.0 / speedMult
		if cooldown < 1.0 {
			cooldown = 1.0
		}
		attackSpeed := cooldown
		attackCooldown := time.Duration(cooldown * float64(time.Second))

		fg := &Entity{
			ID:             fmt.Sprintf("FrostGuardian-%d", i),
			Type:           TypeEnemy,
			SubType:        "FrostGuardian",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      baseStats,
			Health:         maxHealth,
			MaxHealth:      maxHealth,
			Damage:         damage,
			Level:          65 + rand.Intn(6),
			Speed:          4.5, // Slower but tankier
			State:          "IDLE",
			AttackSpeed:    attackSpeed,
			AttackCooldown: attackCooldown,
			Scale:          1.0,
		}
		w.AddEntity(fg)
	}
}

// spawnFireRealm spawns enemies in the Fire Realm (West Zone - Scorched Wastes)
// Level Range: 70-95
// Bounds: X: -3000 to -1000, Z: -600 to 1000
func (w *World) spawnFireRealm() {
	// Fire Realm Enemy Types by Area (from IMPROVEMENT_PLAN.md):
	// Area 1: X -1400 to -1000, Lv 70-75, Sandstorm Djinn
	// Area 2: X -1800 to -1400, Lv 75-80, Magma Golem
	// Area 3: X -2200 to -1800, Lv 80-85, Scorched Wraith
	// Area 4: X -2600 to -2200, Lv 85-90, Infernal Behemoth
	// Area 5: X -3000 to -2600, Lv 90-95, Phoenix Sentinel

	minZ := -600.0 + 5.0
	maxZ := 1000.0 - 5.0
	count := 200 // Per area

	// Helper to spawn enemies in a Fire Realm area
	spawnFireArea := func(subType string, minX, maxX float64, baseLevel int, stats Stats) {
		for i := 0; i < count; i++ {
			x := minX + rand.Float64()*(maxX-minX)
			z := minZ + rand.Float64()*(maxZ-minZ)

			maxHealth := stats.Vitality * 10
			damage := stats.Strength * 2

			speedMult := 1.0 + (float64(stats.Dexterity) * 0.02)
			cooldown := 5.0 / speedMult
			if cooldown < 1.0 {
				cooldown = 1.0
			}

			enemy := &Entity{
				ID:             fmt.Sprintf("%s-%d", subType, i),
				Type:           TypeEnemy,
				SubType:        subType,
				X:              x,
				Y:              0,
				Z:              z,
				SpawnX:         x,
				SpawnZ:         z,
				BaseStats:      stats,
				Health:         maxHealth,
				MaxHealth:      maxHealth,
				Damage:         damage,
				Level:          baseLevel + rand.Intn(6),
				Speed:          5.0,
				State:          "IDLE",
				AttackSpeed:    cooldown,
				AttackCooldown: time.Duration(cooldown * float64(time.Second)),
				Scale:          1.0,
			}
			w.AddEntity(enemy)
		}
	}

	// Area 1: Sandstorm Djinn (Lv 70-75) - AoE slow
	spawnFireArea("SandstormDjinn", -1400.0+5.0, -1000.0-5.0, 70,
		Stats{Strength: 4000, Intelligence: 1200, Dexterity: 1000, Wisdom: 1200, Vitality: 4500})

	// Area 2: Magma Golem (Lv 75-80) - Ground DoT zone
	spawnFireArea("MagmaGolem", -1800.0+5.0, -1400.0-5.0, 75,
		Stats{Strength: 5000, Intelligence: 500, Dexterity: 400, Wisdom: 500, Vitality: 6000})

	// Area 3: Scorched Wraith (Lv 80-85) - Phase shift invulnerable
	spawnFireArea("ScorchedWraith", -2200.0+5.0, -1800.0-5.0, 80,
		Stats{Strength: 4500, Intelligence: 2000, Dexterity: 1500, Wisdom: 2000, Vitality: 4500})

	// Area 4: Infernal Behemoth (Lv 85-90) - AoE stun
	spawnFireArea("InfernalBehemoth", -2600.0+5.0, -2200.0-5.0, 85,
		Stats{Strength: 6000, Intelligence: 1000, Dexterity: 600, Wisdom: 1000, Vitality: 7000})

	// Area 5: Phoenix Sentinel (Lv 90-95) - Rebirth (heals 50% HP once)
	spawnFireArea("PhoenixSentinel", -3000.0+5.0, -2600.0-5.0, 90,
		Stats{Strength: 5500, Intelligence: 2500, Dexterity: 1200, Wisdom: 2500, Vitality: 5500})
}

// spawnAirRealm spawns enemies in the Air Realm (East Zone - Skyward Peaks)
// Level Range: 70-95
// Bounds: X: 1000 to 3000, Z: -600 to 1000
func (w *World) spawnAirRealm() {
	// Air Realm Enemy Types by Area (from IMPROVEMENT_PLAN.md):
	// Area 1: X 1000 to 1400, Lv 70-75, Storm Harpy
	// Area 2: X 1400 to 1800, Lv 75-80, Cloud Elemental
	// Area 3: X 1800 to 2200, Lv 80-85, Thunder Roc
	// Area 4: X 2200 to 2600, Lv 85-90, Tempest Giant
	// Area 5: X 2600 to 3000, Lv 90-95, Cyclone Avatar

	minZ := -600.0 + 5.0
	maxZ := 1000.0 - 5.0
	count := 200 // Per area

	// Helper to spawn enemies in an Air Realm area
	spawnAirArea := func(subType string, minX, maxX float64, baseLevel int, stats Stats) {
		for i := 0; i < count; i++ {
			x := minX + rand.Float64()*(maxX-minX)
			z := minZ + rand.Float64()*(maxZ-minZ)

			maxHealth := stats.Vitality * 10
			damage := stats.Strength * 2

			speedMult := 1.0 + (float64(stats.Dexterity) * 0.02)
			cooldown := 5.0 / speedMult
			if cooldown < 1.0 {
				cooldown = 1.0
			}

			enemy := &Entity{
				ID:             fmt.Sprintf("%s-%d", subType, i),
				Type:           TypeEnemy,
				SubType:        subType,
				X:              x,
				Y:              0,
				Z:              z,
				SpawnX:         x,
				SpawnZ:         z,
				BaseStats:      stats,
				Health:         maxHealth,
				MaxHealth:      maxHealth,
				Damage:         damage,
				Level:          baseLevel + rand.Intn(6),
				Speed:          5.5,
				State:          "IDLE",
				AttackSpeed:    cooldown,
				AttackCooldown: time.Duration(cooldown * float64(time.Second)),
				Scale:          1.0,
			}
			w.AddEntity(enemy)
		}
	}

	// Area 1: Storm Harpy (Lv 70-75) - Knockback
	spawnAirArea("StormHarpy", 1000.0+5.0, 1400.0-5.0, 70,
		Stats{Strength: 3800, Intelligence: 1000, Dexterity: 1500, Wisdom: 1000, Vitality: 4200})

	// Area 2: Cloud Elemental (Lv 75-80) - Mist form (50% miss chance)
	spawnAirArea("CloudElemental", 1400.0+5.0, 1800.0-5.0, 75,
		Stats{Strength: 4200, Intelligence: 1500, Dexterity: 800, Wisdom: 1500, Vitality: 5500})

	// Area 3: Thunder Roc (Lv 80-85) - Chain lightning
	spawnAirArea("ThunderRoc", 1800.0+5.0, 2200.0-5.0, 80,
		Stats{Strength: 5000, Intelligence: 1800, Dexterity: 1200, Wisdom: 1800, Vitality: 5000})

	// Area 4: Tempest Giant (Lv 85-90) - Tornado pull
	spawnAirArea("TempestGiant", 2200.0+5.0, 2600.0-5.0, 85,
		Stats{Strength: 5800, Intelligence: 1200, Dexterity: 700, Wisdom: 1200, Vitality: 6500})

	// Area 5: Cyclone Avatar (Lv 90-95) - Eye of storm safe zone
	spawnAirArea("CycloneAvatar", 2600.0+5.0, 3000.0-5.0, 90,
		Stats{Strength: 5200, Intelligence: 2200, Dexterity: 1400, Wisdom: 2200, Vitality: 5800})
}

// spawnEnvironmentalHazards creates hazard zones in each realm
// Hazards deal % max health damage per second, making them equally dangerous to all players
func (w *World) spawnEnvironmentalHazards() {
	// Hazard damage: 3% max health per second (0.03)
	// Tick interval: 1.0 second
	// This means standing in a hazard for 33 seconds = death from full health

	// ==========================================================================
	// FIRE REALM HAZARDS: Lava Pools (X: -3000 to -1000)
	// Scattered throughout the Fire Realm
	// ==========================================================================
	fireHazards := []struct {
		x, z   float64
		radius float64
	}{
		// Area 1: Near entrance (X -1400 to -1000)
		{-1150, 100, 6.0},
		{-1250, 350, 7.0},
		{-1350, -100, 5.0},
		// Area 2: Mid Fire Realm (X -1800 to -1400)
		{-1550, 200, 8.0},
		{-1650, 500, 6.0},
		{-1500, -300, 7.0},
		{-1750, 0, 6.0},
		// Area 3: Deep Fire Realm (X -2200 to -1800)
		{-1950, 300, 9.0},
		{-2050, -200, 7.0},
		{-2100, 600, 8.0},
		{-1900, -400, 6.0},
		// Area 4: Far Fire Realm (X -2600 to -2200)
		{-2350, 150, 8.0},
		{-2450, 400, 9.0},
		{-2300, -300, 7.0},
		{-2550, 700, 8.0},
		// Area 5: Edge of Fire Realm (X -3000 to -2600)
		{-2750, 200, 10.0},
		{-2850, 500, 9.0},
		{-2700, -100, 8.0},
		{-2950, 350, 10.0},
	}

	for i, h := range fireHazards {
		hazard := &Hazard{
			ID:           fmt.Sprintf("hazard-lava-%d", i),
			HazardType:   HazardLavaPool,
			X:            h.x,
			Z:            h.z,
			Radius:       h.radius,
			DamagePct:    0.03, // 3% max health per tick
			TickInterval: 1.0,
		}
		w.Hazards[hazard.ID] = hazard
	}

	// ==========================================================================
	// EARTH REALM HAZARDS: Sandstorms (X: -1000 to 1000, outside town)
	// Near the edges of the Earth Realm
	// ==========================================================================
	earthHazards := []struct {
		x, z   float64
		radius float64
	}{
		// Northwest corner
		{-800, -450, 10.0},
		{-650, -350, 8.0},
		// Northeast corner
		{800, -450, 10.0},
		{650, -350, 8.0},
		// Southwest corner
		{-800, 850, 9.0},
		{-600, 750, 7.0},
		// Southeast corner
		{800, 850, 9.0},
		{600, 750, 7.0},
		// West side (away from Fire entrance)
		{-900, 500, 8.0},
		{-850, -200, 7.0},
		// East side (away from Air entrance)
		{900, 500, 8.0},
		{850, -200, 7.0},
	}

	for i, h := range earthHazards {
		hazard := &Hazard{
			ID:           fmt.Sprintf("hazard-sandstorm-%d", i),
			HazardType:   HazardSandstorm,
			X:            h.x,
			Z:            h.z,
			Radius:       h.radius,
			DamagePct:    0.02, // 2% max health per tick (slightly less than lava)
			TickInterval: 1.0,
		}
		w.Hazards[hazard.ID] = hazard
	}

	// ==========================================================================
	// WATER REALM HAZARDS: Lightning Zones (Z: -600 to -2200)
	// Scattered throughout the snowy Water Realm
	// ==========================================================================
	waterHazards := []struct {
		x, z   float64
		radius float64
	}{
		// Near entrance from Earth Realm (Z -600 to -900)
		{-50, -750, 7.0},
		{100, -850, 6.0},
		{-150, -700, 5.0},
		// Mid Water Realm (Z -900 to -1400)
		{0, -1000, 8.0},
		{200, -1150, 7.0},
		{-200, -1100, 6.0},
		{50, -1300, 8.0},
		// Deep Water Realm (Z -1400 to -1800)
		{-100, -1550, 9.0},
		{150, -1650, 8.0},
		{-50, -1750, 7.0},
		{250, -1500, 6.0},
		// Far Water Realm (Z -1800 to -2200)
		{0, -1950, 10.0},
		{-200, -2050, 9.0},
		{200, -2100, 8.0},
		{100, -1900, 7.0},
	}

	for i, h := range waterHazards {
		hazard := &Hazard{
			ID:           fmt.Sprintf("hazard-lightning-%d", i),
			HazardType:   HazardLightning,
			X:            h.x,
			Z:            h.z,
			Radius:       h.radius,
			DamagePct:    0.04, // 4% max health per tick (lightning is dangerous!)
			TickInterval: 1.0,
		}
		w.Hazards[hazard.ID] = hazard
	}

	// ==========================================================================
	// AIR REALM HAZARDS: Wind Gusts (X: 1000 to 3000)
	// Scattered throughout the Air Realm
	// ==========================================================================
	airHazards := []struct {
		x, z   float64
		radius float64
	}{
		// Area 1: Near entrance (X 1000 to 1400)
		{1150, 100, 6.0},
		{1250, 350, 7.0},
		{1350, -100, 5.0},
		// Area 2: Mid Air Realm (X 1400 to 1800)
		{1550, 200, 8.0},
		{1650, 500, 6.0},
		{1500, -300, 7.0},
		{1750, 0, 6.0},
		// Area 3: Deep Air Realm (X 1800 to 2200)
		{1950, 300, 9.0},
		{2050, -200, 7.0},
		{2100, 600, 8.0},
		{1900, -400, 6.0},
		// Area 4: Far Air Realm (X 2200 to 2600)
		{2350, 150, 8.0},
		{2450, 400, 9.0},
		{2300, -300, 7.0},
		{2550, 700, 8.0},
		// Area 5: Edge of Air Realm (X 2600 to 3000)
		{2750, 200, 10.0},
		{2850, 500, 9.0},
		{2700, -100, 8.0},
		{2950, 350, 10.0},
	}

	for i, h := range airHazards {
		hazard := &Hazard{
			ID:           fmt.Sprintf("hazard-wind-%d", i),
			HazardType:   HazardWindGust,
			X:            h.x,
			Z:            h.z,
			Radius:       h.radius,
			DamagePct:    0.025, // 2.5% max health per tick
			TickInterval: 1.0,
		}
		w.Hazards[hazard.ID] = hazard
	}

	// Create Entity objects for each hazard so they get broadcast to clients
	// The client uses: Type=Hazard, SubType=hazardType, Scale=radius
	for _, hazard := range w.Hazards {
		entity := &Entity{
			ID:      hazard.ID,
			Type:    TypeHazard,
			SubType: string(hazard.HazardType),
			X:       hazard.X,
			Y:       0,
			Z:       hazard.Z,
			Scale:   hazard.Radius, // Use Scale to store radius for client rendering
			State:   "IDLE",
		}
		w.AddEntity(entity)
	}

	log.Printf("Spawned %d environmental hazards", len(w.Hazards))
}

func (w *World) spawnInitialElites() {
	// Spawn one elite in each rectangular sector
	// Sector 3 (Center): Lv 1-10 (-200 to 200)
	w.spawnEliteInRect(10, -200, 200, -600, 1000)
	// Sector 2 (Left): Lv 10-20 (-600 to -200)
	w.spawnEliteInRect(20, -600, -200, -600, 1000)
	// Sector 4 (Right): Lv 20-30 (200 to 600)
	w.spawnEliteInRect(30, 200, 600, -600, 1000)
	// Sector 1 (Far Left): Lv 30-40 (-1000 to -600)
	w.spawnEliteInRect(40, -1000, -600, -600, 1000)
	// Sector 5 (Far Right): Lv 40-50 (600 to 1000)
	w.spawnEliteInRect(50, 600, 1000, -600, 1000)
}

func (w *World) spawnEliteInRect(level int, minX, maxX, minZ, maxZ float64) {
	subType := "Skeleton"
	if level >= 20 {
		subType = "Imp"
	}
	if level >= 30 {
		subType = "DemonOrc"
	}
	if level >= 40 {
		subType = "Construct"
	}
	if level >= 50 {
		subType = "InfernoTitan"
	}

	// Random pos in rect
	x := minX + rand.Float64()*(maxX-minX)
	z := minZ + rand.Float64()*(maxZ-minZ)

	// Avoid Town Safe Zone if in center sector
	// Town: Rectangular (-100 to 100 X, 100 to 300 Z)
	if x > -100 && x < 100 && z > 100 && z < 300 {
		// Push out
		if x > 0 {
			x = 120
		} else {
			x = -120
		}
	}

	// Base stats multiplier for Elite
	mult := 1.5

	// Base stats for the type (simplified lookup)
	var baseStats Stats
	switch subType {
	case "Skeleton":
		baseStats = Stats{Strength: 15, Intelligence: 6, Dexterity: 9, Wisdom: 6, Vitality: 15}
	case "Imp":
		baseStats = Stats{Strength: 600, Intelligence: 200, Dexterity: 300, Wisdom: 200, Vitality: 600}
	case "DemonOrc":
		baseStats = Stats{Strength: 1250, Intelligence: 400, Dexterity: 500, Wisdom: 400, Vitality: 1250}
	case "Construct":
		baseStats = Stats{Strength: 2000, Intelligence: 750, Dexterity: 250, Wisdom: 750, Vitality: 2000}
	case "InfernoTitan":
		baseStats = Stats{Strength: 3000, Intelligence: 1000, Dexterity: 400, Wisdom: 1000, Vitality: 3000}
	case "Siren":
		baseStats = Stats{Strength: 4000, Intelligence: 2000, Dexterity: 1000, Wisdom: 2000, Vitality: 4000}
	case "FrostGuardian":
		baseStats = Stats{Strength: 5000, Intelligence: 1000, Dexterity: 800, Wisdom: 1000, Vitality: 6500}
	// Fire Realm enemies
	case "SandstormDjinn":
		baseStats = Stats{Strength: 4000, Intelligence: 1200, Dexterity: 1000, Wisdom: 1200, Vitality: 4500}
	case "MagmaGolem":
		baseStats = Stats{Strength: 5000, Intelligence: 500, Dexterity: 400, Wisdom: 500, Vitality: 6000}
	case "ScorchedWraith":
		baseStats = Stats{Strength: 4500, Intelligence: 2000, Dexterity: 1500, Wisdom: 2000, Vitality: 4500}
	case "InfernalBehemoth":
		baseStats = Stats{Strength: 6000, Intelligence: 1000, Dexterity: 600, Wisdom: 1000, Vitality: 7000}
	case "PhoenixSentinel":
		baseStats = Stats{Strength: 5500, Intelligence: 2500, Dexterity: 1200, Wisdom: 2500, Vitality: 5500}
	// Air Realm enemies
	case "StormHarpy":
		baseStats = Stats{Strength: 3800, Intelligence: 1000, Dexterity: 1500, Wisdom: 1000, Vitality: 4200}
	case "CloudElemental":
		baseStats = Stats{Strength: 4200, Intelligence: 1500, Dexterity: 800, Wisdom: 1500, Vitality: 5500}
	case "ThunderRoc":
		baseStats = Stats{Strength: 5000, Intelligence: 1800, Dexterity: 1200, Wisdom: 1800, Vitality: 5000}
	case "TempestGiant":
		baseStats = Stats{Strength: 5800, Intelligence: 1200, Dexterity: 700, Wisdom: 1200, Vitality: 6500}
	case "CycloneAvatar":
		baseStats = Stats{Strength: 5200, Intelligence: 2200, Dexterity: 1400, Wisdom: 2200, Vitality: 5800}
	}

	maxHealth := int(float64(baseStats.Vitality*10) * mult)
	damage := int(float64(baseStats.Strength*2) * mult)

	// Attack Speed (Seconds Per Attack)
	speedMult := 1.0 + (float64(baseStats.Dexterity) * 0.02)
	cooldown := 5.0 / speedMult
	if cooldown < 1.0 {
		cooldown = 1.0
	}
	attackSpeed := cooldown
	attackCooldown := time.Duration(cooldown * float64(time.Second))

	elite := &Entity{
		ID:             fmt.Sprintf("elite-%s-%d", subType, time.Now().UnixNano()),
		Type:           TypeEnemy,
		SubType:        subType,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      baseStats,
		Health:         maxHealth,
		MaxHealth:      maxHealth,
		Damage:         damage,
		Level:          level,
		Speed:          5.4,
		State:          "IDLE",
		AttackSpeed:    attackSpeed,
		AttackCooldown: attackCooldown,
		Scale:          1.0,
	}
	w.Entities[elite.ID] = elite
	w.Grid.Add(elite)

	if w.OnEvent != nil {
		w.OnEvent("elite_spawn", fmt.Sprintf("An Elite %s has spawned!", subType))
	}
}

func (w *World) spawnStash() {
	stash := &Entity{
		ID:        "stash-1",
		Type:      TypeStash,
		SubType:   "Stash",
		X:         0,
		Y:         0.5, // Slightly above ground
		Z:         185, // In front of Two Story Building (which is at 170)
		Rotation:  0,
		State:     "IDLE",
		Health:    100000,
		MaxHealth: 100000,
		Scale:     1.0,
	}
	w.AddEntity(stash)
}

func (w *World) spawnForge() {
	forge := &Entity{
		ID:        "forge-1",
		Type:      TypeForge,
		SubType:   "Forge",
		X:         -28,
		Y:         0.5,
		Z:         218,
		Rotation:  math.Pi / 2,
		State:     "IDLE",
		Health:    100000,
		MaxHealth: 100000,
		Scale:     1.0,
	}
	w.AddEntity(forge)
}

func (w *World) spawnTradingHouse() {
	tradingHouse := &Entity{
		ID:        "trading-house-1",
		Type:      TypeTradingHouse,
		SubType:   "TradingHouse",
		X:         -22,
		Y:         0.5,
		Z:         185,
		Rotation:  math.Pi / 4,
		State:     "IDLE",
		Health:    100000,
		MaxHealth: 100000,
		Scale:     1.0,
	}
	w.AddEntity(tradingHouse)
}

func (w *World) spawnQuestNPC() {
	npc := &Entity{
		ID:       "quest-npc-1",
		Type:     TypeNPC,
		SubType:  "QuestNPC",
		X:        -25,         // Near Blacksmith (West)
		Y:        0.5,         // Slightly above ground
		Z:        200,         // Center Z
		Rotation: math.Pi / 2, // Face East (towards center)
		State:    "IDLE",
		Scale:    1.0,
	}
	w.AddEntity(npc)
}

func (w *World) spawnDungeonNPC() {
	npc := &Entity{
		ID:       "dungeon-npc-1",
		Type:     TypeNPC,
		SubType:  "DungeonNPC",
		X:        0,
		Y:        0.5,
		Z:        240,
		Rotation: math.Pi,
		State:    "IDLE",
		Scale:    1.0,
	}
	w.AddEntity(npc)
}

func (w *World) spawnMerchant() {
	merchant := &Entity{
		ID:       "merchant-1",
		Type:     TypeNPC,
		SubType:  "DwarfSalesman",
		X:        22.5, // Moved to 22.5 (between 20 and 25)
		Y:        0,
		Z:        200,          // Near Trading Post (East)
		Rotation: -math.Pi / 2, // Face West (towards center)
		State:    "IDLE",
		Scale:    1.0,
	}
	// Merchant doesn't need combat stats for now
	w.AddEntity(merchant)
}

func (w *World) spawnRespecNPC() {
	respecNPC := &Entity{
		ID:       "respec-npc-1",
		Type:     TypeNPC,
		SubType:  "RespecNPC",
		X:        0, // Center of safe zone
		Y:        0,
		Z:        220, // Between merchant and quest NPC
		Rotation: 0,   // Face south
		State:    "IDLE",
		Scale:    1.0,
	}
	w.AddEntity(respecNPC)
}

func (w *World) spawnEnemies() {
	// 5 Rectangular Sectors (Vertical Strips)
	// Total Width: 2000 (-1000 to 1000)
	// Each Sector Width: 400
	// Z Range: -600 to 1000

	// Sector 3 (Center): Lv 1-10 (Skeleton)
	// X: -200 to 200
	w.spawnEnemyRect("Skeleton", 300, -200, 200, -600, 1000, 10, Stats{Strength: 15, Intelligence: 6, Dexterity: 9, Wisdom: 6, Vitality: 15})

	// Sector 2 (Left): Lv 10-20 (Imp)
	// X: -600 to -200
	w.spawnEnemyRect("Imp", 300, -600, -200, -600, 1000, 20, Stats{Strength: 600, Intelligence: 200, Dexterity: 300, Wisdom: 200, Vitality: 600})

	// Sector 4 (Right): Lv 20-30 (DemonOrc)
	// X: 200 to 600
	w.spawnEnemyRect("DemonOrc", 300, 200, 600, -600, 1000, 30, Stats{Strength: 1250, Intelligence: 400, Dexterity: 500, Wisdom: 400, Vitality: 1250})

	// Sector 1 (Far Left): Lv 30-40 (Construct)
	// X: -1000 to -600
	w.spawnEnemyRect("Construct", 300, -1000, -600, -600, 1000, 40, Stats{Strength: 2000, Intelligence: 750, Dexterity: 250, Wisdom: 750, Vitality: 2000})

	// Sector 5 (Far Right): Lv 40-50 (InfernoTitan)
	// X: 600 to 1000
	w.spawnEnemyRect("InfernoTitan", 300, 600, 1000, -600, 1000, 50, Stats{Strength: 3000, Intelligence: 1000, Dexterity: 400, Wisdom: 1000, Vitality: 3000})
}

type deferredActions struct {
	mu        sync.Mutex
	removals  []string
	additions []*Entity
}

func (d *deferredActions) addRemoval(id string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.removals = append(d.removals, id)
}

func (d *deferredActions) addAddition(e *Entity) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.additions = append(d.additions, e)
}

func (w *World) spawnEnemyRect(subType string, count int, minX, maxX, minZ, maxZ float64, level int, baseStats Stats) {
	for i := 0; i < count; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := minZ + rand.Float64()*(maxZ-minZ)

		// Avoid Town Safe Zone if in center sector
		// Town: Rectangular (-100 to 100 X, 100 to 300 Z)
		if x > -100 && x < 100 && z > 100 && z < 300 {
			continue // Skip spawn inside town
		}

		// Calculate derived stats
		maxHealth := baseStats.Vitality * 10
		maxMana := baseStats.Intelligence * 10
		damage := baseStats.Strength * 2

		// Player Base Speed (0 Dex) = 3.0 * 1.2 = 3.6
		// Enemy Speed = 150% of Player Base Speed = 5.4
		speed := 5.4

		// Attack Speed (Seconds Per Attack)
		// Base 5.0s, scales down with Dex, min 1.0s
		speedMult := 1.0 + (float64(baseStats.Dexterity) * 0.02)
		cooldown := 5.0 / speedMult
		if cooldown < 1.0 {
			cooldown = 1.0
		}
		attackSpeed := cooldown
		attackCooldown := time.Duration(cooldown * float64(time.Second))

		enemy := &Entity{
			ID:             fmt.Sprintf("%s-%d", subType, i),
			Type:           TypeEnemy,
			SubType:        subType,
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      baseStats,
			Health:         maxHealth,
			MaxHealth:      maxHealth,
			Mana:           maxMana,
			MaxMana:        maxMana,
			Damage:         damage,
			Level:          level,
			Speed:          speed,
			State:          "IDLE",
			AttackSpeed:    attackSpeed,
			AttackCooldown: attackCooldown,
			Scale:          1.0,
		}
		w.AddEntity(enemy)
	}
}

func (w *World) AddEntity(e *Entity) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	// Remove stale grid entry if entity ID already exists (e.g. re-join)
	if old, exists := w.Entities[e.ID]; exists {
		w.Grid.Remove(old)
	}
	w.Entities[e.ID] = e
	w.Grid.Add(e)
}

func (w *World) RemoveEntity(id string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if e, ok := w.Entities[id]; ok {
		instanceID := e.InstanceID
		w.Grid.Remove(e)
		delete(w.Entities, id)

		if strings.HasPrefix(instanceID, "dungeon_") {
			w.checkAndResetDungeonLocked(instanceID)
		}
	}
}

func (w *World) UpdateEntityPosition(id string, x, y, z, rotation float64) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	e, ok := w.Entities[id]
	if !ok {
		return
	}

	if e.Type == TypePlayer {
		if constrainedX, constrainedZ, ok := w.constrainPlayerPointToDungeon(e.InstanceID, x, z); ok {
			x = constrainedX
			z = constrainedZ
		}
	}

	oldX, oldZ := e.X, e.Z
	e.X = x
	e.Y = y
	e.Z = z
	e.Rotation = rotation
	if e.State != "JUMPING" {
		e.State = "MOVING" // Default to moving if position updates
	}

	w.Grid.Update(e, oldX, oldZ)
}

func (w *World) StartPlayerJump(id string, x, y, z float64) bool {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	e, ok := w.Entities[id]
	if !ok || e.Type != TypePlayer {
		return false
	}

	if constrainedX, constrainedZ, ok := w.constrainPlayerPointToDungeon(e.InstanceID, x, z); ok {
		x = constrainedX
		z = constrainedZ
	}

	dx := x - e.X
	dz := z - e.Z
	travelDistance := math.Sqrt(dx*dx + dz*dz)
	duration := math.Max(0.46, math.Min(1.28, travelDistance/13.5))
	height := math.Max(6.5, math.Min(16.5, travelDistance*0.38+4.2))

	e.TargetX = x
	e.TargetZ = z
	e.JumpStartX = e.X
	e.JumpStartY = e.Y
	e.JumpStartZ = e.Z
	e.JumpTargetX = x
	e.JumpTargetY = y
	e.JumpTargetZ = z
	e.JumpDuration = duration
	e.JumpElapsed = 0
	e.JumpHeight = height
	e.JumpProgress = 0
	e.State = "JUMPING"
	if travelDistance > 0 {
		e.Rotation = math.Atan2(dx, dz)
	}

	return true
}

func (w *World) GetEntity(id string) *Entity {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	return w.Entities[id]
}

func (w *World) GetEntityCopy(id string) *Entity {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	e, ok := w.Entities[id]
	if !ok {
		return nil
	}

	// Manual copy to avoid copying the.Mutex
	newE := &Entity{
		ID:                e.ID,
		InstanceID:        e.InstanceID,
		Name:              e.Name,
		PartyID:           e.PartyID,
		Type:              e.Type,
		SubType:           e.SubType,
		X:                 e.X,
		Y:                 e.Y,
		Z:                 e.Z,
		Rotation:          e.Rotation,
		Health:            e.Health,
		MaxHealth:         e.MaxHealth,
		Mana:              e.Mana,
		MaxMana:           e.MaxMana,
		Level:             e.Level,
		Experience:        e.Experience,
		MaxExperience:     e.MaxExperience,
		Gold:              e.Gold,
		LastDailyQuest:    e.LastDailyQuest,
		BaseStats:         e.BaseStats,
		Stats:             e.Stats,
		Damage:            e.Damage,
		Defense:           e.Defense,
		Speed:             e.Speed,
		AttackSpeed:       e.AttackSpeed,
		CooldownReduction: e.CooldownReduction,
		HpRegen:           e.HpRegen,
		ManaRegen:         e.ManaRegen,
		CastSpeed:         e.CastSpeed,
		Scale:             e.Scale,
		TargetX:           e.TargetX,
		TargetZ:           e.TargetZ,
		SpawnX:            e.SpawnX,
		SpawnZ:            e.SpawnZ,
		State:             e.State,
		LastAttackTime:    e.LastAttackTime,
		AttackCooldown:    e.AttackCooldown,
		LastAbilityTime:   e.LastAbilityTime,
		AbilityCooldown:   e.AbilityCooldown,
		LastRespawnTime:   e.LastRespawnTime,
		LootItem:          e.LootItem,
		LootTime:          e.LootTime,
		CreatedAt:         e.CreatedAt,
		OwnerID:           e.OwnerID,
		VelX:              e.VelX,
		VelZ:              e.VelZ,
		Radius:            e.Radius,
		SpiritsActive:     e.SpiritsActive,
		SpiritEndTime:     e.SpiritEndTime,
		LastSpiritTick:    e.LastSpiritTick,
		IsCharging:        e.IsCharging,
		ChargeTargetX:     e.ChargeTargetX,
		ChargeTargetZ:     e.ChargeTargetZ,
		JumpStartX:        e.JumpStartX,
		JumpStartY:        e.JumpStartY,
		JumpStartZ:        e.JumpStartZ,
		JumpTargetX:       e.JumpTargetX,
		JumpTargetY:       e.JumpTargetY,
		JumpTargetZ:       e.JumpTargetZ,
		JumpDuration:      e.JumpDuration,
		JumpElapsed:       e.JumpElapsed,
		JumpHeight:        e.JumpHeight,
		JumpProgress:      e.JumpProgress,
		SkillPoints:       e.SkillPoints,
		SelectedBranch:    e.SelectedBranch,
		TalentPoints:      e.TalentPoints,
	}

	if e.UnlockedSkills != nil {
		newE.UnlockedSkills = make([]string, len(e.UnlockedSkills))
		copy(newE.UnlockedSkills, e.UnlockedSkills)
	}
	if e.TalentRanks != nil {
		newE.TalentRanks = make(map[string]int, len(e.TalentRanks))
		for k, v := range e.TalentRanks {
			newE.TalentRanks[k] = v
		}
	}

	if e.Inventory != nil {
		newE.Inventory = make([]Item, len(e.Inventory))
		copy(newE.Inventory, e.Inventory)
	}
	if e.Stash != nil {
		newE.Stash = make([]Item, len(e.Stash))
		copy(newE.Stash, e.Stash)
	}
	if e.Equipment != nil {
		newE.Equipment = make(map[string]Item)
		for k, v := range e.Equipment {
			newE.Equipment[k] = v
		}
	}
	if e.Quests != nil {
		newE.Quests = make([]Quest, len(e.Quests))
		copy(newE.Quests, e.Quests)
	}
	if e.HitList != nil {
		newE.HitList = make(map[string]bool)
		for k, v := range e.HitList {
			newE.HitList[k] = v
		}
	}
	return newE
}

func (w *World) GetPlayerInstance(id string) string {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	if e, ok := w.Entities[id]; ok {
		return e.InstanceID
	}
	return ""
}

func (w *World) PerformPickup(playerID, lootID string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "player_not_found"
	}
	loot, ok := w.Entities[lootID]
	if !ok || loot.Type != TypeLoot {
		return nil, false, "loot_not_found"
	}

	dx := player.X - loot.X
	dz := player.Z - loot.Z
	dist := dx*dx + dz*dz
	if dist < 36.0 {
		if loot.LootItem != nil {
			originalStack := loot.LootItem.Stack
			remaining := player.AddItemToInventory(*loot.LootItem)

			if remaining == 0 {
				w.Grid.Remove(loot)
				delete(w.Entities, lootID)
				return player, true, ""
			} else if remaining < originalStack {
				loot.LootItem.Stack = remaining
				return player, true, ""
			} else {
				// Inventory was full (or otherwise unable to accept any of this stack).
				// Do not delete the loot; leave it in the world.
				return player, false, "inventory_full"
			}
		}
	}
	return nil, false, "out_of_range"
}

func (w *World) PerformSplitStack(playerID string, slot int, amount int) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	if slot < 0 || slot >= len(player.Inventory) {
		return nil, false
	}

	// Use pointer to modify directly
	item := &player.Inventory[slot]

	// Validation
	if item.ID == "" || item.Stack <= 1 || amount >= item.Stack || amount < 1 {
		return nil, false
	}

	// Find empty slot
	emptySlot := -1
	for i, invItem := range player.Inventory {
		if invItem.ID == "" {
			emptySlot = i
			break
		}
	}

	if emptySlot == -1 {
		return nil, false // Inventory full
	}

	// Create new item stack
	newItem := *item
	newItem.Stack = amount
	// Generate new ID to ensure uniqueness
	newItem.ID = fmt.Sprintf("%s-%d", item.ID, rand.Intn(1000000))

	// Update original stack
	item.Stack -= amount

	// Place new item
	player.Inventory[emptySlot] = newItem

	return player, true
}

func (w *World) PerformEquip(playerID, itemID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Find item
	invIndex := -1
	var itemToEquip *Item
	for i := range player.Inventory {
		if player.Inventory[i].ID == itemID {
			itemToEquip = &player.Inventory[i]
			invIndex = i
			break
		}
	}

	if itemToEquip == nil {
		return nil, false
	}

	if player.Level < itemToEquip.Level {
		return nil, false
	}

	// Prevent equipping non-equippable items
	if itemToEquip.Type == ItemMaterial || itemToEquip.Type == ItemRelic {
		return nil, false
	}

	// Validate Slot
	validSlot := false
	if itemToEquip.Slot == slot {
		validSlot = true
	} else if itemToEquip.Slot == "ring" && (slot == "ring1" || slot == "ring2") {
		validSlot = true
	} else if itemToEquip.Slot == "trinket" && (slot == "trinket1" || slot == "trinket2") {
		validSlot = true
	}

	if !validSlot {
		return nil, false
	}

	// Capture the item value BEFORE any inventory modifications to prevent pointer invalidation
	newItem := *itemToEquip

	// Remove from inventory (Clear slot)
	player.Inventory[invIndex] = Item{}

	// Unequip current
	if current, ok := player.Equipment[slot]; ok {
		remaining := player.AddItemToInventory(current)
		if remaining > 0 {
			// If we can't fit the old item, we have a problem.
			// Since we just cleared one slot, we should have at least one slot.
			// Restore the item to inventory if swap fails (unlikely)
			player.Inventory[invIndex] = newItem
			return nil, false
		}
	}

	if player.Equipment == nil {
		player.Equipment = make(map[string]Item)
	}
	player.Equipment[slot] = newItem

	player.RecalculateStats()
	return player, true
}

func (w *World) PerformInventoryMove(playerID string, from, to int) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	if from < 0 || from >= MaxInventorySize || to < 0 || to >= MaxInventorySize {
		return nil, false
	}

	// Swap
	player.Inventory[from], player.Inventory[to] = player.Inventory[to], player.Inventory[from]

	return player, true
}

func inventorySortCategory(item Item) int {
	if isForgeHeartItem(item) {
		return 0
	}
	if isForgeShardItem(item) {
		return 1
	}
	if item.Type == ItemGem {
		return 2
	}
	return 3
}

func inventoryTypeRank(item Item) int {
	switch item.Type {
	case ItemWeapon:
		return 0
	case ItemArmor:
		return 1
	case ItemAccessory:
		return 2
	case ItemNeck:
		return 3
	case ItemGloves:
		return 4
	case ItemMaterial:
		return 5
	case ItemRelic:
		return 6
	case ItemGem:
		return 7
	default:
		return 99
	}
}

func inventoryGemQualityRank(item Item) int {
	switch item.GemQuality {
	case GemChipped:
		return 0
	case GemFlawed:
		return 1
	case GemNormal:
		return 2
	case GemFlawless:
		return 3
	case GemPerfect:
		return 4
	case GemRadiant:
		return 5
	default:
		return 99
	}
}

func (w *World) PerformInventorySort(playerID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	items := make([]Item, 0, len(player.Inventory))
	for _, item := range player.Inventory {
		if item.ID != "" {
			items = append(items, item)
		}
	}

	sort.SliceStable(items, func(i, j int) bool {
		a := items[i]
		b := items[j]

		if diff := inventorySortCategory(a) - inventorySortCategory(b); diff != 0 {
			return diff < 0
		}

		if inventorySortCategory(a) == 2 {
			if a.GemType != b.GemType {
				return a.GemType < b.GemType
			}
			if diff := inventoryGemQualityRank(a) - inventoryGemQualityRank(b); diff != 0 {
				return diff < 0
			}
		}

		if diff := inventoryTypeRank(a) - inventoryTypeRank(b); diff != 0 {
			return diff < 0
		}
		if a.Rarity != b.Rarity {
			return a.Rarity < b.Rarity
		}
		if a.Level != b.Level {
			return a.Level < b.Level
		}
		return a.Name < b.Name
	})

	sortedInventory := make([]Item, len(player.Inventory))
	copy(sortedInventory, items)
	player.Inventory = sortedInventory

	return player, true
}

func (w *World) PerformUnequip(playerID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Check if slot has item
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false
	}

	// Try to add to inventory
	remaining := player.AddItemToInventory(item)
	if remaining > 0 {
		// Inventory full
		return nil, false
	}

	// Remove from equipment
	delete(player.Equipment, slot)

	player.RecalculateStats()
	return player, true
}

func (w *World) PerformForgeUpgrade(playerID, slot string, amount int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if amount <= 0 {
		amount = 1
	}

	// Calculate Cost and Target Level
	cost := 0
	targetLevel := 0

	// Calculate per-level cost
	perLevelCost := 0
	if item.Level < 90 {
		tier := item.Level / 10
		baseTierCost := int(math.Pow(2, float64(tier)))
		// User requested 1/10th of the cost for the range.
		// Previous range cost was baseTierCost.
		// So 10 levels should cost baseTierCost / 10.
		// So 1 level should cost baseTierCost / 100.
		perLevelCost = baseTierCost / 100
		if perLevelCost < 1 {
			perLevelCost = 1
		}
	} else {
		perLevelCost = 2 // 200 / 100
	}

	targetLevel = item.Level + amount
	if targetLevel > 100 {
		targetLevel = 100
	}

	levelsToAdd := targetLevel - item.Level
	if levelsToAdd <= 0 {
		return nil, false, "Max level reached"
	}

	cost = perLevelCost * levelsToAdd

	// Check Player Level Requirement
	if player.Level < targetLevel {
		return nil, false, fmt.Sprintf("Player level too low. Need level %d", targetLevel)
	}

	// Check Shards
	shardCount := 0
	for _, invItem := range player.Inventory {
		if isForgeShardItem(invItem) {
			shardCount += forgeInventoryStackCount(invItem)
		}
	}

	if shardCount < cost {
		return nil, false, fmt.Sprintf("Not enough Shards. Need %d", cost)
	}

	// Deduct Shards
	remainingCost := cost
	// Iterate backwards to safely remove empty stacks
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeShardItem(player.Inventory[i]) {
			take := remainingCost
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				// Remove item
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingCost -= take
			if remainingCost <= 0 {
				break
			}
		}
	}

	// Upgrade Item
	newItem := item
	oldLevel := newItem.Level
	newItem.Level = targetLevel

	// Scale Stats
	// Using Base Stat scaling formula: (1 + 0.15 * NewLevel) / (1 + 0.15 * OldLevel)
	ratio := (1.0 + float64(newItem.Level)*0.15) / (1.0 + float64(oldLevel)*0.15)

	for k, v := range newItem.Stats {
		newItem.Stats[k] = int(float64(v) * ratio)
	}

	// Update Value
	newItem.Value = int(float64(newItem.Value) * ratio)

	player.Equipment[slot] = newItem
	player.RecalculateStats()

	return player, true, "Upgrade successful"
}

func forgeInventoryStackCount(item Item) int {
	if item.Stack > 0 {
		return item.Stack
	}
	return 1
}

func isForgeHeartItem(item Item) bool {
	return strings.EqualFold(item.Name, "Eidolon Heart") || strings.EqualFold(item.Name, "Heart")
}

func isForgeShardItem(item Item) bool {
	return strings.EqualFold(item.Name, "Eidolon Shard") || strings.EqualFold(item.Name, "Shard")
}

func (w *World) PerformForgePotency(playerID, slot string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if item.Potency >= 20 {
		return nil, false, "Max potency reached"
	}

	// Calculate Cost: 2 ^ Potency
	cost := int(math.Pow(2, float64(item.Potency)))

	// Check Hearts
	heartCount := 0
	for _, invItem := range player.Inventory {
		if isForgeHeartItem(invItem) {
			heartCount += forgeInventoryStackCount(invItem)
		}
	}

	if heartCount < cost {
		return nil, false, fmt.Sprintf("Not enough Hearts. Need %d", cost)
	}

	// Deduct Hearts
	remainingCost := cost
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeHeartItem(player.Inventory[i]) {
			take := remainingCost
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingCost -= take
			if remainingCost <= 0 {
				break
			}
		}
	}

	// Upgrade Potency
	newItem := item
	oldPotency := newItem.Potency
	newItem.Potency++

	// Scale Stats: +10% per potency level
	// NewStats = OldStats * (1 + 0.1 * NewPotency) / (1 + 0.1 * OldPotency)
	oldMult := 1.0 + (0.1 * float64(oldPotency))
	newMult := 1.0 + (0.1 * float64(newItem.Potency))
	ratio := newMult / oldMult

	for k, v := range newItem.Stats {
		newItem.Stats[k] = int(float64(v) * ratio)
	}

	// Update Value
	newItem.Value = int(float64(newItem.Value) * ratio)

	player.Equipment[slot] = newItem
	player.RecalculateStats()

	return player, true, "Potency upgrade successful"
}

func (w *World) PerformForgeSocket(playerID, slot string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get item from slot
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false, "No item in slot"
	}

	if item.Sockets >= 4 {
		return nil, false, "Max sockets reached"
	}

	// Calculate Cost
	// 25 Hearts + 250 Shards * (2 ^ current_sockets)
	shardCost := 250 * int(math.Pow(2, float64(item.Sockets)))
	heartCost := 25

	// Check Resources
	shardCount := 0
	heartCount := 0
	for _, invItem := range player.Inventory {
		if isForgeShardItem(invItem) {
			shardCount += forgeInventoryStackCount(invItem)
		}
		if isForgeHeartItem(invItem) {
			heartCount += forgeInventoryStackCount(invItem)
		}
	}

	if shardCount < shardCost {
		return nil, false, fmt.Sprintf("Not enough Shards. Need %d", shardCost)
	}
	if heartCount < heartCost {
		return nil, false, fmt.Sprintf("Not enough Hearts. Need %d", heartCost)
	}

	// Deduct Shards
	remainingShards := shardCost
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeShardItem(player.Inventory[i]) {
			take := remainingShards
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingShards -= take
			if remainingShards <= 0 {
				break
			}
		}
	}

	// Deduct Hearts
	remainingHearts := heartCost
	for i := len(player.Inventory) - 1; i >= 0; i-- {
		if isForgeHeartItem(player.Inventory[i]) {
			take := remainingHearts
			stackCount := forgeInventoryStackCount(player.Inventory[i])
			if stackCount <= take {
				take = stackCount
				player.Inventory = append(player.Inventory[:i], player.Inventory[i+1:]...)
			} else {
				player.Inventory[i].Stack -= take
			}
			remainingHearts -= take
			if remainingHearts <= 0 {
				break
			}
		}
	}

	// Add Socket
	newItem := item
	newItem.Sockets++
	player.Equipment[slot] = newItem

	return player, true, "Socket added successfully"
}

// PerformForgeInsertGem inserts a gem from inventory into an equipment socket
func (w *World) PerformForgeInsertGem(playerID, equipSlot string, gemInvIndex, socketIndex int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get equipment item
	equipItem, ok := player.Equipment[equipSlot]
	if !ok {
		return nil, false, "No item in equipment slot"
	}

	// Check if equipment has sockets
	if equipItem.Sockets <= 0 {
		return nil, false, "Equipment has no sockets"
	}

	// Check socket index is valid
	usedSockets := len(equipItem.Gems)
	if socketIndex < 0 || socketIndex >= equipItem.Sockets {
		return nil, false, "Invalid socket index"
	}

	// Check if socket is already filled
	if socketIndex < usedSockets {
		return nil, false, "Socket already has a gem"
	}

	// Check we're inserting into the next available socket
	if socketIndex != usedSockets {
		return nil, false, "Must fill sockets in order"
	}

	// Get gem from inventory
	if gemInvIndex < 0 || gemInvIndex >= len(player.Inventory) {
		return nil, false, "Invalid inventory slot"
	}

	gemItem := player.Inventory[gemInvIndex]
	if gemItem.Type != ItemGem {
		return nil, false, "Item is not a gem"
	}

	// Create socketed gem from gem item
	socketedGem := SocketedGem{
		Type:    gemItem.GemType,
		Quality: gemItem.GemQuality,
		Stats:   gemItem.Stats,
	}

	// Add gem to equipment
	newEquipItem := equipItem
	if newEquipItem.Gems == nil {
		newEquipItem.Gems = make([]SocketedGem, 0)
	}
	newEquipItem.Gems = append(newEquipItem.Gems, socketedGem)
	player.Equipment[equipSlot] = newEquipItem

	// Remove gem from inventory
	player.Inventory = append(player.Inventory[:gemInvIndex], player.Inventory[gemInvIndex+1:]...)

	return player, true, "Gem inserted successfully"
}

// PerformForgeCombineGems combines 3 gems of same type and quality into 1 gem of next quality
func (w *World) PerformForgeCombineGems(playerID string, gemIndices [3]int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Validate indices are unique and in range
	indexMap := make(map[int]bool)
	for _, idx := range gemIndices {
		if idx < 0 || idx >= len(player.Inventory) {
			return nil, false, "Invalid inventory slot"
		}
		if indexMap[idx] {
			return nil, false, "Duplicate gem slot selected"
		}
		indexMap[idx] = true
	}

	// Get the three gems and validate they're all gems of same type and quality
	gems := make([]Item, 3)
	for i, idx := range gemIndices {
		gems[i] = player.Inventory[idx]
		if gems[i].Type != ItemGem {
			return nil, false, "Item is not a gem"
		}
	}

	// Check all gems are same type and quality
	gemType := gems[0].GemType
	gemQuality := gems[0].GemQuality
	for i := 1; i < 3; i++ {
		if gems[i].GemType != gemType {
			return nil, false, "All gems must be the same type"
		}
		if gems[i].GemQuality != gemQuality {
			return nil, false, "All gems must be the same quality"
		}
	}

	// Check if we can upgrade (not already max quality)
	nextQuality := GetNextGemQuality(gemQuality)
	if nextQuality == "" {
		return nil, false, "Gems are already maximum quality"
	}

	// Create the upgraded gem
	upgradedGem := GenerateGem(gemType, nextQuality)

	// Remove the 3 gems from inventory (remove from highest index first to preserve indices)
	sortedIndices := make([]int, 3)
	copy(sortedIndices, gemIndices[:])
	// Sort descending
	for i := 0; i < 2; i++ {
		for j := i + 1; j < 3; j++ {
			if sortedIndices[i] < sortedIndices[j] {
				sortedIndices[i], sortedIndices[j] = sortedIndices[j], sortedIndices[i]
			}
		}
	}
	for _, idx := range sortedIndices {
		player.Inventory = append(player.Inventory[:idx], player.Inventory[idx+1:]...)
	}

	// Add upgraded gem to inventory
	player.Inventory = append(player.Inventory, *upgradedGem)

	return player, true, "Gems combined successfully"
}

// PerformForgeRemoveGem removes a gem from an equipment socket (gem is destroyed)
func (w *World) PerformForgeRemoveGem(playerID, equipSlot string, socketIndex int) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "Player not found"
	}

	// Get equipment item
	equipItem, ok := player.Equipment[equipSlot]
	if !ok {
		return nil, false, "No item in equipment slot"
	}

	// Check if equipment has gems
	if len(equipItem.Gems) == 0 {
		return nil, false, "Equipment has no socketed gems"
	}

	// Check socket index is valid
	if socketIndex < 0 || socketIndex >= len(equipItem.Gems) {
		return nil, false, "Invalid socket index"
	}

	// Remove gem from equipment (gem is destroyed)
	newEquipItem := equipItem
	newEquipItem.Gems = append(newEquipItem.Gems[:socketIndex], newEquipItem.Gems[socketIndex+1:]...)
	player.Equipment[equipSlot] = newEquipItem

	return player, true, "Gem removed (destroyed)"
}

func (w *World) PerformBuyGamble(playerID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Cost calculated to ensure ~0.5% house edge against EV (34.5 * Level)
	cost := int(math.Ceil(35 * float64(player.Level)))

	if player.Gold < cost {
		return nil, false
	}

	player.Gold -= cost
	item := GenerateLootForSlot(slot, player.Level)
	if item != nil {
		remaining := player.AddItemToInventory(*item)
		if remaining == item.Stack {
			// Inventory full, nothing added
			player.Gold += cost
			return nil, false
		}
		// If remaining > 0 but < item.Stack, we partially added.
		// We keep the gold as the transaction partially succeeded.
		return player, true
	} else {
		player.Gold += cost
		return nil, false
	}
}

func (w *World) PerformSell(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	invIndex := -1
	var itemToSell *Item
	for i := range player.Inventory {
		if player.Inventory[i].ID == itemID {
			itemToSell = &player.Inventory[i]
			invIndex = i
			break
		}
	}

	if itemToSell == nil {
		return nil, false
	}

	value := itemToSell.Value
	if value <= 0 {
		value = 1
	}

	stackSize := itemToSell.Stack
	if stackSize <= 0 {
		stackSize = 1
	}

	player.Gold += value * stackSize

	// Add to buyback (Legendary only)
	log.Printf("Selling item: %s, Rarity: %s", itemToSell.Name, itemToSell.Rarity)

	if strings.EqualFold(string(itemToSell.Rarity), string(RarityLegendary)) {
		player.Buyback = append(player.Buyback, *itemToSell)
		if len(player.Buyback) > 20 {
			player.Buyback = player.Buyback[1:]
		}
	}

	// Clear slot
	player.Inventory[invIndex] = Item{}

	compacted := make([]Item, len(player.Inventory))
	next := 0
	for _, item := range player.Inventory {
		if item.ID == "" {
			continue
		}
		compacted[next] = item
		next++
	}
	player.Inventory = compacted

	return player, true
}

func (w *World) PerformBuyback(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	buybackIndex := -1
	var itemToBuy *Item
	for i := range player.Buyback {
		if player.Buyback[i].ID == itemID {
			itemToBuy = &player.Buyback[i]
			buybackIndex = i
			break
		}
	}

	if itemToBuy == nil {
		return nil, false
	}

	cost := itemToBuy.Value
	if cost <= 0 {
		cost = 1
	}
	stackSize := itemToBuy.Stack
	if stackSize <= 0 {
		stackSize = 1
	}
	totalCost := cost * stackSize

	if player.Gold < totalCost {
		return nil, false
	}

	player.Gold -= totalCost
	player.Inventory = append(player.Inventory, *itemToBuy)

	// Remove from buyback
	player.Buyback = append(player.Buyback[:buybackIndex], player.Buyback[buybackIndex+1:]...)

	return player, true
}

func (w *World) PerformStashDeposit(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Find item in Inventory
	invIndex := -1
	var itemToDeposit *Item
	for i := range player.Inventory {
		if player.Inventory[i].ID == itemID {
			itemToDeposit = &player.Inventory[i]
			invIndex = i
			break
		}
	}

	if itemToDeposit == nil {
		return nil, false
	}

	// Move to Stash
	remaining := player.AddItemToStash(*itemToDeposit)

	if remaining == 0 {
		// Fully deposited
		player.Inventory[invIndex] = Item{}
		return player, true
	} else if remaining < itemToDeposit.Stack {
		// Partially deposited
		player.Inventory[invIndex].Stack = remaining
		return player, true
	}

	return nil, false
}

func (w *World) PerformStashWithdraw(playerID, itemID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Find item in Stash
	stashIndex := -1
	var itemToWithdraw *Item
	for i := range player.Stash {
		if player.Stash[i].ID == itemID {
			itemToWithdraw = &player.Stash[i]
			stashIndex = i
			break
		}
	}

	if itemToWithdraw == nil {
		return nil, false
	}

	// Move to Inventory
	remaining := player.AddItemToInventory(*itemToWithdraw)

	if remaining == 0 {
		// Fully withdrawn
		lastIdx := len(player.Stash) - 1
		player.Stash[stashIndex] = player.Stash[lastIdx]
		player.Stash = player.Stash[:lastIdx]
		return player, true
	} else if remaining < itemToWithdraw.Stack {
		// Partially withdrawn
		player.Stash[stashIndex].Stack = remaining
		return player, true
	}

	return nil, false
}

func (w *World) GenerateDailyQuests(playerID string) *Entity {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil
	}

	// Check if already generated today
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		log.Printf("Error loading timezone America/New_York: %v. Defaulting to UTC.", err)
		loc = time.UTC
	}

	now := time.Now().In(loc)
	y, m, d := now.Date()
	ly, lm, ld := player.LastDailyQuest.In(loc).Date()

	if y == ly && m == lm && d == ld && len(player.Quests) > 0 {
		// Hotfix: Update rewards if they don't match the current values
		updated := false
		hasQuestID := func(id string) bool {
			for _, q := range player.Quests {
				if q.ID == id {
					return true
				}
			}
			return false
		}
		for i := range player.Quests {
			q := &player.Quests[i]
			var expectedXP int
			switch q.Target {
			case "Skeleton":
				expectedXP = 50000
			case "Imp":
				expectedXP = 150000
			case "DemonOrc":
				expectedXP = 300000
			case "Construct":
				expectedXP = 500000
			case "InfernoTitan":
				expectedXP = 800000
			case "MountainTroll":
				expectedXP = 1200000
			case "AquaGolem":
				expectedXP = 1600000
			case "Siren":
				expectedXP = 2200000
			case "FrostGuardian":
				expectedXP = 3000000
			case "SandstormDjinn":
				expectedXP = 4000000
			case "MagmaGolem":
				expectedXP = 5000000
			case "ScorchedWraith":
				expectedXP = 6500000
			case "InfernalBehemoth":
				expectedXP = 8000000
			case "PhoenixSentinel":
				expectedXP = 10000000
			case "StormHarpy":
				expectedXP = 4000000
			case "CloudElemental":
				expectedXP = 5000000
			case "ThunderRoc":
				expectedXP = 6500000
			case "TempestGiant":
				expectedXP = 8000000
			case "CycloneAvatar":
				expectedXP = 10000000
			case "VerdantBastionBoss":
				expectedXP = 3000000
			case "AbyssalWellBoss":
				expectedXP = 6000000
			case "MoltenCoreBoss":
				expectedXP = 9000000
			case "TempestSpireBoss":
				expectedXP = 9000000
			case "DungeonBoss":
				expectedXP = 5000000
			case "DungeonBossHeroic":
				expectedXP = 10000000
			case "DungeonBossMythic":
				expectedXP = 15000000
			}
			if expectedXP > 0 && q.RewardXP != expectedXP {
				q.RewardXP = expectedXP
				updated = true
			}
		}

		// Check if new quests are missing
		hasTroll := false
		hasGolem := false
		for _, q := range player.Quests {
			if q.Target == "MountainTroll" {
				hasTroll = true
			}
			if q.Target == "AquaGolem" {
				hasGolem = true
			}
		}

		if !hasTroll {
			player.Quests = append(player.Quests, Quest{ID: "daily_mountaintroll", Type: "KILL", Target: "MountainTroll", Count: 0, MaxCount: 100, RewardXP: 1200000, Completed: false, Accepted: false})
			updated = true
		}
		if !hasGolem {
			player.Quests = append(player.Quests, Quest{ID: "daily_aquagolem", Type: "KILL", Target: "AquaGolem", Count: 0, MaxCount: 100, RewardXP: 1600000, Completed: false, Accepted: false})
			updated = true
		}

		// Check for Dungeon Bosses Quest
		hasDungeonBosses := false
		for _, q := range player.Quests {
			if q.ID == "daily_dungeon_bosses" {
				hasDungeonBosses = true
			}
		}
		if !hasDungeonBosses {
			player.Quests = append(player.Quests, Quest{ID: "daily_dungeon_bosses", Type: "KILL", Target: "DungeonBoss", Count: 0, MaxCount: 4, RewardXP: 5000000, Completed: false, Accepted: false})
			updated = true
		}

		additionalQuests := []Quest{
			{ID: "daily_verdant_bastion_bosses", Type: "KILL", Target: "VerdantBastionBoss", Count: 0, MaxCount: 4, RewardXP: 3000000, Completed: false, Accepted: false},
			{ID: "daily_abyssal_well_bosses", Type: "KILL", Target: "AbyssalWellBoss", Count: 0, MaxCount: 5, RewardXP: 6000000, Completed: false, Accepted: false},
			{ID: "daily_molten_core_bosses", Type: "KILL", Target: "MoltenCoreBoss", Count: 0, MaxCount: 5, RewardXP: 9000000, Completed: false, Accepted: false},
			{ID: "daily_tempest_spire_bosses", Type: "KILL", Target: "TempestSpireBoss", Count: 0, MaxCount: 5, RewardXP: 9000000, Completed: false, Accepted: false},
			{ID: "daily_dungeon_bosses_heroic", Type: "KILL", Target: "DungeonBossHeroic", Count: 0, MaxCount: 4, RewardXP: 10000000, Completed: false, Accepted: false},
			{ID: "daily_dungeon_bosses_mythic", Type: "KILL", Target: "DungeonBossMythic", Count: 0, MaxCount: 4, RewardXP: 15000000, Completed: false, Accepted: false},
		}

		for _, quest := range additionalQuests {
			if !hasQuestID(quest.ID) {
				player.Quests = append(player.Quests, quest)
				updated = true
			}
		}

		// Sort quests by RewardXP to ensure they are in order of difficulty
		sort.Slice(player.Quests, func(i, j int) bool {
			return player.Quests[i].RewardXP < player.Quests[j].RewardXP
		})

		if updated {
			log.Printf("Updated daily quest rewards/list for %s", player.Name)
		}
		return player // Already has quests for today
	}

	log.Printf("Generating daily quests for %s (Last: %v, Now: %v)", player.Name, player.LastDailyQuest, now)

	// Generate Daily Quests - All zones
	player.Quests = []Quest{
		// Earth Realm (Lv 1-50)
		{ID: "daily_skeleton", Type: "KILL", Target: "Skeleton", Count: 0, MaxCount: 100, RewardXP: 50000, Completed: false, Accepted: false},
		{ID: "daily_imp", Type: "KILL", Target: "Imp", Count: 0, MaxCount: 100, RewardXP: 150000, Completed: false, Accepted: false},
		{ID: "daily_demonorc", Type: "KILL", Target: "DemonOrc", Count: 0, MaxCount: 100, RewardXP: 300000, Completed: false, Accepted: false},
		{ID: "daily_construct", Type: "KILL", Target: "Construct", Count: 0, MaxCount: 100, RewardXP: 500000, Completed: false, Accepted: false},
		{ID: "daily_infernotitan", Type: "KILL", Target: "InfernoTitan", Count: 0, MaxCount: 100, RewardXP: 800000, Completed: false, Accepted: false},
		// Water Realm (Lv 50-70)
		{ID: "daily_mountaintroll", Type: "KILL", Target: "MountainTroll", Count: 0, MaxCount: 100, RewardXP: 1200000, Completed: false, Accepted: false},
		{ID: "daily_aquagolem", Type: "KILL", Target: "AquaGolem", Count: 0, MaxCount: 100, RewardXP: 1600000, Completed: false, Accepted: false},
		{ID: "daily_siren", Type: "KILL", Target: "Siren", Count: 0, MaxCount: 100, RewardXP: 2200000, Completed: false, Accepted: false},
		{ID: "daily_frostguardian", Type: "KILL", Target: "FrostGuardian", Count: 0, MaxCount: 100, RewardXP: 3000000, Completed: false, Accepted: false},
		// Fire Realm (Lv 70-95)
		{ID: "daily_sandstormdjinn", Type: "KILL", Target: "SandstormDjinn", Count: 0, MaxCount: 100, RewardXP: 4000000, Completed: false, Accepted: false},
		{ID: "daily_magmagolem", Type: "KILL", Target: "MagmaGolem", Count: 0, MaxCount: 100, RewardXP: 5000000, Completed: false, Accepted: false},
		{ID: "daily_scorchedwraith", Type: "KILL", Target: "ScorchedWraith", Count: 0, MaxCount: 100, RewardXP: 6500000, Completed: false, Accepted: false},
		{ID: "daily_infernalbehemoth", Type: "KILL", Target: "InfernalBehemoth", Count: 0, MaxCount: 100, RewardXP: 8000000, Completed: false, Accepted: false},
		{ID: "daily_phoenixsentinel", Type: "KILL", Target: "PhoenixSentinel", Count: 0, MaxCount: 100, RewardXP: 10000000, Completed: false, Accepted: false},
		// Air Realm (Lv 70-95)
		{ID: "daily_stormharpy", Type: "KILL", Target: "StormHarpy", Count: 0, MaxCount: 100, RewardXP: 4000000, Completed: false, Accepted: false},
		{ID: "daily_cloudelemental", Type: "KILL", Target: "CloudElemental", Count: 0, MaxCount: 100, RewardXP: 5000000, Completed: false, Accepted: false},
		{ID: "daily_thunderroc", Type: "KILL", Target: "ThunderRoc", Count: 0, MaxCount: 100, RewardXP: 6500000, Completed: false, Accepted: false},
		{ID: "daily_tempestgiant", Type: "KILL", Target: "TempestGiant", Count: 0, MaxCount: 100, RewardXP: 8000000, Completed: false, Accepted: false},
		{ID: "daily_cycloneavatar", Type: "KILL", Target: "CycloneAvatar", Count: 0, MaxCount: 100, RewardXP: 10000000, Completed: false, Accepted: false},
		// Dungeon Bosses
		{ID: "daily_dungeon_bosses", Type: "KILL", Target: "DungeonBoss", Count: 0, MaxCount: 4, RewardXP: 5000000, Completed: false, Accepted: false},
		{ID: "daily_verdant_bastion_bosses", Type: "KILL", Target: "VerdantBastionBoss", Count: 0, MaxCount: 4, RewardXP: 3000000, Completed: false, Accepted: false},
		{ID: "daily_abyssal_well_bosses", Type: "KILL", Target: "AbyssalWellBoss", Count: 0, MaxCount: 5, RewardXP: 6000000, Completed: false, Accepted: false},
		{ID: "daily_molten_core_bosses", Type: "KILL", Target: "MoltenCoreBoss", Count: 0, MaxCount: 5, RewardXP: 9000000, Completed: false, Accepted: false},
		{ID: "daily_tempest_spire_bosses", Type: "KILL", Target: "TempestSpireBoss", Count: 0, MaxCount: 5, RewardXP: 9000000, Completed: false, Accepted: false},
		{ID: "daily_dungeon_bosses_heroic", Type: "KILL", Target: "DungeonBossHeroic", Count: 0, MaxCount: 4, RewardXP: 10000000, Completed: false, Accepted: false},
		{ID: "daily_dungeon_bosses_mythic", Type: "KILL", Target: "DungeonBossMythic", Count: 0, MaxCount: 4, RewardXP: 15000000, Completed: false, Accepted: false},
	}
	player.LastDailyQuest = now

	return player
}

func (w *World) PerformAcceptQuest(playerID, questID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	for i := range player.Quests {
		if player.Quests[i].ID == questID {
			if !player.Quests[i].Accepted {
				player.Quests[i].Accepted = true
				return player, true
			}
			return nil, false
		}
	}
	return nil, false
}

func (w *World) PerformCompleteQuest(playerID, questID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	for i := range player.Quests {
		if player.Quests[i].ID == questID {
			q := &player.Quests[i]
			if q.Accepted && !q.Completed && q.Count >= q.MaxCount {
				q.Completed = true
				player.Experience += q.RewardXP

				// Level Up Logic (Duplicated from handleDeath, should refactor but keeping simple for now)
				if player.MaxExperience == 0 {
					player.MaxExperience = 100
				}
				for player.Experience >= player.MaxExperience {
					if player.Level >= 100 {
						player.Experience = player.MaxExperience
						break
					}
					player.Experience -= player.MaxExperience
					player.Level++
					player.MaxExperience = int(100 * math.Pow(1.2, float64(player.Level-1)))
					player.recomputeTalentPoints()

					// Update Unlocked Skills
					w.UpdateUnlockedSkills(player)

					player.BaseStats.Vitality += 2
					player.BaseStats.Strength += 2
					player.BaseStats.Dexterity += 1
					player.BaseStats.Intelligence += 1
					player.BaseStats.Wisdom += 1
					player.RecalculateStats()
					player.Health = player.MaxHealth
				}
				return player, true
			}
			return nil, false
		}
	}
	return nil, false
}

func (w *World) UpdateQuestProgress(player *Entity, targetType string) bool {
	// Assumes caller holds lock on player or it's safe
	updated := false
	for i := range player.Quests {
		q := &player.Quests[i]
		if q.Accepted && !q.Completed && q.Type == "KILL" && q.Target == targetType {
			if q.Count < q.MaxCount {
				q.Count++
				updated = true
			}
		}
	}
	if updated && w.OnQuestUpdate != nil {
		// Need to copy quests to avoid race conditions if called asynchronously later
		questsCopy := make([]Quest, len(player.Quests))
		copy(questsCopy, player.Quests)
		w.OnQuestUpdate(player.ID, questsCopy)
	}
	return updated
}

func (w *World) PerformRespawn(playerID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return
	}

	// Allow respawn even if not dead (unstuck)
	player.State = "IDLE"
	player.LastRespawnTime = time.Now()
	player.Health = player.MaxHealth

	// Remove from current grid location (which might be in an instance)
	w.Grid.Remove(player)

	player.X = -1.25
	player.Z = 200
	player.TargetX = -1.25
	player.TargetZ = 200
	player.InstanceID = "" // Reset to overworld

	// Add back to grid in the new location/instance
	w.Grid.Add(player)
}

func (w *World) PerformRecall(playerID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return
	}

	// Teleport to town
	player.State = "IDLE"

	w.Grid.Remove(player)
	player.X = -1.25
	player.Z = 200
	player.TargetX = -1.25
	player.TargetZ = 200
	// Reset InstanceID to Overworld if respawning in town
	// Note: If we want them to respawn inside the dungeon, we shouldn't clear InstanceID here.
	// For now, let's assume death sends you to town (Overworld).
	// We need to handle the Grid update carefully if InstanceID changes.
	player.InstanceID = ""
	w.Grid.Add(player)
}

func (w *World) updateEntity(e *Entity, dt float64, players []*Entity, deferred *deferredActions) {
	// --- Loot Cleanup ---
	if e.Type == TypeLoot {
		e.Mu.Lock()
		if time.Since(e.LootTime) > 1*time.Minute {
			deferred.addRemoval(e.ID)
		}
		e.Mu.Unlock()
		return
	}

	// --- Respawn Logic for Enemies and NPCs ---
	if e.Type == TypeEnemy || e.Type == TypeNPC {
		e.Mu.Lock()
		if e.State == "DEAD" {
			// Check if Elite
			if strings.HasPrefix(e.ID, "elite-") {
				if time.Since(e.LastAttackTime) > 5*time.Second {
					deferred.addRemoval(e.ID)
				}
				e.Mu.Unlock()
				return
			}

			// Respawn Logic for normal mobs
			if time.Since(e.LastAttackTime) > 10*time.Second {
				// Do not respawn enemies in dungeons
				if strings.HasPrefix(e.InstanceID, "dungeon_") {
					e.Mu.Unlock()
					return
				}

				e.State = "IDLE"
				e.Health = e.MaxHealth
				e.Threat = nil
				oldX, oldZ := e.X, e.Z
				e.X = e.SpawnX
				e.Z = e.SpawnZ
				w.Grid.Update(e, oldX, oldZ)
			}
			e.Mu.Unlock()
			return
		}
		e.Mu.Unlock()
	}

	// --- Projectiles ---
	if e.Type == TypeProjectile {
		e.Mu.Lock()

		// Zone Logic (ZoneDamage, ZoneHoly, etc.)
		if strings.HasPrefix(e.SubType, "Zone") {
			// Check zone expiration - use ConsecratedGroundEndTime if set, otherwise 8s default
			zoneExpired := false
			if !e.ConsecratedGroundEndTime.IsZero() {
				zoneExpired = time.Now().After(e.ConsecratedGroundEndTime)
			} else {
				zoneExpired = time.Since(e.CreatedAt) > 8*time.Second
			}

			if zoneExpired {
				deferred.addRemoval(e.ID)
				e.Mu.Unlock()
				return
			}

			// Periodic tick interval (1s default, 500ms with Time Burn combo)
			tickInterval := 1 * time.Second
			if e.ZoneDoubleTick {
				tickInterval = 500 * time.Millisecond
			}
			if time.Since(e.LastAttackTime) >= tickInterval {
				e.LastAttackTime = time.Now()

				radius := e.Radius
				damage := e.Damage
				if damage == 0 {
					damage = 10
				}
				ownerID := e.OwnerID
				owner := w.GetEntity(ownerID)
				ownerIsPlayer := owner != nil && owner.Type == TypePlayer
				zoneSubType := e.SubType
				isSanctuary := e.ConsecratedGroundSanctuary
				e.Mu.Unlock() // Unlock to query grid

				effectiveRadius := expandedAbilityRadius(zoneSubType, radius)
				nearby := w.Grid.Nearby(e.X, e.Z, effectiveRadius, e.InstanceID)
				for _, target := range nearby {
					target.Mu.RLock()
					targetType := target.Type
					targetState := target.State
					target.Mu.RUnlock()

					inRadius := withinAbilityRadius(zoneSubType, e.X, e.Z, target, radius)
					if !inRadius {
						continue
					}

					// --- Damage enemies (all zone types) ---
					if targetType == TypeEnemy && targetState != "DEAD" {
						damageType := "arcane"
						switch zoneSubType {
						case "ZoneFire":
							damageType = "fire"
						case "ZoneHoly":
							damageType = "holy"
						case "ZonePoison":
							damageType = "poison"
						}
						target.Mu.Lock()
						finalDamage := applyFinalDamage(owner, target, damage, damageType)
						if ownerIsPlayer {
							addThreatLocked(target, ownerID, float64(finalDamage))
						}
						isDead := target.Health <= 0
						target.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage})
						}

						if isDead {
							owner := w.GetEntity(ownerID)
							target.Mu.Lock()
							w.handleDeath(target, owner, deferred)
							target.Mu.Unlock()
						}
					}

					// --- ZoneHoly: heal allies + sanctuary buff ---
					if zoneSubType == "ZoneHoly" && (targetType == TypePlayer || targetType == TypeNPC) && targetState != "DEAD" {
						// Heal allies (15 + owner_wisdom*0.5)
						healAmount := 15
						if owner != nil {
							healAmount += owner.Stats.Wisdom / 2
							healAmount = applyHealingDoneBonus(owner, healAmount)
						}
						target.Mu.Lock()
						target.Health += healAmount
						if target.Health > target.MaxHealth {
							target.Health = target.MaxHealth
						}
						// Sanctuary rune: allies in area take 30% less damage
						if isSanctuary {
							target.SanctuaryDamageReduction = true
							target.SanctuaryEndTime = time.Now().Add(2 * time.Second)
						}
						target.Mu.Unlock()

						if w.OnEvent != nil && healAmount > 0 {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: -healAmount})
						}
					}
				}
				return
			}
			e.Mu.Unlock()
			return
		}

		// Meteor Logic
		if e.SubType == "Meteor" {
			if time.Now().After(e.LastAttackTime) {
				// Impact!
				radius := e.Radius
				impactName := e.ProjectileSkill
				if impactName == "" {
					impactName = e.SubType
				}
				effectiveRadius := expandedAbilityRadius(impactName, radius)
				damage := e.Damage
				ownerID := e.OwnerID
				meteorShieldExplode := e.MeteorShieldExplode
				owner := w.GetEntity(ownerID)
				ownerIsPlayer := owner != nil && owner.Type == TypePlayer

				e.Mu.Unlock() // Unlock to query grid

				nearby := w.Grid.Nearby(e.X, e.Z, effectiveRadius, e.InstanceID)
				for _, target := range nearby {
					target.Mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.Mu.RUnlock()
						continue
					}
					target.Mu.RUnlock()

					if withinAbilityRadius(impactName, e.X, e.Z, target, radius) {
						target.Mu.Lock()
						finalDamage := applyFinalDamage(owner, target, damage, "fire")
						if ownerIsPlayer {
							addThreatLocked(target, ownerID, float64(finalDamage))
						}
						isDead := target.Health <= 0
						target.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage})
						}

						if isDead {
							owner := w.GetEntity(ownerID)
							target.Mu.Lock()
							w.handleDeath(target, owner, deferred)
							target.Mu.Unlock()
						}
					}
				}

				// Combo: Arcane Barrage - Shield explodes on meteor impact
				if meteorShieldExplode && owner != nil {
					owner.Mu.Lock()
					if owner.ArcaneShieldActive && owner.ArcaneShieldHP > 0 {
						shieldExplosionDamage := owner.ArcaneShieldHP
						// Consume the shield
						owner.ArcaneShieldActive = false
						owner.ArcaneShieldHP = 0
						owner.Mu.Unlock()

						// Deal shield HP as AoE damage at meteor impact location
						explosionRadius := radius * 1.5 // Slightly larger than meteor
						effectiveExplosionRadius := expandedAbilityRadius(impactName, explosionRadius)
						explosionNearby := w.Grid.Nearby(e.X, e.Z, effectiveExplosionRadius, e.InstanceID)
						for _, target := range explosionNearby {
							target.Mu.RLock()
							if target.Type != TypeEnemy || target.State == "DEAD" {
								target.Mu.RUnlock()
								continue
							}
							target.Mu.RUnlock()

							if withinAbilityRadius(impactName, e.X, e.Z, target, explosionRadius) {
								target.Mu.Lock()
								finalDamage := applyFinalDamage(owner, target, shieldExplosionDamage, "arcane")
								if ownerIsPlayer {
									addThreatLocked(target, ownerID, float64(finalDamage))
								}
								isDead := target.Health <= 0
								target.Mu.Unlock()

								if w.OnEvent != nil {
									w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage})
								}

								if isDead {
									target.Mu.Lock()
									w.handleDeath(target, owner, deferred)
									target.Mu.Unlock()
								}
							}
						}
					} else {
						owner.Mu.Unlock()
					}
				}

				// Remove Meteor after impact
				deferred.addRemoval(e.ID)
				return
			}
			e.Mu.Unlock()
			return
		}

		// Lifetime check
		lifetime := 5 * time.Second
		if e.SubType == "ExplosiveTrap" || e.SubType == "SnareTrap" {
			lifetime = 60 * time.Second
		}
		if time.Since(e.CreatedAt) > lifetime {
			deferred.addRemoval(e.ID)
			e.Mu.Unlock()
			return
		}

		// Move
		oldX, oldZ := e.X, e.Z
		e.X += e.VelX * dt
		e.Z += e.VelZ * dt
		w.Grid.Update(e, oldX, oldZ)

		// Snapshot for collision check
		projX, projZ, radius, damage, ownerID, subType := e.X, e.Z, e.Radius, e.Damage, e.OwnerID, e.SubType
		e.Mu.Unlock()

		owner := w.GetEntity(ownerID)
		ownerIsPlayer := owner != nil && owner.Type == TypePlayer

		// Check Collision with Enemies
		nearbyEnemies := w.Grid.Nearby(projX, projZ, radius+2.0, e.InstanceID)
		for _, target := range nearbyEnemies {
			if target.InstanceID != e.InstanceID {
				continue
			}
			// Read Target State
			target.Mu.RLock()
			if target.Type != TypeEnemy || target.State == "DEAD" {
				target.Mu.RUnlock()
				continue
			}
			dx := projX - target.X
			dz := projZ - target.Z
			target.Mu.RUnlock()

			dist := math.Sqrt(dx*dx + dz*dz)
			if dist < (radius + 0.5) {
				e.Mu.Lock()
				if e.HitList == nil {
					e.HitList = make(map[string]bool)
				}
				if e.HitList[target.ID] {
					e.Mu.Unlock()
					continue
				}
				e.HitList[target.ID] = true
				projRuneID := e.ProjectileRuneID
				projSkill := e.ProjectileSkill
				projBounces := e.ProjectileBounces
				e.Mu.Unlock()

				// Calculate final damage with rune modifications
				finalDamage := damage

				// Combo: Implosion (Gravity Well → Fireball) = +100% damage to slowed targets
				if projSkill == "Fireball" && e.FireballWellBoost {
					target.Mu.RLock()
					isSlowed := target.Slowed
					target.Mu.RUnlock()
					if isSlowed {
						finalDamage *= 2
					}
				}

				// Piercing Throw runes
				if projSkill == "Piercing Throw" {
					// Executioner rune: +100% damage to targets below 30% HP
					if projRuneID == "piercingthrow_executioner" {
						target.Mu.RLock()
						hpPercent := float64(target.Health) / float64(target.MaxHealth)
						target.Mu.RUnlock()
						if hpPercent < 0.30 {
							finalDamage *= 2
						}
					}
				}

				// Hit!
				damageType := "physical"
				if subType == "Fireball" || subType == "ExplosiveTrap" {
					damageType = "fire"
				} else if subType == "ArcaneMissile" {
					damageType = "arcane"
				}
				target.Mu.Lock()
				finalDamage = applyFinalDamage(owner, target, finalDamage, damageType)
				if ownerIsPlayer {
					addThreatLocked(target, ownerID, float64(finalDamage))
				}
				isDead := target.Health <= 0

				// Apply Trap Effects
				if subType == "SnareTrap" {
					target.Rooted = true
					target.RootEndTime = time.Now().Add(3 * time.Second)
				}

				// Piercing Throw: Serrated rune applies bleed
				if projSkill == "Piercing Throw" && projRuneID == "piercingthrow_serrated" && !isDead {
					target.Bleeding = true
					target.BleedDamage = finalDamage / 5 // 20% of damage per tick
					target.BleedEndTime = time.Now().Add(5 * time.Second)
				}

				// Fan of Knives rune effects
				if projSkill == "Fan of Knives" && !isDead {
					if projRuneID == "fanofknives_weighted" {
						target.Slowed = true
						target.SlowFactor = 0.30
						target.SlowEndTime = time.Now().Add(3 * time.Second)
					} else if projRuneID == "fanofknives_poisoned" {
						target.Poisoned = true
						target.PoisonDamage = finalDamage / 4
						target.PoisonEndTime = time.Now().Add(5 * time.Second)
					}
				}

				target.Mu.Unlock()

				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage})
				}

				if isDead {
					// We need the owner entity to award XP
					owner := w.GetEntity(ownerID) // This uses RLock on World
					target.Mu.Lock()              // Lock target for handleDeath
					w.handleDeath(target, owner, deferred)
					target.Mu.Unlock()
				}

				// Piercing Throw: Ricochet rune - bounce to additional targets
				if projSkill == "Piercing Throw" && projRuneID == "piercingthrow_ricochet" && projBounces > 0 {
					// Find nearest enemy that hasn't been hit
					var nextTarget *Entity
					minNextDist := 15.0 // Max bounce range
					bounceNearby := w.Grid.Nearby(target.X, target.Z, minNextDist, e.InstanceID)
					for _, bt := range bounceNearby {
						bt.Mu.RLock()
						if bt.Type != TypeEnemy || bt.State == "DEAD" || e.HitList[bt.ID] {
							bt.Mu.RUnlock()
							continue
						}
						bdx := target.X - bt.X
						bdz := target.Z - bt.Z
						bdist := math.Sqrt(bdx*bdx + bdz*bdz)
						bt.Mu.RUnlock()

						if bdist > 0.5 && bdist < minNextDist {
							minNextDist = bdist
							nextTarget = bt
						}
					}

					if nextTarget != nil {
						// Redirect projectile to next target
						e.Mu.Lock()
						nextTarget.Mu.RLock()
						ntx, ntz := nextTarget.X, nextTarget.Z
						nextTarget.Mu.RUnlock()

						ndx := ntx - e.X
						ndz := ntz - e.Z
						ndist := math.Sqrt(ndx*ndx + ndz*ndz)
						if ndist > 0 {
							speed := 35.0
							e.VelX = (ndx / ndist) * speed
							e.VelZ = (ndz / ndist) * speed
							e.ProjectileBounces--
							e.Rotation = math.Atan2(e.VelX, e.VelZ)
						}
						e.Mu.Unlock()
					}
				}

				// Splash Damage (Fireball / Explosive Trap)
				if subType == "Fireball" || subType == "ExplosiveTrap" {
					splashRadius := 10.0
					if subType == "ExplosiveTrap" {
						splashRadius = 6.0
					}
					effectiveSplashRadius := expandedAbilityRadius(subType, splashRadius)

					splashTargets := w.Grid.Nearby(projX, projZ, effectiveSplashRadius, e.InstanceID)
					for _, splashTarget := range splashTargets {
						if splashTarget.InstanceID != e.InstanceID {
							continue
						}
						splashTarget.Mu.RLock()
						if splashTarget.Type != TypeEnemy || splashTarget.ID == target.ID || splashTarget.State == "DEAD" {
							splashTarget.Mu.RUnlock()
							continue
						}
						splashTarget.Mu.RUnlock()

						if withinAbilityRadius(subType, projX, projZ, splashTarget, splashRadius) {
							splashTarget.Mu.Lock()
							splashDmg := int(float64(finalDamage) * 0.4)
							splashDmg = applyFinalDamage(owner, splashTarget, splashDmg, "fire")
							if ownerIsPlayer {
								addThreatLocked(splashTarget, ownerID, float64(splashDmg))
							}
							isSplashDead := splashTarget.Health <= 0
							splashTarget.Mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: splashTarget.ID, SourceID: ownerID, Amount: splashDmg})
							}

							if isSplashDead {
								owner := w.GetEntity(ownerID)
								splashTarget.Mu.Lock()
								w.handleDeath(splashTarget, owner, deferred)
								splashTarget.Mu.Unlock()
							}
						}
					}
				}

				// Fireball Chain Reaction rune: bounce to additional targets at 50% damage
				if projSkill == "Fireball" && projRuneID == "fireball_chain" && projBounces > 0 {
					// Find nearest enemy that hasn't been hit
					var nextTarget *Entity
					minNextDist := 15.0
					chainNearby := w.Grid.Nearby(target.X, target.Z, minNextDist, e.InstanceID)
					for _, ct := range chainNearby {
						ct.Mu.RLock()
						if ct.Type != TypeEnemy || ct.State == "DEAD" || e.HitList[ct.ID] {
							ct.Mu.RUnlock()
							continue
						}
						cdx := target.X - ct.X
						cdz := target.Z - ct.Z
						cdist := math.Sqrt(cdx*cdx + cdz*cdz)
						ct.Mu.RUnlock()

						if cdist > 0.5 && cdist < minNextDist {
							minNextDist = cdist
							nextTarget = ct
						}
					}

					if nextTarget != nil {
						e.Mu.Lock()
						nextTarget.Mu.RLock()
						ntx, ntz := nextTarget.X, nextTarget.Z
						nextTarget.Mu.RUnlock()

						ndx := ntx - e.X
						ndz := ntz - e.Z
						ndist := math.Sqrt(ndx*ndx + ndz*ndz)
						if ndist > 0 {
							speed := 20.0
							e.VelX = (ndx / ndist) * speed
							e.VelZ = (ndz / ndist) * speed
							e.ProjectileBounces--
							e.Damage = e.Damage / 2 // 50% damage on bounce
							e.Rotation = math.Atan2(e.VelX, e.VelZ)
						}
						e.Mu.Unlock()
					}
				}

				// Fireball Magma rune: leave burning ground (handled via event for now)
				// The burning ground effect would be client-side visual + periodic damage
				// For simplicity, we apply a burn DoT to all enemies in the splash area
				if projSkill == "Fireball" && projRuneID == "fireball_magma" {
					burnRadius := 5.0
					burnTargets := w.Grid.Nearby(projX, projZ, burnRadius, e.InstanceID)
					for _, bt := range burnTargets {
						bt.Mu.RLock()
						if bt.Type != TypeEnemy || bt.State == "DEAD" {
							bt.Mu.RUnlock()
							continue
						}
						bdx := projX - bt.X
						bdz := projZ - bt.Z
						bt.Mu.RUnlock()

						if (bdx*bdx + bdz*bdz) <= burnRadius*burnRadius {
							bt.Mu.Lock()
							// Apply burning ground DoT (reuse Bleeding for simplicity)
							bt.Bleeding = true
							bt.BleedDamage = finalDamage / 6 // ~17% per tick
							bt.BleedEndTime = time.Now().Add(3 * time.Second)
							bt.Mu.Unlock()
						}
					}
				}

				// Determine if projectile should pierce
				// Set Bonus: Inferno's Heart 4pc (fireballPierce) - Fireball pierces enemies
				shouldPierce := subType == "Dagger" || subType == "FlameTornado" || e.ProjectilePierce
				if subType == "Fireball" && owner != nil && owner.HasAnySetBonus("fireballPierce") {
					shouldPierce = true
				}

				if !shouldPierce {
					deferred.addRemoval(e.ID)
					break
				}
			}
		}

		e.Mu.Lock()
		// Only check bounds if in Overworld (InstanceID == "")
		if e.InstanceID == "" {
			if e.X < -1000 || e.X > 1000 || e.Z < -2200 || e.Z > 1000 {
				deferred.addRemoval(e.ID)
			}
		}
		e.Mu.Unlock()
		return
	}

	// --- Player Abilities ---
	if e.Type == TypePlayer {
		e.Mu.Lock()
		if e.State == "JUMPING" {
			jumpDuration := e.JumpDuration
			if jumpDuration <= 0 {
				jumpDuration = 0.35
			}
			e.JumpElapsed = math.Min(jumpDuration, e.JumpElapsed+dt)
			progress := e.JumpElapsed / jumpDuration
			if progress < 0 {
				progress = 0
			} else if progress > 1 {
				progress = 1
			}
			oldX, oldZ := e.X, e.Z
			e.JumpProgress = progress
			e.X = e.JumpStartX + (e.JumpTargetX-e.JumpStartX)*progress
			e.Z = e.JumpStartZ + (e.JumpTargetZ-e.JumpStartZ)*progress
			e.Y = e.JumpStartY + math.Sin(progress*math.Pi)*e.JumpHeight
			if progress >= 1 {
				e.X = e.JumpTargetX
				e.Y = e.JumpTargetY
				e.Z = e.JumpTargetZ
				e.State = "IDLE"
				w.Grid.Update(e, oldX, oldZ)
				e.Mu.Unlock()
				return
			}
			w.Grid.Update(e, oldX, oldZ)
			e.Mu.Unlock()
			return
		}
		// Fighter Charge
		if e.IsCharging {
			dx := e.ChargeTargetX - e.X
			dz := e.ChargeTargetZ - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			speed := 50.0
			moveDist := speed * dt

			oldX, oldZ := e.X, e.Z
			if moveDist >= dist {
				endX, endZ := e.ChargeTargetX, e.ChargeTargetZ
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, endX, endZ); ok {
					endX = constrainedX
					endZ = constrainedZ
					e.ChargeTargetX = endX
					e.ChargeTargetZ = endZ
				}
				e.X = endX
				e.Z = endZ
				e.IsCharging = false
				e.State = "IDLE"
				w.Grid.Update(e, oldX, oldZ)

				// Calculate charge distance for momentum rune
				chargeDistTraveled := math.Sqrt(
					(e.X-e.ChargeStartX)*(e.X-e.ChargeStartX) +
						(e.Z-e.ChargeStartZ)*(e.Z-e.ChargeStartZ),
				)

				// Impact Damage - base calculation with talent bonus
				damage := int(float64(e.Damage) * 1.5 * 1.3 * e.GetSkillDamageMultiplier("Charge"))

				// Rune effects
				runeID := e.ChargeRuneID

				// Momentum rune: damage scales with distance (up to +100% at max range)
				if runeID == "charge_momentum" {
					distanceBonus := math.Min(chargeDistTraveled/30.0, 1.0) // Max bonus at 30 units
					damage = int(float64(damage) * (1.0 + distanceBonus))
				}

				// Unstoppable rune: clear CC immunity, grant +20% armor for 5s
				if runeID == "charge_unstoppable" {
					e.CCImmune = false
					e.RuneArmorBuff = 0.20
					e.RuneArmorBuffEndTime = time.Now().Add(5 * time.Second)
				}

				e.Mu.Unlock() // Unlock before interaction

				nearby := w.Grid.Nearby(e.ChargeTargetX, e.ChargeTargetZ, 16.0, e.InstanceID)
				hitTargets := make([]*Entity, 0)

				for _, target := range nearby {
					target.Mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.Mu.RUnlock()
						continue
					}
					tdx := e.ChargeTargetX - target.X
					tdz := e.ChargeTargetZ - target.Z
					target.Mu.RUnlock()

					tdist := math.Sqrt(tdx*tdx + tdz*tdz)
					if tdist < 16.0 {
						target.Mu.Lock()
						finalDamage := applyFinalDamage(e, target, damage, "physical")
						isDead := target.Health <= 0

						// Combo: Tremor Rush (Earthshaker → Charge) = +2s knockdown
						if e.ActiveCombo == "charge_extended_knockdown" {
							target.Stunned = true
							target.StunEndTime = time.Now().Add(2 * time.Second)
						}
						target.Mu.Unlock()

						hitTargets = append(hitTargets, target)

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: finalDamage})
						}

						if isDead {
							target.Mu.Lock()
							w.handleDeath(target, e, deferred)
							target.Mu.Unlock()
						}
					}
				}

				// Consume the combo after use
				if e.ActiveCombo == "charge_extended_knockdown" {
					e.ActiveCombo = ""
				}

				// Shockwave rune: knockback AoE at end of charge (5 unit radius)
				if runeID == "charge_shockwave" {
					shockwaveRadius := 5.0
					knockbackDist := 4.0
					shockwaveNearby := w.Grid.Nearby(e.X, e.Z, shockwaveRadius, e.InstanceID)
					for _, target := range shockwaveNearby {
						target.Mu.RLock()
						if target.Type != TypeEnemy || target.State == "DEAD" {
							target.Mu.RUnlock()
							continue
						}
						tx, tz := target.X, target.Z
						target.Mu.RUnlock()

						knockDx := tx - e.X
						knockDz := tz - e.Z
						knockDist := math.Sqrt(knockDx*knockDx + knockDz*knockDz)
						if knockDist > 0 && knockDist <= shockwaveRadius {
							// Normalize and apply knockback
							knockDx = (knockDx / knockDist) * knockbackDist
							knockDz = (knockDz / knockDist) * knockbackDist

							target.Mu.Lock()
							oldTX, oldTZ := target.X, target.Z
							target.X += knockDx
							target.Z += knockDz
							if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(target, target.X, target.Z); ok {
								target.X = constrainedX
								target.Z = constrainedZ
							}
							w.Grid.Update(target, oldTX, oldTZ)
							target.Mu.Unlock()
						}
					}
				}

				// Clear charge rune ID
				e.Mu.Lock()
				e.ChargeRuneID = ""
				e.Mu.Unlock()
			} else {
				nextX := e.X + (dx / dist) * moveDist
				nextZ := e.Z + (dz / dist) * moveDist
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, nextX, nextZ); ok {
					nextX = constrainedX
					nextZ = constrainedZ
				}
				e.X = nextX
				e.Z = nextZ
				e.Rotation = math.Atan2(dx, dz)
				w.Grid.Update(e, oldX, oldZ)
				e.Mu.Unlock()
			}
		} else {
			// Check Buff Expirations
			now := time.Now()
			if e.BerserkerModeActive && now.After(e.BerserkerModeEndTime) {
				e.BerserkerModeActive = false
				e.RecalculateStats()
			}
			if e.LastStandActive && now.After(e.LastStandEndTime) {
				e.LastStandActive = false
			}
			if e.StealthActive && now.After(e.StealthEndTime) {
				e.StealthActive = false
				e.CloakSwiftSpeedBonus = false
				// Don't clear CloakNextAttackBonus here - it persists until next attack
			}
			if e.ZealActive && now.After(e.ZealEndTime) {
				e.ZealActive = false
			}
			if e.IronFortressActive && now.After(e.IronFortressEndTime) {
				e.IronFortressActive = false
				e.IronFortressThorns = false
				e.IronFortressImmovable = false
				e.IronFortressRuneID = ""
			}
			if e.GuardianRoarActive && now.After(e.GuardianRoarEndTime) {
				e.GuardianRoarActive = false
			}
			if e.SerratedEdgesActive && now.After(e.SerratedEdgesEndTime) {
				e.SerratedEdgesActive = false
			}
			if e.PoisonCoatingActive && now.After(e.PoisonCoatingEndTime) {
				e.PoisonCoatingActive = false
			}
			if e.ArcaneShieldActive && now.After(e.ArcaneShieldEndTime) {
				e.ArcaneShieldActive = false
				e.ArcaneShieldHP = 0
			}
			if e.TimeWarpActive && now.After(e.TimeWarpEndTime) {
				e.TimeWarpActive = false
			}
			if e.DivineInterventionActive && now.After(e.DivineInterventionEndTime) {
				e.DivineInterventionActive = false
			}
			if e.BlessingResolveActive && now.After(e.BlessingResolveEndTime) {
				e.BlessingResolveActive = false
			}
			if e.Stunned && now.After(e.StunEndTime) {
				e.Stunned = false
			}
			if e.Slowed && now.After(e.SlowEndTime) {
				e.Slowed = false
				e.SlowFactor = 0
			}
			if e.Rooted && now.After(e.RootEndTime) {
				e.Rooted = false
			}
			if e.WeakPointMarked && now.After(e.WeakPointEndTime) {
				e.WeakPointMarked = false
			}
			if e.MarkWeakness && now.After(e.MarkWeaknessEndTime) {
				e.MarkWeakness = false
			}

			// Rune buff expirations
			if e.CCImmune && now.After(e.CCImmuneEndTime) {
				e.CCImmune = false
			}
			if e.RuneArmorBuff > 0 && now.After(e.RuneArmorBuffEndTime) {
				e.RuneArmorBuff = 0
			}
			if now.After(e.InvulnerableEndTime) && !e.InvulnerableEndTime.IsZero() {
				e.InvulnerableEndTime = time.Time{}
			}

			// Extended Whirlwind tick (from rune)
			if e.WhirlwindActive {
				if now.After(e.WhirlwindEndTime) {
					e.WhirlwindActive = false
					e.WhirlwindRuneID = ""
				} else if now.Sub(e.LastSpiritTick) >= 500*time.Millisecond {
					// Tick every 0.5s
					e.LastSpiritTick = now // Reuse this timer
					radius := 6.0
					effectiveRadius := expandedAbilityRadius("Whirlwind", radius)
					damage := int((float64(e.Damage)*0.8 + float64(e.Stats.Strength)*2) * 1.3 * 0.5) // -50% damage
					e.Mu.Unlock()

					nearby := w.Grid.Nearby(e.X, e.Z, effectiveRadius, e.InstanceID)
					for _, target := range nearby {
						if target.ID == e.ID {
							continue
						}
						target.Mu.RLock()
						if target.Type != TypeEnemy || target.State == "DEAD" {
							target.Mu.RUnlock()
							continue
						}
						target.Mu.RUnlock()

						if withinAbilityRadius("Whirlwind", e.X, e.Z, target, radius) {
							target.Mu.Lock()
							finalDamage := applyFinalDamage(e, target, damage, "physical")
							addThreatLocked(target, e.ID, float64(finalDamage))
							isDead := target.Health <= 0
							target.Mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: finalDamage})
							}

							if isDead {
								target.Mu.Lock()
								w.handleDeath(target, e, deferred)
								target.Mu.Unlock()
							}
						}
					}

					e.Mu.Lock()
				}
			}

			// DoT Ticks
			if e.Bleeding {
				if now.After(e.BleedEndTime) {
					e.Bleeding = false
				} else if time.Since(e.LastBleedTick) >= 1*time.Second {
					e.LastBleedTick = now
					e.Health -= e.BleedDamage
					if w.OnEvent != nil {
						w.OnEvent("damage", DamageEvent{TargetID: e.ID, SourceID: "bleed", Amount: e.BleedDamage})
					}
					if e.Health <= 0 {
						// Handle death (tricky without attacker ref, assume environment/self)
						e.Mu.Unlock()
						w.handleDeath(e, nil, deferred)
						e.Mu.Lock()
					}
				}
			}
			if e.Poisoned {
				if now.After(e.PoisonEndTime) {
					e.Poisoned = false
				} else if time.Since(e.LastPoisonTick) >= 1*time.Second {
					e.LastPoisonTick = now
					e.Health -= e.PoisonDamage
					if w.OnEvent != nil {
						w.OnEvent("damage", DamageEvent{TargetID: e.ID, SourceID: "poison", Amount: e.PoisonDamage})
					}
					if e.Health <= 0 {
						e.Mu.Unlock()
						w.handleDeath(e, nil, deferred)
						e.Mu.Lock()
					}
				}
			}

			// Healing Light HoT (Renewal Rune)
			if e.HealingLightHoTActive {
				if now.After(e.HealingLightHoTEndTime) {
					e.HealingLightHoTActive = false
				} else if time.Since(e.LastHealingLightHoTTick) >= 1*time.Second {
					e.LastHealingLightHoTTick = now
					e.Health += e.HealingLightHoTAmount
					if e.Health > e.MaxHealth {
						e.Health = e.MaxHealth
					}
					if w.OnEvent != nil {
						w.OnEvent("heal", HealEvent{TargetID: e.ID, SourceID: "healinglight_hot", Amount: e.HealingLightHoTAmount})
					}
				}
			}

			// Sanctuary Damage Reduction expiry check
			if e.SanctuaryDamageReduction && now.After(e.SanctuaryEndTime) {
				e.SanctuaryDamageReduction = false
			}

			// Divine Intervention Guardian Angel expiry check
			if e.DivineInterventionGuardian && now.After(e.DivineInterventionGuardTime) {
				e.DivineInterventionGuardian = false
			}

			// HoT Ticks (Guardian Embrace)
			if e.GuardianEmbraceActive {
				if now.After(e.GuardianEmbraceEndTime) {
					e.GuardianEmbraceActive = false
				} else if time.Since(e.LastGuardianEmbraceTick) >= 1*time.Second {
					e.LastGuardianEmbraceTick = now
					heal := 20 + (e.Stats.Wisdom * 2)

					// Heal Self
					e.Health += heal
					if e.Health > e.MaxHealth {
						e.Health = e.MaxHealth
					}

					// Heal Nearby Allies
					pX, pZ := e.X, e.Z
					e.Mu.Unlock()
					nearby := w.Grid.Nearby(pX, pZ, 10.0, e.InstanceID)
					for _, target := range nearby {
						if target.InstanceID != e.InstanceID {
							continue
						}
						if target.ID == e.ID {
							continue
						}
						if target.Type == TypePlayer || target.Type == TypeNPC {
							target.Mu.Lock()
							target.Health += heal
							if target.Health > target.MaxHealth {
								target.Health = target.MaxHealth
							}
							target.Mu.Unlock()
						}
					}
					e.Mu.Lock()
				}
			}

			if e.SpiritsActive {
				// Cleric Spirits
				if now.After(e.SpiritEndTime) {
					e.SpiritsActive = false
					e.SpiritGuardiansRuneID = ""
					e.Mu.Unlock()
				} else {
					if time.Since(e.LastSpiritTick) >= 500*time.Millisecond {
						e.LastSpiritTick = now
						damage := 10 + (e.Stats.Wisdom * 1)
						radius := 16.0
						if e.SpiritsBoosted {
							damage = 20 + int(float64(e.Stats.Wisdom)*1.5)
							radius = 20.0
						}

						// Spirit Guardians Rune Effects
						spiritRuneID := e.SpiritGuardiansRuneID

						// spirits_expanded: +50% radius
						if spiritRuneID == "spirits_expanded" {
							radius *= 1.5
						}

						// spirits_vengeful: +50% damage, -25% healing
						healReduction := 1.0
						if spiritRuneID == "spirits_vengeful" {
							damage = int(float64(damage) * 1.5)
							healReduction = 0.75
						}

						pX, pZ := e.X, e.Z
						hasSpiritHeal := e.HasAnySetBonus("spiritGuardiansHeal")
						e.Mu.Unlock() // Unlock before interaction

						effectiveRadius := expandedAbilityRadius("Spirit Guardians", radius)
						nearby := w.Grid.Nearby(pX, pZ, effectiveRadius, e.InstanceID)
						for _, target := range nearby {
							if target.InstanceID != e.InstanceID {
								continue
							}
							target.Mu.RLock()
							targetType := target.Type
							targetState := target.State
							targetID := target.ID
							target.Mu.RUnlock()

							if withinAbilityRadius("Spirit Guardians", pX, pZ, target, radius) {
								// Damage enemies
								if targetType == TypeEnemy && targetState != "DEAD" {
									target.Mu.Lock()
									target.Health -= damage
									isDead := target.Health <= 0
									target.Mu.Unlock()

									if w.OnEvent != nil {
										w.OnEvent("damage", DamageEvent{TargetID: targetID, SourceID: e.ID, Amount: damage})
									}

									if isDead {
										target.Mu.Lock()
										w.handleDeath(target, e, deferred)
										target.Mu.Unlock()
									}
								}

								// Set Bonus: Divine Light 4pc (spiritGuardiansHeal) - Heal allies
								if hasSpiritHeal && targetType == TypePlayer && targetID != e.ID {
									healAmount := int(float64(5+(e.Stats.Wisdom/2)) * healReduction) // Apply vengeful rune reduction
									healAmount = applyHealingDoneBonus(e, healAmount)
									target.Mu.Lock()
									target.Health += healAmount
									if target.Health > target.MaxHealth {
										target.Health = target.MaxHealth
									}
									target.Mu.Unlock()
								}
							}
						}
					} else {
						e.Mu.Unlock()
					}
				}
			} else {
				e.Mu.Unlock()
			}
		}
	}

	if e.SubType == "AvengingSeraph" {
		e.Mu.Lock()

		// Owner Check (needed for both duration and bonus check)
		owner := w.GetEntity(e.OwnerID)
		if owner == nil {
			e.Mu.Unlock()
			deferred.addRemoval(e.ID)
			return
		}

		// Duration Check - Set Bonus: Crusader's Zeal 6pc (permanentSeraph) extends duration
		// Normal duration: 15s, with set bonus: permanent while in combat (300s max)
		owner.Mu.RLock()
		hasPermanentSeraph := owner.HasAnySetBonus("permanentSeraph")
		owner.Mu.RUnlock()

		maxDuration := 15 * time.Second
		if hasPermanentSeraph {
			maxDuration = 300 * time.Second // 5 minutes - effectively permanent in combat
		}

		if time.Since(e.CreatedAt) > maxDuration {
			e.Mu.Unlock()
			deferred.addRemoval(e.ID)
			return
		}

		owner.Mu.RLock()
		ox, oz := owner.X, owner.Z
		owner.Mu.RUnlock()

		// AI Logic
		// 1. Find Target (Enemy)
		var target *Entity
		minDist := 15.0 // Aggro Range

		// Unlock self to search grid
		ex, ez := e.X, e.Z
		e.Mu.Unlock()

		nearby := w.Grid.Nearby(ex, ez, minDist, e.InstanceID)
		for _, t := range nearby {
			if t.InstanceID != e.InstanceID {
				continue
			}
			t.Mu.RLock()
			if t.Type != TypeEnemy || t.State == "DEAD" {
				t.Mu.RUnlock()
				continue
			}
			dx := t.X - ex
			dz := t.Z - ez
			t.Mu.RUnlock()
			d := math.Sqrt(dx*dx + dz*dz)
			if d < minDist {
				minDist = d
				target = t
			}
		}

		e.Mu.Lock()

		// Attack Logic
		if target != nil {
			// Face Target
			target.Mu.RLock()
			tx, tz := target.X, target.Z
			target.Mu.RUnlock()

			dx := tx - e.X
			dz := tz - e.Z
			e.Rotation = math.Atan2(dx, dz)

			if time.Since(e.LastAttackTime) >= 1500*time.Millisecond {
				e.LastAttackTime = time.Now()
				e.State = "ATTACKING"

				// Ranged Smite Attack
				damage := e.Damage

				e.Mu.Unlock() // Unlock before interaction

				ownerIsPlayer := owner.Type == TypePlayer
				ownerID := e.OwnerID
				target.Mu.Lock()
				finalDamage := applyFinalDamage(owner, target, damage, "holy")
				if ownerIsPlayer {
					addThreatLocked(target, ownerID, float64(finalDamage))
				}
				isDead := target.Health <= 0
				target.Mu.Unlock()

				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: finalDamage})
					// Visual Beam event? Or just rely on attack animation
					w.OnEvent("ability", AbilityEvent{SourceID: e.ID, TargetID: target.ID, SkillName: "Smite", TargetX: tx, TargetZ: tz})
				}

				if isDead {
					target.Mu.Lock()
					w.handleDeath(target, owner, deferred) // Owner gets XP
					target.Mu.Unlock()
				}
				e.Mu.Lock()
			}
		} else {
			// Follow Owner
			dx := ox - e.X
			dz := oz - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist > 3.0 {
				e.State = "MOVING"
				// Move towards owner
				dirX := dx / dist
				dirZ := dz / dist
				speed := 6.0 * dt
				newX := e.X + dirX*speed
				newZ := e.Z + dirZ*speed
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, newX, newZ); ok {
					newX = constrainedX
					newZ = constrainedZ
				}

				e.X = newX
				e.Z = newZ
				e.Rotation = math.Atan2(dirX, dirZ)

				// Update Grid
				w.Grid.Update(e, ex, ez)
			} else {
				e.State = "IDLE"
			}
		}
		e.Mu.Unlock()
		return
	}

	if e.Type == TypeEnemy {
		// AI Logic
		var target *Entity
		minDist := 1000.0
		sightRange := 45.0

		// Snapshot position + threat without holding the enemy lock while scanning players.
		var threatSnapshot map[string]float64
		e.Mu.RLock()
		ex, ez := e.X, e.Z
		if len(e.Threat) > 0 {
			threatSnapshot = make(map[string]float64, len(e.Threat))
			for k, v := range e.Threat {
				threatSnapshot[k] = v
			}
		}
		e.Mu.RUnlock()

		// Apply decay to snapshot so selection matches this tick's decay.
		decayFactor := math.Pow(0.97, dt)
		for k, v := range threatSnapshot {
			threatSnapshot[k] = v * decayFactor
		}

		// Pick target:
		// - If enemy has any threat on valid players, pick highest threat.
		// - Otherwise, pick nearest valid player.
		nearestDist := math.MaxFloat64
		var nearestPlayer *Entity
		maxThreat := 0.0
		threatDist := math.MaxFloat64
		var threatPlayer *Entity

		for _, p := range players {
			if p.InstanceID != e.InstanceID {
				continue
			}
			p.Mu.RLock()
			// Check Safe Zone
			if p.X > -100 && p.X < 100 && p.Z > 100 && p.Z < 300 {
				p.Mu.RUnlock()
				continue
			}
			// Check Stealth
			if p.StealthActive {
				if time.Now().Before(p.StealthEndTime) {
					p.Mu.RUnlock()
					continue
				}
			}
			dx := p.X - ex
			dz := p.Z - ez
			pid := p.ID
			p.Mu.RUnlock()

			dist := math.Sqrt(dx*dx + dz*dz)
			if dist < nearestDist {
				nearestDist = dist
				nearestPlayer = p
			}

			thr := 0.0
			if threatSnapshot != nil {
				thr = threatSnapshot[pid]
			}
			if thr > 0 {
				if thr > maxThreat || (thr == maxThreat && dist < threatDist) {
					maxThreat = thr
					threatDist = dist
					threatPlayer = p
				}
			}
		}

		if threatPlayer != nil {
			target = threatPlayer
			minDist = threatDist
		} else {
			target = nearestPlayer
			minDist = nearestDist
		}

		attackRange := 3.0 // Match PerformAttack base range (tighter so melee looks/feels like contact)
		roamRadius := 10.0

		e.Mu.Lock()
		defer e.Mu.Unlock()

		// Decay stored threat table by 3%/sec and prune tiny values.
		if len(e.Threat) > 0 {
			for k, v := range e.Threat {
				nv := v * decayFactor
				if nv < 0.01 {
					delete(e.Threat, k)
					continue
				}
				e.Threat[k] = nv
			}
		}

		// Adjust range for large entities (must match PerformAttack scaling)
		if e.Scale > 1.0 {
			// Use the same scaling as PerformAttack to ensure AI attacks when in range
			attackRange += (e.Scale - 1.0) * 1.5
		}

		// Animation Lock: If attacking, stay attacking and don't move
		// Lock for 80% of cooldown to allow a brief IDLE reset before next attack
		// This ensures the client sees a state change to trigger the animation again.
		lockDuration := time.Duration(float64(e.AttackCooldown) * 0.8)
		if lockDuration > 1*time.Second {
			lockDuration = 1 * time.Second
		}

		if time.Since(e.LastAttackTime) < lockDuration {
			if e.State != "ATTACKING" {
				e.State = "ATTACKING"
			}
			return
		}

		// After the swing lock, enemies should be allowed to move immediately.
		// We still want the state flip (ATTACKING -> IDLE) during cooldown so the
		// client can reliably retrigger ATTACKING on the next hit.
		cooldownActive := time.Since(e.LastAttackTime) < e.AttackCooldown
		if cooldownActive {
			e.State = "IDLE"
		}

		if target != nil && minDist <= sightRange {
			if minDist <= attackRange {
				// Attack (if off cooldown). If still on cooldown, stay IDLE in-place.
				if !cooldownActive {
					// Boss AoE Slam: bosses (Scale >= 4.0) periodically use a
					// telegraphed ground slam instead of their normal attack.
					// Cooldown: 10 seconds.  Telegraph: 2 seconds warning.
					if e.Scale >= 4.0 && time.Since(e.LastSpecialAttack) >= 10*time.Second {
						e.LastSpecialAttack = time.Now()
						e.LastAttackTime = time.Now() // put normal attack on cooldown too
						e.State = "ATTACKING"

						slamX := e.X
						slamZ := e.Z
						slamRadius := 8.0 + (e.Scale-1.0)*1.5 // ~12.5 for Scale 4
						slamDelay := 2.0                      // seconds
						bossID := e.ID
						bossDamage := e.Damage
						instanceID := e.InstanceID

						// Emit telegraph event so clients show a warning circle
						if w.OnEvent != nil {
							w.OnEvent("telegraph", TelegraphEvent{
								SourceID: bossID,
								X:        slamX,
								Z:        slamZ,
								Radius:   slamRadius,
								Duration: slamDelay,
							})
						}

						// Schedule AoE damage after the telegraph delay
						go func(x, z, radius float64, delay time.Duration, dmg int, instID, srcID string) {
							time.Sleep(delay)

							w.Mu.Lock()
							defer w.Mu.Unlock()

							src := w.Entities[srcID]
							if src == nil || src.State == "DEAD" {
								return
							}

							for _, p := range w.Entities {
								if p.Type != TypePlayer || p.InstanceID != instID || p.State == "DEAD" {
									continue
								}
								p.Mu.Lock()
								dx := p.X - x
								dz := p.Z - z
								if math.Sqrt(dx*dx+dz*dz) <= radius {
									damage := dmg - p.Defense/2
									if damage < 1 {
										damage = 1
									}
									p.Health -= damage
									if p.Health < 0 {
										p.Health = 0
									}
									if w.OnEvent != nil {
										w.OnEvent("damage", DamageEvent{TargetID: p.ID, SourceID: srcID, Amount: damage})
									}
									if p.Health <= 0 {
										p.State = "DEAD"
									}
								}
								p.Mu.Unlock()
							}
						}(slamX, slamZ, slamRadius, time.Duration(slamDelay*float64(time.Second)), bossDamage, instanceID, bossID)
					} else {
						e.Mu.Unlock() // Unlock self before interaction
						w.PerformAttack(e.ID, target.ID)
						e.Mu.Lock() // Relock self
					}
				}
			} else {
				// Chase
				target.Mu.RLock()
				tx, tz := target.X, target.Z
				target.Mu.RUnlock()

				// Anti-stacking steering:
				// Many enemies converging on the exact player position causes them to overlap.
				// Instead, chase distinct offset points on a ring around the player.
				// Once in melee range, AI switches to attacking based on true distance to player.
				angle := hashAngle(e.ID + "|" + target.ID)
				// Offset tuned to be inside melee range but large enough to visibly separate.
				offset := 1.8
				if attackRange*0.8 < offset {
					offset = attackRange * 0.8
				}
				// Large entities get a slightly larger orbit to reduce clipping.
				if e.Scale > 1.0 {
					offset += (e.Scale - 1.0) * 0.5
				}

				e.TargetX = tx + math.Cos(angle)*offset
				e.TargetZ = tz + math.Sin(angle)*offset
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, e.TargetX, e.TargetZ); ok {
					e.TargetX = constrainedX
					e.TargetZ = constrainedZ
				}
				e.State = "MOVING"

				dx := e.TargetX - e.X
				dz := e.TargetZ - e.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist > 0 {
					moveDist := e.Speed * dt
					if moveDist > dist {
						moveDist = dist
					}
					oldX, oldZ := e.X, e.Z
					newX := e.X + (dx/dist)*moveDist
					newZ := e.Z + (dz/dist)*moveDist
					if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, newX, newZ); ok {
						newX = constrainedX
						newZ = constrainedZ
					}

					if newX > -100 && newX < 100 && newZ > 100 && newZ < 300 {
						e.State = "IDLE"
					} else {
						e.X = newX
						e.Z = newZ
						e.Rotation = math.Atan2(dx, dz)
						w.Grid.Update(e, oldX, oldZ)
					}
				}
			}
		} else {
			// Roam
			dx := e.TargetX - e.X
			dz := e.TargetZ - e.Z
			distToTarget := math.Sqrt(dx*dx + dz*dz)

			if distToTarget < 0.5 || (e.TargetX == 0 && e.TargetZ == 0) {
				angle := rand.Float64() * 2 * math.Pi
				dist := rand.Float64() * roamRadius
				e.TargetX = e.SpawnX + math.Cos(angle)*dist
				e.TargetZ = e.SpawnZ + math.Sin(angle)*dist
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, e.TargetX, e.TargetZ); ok {
					e.TargetX = constrainedX
					e.TargetZ = constrainedZ
				}
				e.State = "MOVING"
			}

			dx = e.TargetX - e.X
			dz = e.TargetZ - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist > 0 {
				moveDist := e.Speed * dt
				if moveDist > dist {
					moveDist = dist
				}
				oldX, oldZ := e.X, e.Z
				newX := e.X + (dx/dist)*moveDist
				newZ := e.Z + (dz/dist)*moveDist
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, newX, newZ); ok {
					newX = constrainedX
					newZ = constrainedZ
				}

				if newX > -100 && newX < 100 && newZ > 100 && newZ < 300 {
					e.TargetX = e.SpawnX
					e.TargetZ = e.SpawnZ
				} else {
					e.X = newX
					e.Z = newZ
					e.Rotation = math.Atan2(dx, dz)
					w.Grid.Update(e, oldX, oldZ)
				}
			}
		}
	}
}

func (w *World) Update(dt float64) {
	// Note: We do NOT hold w.Mu during the main update loop to allow parallelism.
	// However, we need to snapshot the entity list safely.

	w.Mu.Lock()

	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Recovered from panic in Update: %v\n", r)
			// Ensure we don't leave.Mutex locked if we panic while holding it
			// This is tricky because we lock/unlock multiple times.
			// Ideally we should use a named mutex or check state, but sync.Mutex doesn't expose state.
			// For now, we assume panic handling is last resort.
		}
	}()

	// Global Regeneration (1 second tick)
	w.RegenTimer += dt
	if w.RegenTimer >= 1.0 {
		w.RegenTimer -= 1.0
		for _, e := range w.Entities {
			// Prevent regen if dead or effectively dead (<= 0 HP)
			if e.State != "DEAD" && e.Health > 0 {
				if e.Health < e.MaxHealth {
					e.Health += int(e.HpRegen)
					if e.Health > e.MaxHealth {
						e.Health = e.MaxHealth
					}
				}
				if e.Mana < e.MaxMana {
					e.Mana += int(e.ManaRegen)
					if e.Mana > e.MaxMana {
						e.Mana = e.MaxMana
					}
				}
			}
		}
	}

	// 1. Identify potential targets (Players) & Snapshot Entities
	players := make([]*Entity, 0, 100)
	allEntities := make([]*Entity, 0, len(w.Entities))

	for _, e := range w.Entities {
		allEntities = append(allEntities, e)
		if e.Type == TypePlayer && e.State != "DEAD" {
			players = append(players, e)
		}
	}
	w.Mu.Unlock() // Unlock World so parallel updates can happen

	// 2. Update Entities (Parallel)
	deferred := &deferredActions{}

	// Create a channel for entities to update
	entityChan := make(chan *Entity, len(allEntities))
	for _, e := range allEntities {
		entityChan <- e
	}
	close(entityChan)

	var wg sync.WaitGroup
	numWorkers := runtime.NumCPU()
	wg.Add(numWorkers)

	for i := 0; i < numWorkers; i++ {
		go func() {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					fmt.Printf("Worker panic: %v\n", r)
				}
			}()
			for e := range entityChan {
				w.updateEntity(e, dt, players, deferred)
			}
		}()
	}
	wg.Wait()

	// 3. Process Deferred Actions (Removals/Additions)
	w.Mu.Lock()

	for _, id := range deferred.removals {
		if e, ok := w.Entities[id]; ok {
			w.Grid.Remove(e)
			delete(w.Entities, id)
		}
	}

	for _, e := range deferred.additions {
		w.Entities[e.ID] = e
		w.Grid.Add(e)
	}

	w.Mu.Unlock()

	// 4. Environmental Hazard Damage (% max health per tick)
	// Process hazard damage for players standing in hazard zones
	w.processHazardDamage(dt, players)

	// 5. Elite Spawning Logic (Every 5 minutes)
	// Note: w.EliteSpawnTimer is accessed without lock here.
	// Strictly speaking, we should lock it. But it's only used in Update loop (single threaded relative to itself).
	// However, if we want to be safe, we can lock just for the check.
	// But w.spawnEliteInRect locks w.Mu internally.

	if time.Since(w.EliteSpawnTimer) >= 5*time.Minute {
		w.EliteSpawnTimer = time.Now()
		// Spawn one random elite
		type SpawnArea struct {
			MinX, MaxX, MinZ, MaxZ float64
			Level                  int
		}
		areas := []SpawnArea{
			{-200, 200, -600, 1000, 10},
			{-600, -200, -600, 1000, 20},
			{200, 600, -600, 1000, 30},
			{-1000, -600, -600, 1000, 40},
			{600, 1000, -600, 1000, 50},
		}
		area := areas[rand.Intn(len(areas))]
		w.spawnEliteInRect(area.Level, area.MinX, area.MaxX, area.MinZ, area.MaxZ)
	}
}

// processHazardDamage checks if players are standing in hazard zones and applies % max health damage
func (w *World) processHazardDamage(dt float64, players []*Entity) {
	if len(w.Hazards) == 0 || len(players) == 0 {
		return
	}

	// Lock for hazard tick tracking modifications
	w.Mu.Lock()
	defer w.Mu.Unlock()

	for _, player := range players {
		if player.State == "DEAD" || player.Health <= 0 {
			continue
		}

		// Players in town are safe (Town: X -100 to 100, Z 100 to 300)
		if player.X > -100 && player.X < 100 && player.Z > 100 && player.Z < 300 {
			continue
		}

		// Players in dungeon instances don't get world hazard damage
		if player.InstanceID != "" {
			continue
		}

		player.Mu.RLock()
		px, pz := player.X, player.Z
		playerID := player.ID
		maxHealth := player.MaxHealth
		player.Mu.RUnlock()

		// Initialize player's hazard tick map if needed
		if w.PlayerHazardTicks[playerID] == nil {
			w.PlayerHazardTicks[playerID] = make(map[string]float64)
		}

		// Check each hazard
		for hazardID, hazard := range w.Hazards {
			// Calculate distance from player to hazard center
			dx := px - hazard.X
			dz := pz - hazard.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist <= hazard.Radius {
				// Player is inside hazard zone
				// Accumulate time since last tick
				w.PlayerHazardTicks[playerID][hazardID] += dt

				// Check if we should apply damage
				if w.PlayerHazardTicks[playerID][hazardID] >= hazard.TickInterval {
					w.PlayerHazardTicks[playerID][hazardID] -= hazard.TickInterval

					// Calculate % health damage
					damage := int(float64(maxHealth) * hazard.DamagePct)
					if damage < 1 {
						damage = 1
					}

					// Apply damage
					player.Mu.Lock()
					player.Health -= damage
					if player.Health < 0 {
						player.Health = 0
					}
					player.Mu.Unlock()

					// Emit damage event
					w.OnEvent("hazard_damage", HazardDamageEvent{
						PlayerID:   playerID,
						HazardID:   hazardID,
						HazardType: hazard.HazardType,
						Damage:     damage,
					})

					// Check for death
					if player.Health <= 0 {
						player.Mu.Lock()
						player.State = "DEAD"
						player.Mu.Unlock()

						// Emit death event (player died to hazard)
						w.OnEvent("death", map[string]interface{}{
							"entityId":  playerID,
							"killedBy":  hazardID,
							"wasPlayer": true,
						})
					}
				}
			} else {
				// Player left hazard zone, reset their tick for this hazard
				delete(w.PlayerHazardTicks[playerID], hazardID)
			}
		}
	}
}

func (w *World) PerformAttack(attackerID, targetID string) (int, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	attacker, ok := w.Entities[attackerID]
	if !ok || attacker.State == "DEAD" {
		return 0, false
	}

	target, ok := w.Entities[targetID]
	if !ok || target.State == "DEAD" {
		return 0, false
	}

	if attacker.InstanceID != target.InstanceID {
		return 0, false
	}

	// NO PVP: If both are players, return false
	if attacker.Type == TypePlayer && target.Type == TypePlayer {
		return 0, false
	}

	// NO NPC ATTACKS
	if target.Type == TypeNPC || target.Type == TypeForge || target.Type == TypeStash {
		return 0, false
	}

	// Check Cooldown
	if time.Since(attacker.LastAttackTime) < attacker.AttackCooldown {
		return 0, false
	}

	// Check CC
	if attacker.Stunned {
		return 0, false
	}

	// Check Range (Simple distance check)
	dx := attacker.X - target.X
	dz := attacker.Z - target.Z
	dist := math.Sqrt(dx*dx + dz*dz)

	attackRange := 3.0 // Default Melee range (tighter so melee looks/feels like contact)

	// Adjust range for scale (Bosses)
	if attacker.Scale > 1.0 {
		attackRange += (attacker.Scale - 1.0) * 1.5
	}

	// Also adjust range for target's scale (allows melee to hit large bosses)
	if target.Scale > 1.0 {
		attackRange += (target.Scale - 1.0) * 1.5
	}

	switch attacker.SubType {
	case "Wizard", "Rogue":
		attackRange = 100.0 // Ranged - effectively infinite
	case "DwarfSalesman":
		attackRange = 6.0
	}

	if dist > attackRange {
		return 0, false
	}

	// Start Attack State & Cooldown immediately
	attacker.LastAttackTime = time.Now()
	attacker.State = "ATTACKING"

	// Calculate Delay (35% of animation duration)
	// AttackCooldown IS the duration now.
	delay := time.Duration(float64(attacker.AttackCooldown) * 0.35)

	// Async Damage Application
	go func(attID, tgtID string, d time.Duration) {
		time.Sleep(d)

		// Use fine-grained locking instead of global lock
		att := w.GetEntity(attID)
		if att == nil || att.State == "DEAD" {
			return
		}
		tgt := w.GetEntity(tgtID)
		if tgt == nil || tgt.State == "DEAD" {
			return
		}

		// Lock target for modification
		tgt.Mu.Lock()
		// We should also lock attacker if we read mutable fields, but Damage is updated in RecalculateStats
		// and we are reading it. Ideally we lock both, but let's be careful of deadlock.
		// Since we only read att.Damage (int), it's atomic-ish on 64bit, but technically racey.
		// However, locking both requires ordering.
		// For now, let's assume reading att.Damage is "safe enough" or we RLock att.

		defense := tgt.Defense

		// Bosses ignore 50% of defense
		bosses := map[string]bool{
			"InfernoTitan": true, "Siren": true, "FrostGuardian": true,
			"MountainTroll": true, "AquaGolem": true, "RootboundWarden": true,
			"BriarMatron": true, "RustboundColossus": true, "HollowSentinel": true,
			"Avenging Seraph": true,
		}
		if bosses[att.SubType] {
			defense = defense / 2
		}

		damage := att.Damage - defense
		if damage < 1 {
			damage = 1
		}

		// Cloak Prepared Ambush rune: next attack deals +100% damage
		if att.Type == TypePlayer && att.CloakNextAttackBonus > 0 {
			damage = int(float64(damage) * (1.0 + att.CloakNextAttackBonus))
			att.Mu.Lock()
			att.CloakNextAttackBonus = 0
			att.StealthActive = false // Break stealth on attack
			att.CloakSwiftSpeedBonus = false
			att.Mu.Unlock()
		}

		// Iron Fortress Thorns rune: reflect 20% damage back to attacker
		if tgt.Type == TypePlayer && tgt.IronFortressActive && tgt.IronFortressThorns {
			thornsDamage := damage / 5 // 20%
			if thornsDamage > 0 {
				att.Health -= thornsDamage
				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: att.ID, SourceID: tgt.ID, Amount: thornsDamage})
				}
			}
		}

		// Invulnerability check (from teleport phase rune)
		if tgt.Type == TypePlayer && !tgt.InvulnerableEndTime.IsZero() && time.Now().Before(tgt.InvulnerableEndTime) {
			damage = 0
		}

		// Sanctuary damage reduction (Spirit Guardians rune or Consecrated Ground rune): 20-30% less damage
		if tgt.Type == TypePlayer && tgt.SanctuaryDamageReduction && time.Now().Before(tgt.SanctuaryEndTime) {
			// Sanctuary gives 20% reduction (spirits_sanctuary) or 30% (consecratedground_sanctuary)
			// We use 25% as a middle ground since both can stack
			damage = int(float64(damage) * 0.75)
		}

		// Divine Intervention Guardian Angel rune: 50% damage reduction
		if tgt.Type == TypePlayer && tgt.DivineInterventionGuardian && time.Now().Before(tgt.DivineInterventionGuardTime) {
			damage = int(float64(damage) * 0.5)
		}

		// Arcane Shield absorption
		actualDamage := damage
		if tgt.Type == TypePlayer && tgt.ArcaneShieldActive && tgt.ArcaneShieldHP > 0 && damage > 0 {
			absorbed := damage
			if absorbed > tgt.ArcaneShieldHP {
				absorbed = tgt.ArcaneShieldHP
			}
			tgt.ArcaneShieldHP -= absorbed
			tgt.ArcaneShieldAbsorbed += absorbed
			actualDamage = damage - absorbed

			// Reflective rune: reflect 30% of absorbed damage
			if tgt.ArcaneShieldRuneID == "arcaneshield_reflective" {
				reflectDamage := absorbed * 30 / 100
				if reflectDamage > 0 {
					att.Health -= reflectDamage
					if w.OnEvent != nil {
						w.OnEvent("damage", DamageEvent{TargetID: att.ID, SourceID: tgt.ID, Amount: reflectDamage})
					}
				}
			}

			// Shield broken - check for explosive rune
			if tgt.ArcaneShieldHP <= 0 {
				if tgt.ArcaneShieldRuneID == "arcaneshield_explosive" {
					// Explode dealing absorbed amount to nearby enemies
					explosionDamage := tgt.ArcaneShieldAbsorbed
					explosionRadius := 6.0
					tgt.Mu.Unlock() // Unlock for grid search
					explosionNearby := w.Grid.Nearby(tgt.X, tgt.Z, explosionRadius, tgt.InstanceID)
					for _, et := range explosionNearby {
						et.Mu.RLock()
						if et.Type != TypeEnemy || et.State == "DEAD" {
							et.Mu.RUnlock()
							continue
						}
						edx := tgt.X - et.X
						edz := tgt.Z - et.Z
						et.Mu.RUnlock()

						if (edx*edx + edz*edz) <= explosionRadius*explosionRadius {
							et.Mu.Lock()
							et.Health -= explosionDamage
							isDead := et.Health <= 0
							et.Mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: et.ID, SourceID: tgt.ID, Amount: explosionDamage})
							}
							if isDead {
								et.Mu.Lock()
								w.handleDeath(et, tgt, nil)
								et.Mu.Unlock()
							}
						}
					}
					tgt.Mu.Lock() // Relock
				}

				tgt.ArcaneShieldActive = false
				tgt.ArcaneShieldRuneID = ""
				tgt.ArcaneShieldAbsorbed = 0
			}
		}

		actualDamage = applyFinalDamage(att, tgt, actualDamage, "physical")
		if att.Type == TypePlayer && tgt.Type == TypeEnemy {
			addThreatLocked(tgt, att.ID, float64(actualDamage))
		}

		// Apply On-Hit Effects
		// These read att fields.
		if att.SerratedEdgesActive {
			tgt.Bleeding = true
			tgt.BleedDamage = 10 + (att.Stats.Strength / 2)
			tgt.BleedEndTime = time.Now().Add(5 * time.Second)
		}
		if att.PoisonCoatingActive {
			tgt.Poisoned = true
			tgt.PoisonDamage = 8 + (att.Stats.Dexterity / 2)
			tgt.PoisonEndTime = time.Now().Add(8 * time.Second)
		}

		isDead := tgt.Health <= 0
		tgt.Mu.Unlock() // Unlock target before event/death handling to avoid holding too long?
		// No, handleDeath expects target to be locked?
		// Let's check handleDeath contract.
		// In updateProjectiles, target IS locked.
		// So we should keep it locked or re-lock.

		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: tgt.ID, SourceID: att.ID, Amount: damage})
		}

		if isDead {
			tgt.Mu.Lock() // Re-lock for death handling
			// Double check if still dead (race condition?)
			if tgt.Health <= 0 && tgt.State != "DEAD" {
				w.handleDeath(tgt, att, nil)
			}
			tgt.Mu.Unlock()
		}
	}(attackerID, targetID, delay)

	return 0, true
}

func (w *World) PerformAbility(playerID string, targetX, targetZ float64, targetID string, skillName string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok || player.State == "DEAD" {
		return
	}

	// Default skill names if not provided (Legacy support)
	if skillName == "" {
		switch player.SubType {
		case "Fighter":
			skillName = "Charge"
		case "Wizard":
			skillName = "Fireball"
		case "Rogue":
			skillName = "Piercing Throw"
		case "Cleric":
			skillName = "Spirit Guardians"
		}
	}

	// Lazy init cooldowns
	if player.Cooldowns == nil {
		player.Cooldowns = make(map[string]time.Time)
	}

	// Check Specific Cooldown
	if readyAt, ok := player.Cooldowns[skillName]; ok {
		if time.Now().Before(readyAt) {
			return
		}
	}

	// Check Global Cooldown (0.5s)
	// Apply Cooldown Reduction to GCD? Maybe not necessary for GCD, but let's keep it snappy.
	gcd := 500 * time.Millisecond
	if time.Since(player.LastAbilityTime) < gcd {
		return
	}

	setCooldown := func(duration time.Duration) {
		if player.CooldownReduction > 0 {
			duration = time.Duration(float64(duration) * (1.0 - player.CooldownReduction))
		}
		player.Cooldowns[skillName] = time.Now().Add(duration)
		player.LastAbilityTime = time.Now()
	}

	// Check if skill is unlocked
	isUnlocked := false
	for _, s := range player.UnlockedSkills {
		if s == skillName {
			isUnlocked = true
			break
		}
	}
	// Fallback: Always allow base skills if UnlockedSkills is empty or not found
	if !isUnlocked {
		if (player.SubType == "Fighter" && skillName == "Charge") ||
			(player.SubType == "Rogue" && skillName == "Piercing Throw") ||
			(player.SubType == "Wizard" && skillName == "Fireball") ||
			(player.SubType == "Cleric" && skillName == "Spirit Guardians") {
			isUnlocked = true
		}
	}

	if !isUnlocked {
		return
	}

	// Combo System: Check if this skill completes a combo
	now := time.Now()
	if player.LastSkillUsed != "" && now.Sub(player.LastSkillTime) <= ComboWindow {
		combo := GetComboForSkills(player.SubType, player.LastSkillUsed, skillName)
		if combo != nil {
			player.ActiveCombo = combo.Effect
			player.ActiveComboEndTime = now.Add(10 * time.Second) // Combo effect lasts 10 seconds or until consumed
			if w.OnEvent != nil {
				w.OnEvent("combo", map[string]interface{}{
					"playerID":  player.ID,
					"comboID":   combo.ID,
					"comboName": combo.Name,
				})
			}
		}
	}

	// Record this skill for combo tracking (after checking, so we don't self-combo)
	player.LastSkillUsed = skillName
	player.LastSkillTime = now

	// Class Specific Logic
	switch player.SubType {
	case "Fighter":
		w.performFighterAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	case "Wizard":
		w.performWizardAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	case "Rogue":
		w.performRogueAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	case "Cleric":
		w.performClericAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	}
}

func (w *World) PerformSelectBranch(playerID, branch string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Allow switching branches freely
	if branch != "A" && branch != "B" && branch != "C" {
		return nil, false
	}

	player.SelectedBranch = branch

	// Update unlocked skills based on level
	w.UpdateUnlockedSkills(player)

	return player, true
}

func (w *World) UpdateUnlockedSkills(player *Entity) {
	if player.SelectedBranch == "" {
		return
	}

	allSkills := getSkillsForBranch(player.SubType, player.SelectedBranch)
	var unlocked []string

	for _, skill := range allSkills {
		reqLevel := 1
		switch skill {
		// Fighter
		case "Whirlwind", "Sweeping Strike", "Berserker Edge":
			reqLevel = 10
		case "Shield Slam", "Earthshaker", "Shattering Charge":
			reqLevel = 20
		case "Iron Fortress", "Unbreakable Grip", "Executioner Spin":
			reqLevel = 30
		case "Guardian Roar", "Juggernaut Charge", "Last Stand Rampage":
			reqLevel = 40

		// Rogue
		case "Backstab", "Fan of Knives", "Smoke Bomb":
			reqLevel = 10
		case "Weak Point Mark", "Serrated Edges", "Poison Coating":
			reqLevel = 20
		case "Shadow Lunge", "Blade Storm", "Tripwire":
			reqLevel = 30
		case "Death Spiral", "Phantom Volley", "Cloak & Vanish":
			reqLevel = 40

		// Wizard
		case "Flame Whip", "Scorch Beam", "Teleport":
			reqLevel = 10
		case "Flame Tornado", "Arcane Missiles", "Arcane Shield":
			reqLevel = 20
		case "Meteor Drop", "Spell Focus", "Gravity Well":
			reqLevel = 30
		case "Inferno Cataclysm", "Dragonfire Lance", "Time Warp":
			reqLevel = 40

		// Cleric
		case "Healing Light", "Radiant Strike", "Blessing of Resolve":
			reqLevel = 10
		case "Guardian Embrace", "Consecrated Ground", "Blessing of Zeal":
			reqLevel = 20
		case "Purifying Wave", "Spirit Guardians Boost", "Mark of Weakness":
			reqLevel = 30
		case "Divine Intervention", "Avenging Seraph", "Heaven's Trumpet":
			reqLevel = 40
		}

		if player.Level >= reqLevel {
			unlocked = append(unlocked, skill)
		}
	}
	player.UnlockedSkills = unlocked
}

func getSkillsForBranch(classType, branch string) []string {
	var skills []string

	switch classType {
	case "Fighter":
		skills = append(skills, "Charge") // Base
		if branch == "A" {
			skills = append(skills, "Whirlwind", "Shield Slam", "Iron Fortress", "Guardian Roar")
		} else if branch == "B" {
			skills = append(skills, "Sweeping Strike", "Earthshaker", "Unbreakable Grip", "Juggernaut Charge")
		} else if branch == "C" {
			skills = append(skills, "Berserker Edge", "Shattering Charge", "Executioner Spin", "Last Stand Rampage")
		}
	case "Rogue":
		skills = append(skills, "Piercing Throw") // Base
		if branch == "A" {
			skills = append(skills, "Backstab", "Weak Point Mark", "Shadow Lunge", "Death Spiral")
		} else if branch == "B" {
			skills = append(skills, "Fan of Knives", "Serrated Edges", "Blade Storm", "Phantom Volley")
		} else if branch == "C" {
			skills = append(skills, "Smoke Bomb", "Poison Coating", "Tripwire", "Cloak & Vanish")
		}
	case "Wizard":
		skills = append(skills, "Fireball") // Base
		if branch == "A" {
			skills = append(skills, "Flame Whip", "Flame Tornado", "Meteor Drop", "Inferno Cataclysm")
		} else if branch == "B" {
			skills = append(skills, "Scorch Beam", "Arcane Missiles", "Spell Focus", "Dragonfire Lance")
		} else if branch == "C" {
			skills = append(skills, "Teleport", "Arcane Shield", "Gravity Well", "Time Warp")
		}
	case "Cleric":
		skills = append(skills, "Spirit Guardians") // Base
		if branch == "A" {
			skills = append(skills, "Healing Light", "Guardian Embrace", "Purifying Wave", "Divine Intervention")
		} else if branch == "B" {
			skills = append(skills, "Radiant Strike", "Consecrated Ground", "Spirit Guardians Boost", "Avenging Seraph")
		} else if branch == "C" {
			skills = append(skills, "Blessing of Resolve", "Blessing of Zeal", "Mark of Weakness", "Heaven's Trumpet")
		}
	}
	return skills
}

func (w *World) PerformUnlockSkill(playerID, skillName string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	if player.SkillPoints <= 0 {
		return nil, false
	}

	// Check if already unlocked
	for _, s := range player.UnlockedSkills {
		if s == skillName {
			return nil, false
		}
	}

	player.SkillPoints--
	player.UnlockedSkills = append(player.UnlockedSkills, skillName)
	return player, true
}

func (w *World) handleDeath(target *Entity, attacker *Entity, deferred *deferredActions) {
	// Prevent destruction of static objects
	if target.Type == TypeForge || target.Type == TypeStash {
		target.Health = target.MaxHealth
		return
	}

	if target.State == "DEAD" {
		return
	}

	target.Health = 0
	target.State = "DEAD"
	target.LastAttackTime = time.Now()

	// === ON-KILL EFFECTS (Unique Effects & Set Bonuses) ===
	if attacker != nil && attacker.Type == TypePlayer && target.Type == TypeEnemy {
		// Unique Effect: vampiric - Restore 5% max HP on kill
		if attacker.HasUniqueEffect("vampiric") {
			healAmount := applyHealingDoneBonus(attacker, attacker.MaxHealth/20) // 5%
			attacker.Health += healAmount
			if attacker.Health > attacker.MaxHealth {
				attacker.Health = attacker.MaxHealth
			}
		}

		// Unique Effect: explosive - AoE damage on kill (15% of attacker's damage in 5 unit radius)
		if attacker.HasUniqueEffect("explosive") {
			explosionDamage := attacker.Damage * 15 / 100
			if explosionDamage < 1 {
				explosionDamage = 1
			}
			// Find nearby enemies (not the target itself)
			nearbyTargets := w.Grid.Nearby(target.X, target.Z, 5.0, target.InstanceID)
			for _, nearby := range nearbyTargets {
				if nearby.ID == target.ID || nearby.Type != TypeEnemy || nearby.State == "DEAD" {
					continue
				}
				nearby.Mu.Lock()
				nearby.Health -= explosionDamage
				if nearby.Health <= 0 {
					nearby.Mu.Unlock()
					w.handleDeath(nearby, attacker, deferred) // Recursive, could chain explosions!
				} else {
					nearby.Mu.Unlock()
				}
			}
		}

		// Set Bonus: Warlord's Fury 4pc (chargeReset) - Reset Charge cooldown on kill
		if attacker.HasAnySetBonus("chargeReset") {
			if attacker.Cooldowns != nil {
				delete(attacker.Cooldowns, "Charge")
			}
		}

		// Set Bonus: Inferno's Heart 6pc (meteorReset) - Fire kill resets Meteor CD
		// Note: This should only trigger on fire damage kills, but we track it simply here
		if attacker.HasAnySetBonus("meteorReset") {
			if attacker.Cooldowns != nil {
				delete(attacker.Cooldowns, "Meteor Drop")
			}
		}
	}

	if attacker != nil && attacker.Type == TypePlayer && target.Type == TypeEnemy {
		// Capture data for async processing to avoid deadlocks
		tLevel := target.Level
		tSubType := target.SubType
		tID := target.ID
		tX, tZ := target.X, target.Z
		tInstanceID := target.InstanceID

		go func() {
			// Get difficulty multipliers and current dungeon completion state for dungeon enemies
			instanceDifficulty := w.GetInstanceDifficulty(tInstanceID)
			instanceType := w.GetInstanceType(tInstanceID)
			runLevel := 0
			roomsCleared := 0
			eliteRoomsCleared := 0
			totalRooms := 0
			totalEliteRooms := 0
			if tInstanceID != "" {
				w.Mu.RLock()
				if inst, ok := w.InstanceLayouts[tInstanceID]; ok {
					runLevel = inst.RunLevel
					for idx, layoutRoom := range inst.Layout.Rooms {
						if layoutRoom.Type == "start" {
							continue
						}
						totalRooms++
						if layoutRoom.Type == "elite" {
							totalEliteRooms++
						}
						if inst.RoomState != nil && idx < len(inst.RoomState.Rooms) && inst.RoomState.Rooms[idx].Cleared {
							roomsCleared++
							if layoutRoom.Type == "elite" {
								eliteRoomsCleared++
							}
						}
					}
				}
				w.Mu.RUnlock()
			}
			_, _, lootMult, xpMult := DifficultyMultipliers(instanceDifficulty)

			// XP - Base XP scales with level
			baseXpReward := tLevel*10 + 10

			// Water Realm enemies (Lv 50-70)
			if tSubType == "InfernoTitan" {
				baseXpReward *= 3
			}
			if tSubType == "Siren" {
				baseXpReward *= 3
			}
			if tSubType == "FrostGuardian" {
				baseXpReward *= 3
			}
			if tSubType == "MountainTroll" {
				baseXpReward *= 2
			}
			if tSubType == "AquaGolem" {
				baseXpReward *= 2
			}

			// Fire Realm enemies (Lv 70-95) - Higher XP multipliers
			if tSubType == "SandstormDjinn" {
				baseXpReward *= 4
			}
			if tSubType == "MagmaGolem" {
				baseXpReward *= 5
			}
			if tSubType == "ScorchedWraith" {
				baseXpReward *= 6
			}
			if tSubType == "InfernalBehemoth" {
				baseXpReward *= 7
			}
			if tSubType == "PhoenixSentinel" {
				baseXpReward *= 8
			}

			// Air Realm enemies (Lv 70-95) - Higher XP multipliers
			if tSubType == "StormHarpy" {
				baseXpReward *= 4
			}
			if tSubType == "CloudElemental" {
				baseXpReward *= 5
			}
			if tSubType == "ThunderRoc" {
				baseXpReward *= 6
			}
			if tSubType == "TempestGiant" {
				baseXpReward *= 7
			}
			if tSubType == "CycloneAvatar" {
				baseXpReward *= 8
			}

			// Gold
			baseGold := 0
			if tLevel > 0 {
				baseGold = rand.Intn(tLevel*10) + 10
			}

			// Boss Check
			isBoss := false
			bosses := []string{
				"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel", "AvengingSeraph",
				"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax",
				"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion",
				"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath",
			}
			for _, b := range bosses {
				if tSubType == b {
					isBoss = true
					break
				}
			}

			if isBoss {
				log.Printf("Boss Death Detected: %s. Attacker: %s. PartyID: %s", tSubType, attacker.ID, attacker.PartyID)
			}

			// Dungeon Boss Check
			isDungeonBoss := false
			dungeonBosses := []string{
				"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel",
				"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax",
				"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion",
				"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath",
			}
			for _, b := range dungeonBosses {
				if tSubType == b {
					isDungeonBoss = true
					break
				}
			}

			// Loot
			// Check if Elite
			isElite := strings.HasPrefix(tID, "elite-")

			// 1. Equipment Loot
			dropCount := 0
			if isElite {
				dropCount = 3 // Elites drop 3 items guaranteed
			} else if rand.Float64() < 0.5 && tLevel > 0 {
				dropCount = 1 // Normal enemies have 50% chance for 1 item
			}

			var lootItems []*Item

			if dropCount > 0 {
				for i := 0; i < dropCount; i++ {
					if isElite {
						lootItems = append(lootItems, GenerateEliteLoot(tLevel))
					} else {
						lootItems = append(lootItems, GenerateLoot(tLevel))
					}
				}
			}

			// 2. Shard/Heart Loot (Eidolic)
			eidolicLoot := GenerateShardLoot(isElite)
			lootItems = append(lootItems, eidolicLoot...)

			// 3. Gem Loot - 10% base chance (30% for elites)
			gemChance := 0.10
			if isElite {
				gemChance = 0.30
			}
			if rand.Float64() < gemChance {
				// Quality still scales with level, but gems can now drop at any level.
				gem := GenerateRandomGemByLevel(tLevel, isElite)
				lootItems = append(lootItems, gem)
			}

			// Party Logic
			var partyMembers []*Entity

			// We need to access Party, which requires w.Mu.RLock via GetParty
			// Since we are in a goroutine and not holding any locks, this is safe.
			if attacker.PartyID != "" {
				party := w.GetParty(attacker.PartyID)
				if party != nil {
					_, _, memberIDs := party.GetSnapshot()
					for _, mid := range memberIDs {
						member := w.GetEntity(mid)
						if member != nil {
							// Check distance (e.g., 200 units) to share XP
							dx := member.X - tX
							dz := member.Z - tZ
							if math.Sqrt(dx*dx+dz*dz) <= 200.0 {
								partyMembers = append(partyMembers, member)
							}
						}
					}
				}
			}

			if len(partyMembers) > 0 {
				// Calculate Bonus
				bonusMultiplier := 1.0 + (float64(len(partyMembers)) * 0.10)
				// Apply difficulty multipliers
				totalXP := int(float64(baseXpReward) * bonusMultiplier * xpMult)
				totalGold := int(float64(baseGold) * bonusMultiplier * lootMult)

				xpPerMember := totalXP / len(partyMembers)
				goldPerMember := totalGold / len(partyMembers)

				if isBoss {
					xpPerMember += 2000000
				}

				for _, member := range partyMembers {
					member.Mu.Lock()
					member.Experience += xpPerMember
					member.Gold += goldPerMember
					memberRewardItemCount := 0
					memberRewardGemCount := 0

					// Update Quests for all party members
					w.UpdateQuestProgress(member, tSubType)
					if isDungeonBoss {
						w.UpdateQuestProgress(member, "DungeonBoss")
						if instanceDifficulty == DifficultyHeroic {
							w.UpdateQuestProgress(member, "DungeonBossHeroic")
						} else if instanceDifficulty == DifficultyMythic {
							w.UpdateQuestProgress(member, "DungeonBossMythic")
						}

						switch instanceType {
						case "verdant_bastion_catacombs":
							w.UpdateQuestProgress(member, "VerdantBastionBoss")
						case "molten_core":
							w.UpdateQuestProgress(member, "MoltenCoreBoss")
						case "tempest_spire":
							w.UpdateQuestProgress(member, "TempestSpireBoss")
						case "abyssal_well":
							w.UpdateQuestProgress(member, "AbyssalWellBoss")
						}
					}

					// Level Up Logic
					if member.MaxExperience == 0 {
						member.MaxExperience = 100
					}
					for member.Experience >= member.MaxExperience {
						if member.Level >= 100 {
							member.Experience = member.MaxExperience
							break
						}
						member.Experience -= member.MaxExperience
						member.Level++
						member.MaxExperience = int(100 * math.Pow(1.2, float64(member.Level-1)))
						member.recomputeTalentPoints()

						// Update Unlocked Skills
						w.UpdateUnlockedSkills(member)

						member.BaseStats.Vitality += 2
						member.BaseStats.Strength += 2
						member.BaseStats.Dexterity += 1
						member.BaseStats.Intelligence += 1
						member.BaseStats.Wisdom += 1

						member.RecalculateStats()
						member.Health = member.MaxHealth
					}

					heartCount := 0
					if isBoss {
						hearts := GenerateBossHearts()
						heartCount = len(hearts)
						log.Printf("Party Boss Loot: Generated %d hearts for member %s", len(hearts), member.ID)
						for _, heart := range hearts {
							rem := member.AddItemToInventory(*heart)
							if rem > 0 {
								log.Printf("Party Boss Loot: Inventory full for %s. Remaining: %d", member.ID, rem)
							}
						}
					}

					memberID := member.ID
					rewardSummary := RewardSummaryEvent{}
					hasRewardSummary := false
					if isBoss {
						rewardSummary = buildBossRewardSummary(memberID, tSubType, instanceType, instanceDifficulty, runLevel, roomsCleared, eliteRoomsCleared, totalRooms, totalEliteRooms, goldPerMember, xpPerMember, heartCount, nil)
						if memberRewardItemCount > 0 {
							rewardSummary.ItemCount = memberRewardItemCount
						}
						if memberRewardGemCount > 0 {
							rewardSummary.GemCount = memberRewardGemCount
						}
						hasRewardSummary = true
					}

					member.Mu.Unlock()

					if isBoss && w.OnEvent != nil {
						go func(pid string, summary RewardSummaryEvent, sendSummary bool) {
							w.OnEvent("inventory_update", pid)
							if sendSummary {
								w.OnEvent("reward_summary", summary)
							}
						}(memberID, rewardSummary, hasRewardSummary)
					}
				}
			} else {
				// Solo Logic
				attacker.Mu.Lock()

				// Apply difficulty multipliers
				finalXp := int(float64(baseXpReward) * xpMult)
				if isBoss {
					finalXp += 2000000
				}
				finalGold := int(float64(baseGold) * lootMult)

				attacker.Experience += finalXp
				attacker.Gold += finalGold
				attackerRewardItemCount := 0
				attackerRewardGemCount := 0
				if attacker.MaxExperience == 0 {
					attacker.MaxExperience = 100
				}

				// Update Quests
				w.UpdateQuestProgress(attacker, tSubType)
				if isDungeonBoss {
					w.UpdateQuestProgress(attacker, "DungeonBoss")
					if instanceDifficulty == DifficultyHeroic {
						w.UpdateQuestProgress(attacker, "DungeonBossHeroic")
					} else if instanceDifficulty == DifficultyMythic {
						w.UpdateQuestProgress(attacker, "DungeonBossMythic")
					}

					switch instanceType {
					case "verdant_bastion_catacombs":
						w.UpdateQuestProgress(attacker, "VerdantBastionBoss")
					case "molten_core":
						w.UpdateQuestProgress(attacker, "MoltenCoreBoss")
					case "tempest_spire":
						w.UpdateQuestProgress(attacker, "TempestSpireBoss")
					case "abyssal_well":
						w.UpdateQuestProgress(attacker, "AbyssalWellBoss")
					}
				}

				for attacker.Experience >= attacker.MaxExperience {
					if attacker.Level >= 100 {
						attacker.Experience = attacker.MaxExperience
						break
					}
					attacker.Experience -= attacker.MaxExperience
					attacker.Level++
					// Exponential Curve: 100 * (1.2 ^ (Level-1))
					attacker.MaxExperience = int(100 * math.Pow(1.2, float64(attacker.Level-1)))
					attacker.recomputeTalentPoints()

					// Update Unlocked Skills
					w.UpdateUnlockedSkills(attacker)

					// Update Base Stats
					attacker.BaseStats.Vitality += 2
					attacker.BaseStats.Strength += 2
					attacker.BaseStats.Dexterity += 1
					attacker.BaseStats.Intelligence += 1
					attacker.BaseStats.Wisdom += 1

					attacker.RecalculateStats()
					attacker.Health = attacker.MaxHealth
				}

				heartCount := 0
				if isBoss {
					hearts := GenerateBossHearts()
					heartCount = len(hearts)
					log.Printf("Solo Boss Loot: Generated %d hearts for %s", len(hearts), attacker.ID)
					for _, heart := range hearts {
						rem := attacker.AddItemToInventory(*heart)
						if rem > 0 {
							log.Printf("Solo Boss Loot: Inventory full for %s. Remaining: %d", attacker.ID, rem)
						}
					}
				}

				attackerID := attacker.ID
				rewardSummary := RewardSummaryEvent{}
				hasRewardSummary := false
				if isBoss {
					rewardSummary = buildBossRewardSummary(attackerID, tSubType, instanceType, instanceDifficulty, runLevel, roomsCleared, eliteRoomsCleared, totalRooms, totalEliteRooms, finalGold, finalXp, heartCount, nil)
					if attackerRewardItemCount > 0 {
						rewardSummary.ItemCount = attackerRewardItemCount
					}
					if attackerRewardGemCount > 0 {
						rewardSummary.GemCount = attackerRewardGemCount
					}
					hasRewardSummary = true
				}

				attacker.Mu.Unlock()

				if isBoss && w.OnEvent != nil {
					go func(pid string, summary RewardSummaryEvent, sendSummary bool) {
						w.OnEvent("inventory_update", pid)
						if sendSummary {
							w.OnEvent("reward_summary", summary)
						}
					}(attackerID, rewardSummary, hasRewardSummary)
				}
			}

			if len(lootItems) > 0 {
				w.Mu.Lock() // Lock world to add entities
				for i, item := range lootItems {
					if item == nil {
						continue
					}
					// Offset loot slightly so they don't stack perfectly
					offsetX := (rand.Float64() - 0.5) * 1.0
					offsetZ := (rand.Float64() - 0.5) * 1.0

					lootEntity := &Entity{
						ID:       fmt.Sprintf("loot-%d-%d", time.Now().UnixNano(), i),
						Type:     TypeLoot,
						X:        tX + offsetX,
						Y:        0.5,
						Z:        tZ + offsetZ,
						LootItem: item,
						LootTime: time.Now(),
					}

					// Always add directly since we are async
					w.Entities[lootEntity.ID] = lootEntity
					w.Grid.Add(lootEntity)
				}
				w.Mu.Unlock()
			}
		}()

	}
}

func (w *World) GetState() map[string]*Entity {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	// Return a copy or the map itself?
	// For JSON marshaling, we can just return the map, but need to be careful about concurrency during marshal
	// So we copy.
	state := make(map[string]*Entity, len(w.Entities))
	for k, v := range w.Entities {
		// Shallow copy of entity struct is fine for now
		// Manual copy to avoid copying mutex
		e := Entity{
			ID:                v.ID,
			Name:              v.Name,
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
			Gold:              v.Gold,
			LastDailyQuest:    v.LastDailyQuest,
			SkillPoints:       v.SkillPoints,
			SelectedBranch:    v.SelectedBranch,
			UnlockedSkills:    v.UnlockedSkills,
			BaseStats:         v.BaseStats,
			Stats:             v.Stats,
			Damage:            v.Damage,
			Defense:           v.Defense,
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
			LastAttackTime:    v.LastAttackTime,
			AttackCooldown:    v.AttackCooldown,
			LastAbilityTime:   v.LastAbilityTime,
			AbilityCooldown:   v.AbilityCooldown,
			LastRespawnTime:   v.LastRespawnTime,
			LootItem:          v.LootItem,
			LootTime:          v.LootTime,
			CreatedAt:         v.CreatedAt,
			OwnerID:           v.OwnerID,
			VelX:              v.VelX,
			VelZ:              v.VelZ,
			Radius:            v.Radius,
			SpiritsActive:     v.SpiritsActive,
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

	// Query Grid
	nearby := w.Grid.Nearby(player.X, player.Z, viewDistance, player.InstanceID)

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
		if v.InstanceID != player.InstanceID {
			log.Printf("CRITICAL: GetStateForPlayer LEAK! Player %s (Inst: %s) sees %s (Inst: %s)", playerID, player.InstanceID, v.ID, v.InstanceID)
			continue
		}
		// Precise distance check using squared distance (avoids sqrt)
		dx := v.X - player.X
		dz := v.Z - player.Z
		distSq := dx*dx + dz*dz

		if distSq <= viewDistSq {
			state[v.ID] = w.copyEntity(v)
		}
	}
	return state
}

func (w *World) copyEntity(v *Entity) *Entity {
	// Optimized: Only copy essential fields based on entity type
	// Enemies don't need inventory, stash, equipment details, etc.
	// This significantly reduces JSON payload size for state broadcasts

	e := Entity{
		ID:         v.ID,
		InstanceID: v.InstanceID,
		Name:       v.Name,
		Type:       v.Type,
		SubType:    v.SubType,
		X:          v.X,
		Y:          v.Y,
		Z:          v.Z,
		Rotation:   v.Rotation,
		Health:     v.Health,
		MaxHealth:  v.MaxHealth,
		Level:      v.Level,
		State:      v.State,
		Scale:      v.Scale,
	}

	// Add type-specific fields
	switch v.Type {
	case TypePlayer:
		// Players need full stats and equipment for UI
		e.Mana = v.Mana
		e.MaxMana = v.MaxMana
		e.Experience = v.Experience
		e.MaxExperience = v.MaxExperience
		e.Gold = v.Gold
		e.SkillPoints = v.SkillPoints
		e.SelectedBranch = v.SelectedBranch
		e.UnlockedSkills = v.UnlockedSkills
		e.TalentPoints = v.TalentPoints
		if v.TalentRanks != nil {
			newRanks := make(map[string]int, len(v.TalentRanks))
			for k, r := range v.TalentRanks {
				newRanks[k] = r
			}
			e.TalentRanks = newRanks
		}
		e.BaseStats = v.BaseStats
		e.Stats = v.Stats
		e.Damage = v.Damage
		e.Defense = v.Defense
		e.Speed = v.Speed
		e.AttackSpeed = v.AttackSpeed
		e.CooldownReduction = v.CooldownReduction
		e.HpRegen = v.HpRegen
		e.ManaRegen = v.ManaRegen
		e.CastSpeed = v.CastSpeed
		e.SpiritsActive = v.SpiritsActive
		e.IsCharging = v.IsCharging
		e.ChargeTargetX = v.ChargeTargetX
		e.ChargeTargetZ = v.ChargeTargetZ
		if len(v.Equipment) > 0 {
			newEquip := make(map[string]Item, len(v.Equipment))
			for slot, item := range v.Equipment {
				newItem := item
				newItem.Description = "" // Strip description to save bandwidth
				newEquip[slot] = newItem
			}
			e.Equipment = newEquip
		}
	case TypeEnemy:
		// Enemies only need combat-relevant stats
		e.Damage = v.Damage
		e.AttackSpeed = v.AttackSpeed
		e.IsCharging = v.IsCharging
	case TypeProjectile:
		// Projectiles need velocity and owner
		e.OwnerID = v.OwnerID
		e.VelX = v.VelX
		e.VelZ = v.VelZ
		e.Radius = v.Radius
	case TypeLoot:
		// Loot needs item info
		e.LootItem = v.LootItem
	}

	return &e
}

func (e *Entity) AddItemToInventory(item Item) int {
	remaining := item.Stack
	// 1. Try to stack
	if item.MaxStack > 1 {
		for i := range e.Inventory {
			if e.Inventory[i].ID != "" && e.Inventory[i].Name == item.Name {
				// Self-heal: Update MaxStack from incoming item if it's better (fixes old items)
				if item.MaxStack > e.Inventory[i].MaxStack {
					e.Inventory[i].MaxStack = item.MaxStack
				}

				// Self-heal: Update Icon if missing
				if e.Inventory[i].Icon == "" && item.Icon != "" {
					e.Inventory[i].Icon = item.Icon
				}

				if e.Inventory[i].Stack < e.Inventory[i].MaxStack {
					space := e.Inventory[i].MaxStack - e.Inventory[i].Stack
					if space >= remaining {
						e.Inventory[i].Stack += remaining
						return 0
					} else {
						e.Inventory[i].Stack += space
						remaining -= space
					}
				}
			}
		}
	}

	// 2. Add remaining as new item
	if remaining > 0 {
		// Find first empty slot
		for i := range e.Inventory {
			if e.Inventory[i].ID == "" {
				newItem := item
				newItem.Stack = remaining
				e.Inventory[i] = newItem
				return 0
			}
		}
		return remaining // Inventory full
	}
	return 0
}

func (e *Entity) AddItemToStash(item Item) int {
	remaining := item.Stack
	// 1. Try to stack
	if item.MaxStack > 1 {
		for i := range e.Stash {
			if e.Stash[i].Name == item.Name {
				// Self-heal: Update MaxStack from incoming item if it's better
				if item.MaxStack > e.Stash[i].MaxStack {
					e.Stash[i].MaxStack = item.MaxStack
				}

				// Self-heal: Update Icon if missing
				if e.Stash[i].Icon == "" && item.Icon != "" {
					e.Stash[i].Icon = item.Icon
				}

				if e.Stash[i].Stack < e.Stash[i].MaxStack {
					space := e.Stash[i].MaxStack - e.Stash[i].Stack
					if space >= remaining {
						e.Stash[i].Stack += remaining
						return 0
					} else {
						e.Stash[i].Stack += space
						remaining -= space
					}
				}
			}
		}
	}

	// 2. Add remaining as new item
	if remaining > 0 {
		if len(e.Stash) < MaxStashSize {
			newItem := item
			newItem.Stack = remaining
			e.Stash = append(e.Stash, newItem)
			return 0
		}
		return remaining // Stash full
	}
	return 0
}

func (e *Entity) RecalculateStats() {
	// Start with Base Stats
	totalStr := e.BaseStats.Strength
	totalDex := e.BaseStats.Dexterity
	totalInt := e.BaseStats.Intelligence
	totalWis := e.BaseStats.Wisdom
	totalVit := e.BaseStats.Vitality

	flatDamage := 0
	flatDefense := 0
	pctArmor := 0.0
	pctMaxHealthFromSets := 0.0
	pctCritChance := 0.0
	pctPoisonDamage := 0.0
	pctFireDamage := 0.0
	pctCdr := 0.0
	pctHealingDone := 0.0
	pctHolyDamage := 0.0
	pctManaRegen := 0.0
	pctMoveSpeed := 0.0
	pctAllResist := 0.0
	pctLifesteal := 0.0

	applyItemStats := func(stats map[string]int) {
		for stat, value := range stats {
			switch stat {
			case "strength":
				totalStr += value
			case "dexterity":
				totalDex += value
			case "intelligence":
				totalInt += value
			case "wisdom":
				totalWis += value
			case "vitality":
				totalVit += value
			case "damage":
				flatDamage += value
			case "defense":
				flatDefense += value
			case "critChance":
				pctCritChance += float64(value) / 100.0
			case "poisonDamage":
				pctPoisonDamage += float64(value) / 100.0
			case "fireDamage":
				pctFireDamage += float64(value) / 100.0
			case "cdr":
				pctCdr += float64(value) / 100.0
			case "manaRegen":
				pctManaRegen += float64(value) / 100.0
			case "healingDone":
				pctHealingDone += float64(value) / 100.0
			case "holyDamage":
				pctHolyDamage += float64(value) / 100.0
			case "moveSpeed":
				pctMoveSpeed += float64(value) / 100.0
			case "allResist":
				pctAllResist += float64(value) / 100.0
			case "lifesteal":
				pctLifesteal += float64(value) / 100.0
			}
		}
	}

	// Add Equipment Stats
	for _, item := range e.Equipment {
		applyItemStats(item.Stats)
		for _, gem := range item.Gems {
			applyItemStats(gem.Stats)
		}
	}

	// Calculate and Apply Set Bonuses
	e.ActiveSetBonuses = CalculateSetBonuses(e.Equipment)

	for _, bonuses := range e.ActiveSetBonuses {
		for bonusKey, value := range bonuses {
			switch bonusKey {
			case "armor":
				pctArmor += float64(value) / 100.0
			case "maxHealth":
				pctMaxHealthFromSets += float64(value) / 100.0
			case "critChance":
				pctCritChance += float64(value) / 100.0
			case "poisonDamage":
				pctPoisonDamage += float64(value) / 100.0
			case "fireDamage":
				pctFireDamage += float64(value) / 100.0
			case "cdr":
				pctCdr += float64(value) / 100.0
			case "healingDone":
				pctHealingDone += float64(value) / 100.0
			case "holyDamage":
				pctHolyDamage += float64(value) / 100.0
				// Special set bonuses are handled in combat logic, not stats:
				// chargeReset, ironFortressDamage, damageReflect, bossTaunt,
				// backstabAnyAngle, phantomVolleyDouble, poisonSpread, deathSpiralConsume,
				// fireballPierce, meteorReset, teleportCharges, timeWarpZone,
				// spiritGuardiansHeal, divineInterventionCD, radiantStrikeLifesteal, permanentSeraph
			}
		}
	}

	// Collect Active Unique Effects from equipment
	e.ActiveUniqueEffects = nil
	for _, item := range e.Equipment {
		if item.UniqueEffect != "" {
			e.ActiveUniqueEffects = append(e.ActiveUniqueEffects, item.UniqueEffect)
		}
	}

	// Apply Passive Talents (server-authoritative)
	if e.Type == TypePlayer {
		pctMaxHealth := 0.0
		pctDamage := 0.0
		pctSpeed := 0.0
		addCdr := 0.0
		for tid, rank := range e.TalentRanks {
			if rank <= 0 {
				continue
			}
			def, ok := talentDefForID(e.SubType, tid)
			if !ok {
				continue
			}
			if rank > def.MaxRank {
				rank = def.MaxRank
			}
			b := def.PerRank
			totalStr += b.FlatStrength * rank
			totalDex += b.FlatDexterity * rank
			totalInt += b.FlatIntelligence * rank
			totalWis += b.FlatWisdom * rank
			totalVit += b.FlatVitality * rank
			flatDamage += b.FlatDamage * rank
			flatDefense += b.FlatDefense * rank
			pctMaxHealth += b.PctMaxHealth * float64(rank)
			pctDamage += b.PctDamage * float64(rank)
			pctSpeed += b.PctSpeed * float64(rank)
			addCdr += b.AddCdr * float64(rank)
		}

		// Recompute talent points whenever we recalc stats (keeps it consistent after level-ups)
		e.recomputeTalentPoints()

		// Derived multipliers applied later after base derived values are computed.
		// Store as temporary on stack via closures below.
		_ = pctMaxHealth
		_ = pctDamage
		_ = pctSpeed
		_ = addCdr
		// Apply after derived stats calculation (see below).
		defer func() {
			// Talent bonuses
			if pctMaxHealth != 0 {
				e.MaxHealth = int(float64(e.MaxHealth) * (1.0 + pctMaxHealth))
			}
			if pctDamage != 0 {
				e.Damage = int(float64(e.Damage) * (1.0 + pctDamage))
			}
			if pctSpeed != 0 {
				e.Speed = e.Speed * (1.0 + pctSpeed)
			}
			if addCdr != 0 {
				e.CooldownReduction = math.Min(0.5, e.CooldownReduction+addCdr)
			}

			// Set bonuses (percentage-based)
			if pctMaxHealthFromSets != 0 {
				e.MaxHealth = int(float64(e.MaxHealth) * (1.0 + pctMaxHealthFromSets))
			}
			if pctArmor != 0 {
				e.Defense = int(float64(e.Defense) * (1.0 + pctArmor))
			}
		}()
	}

	// Update Total Stats
	e.Stats = Stats{
		Strength:     totalStr,
		Dexterity:    totalDex,
		Intelligence: totalInt,
		Wisdom:       totalWis,
		Vitality:     totalVit,
	}

	// Level Bonus (Matches Client)
	levelBonus := (e.Level - 1) * 5

	// Derived Stats
	e.MaxHealth = (totalVit * 10) + levelBonus
	e.HpRegen = float64(totalVit) * 0.5

	e.MaxMana = (totalInt * 10) + levelBonus
	e.CooldownReduction = math.Min(0.5, float64(totalInt)*0.01)
	if pctCdr != 0 {
		e.CooldownReduction = math.Min(0.5, e.CooldownReduction+pctCdr)
	}

	if e.Type == TypePlayer {
		switch e.SubType {
		case "Rogue":
			e.Damage = (totalDex / 4) + flatDamage
		case "Wizard":
			e.Damage = (totalInt / 4) + flatDamage
		case "Cleric":
			e.Damage = (totalWis / 4) + flatDamage
		default: // Fighter and others
			e.Damage = (totalStr / 4) + flatDamage
		}
	} else {
		e.Damage = (totalStr * 2) + flatDamage
	}

	e.Defense = flatDefense
	if pctAllResist != 0 {
		e.Defense = int(float64(e.Defense) * (1.0 + pctAllResist))
	}

	// Speed Calculation
	e.Speed = (3.0 + (float64(totalDex) * 0.5)) * 1.2
	if pctMoveSpeed != 0 {
		e.Speed *= (1.0 + pctMoveSpeed)
	}

	// Cap Speed (Max = 3x Speed at 10 Dex)
	refDex := 10.0
	refSpeed := (3.0 + (refDex * 0.5)) * 1.2 // ~9.6
	maxSpeed := refSpeed * 3.0               // ~28.8

	if e.Speed > maxSpeed {
		e.Speed = maxSpeed
	}

	// Attack Speed (Seconds Per Attack)
	// Base 5.0s, scales down with Dex, min 1.0s
	speedMult := 1.0 + (float64(totalDex) * 0.02)
	cooldown := 5.0 / speedMult
	if cooldown < 1.0 {
		cooldown = 1.0
	}
	e.AttackSpeed = cooldown
	e.AttackCooldown = time.Duration(cooldown * float64(time.Second))

	e.ManaRegen = float64(totalWis) * 0.5
	if pctManaRegen != 0 {
		e.ManaRegen *= (1.0 + pctManaRegen)
	}
	e.CastSpeed = 1.0 + (float64(totalWis)/5.0)*0.01
	e.CritChanceBonus = pctCritChance
	e.PoisonDamageBonus = pctPoisonDamage
	e.FireDamageBonus = pctFireDamage
	e.HealingDoneBonus = pctHealingDone
	e.HolyDamageBonus = pctHolyDamage
	e.LifestealBonus = pctLifesteal
	e.AllResistBonus = pctAllResist

	if e.Mana > e.MaxMana {
		e.Mana = e.MaxMana
	}

	// Apply Buffs/Debuffs
	if e.BerserkerModeActive {
		e.Damage = int(float64(e.Damage) * 1.5)
		e.Defense = int(float64(e.Defense) * 0.8)
	}
	if e.LastStandActive {
		e.Defense = int(float64(e.Defense) * 1.5)
	}
	if e.ZealActive {
		e.Speed *= 1.2
		e.AttackSpeed /= 1.3 // Faster attacks = lower cooldown
		e.AttackCooldown = time.Duration(e.AttackSpeed * float64(time.Second))
	}
	if e.IronFortressActive {
		e.Defense = int(float64(e.Defense) * 1.5)
		e.Speed *= 0.8
	}
	if e.GuardianRoarActive {
		e.Defense = int(float64(e.Defense) * 1.2)
	}
	if e.TimeWarpActive {
		e.Speed *= 1.5
		e.AttackSpeed /= 1.5
		e.AttackCooldown = time.Duration(e.AttackSpeed * float64(time.Second))
	}
	if e.BlessingResolveActive {
		e.Defense = int(float64(e.Defense) * 1.2)
	}
	// Cloak Swift Rune: +30% movement speed while invisible
	if e.CloakSwiftSpeedBonus && e.StealthActive {
		e.Speed *= 1.3
	}
	if e.Slowed {
		e.Speed *= (1.0 - e.SlowFactor)
	}

	// Apply Unique Effect passive bonuses
	for _, effect := range e.ActiveUniqueEffects {
		switch effect {
		case "regenerative":
			// +1% HP regen per second (additive to base HpRegen)
			e.HpRegen += float64(e.MaxHealth) * 0.01
		case "guardian":
			// Above 80% HP, +20% armor
			if e.Health > int(float64(e.MaxHealth)*0.8) {
				e.Defense = int(float64(e.Defense) * 1.2)
			}
		case "berserker":
			// Below 30% HP, +30% damage (this is separate from BerserkerMode skill)
			if e.Health < int(float64(e.MaxHealth)*0.3) {
				e.Damage = int(float64(e.Damage) * 1.3)
			}
			// "efficient" reduces mana costs - handled in ability usage
			// "vampiric", "explosive" - handled on kill
			// "lucky", "executioner" - handled on hit
			// "swift" - handled on skill use
			// "thorns" - handled on damage taken
		}
	}
}

func (w *World) DropLoot(item Item, x, y float64) {
	// Create Loot Entity
	loot := &Entity{
		ID:         fmt.Sprintf("loot-%d", time.Now().UnixNano()),
		Type:       TypeLoot,
		X:          x,
		Y:          0.5,
		Z:          y,
		LootItem:   &item,
		CreatedAt:  time.Now(),
		InstanceID: "", // Loot drops in overworld by default unless specified
	}
	// If we want loot to drop in instances, we need to pass the instance ID to DropLoot
	// For now, let's assume DropLoot is only called for overworld or we need to update it.
	// Actually, DropLoot is usually called from handleDeath, which has access to the dead entity.
	// We should update DropLoot to take instanceID.
	w.AddEntity(loot)
}

func (w *World) DropLootInInstance(item Item, x, y float64, instanceID string) {
	loot := &Entity{
		ID:         fmt.Sprintf("loot-%d", time.Now().UnixNano()),
		Type:       TypeLoot,
		X:          x,
		Y:          0.5,
		Z:          y,
		LootItem:   &item,
		CreatedAt:  time.Now(),
		InstanceID: instanceID,
	}
	w.AddEntity(loot)
}

func (w *World) CreateDungeon(partyID string, dungeonType string, difficulty DungeonDifficulty, runLevel int) string {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	// Check for existing active dungeon for this party
	// DEBUG: Always create new dungeon for now to fix layout issues
	/*
		for id, inst := range w.InstanceLayouts {
			if inst.PartyID == partyID {
				// Check if expired (empty for > 5 minutes)
				if !inst.EmptySince.IsZero() && time.Since(inst.EmptySince) > 5*time.Minute {
					// Expired, delete it (cleanup will happen below or we can do it here)
					// We'll just let the new one be created and the old one will be orphaned/cleaned up
					// Actually, let's clean it up to be safe
					w.cleanupInstanceLocked(id)
				} else {
					// Valid existing dungeon
					return id
				}
			}
		}
	*/

	// Default to normal if not specified
	if difficulty == "" {
		difficulty = DifficultyNormal
	}

	instanceID := fmt.Sprintf("dungeon_%s_%d_%d", partyID, time.Now().UnixNano(), rand.Intn(10000))

	if runLevel == 0 {
		runLevel = DungeonUnlockLevel
	}

	dungeon := &DungeonInstance{
		ID:                instanceID,
		PartyID:           partyID,
		CreatedAt:         time.Now(),
		EmptySince:        time.Now(),
		Difficulty:        difficulty,
		DungeonType:       dungeonType,
		RunLevel:          runLevel,
		PlayerRoomSummary: make(map[string]DungeonRoomSummary),
	}
	buildLayout := func(generator func(string, DungeonDifficulty) DungeonLayout) DungeonLayout {
		const maxLayoutAttempts = 8
		cleanupGeneratedEntities := func() {
			toRemove := []string{}
			for id, entity := range w.Entities {
				if entity.InstanceID == instanceID {
					toRemove = append(toRemove, id)
				}
			}
			for _, id := range toRemove {
				if entity, ok := w.Entities[id]; ok {
					w.Grid.Remove(entity)
					delete(w.Entities, id)
				}
			}
		}
		var lastLayout DungeonLayout
		var lastErr error
		for attempt := 0; attempt < maxLayoutAttempts; attempt++ {
			lastLayout = generator(instanceID, difficulty)
			lastErr = ValidateDungeonLayout(lastLayout)
			if lastErr == nil {
				assignDungeonRoomHooks(&lastLayout)
				return lastLayout
			}
			cleanupGeneratedEntities()
		}
		log.Printf("CreateDungeon: failed to generate valid %s layout for instance %s after %d attempts: %v", dungeonType, instanceID, maxLayoutAttempts, lastErr)
		layout := fallbackDungeonLayout(dungeonType)
		assignDungeonRoomHooks(&layout)
		return layout
	}

	if dungeonType == "verdant_bastion_catacombs" {
		layout := buildLayout(w.generateVerdantBastionLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.InstanceLayouts[instanceID] = dungeon
	} else if dungeonType == "molten_core" {
		layout := buildLayout(w.generateMoltenCoreLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.InstanceLayouts[instanceID] = dungeon
	} else if dungeonType == "tempest_spire" {
		layout := buildLayout(w.generateTempestSpireLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.InstanceLayouts[instanceID] = dungeon
	} else if dungeonType == "abyssal_well" {
		layout := buildLayout(w.generateAbyssalWellLayout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.InstanceLayouts[instanceID] = dungeon
	} else {
		// Default Crypt
		// Generate a simple layout for the crypt too, so we have a start point
		layout := fallbackDungeonLayout(dungeonType)
		assignDungeonRoomHooks(&layout)
		dungeon.Layout = layout
		dungeon.RoomState = NewDungeonRoomState(layout)
		w.InstanceLayouts[instanceID] = dungeon

		// Spawn Dungeon Entities (Example: 20 Skeletons)
		for i := 0; i < 20; i++ {
			x := (rand.Float64() * 40) - 20
			z := (rand.Float64() * 40) - 20
			w.spawnEnemyInInstance("Skeleton", x, z, instanceID, difficulty)
		}
	}

	return instanceID
}

func (w *World) ResetDungeon(partyID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	for id, inst := range w.InstanceLayouts {
		if inst.PartyID == partyID {
			w.cleanupInstanceLocked(id)
			return
		}
	}
}

func (w *World) GetDungeonStatus(partyID string) (bool, float64) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	for _, inst := range w.InstanceLayouts {
		if inst.PartyID == partyID {
			timeLeft := 0.0
			if !inst.EmptySince.IsZero() {
				elapsed := time.Since(inst.EmptySince)
				if elapsed < 5*time.Minute {
					timeLeft = (5 * time.Minute).Seconds() - elapsed.Seconds()
				}
			}
			return true, timeLeft
		}
	}
	return false, 0
}

func (w *World) GetInstanceLayout(instanceID string) (DungeonLayout, bool) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	inst, ok := w.InstanceLayouts[instanceID]
	if !ok {
		return DungeonLayout{}, false
	}
	return inst.Layout, true
}

// GetInstanceDifficulty returns the difficulty of a dungeon instance
func (w *World) GetInstanceDifficulty(instanceID string) DungeonDifficulty {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	inst, ok := w.InstanceLayouts[instanceID]
	if !ok {
		return DifficultyNormal
	}
	return inst.Difficulty
}

// GetInstanceType returns the dungeon type of an instance
func (w *World) GetInstanceType(instanceID string) string {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	inst, ok := w.InstanceLayouts[instanceID]
	if !ok {
		return ""
	}
	return inst.DungeonType
}

func (w *World) getInstanceRunLevelUnsafe(instanceID string) int {
	inst, ok := w.InstanceLayouts[instanceID]
	if !ok || inst.RunLevel <= 0 {
		return DungeonUnlockLevel
	}
	return inst.RunLevel
}

func (w *World) GetInstanceRunLevel(instanceID string) int {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	return w.getInstanceRunLevelUnsafe(instanceID)
}

func (w *World) UpdateDungeonRoomProgress(playerID string, x, z float64) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok || player.InstanceID == "" {
		return
	}
	inst, ok := w.InstanceLayouts[player.InstanceID]
	if !ok || inst.RoomState == nil {
		return
	}
	inst.RoomState.MarkExploredAt(x, z)
	inst.PlayerRoomSummary[playerID] = inst.RoomState.Summary(x, z)
}

func (w *World) MarkDungeonRoomCleared(instanceID string, roomIndex int) {
	w.Mu.Lock()
	inst, ok := w.InstanceLayouts[instanceID]
	if !ok || inst.RoomState == nil {
		w.Mu.Unlock()
		return
	}
	if roomIndex < 0 || roomIndex >= len(inst.Layout.Rooms) || roomIndex >= len(inst.RoomState.Rooms) {
		w.Mu.Unlock()
		return
	}

	room := inst.Layout.Rooms[roomIndex]
	progress := inst.RoomState.Rooms[roomIndex]
	if progress.Cleared {
		w.Mu.Unlock()
		return
	}

	inst.RoomState.MarkRoomCleared(roomIndex)
	for playerID := range inst.PlayerRoomSummary {
		inst.PlayerRoomSummary[playerID] = inst.RoomState.Summary(0, 0)
	}
	roomsCleared := 0
	eliteRoomsCleared := 0
	totalRooms := 0
	totalEliteRooms := 0
	for idx, layoutRoom := range inst.Layout.Rooms {
		if layoutRoom.Type == "start" {
			continue
		}
		totalRooms++
		if layoutRoom.Type == "elite" {
			totalEliteRooms++
		}
		if idx < len(inst.RoomState.Rooms) && inst.RoomState.Rooms[idx].Cleared {
			roomsCleared++
			if layoutRoom.Type == "elite" {
				eliteRoomsCleared++
			}
		}
	}

	shouldReward := room.Type != "start" && room.Type != "boss" && !progress.Rewarded
	playerRewards := make([]DungeonRoomClearRewardEvent, 0)
	if shouldReward {
		inst.RoomState.Rooms[roomIndex].Rewarded = true
		objectiveRoomIndex := inst.RoomState.ObjectiveRoomIndex()
		rewardScale := 1.0
		if room.Type == "elite" {
			rewardScale = 1.5
		}
		if room.Hook == "chest" {
			rewardScale += 0.35
		}
		if room.Hook == "elite_ambush" {
			rewardScale += 0.45
		}
		for _, entity := range w.Entities {
			if entity == nil || entity.Type != TypePlayer || entity.InstanceID != instanceID || entity.State == "DEAD" {
				continue
			}
			xpReward := int(float64(max(50, inst.RunLevel*10)) * rewardScale)
			goldReward := int(float64(max(25, inst.RunLevel*3)) * rewardScale)
			itemCount := 0
			gemCount := 0
			heartCount := 0
			healthRestored := 0
			manaRestored := 0
			if room.Hook == "shrine" {
				healthRestored = max(1, int(float64(entity.MaxHealth)*0.30))
				manaRestored = max(1, int(float64(entity.MaxMana)*0.30))
				entity.Health = min(entity.MaxHealth, entity.Health+healthRestored)
				entity.Mana = min(entity.MaxMana, entity.Mana+manaRestored)
				entity.SanctuaryDamageReduction = true
				entity.SanctuaryEndTime = time.Now().Add(8 * time.Second)
			}
			if room.Hook == "chest" {
				if gem := GenerateRandomGemByLevel(max(20, inst.RunLevel), false); gem != nil {
					if entity.AddItemToInventory(*gem) == 0 {
						gemCount = 1
					}
				}
			}
			if room.Hook == "elite_ambush" {
				if loot := GenerateEliteLoot(max(20, inst.RunLevel)); loot != nil {
					if entity.AddItemToInventory(*loot) == 0 {
						itemCount = 1
					}
				}
			}
			entity.Experience += xpReward
			entity.Gold += goldReward
			if entity.MaxExperience == 0 {
				entity.MaxExperience = 100
			}
			playerRewards = append(playerRewards, buildDungeonRoomClearRewardSummary(entity.ID, roomIndex, objectiveRoomIndex, goldReward, xpReward, itemCount, gemCount, heartCount, inst.DungeonType, inst.Difficulty, room.Type, room.Hook, healthRestored, manaRestored))
		}
	}
	w.Mu.Unlock()

	if w.OnEvent != nil {
		for _, reward := range playerRewards {
			w.OnEvent("room_clear_reward", reward)
		}
	}
}

func (w *World) GetDungeonRoomSummary(instanceID string, playerID string) (DungeonRoomSummary, bool) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()

	inst, ok := w.InstanceLayouts[instanceID]
	if !ok || inst.RoomState == nil {
		return DungeonRoomSummary{}, false
	}
	if summary, ok := inst.PlayerRoomSummary[playerID]; ok {
		return summary, true
	}
	return inst.RoomState.Summary(0, 0), true
}

func fallbackDungeonLayout(dungeonType string) DungeonLayout {
	startX, startZ := 0.0, 0.0
	switch dungeonType {
	case "verdant_bastion_catacombs":
		startX, startZ = 20000.0, 20000.0
	case "molten_core":
		startX, startZ = 30000.0, 20000.0
	case "tempest_spire":
		startX, startZ = 40000.0, 20000.0
	case "abyssal_well":
		startX, startZ = 50000.0, 20000.0
	}

	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: startX, Z: startZ, Width: 40, Height: 40, Type: "start"})
	return layout
}

func (w *World) generateVerdantBastionLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (e.g., 20000, 20000)
	offsetX := 20000.0
	offsetZ := 20000.0

	// Start Room
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 120, Height: 120, Type: "start", Color: 0x444444})

	// Boss Milestones
	bosses := []struct {
		Name  string
		Stats Stats
	}{
		{"RootboundWarden", Stats{Strength: 2000, Vitality: 1250000, Dexterity: 150}},
		{"BriarMatron", Stats{Strength: 2500, Vitality: 1350000, Dexterity: 200}},
		{"RustboundColossus", Stats{Strength: 3000, Vitality: 1500000, Dexterity: 250}},
		{"HollowSentinel", Stats{Strength: 3500, Vitality: 1750000, Dexterity: 300}},
	}

	currentX := offsetX
	currentZ := offsetZ

	// Use a deterministic seed based on instanceID hash if possible,
	// but for now we just use global rand since we store the layout.

	for _, boss := range bosses {
		// Generate 1-2 intermediate rooms (Reduced from 2-3 to prevent "endless" feel)
		numIntermediate := 1 + rand.Intn(2)

		// Calculate Target Z based on required spacing
		// We need enough space for the Z-shaped corridor segments to be longer than the wall offsets.
		// Room Half Height (60) + Corridor Half Width (20) = 80 offset.
		// We need vertical segment > 80.
		// Vertical segment is stepZ / 2.
		// So stepZ must be > 160.
		// Reduced from 250 to 180 to make corridors shorter and less tedious.
		stepZ := -180.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			// Move North
			nextZ := currentZ + stepZ
			// Random East/West offset (-80 to 80)
			offset := (rand.Float64() * 160) - 80
			// Avoid small offsets that cause Z-shape corner overlap in client generation
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			// Add Room
			roomType := "normal"
			if rand.Float64() < 0.3 {
				roomType = "elite"
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 100, Height: 100, Type: roomType, Color: 0x333333,
			}, canonicalDungeonCorridorWidth)

			// Spawn Mobs
			if roomType == "elite" {
				// Spawn Elite
				w.spawnEnemyInInstance("DemonOrc", nextX, nextZ, instanceID, difficulty) // Placeholder Elite
			} else {
				// Spawn Trash
				for k := 0; k < 3; k++ {
					ox := (rand.Float64() * 10) - 5
					oz := (rand.Float64() * 10) - 5
					w.spawnEnemyInInstance("Skeleton", nextX+ox, nextZ+oz, instanceID, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		// Place Boss Room
		// Re-center X slightly towards the dungeon center (20000) to keep dungeon from drifting too far
		// Pull it back 50% towards 20000.
		currentX = 20000.0 + (currentX-20000.0)*0.5
		currentZ = targetZ

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: 120, Height: 120, Type: "boss", Color: 0x222222,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss.Name, currentX, currentZ, instanceID, boss.Stats, difficulty)
	}

	return layout
}

// generateMoltenCoreLayout creates the Fire Dungeon layout (Level 80-90)
// Location: X: -2400, Z: 200 (Fire Realm)
// 5 Bosses: Cindermaw, Scorched Twins, Forgemaster Pyrax, Obsidian Guardian, Lord Infernax
func (w *World) generateMoltenCoreLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (Fire dungeon at 30000, 20000)
	offsetX := 30000.0
	offsetZ := 20000.0

	// Start Room (Lava-themed entrance)
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 140, Height: 140, Type: "start", Color: 0x8B0000})

	// Molten Core Bosses (5 bosses)
	bosses := []struct {
		Name  string
		Stats Stats
	}{
		// Boss 1: Cindermaw (Fire Elemental) - Normal: 3,000,000 HP
		{"Cindermaw", Stats{Strength: 4000, Vitality: 3000000, Dexterity: 200}},
		// Boss 2: ScorchedTwins (Duo Fight) - Actually one entity, but represents duo
		{"ScorchedTwins", Stats{Strength: 3500, Vitality: 4000000, Dexterity: 250}},
		// Boss 3: ForgemasterPyrax - Normal: 4,000,000 HP
		{"ForgemasterPyrax", Stats{Strength: 4500, Vitality: 4000000, Dexterity: 220}},
		// Boss 4: ObsidianGuardian - Normal: 5,000,000 HP
		{"ObsidianGuardian", Stats{Strength: 5000, Vitality: 5000000, Dexterity: 180}},
		// Boss 5: LordInfernax (Final Boss) - Normal: 8,000,000 HP
		{"LordInfernax", Stats{Strength: 6000, Vitality: 8000000, Dexterity: 300}},
	}

	currentX := offsetX
	currentZ := offsetZ

	// Fire-themed trash mobs for the dungeon
	fireTrash := []string{"MagmaGolem", "ScorchedWraith", "InfernalBehemoth"}

	for i, boss := range bosses {
		// Generate 1-2 intermediate rooms between bosses
		numIntermediate := 1 + rand.Intn(2)
		stepZ := -200.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			nextZ := currentZ + stepZ
			offset := (rand.Float64() * 160) - 80
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			roomType := "normal"
			if rand.Float64() < 0.35 {
				roomType = "elite"
			}

			// Lava-themed room colors
			roomColor := 0x4a0000
			if roomType == "elite" {
				roomColor = 0x6a0000
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 110, Height: 110, Type: roomType, Color: roomColor,
			}, canonicalDungeonCorridorWidth)

			// Spawn Fire Realm Mobs
			if roomType == "elite" {
				// Spawn Elite fire enemy
				w.spawnFireDungeonEnemy("InfernalBehemoth", nextX, nextZ, instanceID, true, difficulty)
			} else {
				// Spawn 3-4 trash mobs
				numTrash := 3 + rand.Intn(2)
				for k := 0; k < numTrash; k++ {
					ox := (rand.Float64() * 15) - 7.5
					oz := (rand.Float64() * 15) - 7.5
					trashType := fireTrash[rand.Intn(len(fireTrash))]
					w.spawnFireDungeonEnemy(trashType, nextX+ox, nextZ+oz, instanceID, false, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		// Place Boss Room
		currentX = 30000.0 + (currentX-30000.0)*0.5
		currentZ = targetZ

		// Boss room is larger and darker
		bossRoomSize := 140.0
		if i == len(bosses)-1 {
			bossRoomSize = 180.0 // Final boss room is biggest
		}

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: bossRoomSize, Height: bossRoomSize, Type: "boss", Color: 0x2a0000,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss.Name, currentX, currentZ, instanceID, boss.Stats, difficulty)
	}

	return layout
}

// generateTempestSpireLayout creates the Air Dungeon layout (Level 80-90)
// Location: X: 2400, Z: 200 (Air Realm)
// 5 Bosses: Windshear, Stormcallers, Roc Matriarch, Thunderlord Kaelix, Zephyrion
func (w *World) generateTempestSpireLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (Air dungeon at 40000, 20000)
	offsetX := 40000.0
	offsetZ := 20000.0

	// Start Room (Storm-themed entrance)
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 140, Height: 140, Type: "start", Color: 0x1a1a4a})

	// Tempest Spire Bosses (5 bosses)
	bosses := []struct {
		Name  string
		Stats Stats
	}{
		// Boss 1: Windshear - Normal: 2,800,000 HP
		{"Windshear", Stats{Strength: 3800, Vitality: 2800000, Dexterity: 350}},
		// Boss 2: Stormcallers (Duo Fight) - Combined 3,600,000 HP
		{"Stormcallers", Stats{Strength: 3500, Vitality: 3600000, Dexterity: 280}},
		// Boss 3: RocMatriarch (Flying Boss) - Normal: 3,800,000 HP
		{"RocMatriarch", Stats{Strength: 4200, Vitality: 3800000, Dexterity: 400}},
		// Boss 4: ThunderlordKaelix - Normal: 4,800,000 HP
		{"ThunderlordKaelix", Stats{Strength: 4800, Vitality: 4800000, Dexterity: 320}},
		// Boss 5: Zephyrion (Final Boss) - Normal: 7,500,000 HP
		{"Zephyrion", Stats{Strength: 5500, Vitality: 7500000, Dexterity: 380}},
	}

	currentX := offsetX
	currentZ := offsetZ

	// Air-themed trash mobs for the dungeon
	airTrash := []string{"StormHarpy", "CloudElemental", "ThunderRoc"}

	for i, boss := range bosses {
		// Generate 1-2 intermediate rooms between bosses
		numIntermediate := 1 + rand.Intn(2)
		stepZ := -200.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			nextZ := currentZ + stepZ
			offset := (rand.Float64() * 160) - 80
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			roomType := "normal"
			if rand.Float64() < 0.35 {
				roomType = "elite"
			}

			// Storm-themed room colors
			roomColor := 0x1a1a3a
			if roomType == "elite" {
				roomColor = 0x2a2a5a
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 110, Height: 110, Type: roomType, Color: roomColor,
			}, canonicalDungeonCorridorWidth)

			// Spawn Air Realm Mobs
			if roomType == "elite" {
				// Spawn Elite air enemy
				w.spawnAirDungeonEnemy("TempestGiant", nextX, nextZ, instanceID, true, difficulty)
			} else {
				// Spawn 3-4 trash mobs
				numTrash := 3 + rand.Intn(2)
				for k := 0; k < numTrash; k++ {
					ox := (rand.Float64() * 15) - 7.5
					oz := (rand.Float64() * 15) - 7.5
					trashType := airTrash[rand.Intn(len(airTrash))]
					w.spawnAirDungeonEnemy(trashType, nextX+ox, nextZ+oz, instanceID, false, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		// Place Boss Room
		currentX = 40000.0 + (currentX-40000.0)*0.5
		currentZ = targetZ

		// Boss room is larger
		bossRoomSize := 140.0
		if i == len(bosses)-1 {
			bossRoomSize = 180.0 // Final boss room is biggest
		}

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: bossRoomSize, Height: bossRoomSize, Type: "boss", Color: 0x0a0a2a,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss.Name, currentX, currentZ, instanceID, boss.Stats, difficulty)
	}

	return layout
}

// generateAbyssalWellLayout creates the Water Dungeon layout (Level 60-70)
// Location: X: 0, Z: -1400 (Water Realm center)
// 5 Bosses: Tiderend Leviathan, Drowned Choir, Abyssal Goliath, Maelstrom Warden, Thalorath
func (w *World) generateAbyssalWellLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{},
	}

	// Offset coordinates to avoid overworld overlap (Water dungeon at 50000, 20000)
	offsetX := 50000.0
	offsetZ := 20000.0

	// Start Room (Abyssal-themed entrance)
	appendDungeonRoom(&layout, DungeonRoom{X: offsetX, Z: offsetZ, Width: 130, Height: 130, Type: "start", Color: 0x0a2a4a})

	// Abyssal Well Bosses (5 bosses)
	bosses := []struct {
		Name  string
		Stats Stats
	}{
		// Boss 1: Tiderend Leviathan - Normal: 2,600,000 HP
		{"TiderendLeviathan", Stats{Strength: 3600, Vitality: 2600000, Dexterity: 240}},
		// Boss 2: DrownedChoir (Duo Fight) - Combined 3,400,000 HP
		{"DrownedChoir", Stats{Strength: 3300, Vitality: 3400000, Dexterity: 220}},
		// Boss 3: AbyssalGoliath - Normal: 3,800,000 HP
		{"AbyssalGoliath", Stats{Strength: 4200, Vitality: 3800000, Dexterity: 200}},
		// Boss 4: MaelstromWarden - Normal: 4,500,000 HP
		{"MaelstromWarden", Stats{Strength: 4700, Vitality: 4500000, Dexterity: 260}},
		// Boss 5: Thalorath (Final Boss) - Normal: 7,000,000 HP
		{"Thalorath", Stats{Strength: 5400, Vitality: 7000000, Dexterity: 300}},
	}

	currentX := offsetX
	currentZ := offsetZ

	// Water-themed trash mobs for the dungeon
	waterTrash := []string{"AquaGolem", "Siren", "FrostGuardian"}

	for i, boss := range bosses {
		// Generate 1-2 intermediate rooms between bosses
		numIntermediate := 1 + rand.Intn(2)
		stepZ := -190.0
		targetZ := currentZ + (stepZ * float64(numIntermediate+1))

		for j := 0; j < numIntermediate; j++ {
			nextZ := currentZ + stepZ
			offset := (rand.Float64() * 160) - 80
			if math.Abs(offset) < 45 {
				offset = 0
			}
			nextX := currentX + offset

			roomType := "normal"
			if rand.Float64() < 0.35 {
				roomType = "elite"
			}

			roomColor := 0x0a3555
			if roomType == "elite" {
				roomColor = 0x0f4466
			}

			appendDungeonRoomAndConnect(&layout, DungeonRoom{
				X: nextX, Z: nextZ, Width: 110, Height: 110, Type: roomType, Color: roomColor,
			}, canonicalDungeonCorridorWidth)

			if roomType == "elite" {
				w.spawnEnemyInInstance("FrostGuardian", nextX, nextZ, instanceID, difficulty)
			} else {
				numTrash := 3 + rand.Intn(2)
				for k := 0; k < numTrash; k++ {
					ox := (rand.Float64() * 15) - 7.5
					oz := (rand.Float64() * 15) - 7.5
					trashType := waterTrash[rand.Intn(len(waterTrash))]
					w.spawnEnemyInInstance(trashType, nextX+ox, nextZ+oz, instanceID, difficulty)
				}
			}

			currentX = nextX
			currentZ = nextZ
		}

		currentX = 50000.0 + (currentX-50000.0)*0.5
		currentZ = targetZ

		bossRoomSize := 140.0
		if i == len(bosses)-1 {
			bossRoomSize = 175.0
		}

		appendDungeonRoomAndConnect(&layout, DungeonRoom{
			X: currentX, Z: currentZ, Width: bossRoomSize, Height: bossRoomSize, Type: "boss", Color: 0x061a2a,
		}, canonicalDungeonCorridorWidth)

		w.spawnBossInInstance(boss.Name, currentX, currentZ, instanceID, boss.Stats, difficulty)
	}

	return layout
}

// spawnFireDungeonEnemy spawns a fire-themed enemy in the Molten Core dungeon
func (w *World) spawnFireDungeonEnemy(subType string, x, z float64, instanceID string, isElite bool, difficulty DungeonDifficulty) {
	// Scaled for Level 80-90 dungeon
	vitality := 200000
	strength := 6000

	if isElite {
		vitality = 300000
		strength = 8000
	}

	runLevelHealthMult, runLevelDamageMult := DungeonRunLevelStatMultipliers(w.getInstanceRunLevelUnsafe(instanceID))

	// Apply difficulty multipliers
	healthMult, damageMult, _, _ := DifficultyMultipliers(difficulty)
	vitality = int(float64(vitality) * healthMult * runLevelHealthMult)
	strength = int(float64(strength) * damageMult * runLevelDamageMult)

	enemy := &Entity{
		ID:             fmt.Sprintf("%s-%s-%d", subType, instanceID, rand.Intn(10000)),
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      Stats{Strength: strength, Vitality: vitality},
		Health:         vitality * 10,
		MaxHealth:      vitality * 10,
		Damage:         strength * 2,
		State:          "IDLE",
		Speed:          3.0,
		AttackSpeed:    2.0,
		AttackCooldown: 2 * time.Second,
		Scale:          1.2,
	}
	w.Entities[enemy.ID] = enemy
	w.Grid.Add(enemy)
}

// spawnAirDungeonEnemy spawns an air-themed enemy in the Tempest Spire dungeon
func (w *World) spawnAirDungeonEnemy(subType string, x, z float64, instanceID string, isElite bool, difficulty DungeonDifficulty) {
	// Scaled for Level 80-90 dungeon
	vitality := 180000
	strength := 5500

	if isElite {
		vitality = 280000
		strength = 7500
	}

	runLevelHealthMult, runLevelDamageMult := DungeonRunLevelStatMultipliers(w.getInstanceRunLevelUnsafe(instanceID))

	// Apply difficulty multipliers
	healthMult, damageMult, _, _ := DifficultyMultipliers(difficulty)
	vitality = int(float64(vitality) * healthMult * runLevelHealthMult)
	strength = int(float64(strength) * damageMult * runLevelDamageMult)

	enemy := &Entity{
		ID:             fmt.Sprintf("%s-%s-%d", subType, instanceID, rand.Intn(10000)),
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      Stats{Strength: strength, Vitality: vitality},
		Health:         vitality * 10,
		MaxHealth:      vitality * 10,
		Damage:         strength * 2,
		State:          "IDLE",
		Speed:          3.5, // Air enemies are faster
		AttackSpeed:    1.8,
		AttackCooldown: time.Duration(1.8 * float64(time.Second)),
		Scale:          1.1,
	}
	w.Entities[enemy.ID] = enemy
	w.Grid.Add(enemy)
}

func (w *World) spawnBossInInstance(subType string, x, z float64, instanceID string, stats Stats, difficulty DungeonDifficulty) {
	runLevelHealthMult, runLevelDamageMult := DungeonRunLevelStatMultipliers(w.getInstanceRunLevelUnsafe(instanceID))

	// Apply difficulty multipliers
	healthMult, damageMult, _, _ := DifficultyMultipliers(difficulty)
	scaledStats := Stats{
		Strength:  int(float64(stats.Strength) * damageMult * runLevelDamageMult),
		Vitality:  int(float64(stats.Vitality) * healthMult * runLevelHealthMult),
		Dexterity: stats.Dexterity,
	}

	// Calculate Attack Speed
	speedMult := 1.0 + (float64(scaledStats.Dexterity) * 0.02)
	cooldown := 5.0 / speedMult
	if cooldown < 0.5 {
		cooldown = 0.5
	}

	boss := &Entity{
		ID:             fmt.Sprintf("%s-%s", subType, instanceID),
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      scaledStats,
		Health:         scaledStats.Vitality * 10,
		MaxHealth:      scaledStats.Vitality * 10,
		State:          "IDLE",
		Speed:          2.5,
		AttackSpeed:    cooldown,
		AttackCooldown: time.Duration(cooldown * float64(time.Second)),
		Scale:          4.0,
		Damage:         scaledStats.Strength * 10,
	}
	w.Entities[boss.ID] = boss
	w.Grid.Add(boss)
}

func (w *World) spawnEnemyInInstance(subType string, x, z float64, instanceID string, difficulty DungeonDifficulty) {
	// "25x normal hp"
	// Assuming "normal hp" refers to a standard enemy at the dungeon's level (Level 70).
	// If a Level 70 enemy has ~50,000 HP (5000 Vitality), then 25x is 1,250,000 HP (125,000 Vitality).

	vitality := 125000
	strength := 4000 // Scaled up damage for Level 70
	isElite := false

	if subType == "DemonOrc" {
		// Verdant elite-room placeholder until elite dungeon variants get distinct subtype plumbing.
		isElite = true
		vitality = 150000
		strength = 5000
	}

	runLevelHealthMult, runLevelDamageMult := DungeonRunLevelStatMultipliers(w.getInstanceRunLevelUnsafe(instanceID))

	// Apply difficulty multipliers
	healthMult, damageMult, _, _ := DifficultyMultipliers(difficulty)
	vitality = int(float64(vitality) * healthMult * runLevelHealthMult)
	strength = int(float64(strength) * damageMult * runLevelDamageMult)

	enemyID := fmt.Sprintf("%s-%s-%d", subType, instanceID, rand.Intn(10000))
	if isElite {
		enemyID = fmt.Sprintf("elite-%s-%s-%d", subType, instanceID, rand.Intn(10000))
	}

	enemy := &Entity{
		ID:             enemyID,
		InstanceID:     instanceID,
		Type:           TypeEnemy,
		SubType:        subType,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      Stats{Strength: strength, Vitality: vitality},
		Health:         vitality * 10,
		MaxHealth:      vitality * 10,
		Damage:         strength * 2,
		State:          "IDLE",
		Speed:          3.0,
		AttackSpeed:    2.0,
		AttackCooldown: 2 * time.Second,
		Scale:          1.0,
	}
	w.Entities[enemy.ID] = enemy
	w.Grid.Add(enemy)
}

func (w *World) EnterInstance(playerID string, instanceID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return fmt.Errorf("player not found")
	}

	w.Grid.Remove(player)

	oldInstanceID := player.InstanceID
	log.Printf("EnterInstance: Player %s moving from '%s' to '%s'", playerID, oldInstanceID, instanceID)
	player.InstanceID = instanceID

	// Set Spawn Position based on Dungeon Layout
	startX, startZ := 0.0, 0.0
	if strings.HasPrefix(instanceID, "dungeon_") {
		if inst, ok := w.InstanceLayouts[instanceID]; ok && len(inst.Layout.Rooms) > 0 {
			startX = inst.Layout.Rooms[0].X
			startZ = inst.Layout.Rooms[0].Z
		} else if inst, ok := w.InstanceLayouts[instanceID]; ok {
			fallback := fallbackDungeonLayout(inst.DungeonType)
			startX = fallback.Rooms[0].X
			startZ = fallback.Rooms[0].Z
		}
	}
	player.X = startX
	player.Z = startZ
	player.TargetX = startX
	player.TargetZ = startZ

	w.Grid.Add(player)

	// Handle Old Instance (Leaving)
	if strings.HasPrefix(oldInstanceID, "dungeon_") {
		w.checkAndResetDungeonLocked(oldInstanceID)
	}

	// Handle New Instance (Entering)
	if strings.HasPrefix(instanceID, "dungeon_") {
		if inst, ok := w.InstanceLayouts[instanceID]; ok {
			inst.EmptySince = time.Time{} // Reset empty timer
			if inst.RoomState != nil {
				inst.RoomState.MarkExploredAt(startX, startZ)
				inst.PlayerRoomSummary[playerID] = inst.RoomState.Summary(startX, startZ)
			}
		}
	}

	return nil
}

func (w *World) cleanupInstanceLocked(instanceID string) {
	delete(w.InstanceLayouts, instanceID)

	toRemove := []string{}
	for id, e := range w.Entities {
		if e.InstanceID == instanceID {
			toRemove = append(toRemove, id)
		}
	}

	for _, id := range toRemove {
		if e, ok := w.Entities[id]; ok {
			w.Grid.Remove(e)
			delete(w.Entities, id)
		}
	}
}

func (w *World) checkAndResetDungeonLocked(instanceID string) {
	// Check if any players remain
	hasPlayers := false
	for _, e := range w.Entities {
		if e.Type == TypePlayer && e.InstanceID == instanceID {
			hasPlayers = true
			break
		}
	}

	if !hasPlayers {
		// Mark as empty
		if inst, ok := w.InstanceLayouts[instanceID]; ok {
			inst.EmptySince = time.Now()
		}
	}
}

func (w *World) IsLocationInDungeon(instanceID string, x, z float64) bool {
	layout, ok := w.InstanceLayouts[instanceID]
	if !ok {
		return false
	}
	if len(layout.Layout.WalkRects) == 0 {
		if layout.Layout.Rooms == nil {
			return true // Default open dungeon
		}
		for _, r := range layout.Layout.Rooms {
			halfW := r.Width / 2
			halfH := r.Height / 2
			if x >= r.X-halfW && x <= r.X+halfW && z >= r.Z-halfH && z <= r.Z+halfH {
				return true
			}
		}
		return false
	}

	return isPointInDungeonLayout(layout.Layout, x, z)
}
