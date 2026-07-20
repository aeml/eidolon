package game

import (
	"math"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Entity type constants and basic value types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Entity struct
// ---------------------------------------------------------------------------

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
	LastAttackTime       time.Time            `json:"-"`
	AttackCooldown       time.Duration        `json:"-"`
	LastAbilityTime      time.Time            `json:"-"`
	AbilityCooldown      time.Duration        `json:"-"`
	Cooldowns            map[string]time.Time `json:"-"`
	LastRespawnTime      time.Time            `json:"-"`
	MoveLockUntil        time.Time            `json:"-"`
	QAGuaranteedLoot     bool                 `json:"-"`
	QAPersistentDuration time.Duration        `json:"-"`
	LastSpecialAttack    time.Time            `json:"-"` // Boss AoE slam cooldown

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
	PartyID      string `json:"partyId,omitempty"`
	SocialStatus string `json:"socialStatus,omitempty"`

	// Reconnect / session resume
	Disconnected   bool      `json:"-"`
	DisconnectedAt time.Time `json:"-"`

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

// ---------------------------------------------------------------------------
// Rune helpers (entity-level: reads SkillRunes field)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Set bonus and unique-effect helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Status-effect speed helpers
// ---------------------------------------------------------------------------

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

// ActivateSwiftIfEquipped activates the swift buff if the entity has the unique effect.
// Call this after any skill usage.
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

// ---------------------------------------------------------------------------
// Stat recalculation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Entity copy / snapshot helpers (owned by World but work on Entity fields)
// ---------------------------------------------------------------------------

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
		SocialStatus:      e.SocialStatus,
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
		MoveLockUntil:     e.MoveLockUntil,
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

func (w *World) copyEntity(v *Entity) *Entity {
	// Optimized: Only copy essential fields based on entity type
	// Enemies don't need inventory, stash, equipment details, etc.
	// This significantly reduces JSON payload size for state broadcasts

	e := Entity{
		ID:           v.ID,
		InstanceID:   v.InstanceID,
		Name:         v.Name,
		PartyID:      v.PartyID,
		SocialStatus: v.SocialStatus,
		Type:         v.Type,
		SubType:      v.SubType,
		X:            v.X,
		Y:            v.Y,
		Z:            v.Z,
		Rotation:     v.Rotation,
		Health:       v.Health,
		MaxHealth:    v.MaxHealth,
		Level:        v.Level,
		State:        v.State,
		Scale:        v.Scale,
		JumpStartX:   v.JumpStartX,
		JumpStartY:   v.JumpStartY,
		JumpStartZ:   v.JumpStartZ,
		JumpTargetX:  v.JumpTargetX,
		JumpTargetY:  v.JumpTargetY,
		JumpTargetZ:  v.JumpTargetZ,
		JumpDuration: v.JumpDuration,
		JumpHeight:   v.JumpHeight,
		JumpProgress: v.JumpProgress,
		OwnerID:      v.OwnerID,

		SpiritsActive:  v.SpiritsActive,
		SpiritsBoosted: v.SpiritsBoosted,
		SpiritEndTime:  v.SpiritEndTime,

		BerserkerModeActive:  v.BerserkerModeActive,
		BerserkerModeEndTime: v.BerserkerModeEndTime,
		LastStandActive:      v.LastStandActive,
		LastStandEndTime:     v.LastStandEndTime,
		StealthActive:        v.StealthActive,
		StealthEndTime:       v.StealthEndTime,
		ZealActive:           v.ZealActive,
		ZealEndTime:          v.ZealEndTime,

		IronFortressActive:        v.IronFortressActive,
		IronFortressEndTime:       v.IronFortressEndTime,
		GuardianRoarActive:        v.GuardianRoarActive,
		GuardianRoarEndTime:       v.GuardianRoarEndTime,
		SerratedEdgesActive:       v.SerratedEdgesActive,
		SerratedEdgesEndTime:      v.SerratedEdgesEndTime,
		PoisonCoatingActive:       v.PoisonCoatingActive,
		PoisonCoatingEndTime:      v.PoisonCoatingEndTime,
		SpellFocusActive:          v.SpellFocusActive,
		SpellFocusEndTime:         v.SpellFocusEndTime,
		ArcaneShieldActive:        v.ArcaneShieldActive,
		ArcaneShieldHP:            v.ArcaneShieldHP,
		ArcaneShieldEndTime:       v.ArcaneShieldEndTime,
		TimeWarpActive:            v.TimeWarpActive,
		TimeWarpEndTime:           v.TimeWarpEndTime,
		DivineInterventionActive:  v.DivineInterventionActive,
		DivineInterventionEndTime: v.DivineInterventionEndTime,
		BlessingResolveActive:     v.BlessingResolveActive,
		BlessingResolveEndTime:    v.BlessingResolveEndTime,
		GuardianEmbraceActive:     v.GuardianEmbraceActive,
		GuardianEmbraceEndTime:    v.GuardianEmbraceEndTime,
		SwiftActive:               v.SwiftActive,
		SwiftEndTime:              v.SwiftEndTime,

		Stunned:             v.Stunned,
		StunEndTime:         v.StunEndTime,
		Slowed:              v.Slowed,
		SlowEndTime:         v.SlowEndTime,
		SlowFactor:          v.SlowFactor,
		Rooted:              v.Rooted,
		RootEndTime:         v.RootEndTime,
		WeakPointMarked:     v.WeakPointMarked,
		WeakPointEndTime:    v.WeakPointEndTime,
		MarkWeakness:        v.MarkWeakness,
		MarkWeaknessEndTime: v.MarkWeaknessEndTime,
		Bleeding:            v.Bleeding,
		BleedEndTime:        v.BleedEndTime,
		BleedDamage:         v.BleedDamage,
		Poisoned:            v.Poisoned,
		PoisonEndTime:       v.PoisonEndTime,
		PoisonDamage:        v.PoisonDamage,
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
		e.IsCharging = v.IsCharging
		e.ChargeTargetX = v.ChargeTargetX
		e.ChargeTargetZ = v.ChargeTargetZ
		if v.SkillRunes != nil {
			e.SkillRunes = make(map[string]string, len(v.SkillRunes))
			for skill, runeID := range v.SkillRunes {
				e.SkillRunes[skill] = runeID
			}
		}
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
