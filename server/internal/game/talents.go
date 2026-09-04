package game

import (
	"fmt"
	"log"
	"strconv"
	"strings"
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
	multiplier := 1.0 + bonus.SkillDamage
	if e.SpellFocusActive {
		multiplier *= 2.5
	}
	return multiplier
}

func isWizardDamageSkill(skillName string) bool {
	switch skillName {
	case "Fireball", "Flame Whip", "Flame Tornado", "Meteor Drop", "Inferno Cataclysm",
		"Scorch Beam", "Arcane Missiles", "Dragonfire Lance", "Gravity Well", "Frost Nova":
		return true
	default:
		return false
	}
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
	w.Economy.RecordSink("respec", cost)

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
