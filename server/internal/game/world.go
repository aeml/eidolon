package game

import (
	"fmt"
	"math"
	"math/rand"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

type EntityType string

const (
	TypePlayer     EntityType = "Player"
	TypeEnemy      EntityType = "Enemy"
	TypeNPC        EntityType = "NPC"
	TypeLoot       EntityType = "Loot"
	TypeProjectile EntityType = "Projectile"
	TypeFence      EntityType = "Fence"
	TypeStash      EntityType = "Stash"

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
	mu            sync.RWMutex // Protects concurrent access
	ID            string       `json:"id"`
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
	Equipment      map[string]Item `json:"equipment"`
	Quests         []Quest         `json:"quests"`
	LastDailyQuest time.Time       `json:"-"`

	// Skills
	SkillPoints    int      `json:"skillPoints"`
	SelectedBranch string   `json:"selectedBranch"` // "A", "B", or "C"
	UnlockedSkills []string `json:"unlockedSkills"`

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

	TargetX  float64 `json:"-"`
	TargetZ  float64 `json:"-"`
	TargetID string  `json:"-"`
	SpawnX   float64 `json:"-"`
	SpawnZ   float64 `json:"-"`
	State    string  `json:"state"` // IDLE, MOVING, ATTACKING, DEAD

	// Combat
	LastAttackTime  time.Time            `json:"-"`
	AttackCooldown  time.Duration        `json:"-"`
	LastAbilityTime time.Time            `json:"-"`
	AbilityCooldown time.Duration        `json:"-"`
	Cooldowns       map[string]time.Time `json:"-"`
	LastRespawnTime time.Time            `json:"-"`

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

	// Abilities
	SpiritsActive  bool      `json:"spiritsActive"`
	SpiritsBoosted bool      `json:"spiritsBoosted"`
	SpiritEndTime  time.Time `json:"-"`
	LastSpiritTick time.Time `json:"-"`
	IsCharging     bool      `json:"isCharging,omitempty"`
	ChargeTargetX  float64   `json:"-"`
	ChargeTargetZ  float64   `json:"-"`

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
}

type SpatialMap struct {
	cellSize float64
	cells    map[string]map[string]*Entity
	mu       sync.RWMutex
}

func NewSpatialMap(cellSize float64) *SpatialMap {
	return &SpatialMap{
		cellSize: cellSize,
		cells:    make(map[string]map[string]*Entity),
	}
}

func (sm *SpatialMap) key(x, z float64) string {
	cx := int(math.Floor(x / sm.cellSize))
	cz := int(math.Floor(z / sm.cellSize))
	return fmt.Sprintf("%d:%d", cx, cz)
}
func (sm *SpatialMap) Add(e *Entity) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	k := sm.key(e.X, e.Z)
	if sm.cells[k] == nil {
		sm.cells[k] = make(map[string]*Entity)
	}
	sm.cells[k][e.ID] = e
}

func (sm *SpatialMap) Remove(e *Entity) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	k := sm.key(e.X, e.Z)
	if sm.cells[k] != nil {
		delete(sm.cells[k], e.ID)
		if len(sm.cells[k]) == 0 {
			delete(sm.cells, k)
		}
	}
}

func (sm *SpatialMap) Update(e *Entity, oldX, oldZ float64) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	oldKey := sm.key(oldX, oldZ)
	newKey := sm.key(e.X, e.Z)
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

func (sm *SpatialMap) Nearby(x, z, radius float64) []*Entity {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	var result []*Entity
	minX := int(math.Floor((x - radius) / sm.cellSize))
	maxX := int(math.Floor((x + radius) / sm.cellSize))
	minZ := int(math.Floor((z - radius) / sm.cellSize))
	maxZ := int(math.Floor((z + radius) / sm.cellSize))

	for cx := minX; cx <= maxX; cx++ {
		for cz := minZ; cz <= maxZ; cz++ {
			k := fmt.Sprintf("%d:%d", cx, cz)
			for _, e := range sm.cells[k] {
				result = append(result, e)
			}
		}
	}
	return result
}

type World struct {
	Entities map[string]*Entity
	Parties  map[string]*Party
	Grid     *SpatialMap
	mu       sync.RWMutex

	// Elite Spawning
	EliteSpawnTimer time.Time

	// Global Regen Timer
	RegenTimer float64

	// Event Callback
	OnEvent       func(eventType string, data interface{})
	OnQuestUpdate func(playerID string, quests []Quest)
}

type DamageEvent struct {
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

func NewWorld() *World {
	w := &World{
		Entities:        make(map[string]*Entity),
		Parties:         make(map[string]*Party),
		Grid:            NewSpatialMap(50.0), // 50 unit cell size
		EliteSpawnTimer: time.Now(),
		RegenTimer:      0,
		OnEvent:         func(eventType string, data interface{}) {}, // Default no-op
		OnQuestUpdate:   func(playerID string, quests []Quest) {},
	}
	w.initWorld()
	return w
}

func (w *World) initWorld() {
	w.spawnMerchant()
	w.spawnQuestNPC()
	w.spawnStash()
	w.spawnEnemies()
	w.spawnInitialElites()
	w.spawnFence()
	w.spawnSnowWorld()
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
	// West Wall
	for z := minZ; z <= maxZ; z += segmentLen {
		createSegment(minX, z, math.Pi/2)
	}
	// East Wall
	for z := minZ; z <= maxZ; z += segmentLen {
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
		}
		w.AddEntity(fg)
	}
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
	}
	w.Entities[elite.ID] = elite
	w.Grid.Add(elite)

	if w.OnEvent != nil {
		w.OnEvent("elite_spawn", fmt.Sprintf("An Elite %s has spawned!", subType))
	}
}

func (w *World) spawnStash() {
	stash := &Entity{
		ID:       "stash-1",
		Type:     TypeStash,
		SubType:  "Stash",
		X:        0,
		Y:        0.5, // Slightly above ground
		Z:        185, // In front of Two Story Building (which is at 170)
		Rotation: 0,
		State:    "IDLE",
	}
	w.AddEntity(stash)
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
	}
	// Merchant doesn't need combat stats for now
	w.AddEntity(merchant)
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
		}
		w.AddEntity(enemy)
	}
}

func (w *World) AddEntity(e *Entity) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Entities[e.ID] = e
	w.Grid.Add(e)
}

func (w *World) RemoveEntity(id string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if e, ok := w.Entities[id]; ok {
		w.Grid.Remove(e)
		delete(w.Entities, id)
	}
}

func (w *World) UpdateEntityPosition(id string, x, y, z, rotation float64) {
	w.mu.Lock()
	defer w.mu.Unlock()

	e, ok := w.Entities[id]
	if !ok {
		return
	}

	oldX, oldZ := e.X, e.Z
	e.X = x
	e.Y = y
	e.Z = z
	e.Rotation = rotation
	e.State = "MOVING" // Default to moving if position updates

	w.Grid.Update(e, oldX, oldZ)
}

func (w *World) GetEntity(id string) *Entity {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Entities[id]
}

func (w *World) GetEntityCopy(id string) *Entity {
	w.mu.RLock()
	defer w.mu.RUnlock()
	e, ok := w.Entities[id]
	if !ok {
		return nil
	}

	// Manual copy to avoid copying the mutex
	newE := &Entity{
		ID:                e.ID,
		Name:              e.Name,
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
		SkillPoints:       e.SkillPoints,
		SelectedBranch:    e.SelectedBranch,
	}

	if e.UnlockedSkills != nil {
		newE.UnlockedSkills = make([]string, len(e.UnlockedSkills))
		copy(newE.UnlockedSkills, e.UnlockedSkills)
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

func (w *World) PerformPickup(playerID, lootID string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}
	loot, ok := w.Entities[lootID]
	if !ok || loot.Type != TypeLoot {
		return nil, false
	}

	dx := player.X - loot.X
	dz := player.Z - loot.Z
	dist := dx*dx + dz*dz
	if dist < 36.0 {
		if loot.LootItem != nil {
			if len(player.Inventory) >= MaxInventorySize {
				return nil, false
			}
			player.Inventory = append(player.Inventory, *loot.LootItem)
			w.Grid.Remove(loot)
			delete(w.Entities, lootID)
			return player, true
		}
	}
	return nil, false
}

func (w *World) PerformEquip(playerID, itemID, slot string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

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

	// Unequip current
	if current, ok := player.Equipment[slot]; ok {
		player.Inventory = append(player.Inventory, current)
	}

	if player.Equipment == nil {
		player.Equipment = make(map[string]Item)
	}
	player.Equipment[slot] = *itemToEquip

	// Swap remove
	lastIdx := len(player.Inventory) - 1
	player.Inventory[invIndex] = player.Inventory[lastIdx]
	player.Inventory = player.Inventory[:lastIdx]

	player.RecalculateStats()
	return player, true
}

func (w *World) PerformBuyGamble(playerID, slot string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Cost calculated to ensure ~0.5% house edge against EV (34.5 * Level)
	cost := int(math.Ceil(35 * float64(player.Level)))

	if player.Gold < cost {
		return nil, false
	}
	if len(player.Inventory) >= MaxInventorySize {
		return nil, false
	}

	player.Gold -= cost
	item := GenerateLootForSlot(slot, player.Level)
	if item != nil {
		player.Inventory = append(player.Inventory, *item)
		return player, true
	} else {
		player.Gold += cost
		return nil, false
	}
}

func (w *World) PerformSell(playerID, itemID string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

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
	player.Gold += value

	lastIdx := len(player.Inventory) - 1
	player.Inventory[invIndex] = player.Inventory[lastIdx]
	player.Inventory = player.Inventory[:lastIdx]

	return player, true
}

func (w *World) PerformStashDeposit(playerID, itemID string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Check Stash Size
	if len(player.Stash) >= MaxStashSize {
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
	player.Stash = append(player.Stash, *itemToDeposit)

	// Remove from Inventory
	lastIdx := len(player.Inventory) - 1
	player.Inventory[invIndex] = player.Inventory[lastIdx]
	player.Inventory = player.Inventory[:lastIdx]

	return player, true
}

func (w *World) PerformStashWithdraw(playerID, itemID string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Check Inventory Size
	if len(player.Inventory) >= MaxInventorySize {
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
	player.Inventory = append(player.Inventory, *itemToWithdraw)

	// Remove from Stash
	lastIdx := len(player.Stash) - 1
	player.Stash[stashIndex] = player.Stash[lastIdx]
	player.Stash = player.Stash[:lastIdx]

	return player, true
}

func (w *World) GenerateDailyQuests(playerID string) *Entity {
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil
	}

	// Check if already generated today
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		fmt.Printf("Error loading timezone America/New_York: %v. Defaulting to UTC.\n", err)
		loc = time.UTC
	}

	now := time.Now().In(loc)
	y, m, d := now.Date()
	ly, lm, ld := player.LastDailyQuest.In(loc).Date()

	if y == ly && m == lm && d == ld && len(player.Quests) > 0 {
		// Hotfix: Update rewards if they don't match the current values
		updated := false
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

		// Sort quests by RewardXP to ensure they are in order of difficulty
		sort.Slice(player.Quests, func(i, j int) bool {
			return player.Quests[i].RewardXP < player.Quests[j].RewardXP
		})

		if updated {
			fmt.Printf("Updated daily quest rewards/list for %s\n", player.Name)
		}
		return player // Already has quests for today
	}

	fmt.Printf("Generating daily quests for %s (Last: %v, Now: %v)\n", player.Name, player.LastDailyQuest, now)

	// Generate 9 Daily Quests
	player.Quests = []Quest{
		{ID: "daily_skeleton", Type: "KILL", Target: "Skeleton", Count: 0, MaxCount: 100, RewardXP: 50000, Completed: false, Accepted: false},
		{ID: "daily_imp", Type: "KILL", Target: "Imp", Count: 0, MaxCount: 100, RewardXP: 150000, Completed: false, Accepted: false},
		{ID: "daily_demonorc", Type: "KILL", Target: "DemonOrc", Count: 0, MaxCount: 100, RewardXP: 300000, Completed: false, Accepted: false},
		{ID: "daily_construct", Type: "KILL", Target: "Construct", Count: 0, MaxCount: 100, RewardXP: 500000, Completed: false, Accepted: false},
		{ID: "daily_infernotitan", Type: "KILL", Target: "InfernoTitan", Count: 0, MaxCount: 100, RewardXP: 800000, Completed: false, Accepted: false},
		{ID: "daily_mountaintroll", Type: "KILL", Target: "MountainTroll", Count: 0, MaxCount: 100, RewardXP: 1200000, Completed: false, Accepted: false},
		{ID: "daily_aquagolem", Type: "KILL", Target: "AquaGolem", Count: 0, MaxCount: 100, RewardXP: 1600000, Completed: false, Accepted: false},
		{ID: "daily_siren", Type: "KILL", Target: "Siren", Count: 0, MaxCount: 100, RewardXP: 2200000, Completed: false, Accepted: false},
		{ID: "daily_frostguardian", Type: "KILL", Target: "FrostGuardian", Count: 0, MaxCount: 100, RewardXP: 3000000, Completed: false, Accepted: false},
	}
	player.LastDailyQuest = now

	return player
}

func (w *World) PerformAcceptQuest(playerID, questID string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

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
	w.mu.Lock()
	defer w.mu.Unlock()

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
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return
	}

	// Allow respawn even if not dead (unstuck)
	player.State = "IDLE"
	player.LastRespawnTime = time.Now()
	player.Health = player.MaxHealth

	oldX, oldZ := player.X, player.Z
	player.X = -1.25
	player.Z = 200
	player.TargetX = -1.25
	player.TargetZ = 200
	w.Grid.Update(player, oldX, oldZ) // Force update to -1.25,200
}

func (w *World) updateEntity(e *Entity, dt float64, players []*Entity, deferred *deferredActions) {
	// --- Loot Cleanup ---
	if e.Type == TypeLoot {
		e.mu.Lock()
		if time.Since(e.LootTime) > 1*time.Minute {
			deferred.addRemoval(e.ID)
		}
		e.mu.Unlock()
		return
	}

	// --- Respawn Logic for Enemies and NPCs ---
	if e.Type == TypeEnemy || e.Type == TypeNPC {
		e.mu.Lock()
		if e.State == "DEAD" {
			// Check if Elite
			if strings.HasPrefix(e.ID, "elite-") {
				if time.Since(e.LastAttackTime) > 5*time.Second {
					deferred.addRemoval(e.ID)
				}
				e.mu.Unlock()
				return
			}

			// Respawn Logic for normal mobs
			if time.Since(e.LastAttackTime) > 10*time.Second {
				e.State = "IDLE"
				e.Health = e.MaxHealth
				oldX, oldZ := e.X, e.Z
				e.X = e.SpawnX
				e.Z = e.SpawnZ
				w.Grid.Update(e, oldX, oldZ)
			}
			e.mu.Unlock()
			return
		}
		e.mu.Unlock()
	}

	// --- Projectiles ---
	if e.Type == TypeProjectile {
		e.mu.Lock()

		// Zone Logic
		if e.SubType == "Zone" {
			if time.Since(e.CreatedAt) > 8*time.Second {
				deferred.addRemoval(e.ID)
				e.mu.Unlock()
				return
			}
			// Zone doesn't move
			// Periodic Effect (e.g. every 1s)
			if time.Since(e.LastAttackTime) >= 1*time.Second {
				e.LastAttackTime = time.Now()

				radius := e.Radius
				damage := e.Damage
				if damage == 0 {
					damage = 10
				}
				ownerID := e.OwnerID
				e.mu.Unlock() // Unlock to query grid

				nearby := w.Grid.Nearby(e.X, e.Z, radius)
				for _, target := range nearby {
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := e.X - target.X
					dz := e.Z - target.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: damage})
						}

						if isDead {
							owner := w.GetEntity(ownerID)
							target.mu.Lock()
							w.handleDeath(target, owner, deferred)
							target.mu.Unlock()
						}
					}
				}
				return
			}
			e.mu.Unlock()
			return
		}

		// Meteor Logic
		if e.SubType == "Meteor" {
			if time.Now().After(e.LastAttackTime) {
				// Impact!
				radius := e.Radius
				damage := e.Damage
				ownerID := e.OwnerID

				e.mu.Unlock() // Unlock to query grid

				nearby := w.Grid.Nearby(e.X, e.Z, radius)
				for _, target := range nearby {
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := e.X - target.X
					dz := e.Z - target.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: damage})
						}

						if isDead {
							owner := w.GetEntity(ownerID)
							target.mu.Lock()
							w.handleDeath(target, owner, deferred)
							target.mu.Unlock()
						}
					}
				}

				// Remove Meteor after impact
				deferred.addRemoval(e.ID)
				return
			}
			e.mu.Unlock()
			return
		}

		// Lifetime check
		lifetime := 5 * time.Second
		if e.SubType == "ExplosiveTrap" || e.SubType == "SnareTrap" {
			lifetime = 60 * time.Second
		}
		if time.Since(e.CreatedAt) > lifetime {
			deferred.addRemoval(e.ID)
			e.mu.Unlock()
			return
		}

		// Move
		oldX, oldZ := e.X, e.Z
		e.X += e.VelX * dt
		e.Z += e.VelZ * dt
		w.Grid.Update(e, oldX, oldZ)

		// Snapshot for collision check
		projX, projZ, radius, damage, ownerID, subType := e.X, e.Z, e.Radius, e.Damage, e.OwnerID, e.SubType
		e.mu.Unlock()

		// Check Collision with Enemies
		nearbyEnemies := w.Grid.Nearby(projX, projZ, radius+2.0)
		for _, target := range nearbyEnemies {
			// Read Target State
			target.mu.RLock()
			if target.Type != TypeEnemy || target.State == "DEAD" {
				target.mu.RUnlock()
				continue
			}
			dx := projX - target.X
			dz := projZ - target.Z
			target.mu.RUnlock()

			dist := math.Sqrt(dx*dx + dz*dz)
			if dist < (radius + 0.5) {
				e.mu.Lock()
				if e.HitList == nil {
					e.HitList = make(map[string]bool)
				}
				if e.HitList[target.ID] {
					e.mu.Unlock()
					continue
				}
				e.HitList[target.ID] = true
				e.mu.Unlock()

				// Hit!
				target.mu.Lock()
				target.Health -= damage
				isDead := target.Health <= 0

				// Apply Trap Effects
				if subType == "SnareTrap" {
					target.Rooted = true
					target.RootEndTime = time.Now().Add(3 * time.Second)
				}

				target.mu.Unlock()

				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: damage})
				}

				if isDead {
					// We need the owner entity to award XP
					owner := w.GetEntity(ownerID) // This uses RLock on World
					target.mu.Lock()              // Lock target for handleDeath
					w.handleDeath(target, owner, deferred)
					target.mu.Unlock()
				}

				// Splash Damage (Fireball / Explosive Trap)
				if subType == "Fireball" || subType == "ExplosiveTrap" {
					splashRadius := 10.0
					if subType == "ExplosiveTrap" {
						splashRadius = 6.0
					}

					splashTargets := w.Grid.Nearby(projX, projZ, splashRadius)
					for _, splashTarget := range splashTargets {
						splashTarget.mu.RLock()
						if splashTarget.Type != TypeEnemy || splashTarget.ID == target.ID || splashTarget.State == "DEAD" {
							splashTarget.mu.RUnlock()
							continue
						}
						sdx := projX - splashTarget.X
						sdz := projZ - splashTarget.Z
						splashTarget.mu.RUnlock()

						sdist := math.Sqrt(sdx*sdx + sdz*sdz)
						if sdist < 10.0 {
							splashTarget.mu.Lock()
							splashDmg := int(float64(damage) * 0.4)
							splashTarget.Health -= splashDmg
							isSplashDead := splashTarget.Health <= 0
							splashTarget.mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: splashTarget.ID, SourceID: ownerID, Amount: splashDmg})
							}

							if isSplashDead {
								owner := w.GetEntity(ownerID)
								splashTarget.mu.Lock()
								w.handleDeath(splashTarget, owner, deferred)
								splashTarget.mu.Unlock()
							}
						}
					}
				}

				if subType != "Dagger" && subType != "FlameTornado" {
					deferred.addRemoval(e.ID)
					break
				}
			}
		}

		e.mu.Lock()
		if e.X < -1000 || e.X > 1000 || e.Z < -2200 || e.Z > 1000 {
			deferred.addRemoval(e.ID)
		}
		e.mu.Unlock()
		return
	}

	// --- Player Abilities ---
	if e.Type == TypePlayer {
		e.mu.Lock()
		// Fighter Charge
		if e.IsCharging {
			dx := e.ChargeTargetX - e.X
			dz := e.ChargeTargetZ - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			speed := 50.0
			moveDist := speed * dt

			oldX, oldZ := e.X, e.Z
			if moveDist >= dist {
				e.X = e.ChargeTargetX
				e.Z = e.ChargeTargetZ
				e.IsCharging = false
				e.State = "IDLE"
				w.Grid.Update(e, oldX, oldZ)

				// Impact Damage
				damage := int(float64(e.Damage) * 1.5)
				e.mu.Unlock() // Unlock before interaction

				nearby := w.Grid.Nearby(e.ChargeTargetX, e.ChargeTargetZ, 16.0)
				for _, target := range nearby {
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					tdx := e.ChargeTargetX - target.X
					tdz := e.ChargeTargetZ - target.Z
					target.mu.RUnlock()

					tdist := math.Sqrt(tdx*tdx + tdz*tdz)
					if tdist < 16.0 {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: damage})
						}

						if isDead {
							target.mu.Lock()
							w.handleDeath(target, e, deferred)
							target.mu.Unlock()
						}
					}
				}
			} else {
				e.X += (dx / dist) * moveDist
				e.Z += (dz / dist) * moveDist
				e.Rotation = math.Atan2(dx, dz)
				w.Grid.Update(e, oldX, oldZ)
				e.mu.Unlock()
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
			}
			if e.ZealActive && now.After(e.ZealEndTime) {
				e.ZealActive = false
			}
			if e.IronFortressActive && now.After(e.IronFortressEndTime) {
				e.IronFortressActive = false
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
						e.mu.Unlock()
						w.handleDeath(e, nil, deferred)
						e.mu.Lock()
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
						e.mu.Unlock()
						w.handleDeath(e, nil, deferred)
						e.mu.Lock()
					}
				}
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
					e.mu.Unlock()
					nearby := w.Grid.Nearby(pX, pZ, 10.0)
					for _, target := range nearby {
						if target.ID == e.ID {
							continue
						}
						if target.Type == TypePlayer || target.Type == TypeNPC {
							target.mu.Lock()
							target.Health += heal
							if target.Health > target.MaxHealth {
								target.Health = target.MaxHealth
							}
							target.mu.Unlock()
						}
					}
					e.mu.Lock()
				}
			}

			if e.SpiritsActive {
				// Cleric Spirits
				if now.After(e.SpiritEndTime) {
					e.SpiritsActive = false
					e.mu.Unlock()
				} else {
					if time.Since(e.LastSpiritTick) >= 500*time.Millisecond {
						e.LastSpiritTick = now
						damage := 10 + (e.Stats.Wisdom * 1)
						radius := 16.0
						if e.SpiritsBoosted {
							damage = 20 + int(float64(e.Stats.Wisdom)*1.5)
							radius = 20.0
						}
						pX, pZ := e.X, e.Z
						e.mu.Unlock() // Unlock before interaction

						nearby := w.Grid.Nearby(pX, pZ, radius)
						for _, target := range nearby {
							target.mu.RLock()
							if target.Type != TypeEnemy || target.State == "DEAD" {
								target.mu.RUnlock()
								continue
							}
							tdx := pX - target.X
							tdz := pZ - target.Z
							target.mu.RUnlock()

							tdist := math.Sqrt(tdx*tdx + tdz*tdz)
							if tdist < radius {
								target.mu.Lock()
								target.Health -= damage
								isDead := target.Health <= 0
								target.mu.Unlock()

								if w.OnEvent != nil {
									w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: damage})
								}

								if isDead {
									target.mu.Lock()
									w.handleDeath(target, e, deferred)
									target.mu.Unlock()
								}
							}
						}
					} else {
						e.mu.Unlock()
					}
				}
			} else {
				e.mu.Unlock()
			}
		}
	}

	if e.SubType == "AvengingSeraph" {
		e.mu.Lock()
		// Duration Check (15s)
		if time.Since(e.CreatedAt) > 15*time.Second {
			e.mu.Unlock()
			deferred.addRemoval(e.ID)
			return
		}

		// Owner Check
		owner := w.GetEntity(e.OwnerID)
		if owner == nil {
			e.mu.Unlock()
			deferred.addRemoval(e.ID)
			return
		}

		owner.mu.RLock()
		ox, oz := owner.X, owner.Z
		owner.mu.RUnlock()

		// AI Logic
		// 1. Find Target (Enemy)
		var target *Entity
		minDist := 15.0 // Aggro Range

		// Unlock self to search grid
		ex, ez := e.X, e.Z
		e.mu.Unlock()

		nearby := w.Grid.Nearby(ex, ez, minDist)
		for _, t := range nearby {
			t.mu.RLock()
			if t.Type != TypeEnemy || t.State == "DEAD" {
				t.mu.RUnlock()
				continue
			}
			dx := t.X - ex
			dz := t.Z - ez
			t.mu.RUnlock()
			d := math.Sqrt(dx*dx + dz*dz)
			if d < minDist {
				minDist = d
				target = t
			}
		}

		e.mu.Lock()

		// Attack Logic
		if target != nil {
			// Face Target
			target.mu.RLock()
			tx, tz := target.X, target.Z
			target.mu.RUnlock()

			dx := tx - e.X
			dz := tz - e.Z
			e.Rotation = math.Atan2(dx, dz)

			if time.Since(e.LastAttackTime) >= 1500*time.Millisecond {
				e.LastAttackTime = time.Now()
				e.State = "ATTACKING"

				// Ranged Smite Attack
				damage := e.Damage

				e.mu.Unlock() // Unlock before interaction

				target.mu.Lock()
				target.Health -= damage
				isDead := target.Health <= 0
				target.mu.Unlock()

				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: damage})
					// Visual Beam event? Or just rely on attack animation
					w.OnEvent("ability", AbilityEvent{SourceID: e.ID, TargetID: target.ID, SkillName: "Smite", TargetX: tx, TargetZ: tz})
				}

				if isDead {
					target.mu.Lock()
					w.handleDeath(target, owner, deferred) // Owner gets XP
					target.mu.Unlock()
				}
				e.mu.Lock()
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

				e.X += dirX * speed
				e.Z += dirZ * speed
				e.Rotation = math.Atan2(dirX, dirZ)

				// Update Grid
				w.Grid.Update(e, ex, ez)
			} else {
				e.State = "IDLE"
			}
		}
		e.mu.Unlock()
		return
	}

	if e.Type == TypeEnemy {
		// AI Logic
		var target *Entity
		minDist := 1000.0

		e.mu.Lock()
		ex, ez := e.X, e.Z
		e.mu.Unlock()

		// Find nearest player
		for _, p := range players {
			p.mu.RLock()
			// Check Safe Zone
			if p.X > -100 && p.X < 100 && p.Z > 100 && p.Z < 300 {
				p.mu.RUnlock()
				continue
			}
			// Check Stealth
			if p.StealthActive {
				if time.Now().Before(p.StealthEndTime) {
					p.mu.RUnlock()
					continue
				}
			}
			dx := p.X - ex
			dz := p.Z - ez
			p.mu.RUnlock()

			dist := math.Sqrt(dx*dx + dz*dz)
			if dist < minDist {
				minDist = dist
				target = p
			}
		}

		sightRange := 45.0
		attackRange := 2.5
		roamRadius := 10.0

		e.mu.Lock()
		defer e.mu.Unlock()

		// Animation Lock: If attacking, stay attacking and don't move
		if time.Since(e.LastAttackTime) < e.AttackCooldown {
			if e.State != "ATTACKING" {
				e.State = "ATTACKING"
			}
			return
		}

		if target != nil && minDist <= sightRange {
			if minDist <= attackRange {
				// Attack
				if time.Since(e.LastAttackTime) >= e.AttackCooldown {
					e.mu.Unlock() // Unlock self before interaction
					w.PerformAttack(e.ID, target.ID)
					e.mu.Lock() // Relock self
				}
			} else {
				// Chase
				target.mu.RLock()
				tx, tz := target.X, target.Z
				target.mu.RUnlock()

				e.TargetX = tx
				e.TargetZ = tz
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
	// Note: We do NOT hold w.mu during the main update loop to allow parallelism.
	// However, we need to snapshot the entity list safely.

	w.mu.Lock()

	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Recovered from panic in Update: %v\n", r)
			// Ensure we don't leave mutex locked if we panic while holding it
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
	w.mu.Unlock() // Unlock World so parallel updates can happen

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
	w.mu.Lock()

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

	w.mu.Unlock()

	// 4. Elite Spawning Logic (Every 5 minutes)
	// Note: w.EliteSpawnTimer is accessed without lock here.
	// Strictly speaking, we should lock it. But it's only used in Update loop (single threaded relative to itself).
	// However, if we want to be safe, we can lock just for the check.
	// But w.spawnEliteInRect locks w.mu internally.

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

func (w *World) PerformAttack(attackerID, targetID string) (int, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	attacker, ok := w.Entities[attackerID]
	if !ok || attacker.State == "DEAD" {
		return 0, false
	}

	target, ok := w.Entities[targetID]
	if !ok || target.State == "DEAD" {
		return 0, false
	}

	// NO PVP: If both are players, return false
	if attacker.Type == TypePlayer && target.Type == TypePlayer {
		return 0, false
	}

	// NO NPC ATTACKS
	if target.Type == TypeNPC {
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

	attackRange := 5.0 // Default Melee range
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
		tgt.mu.Lock()
		// We should also lock attacker if we read mutable fields, but Damage is updated in RecalculateStats
		// and we are reading it. Ideally we lock both, but let's be careful of deadlock.
		// Since we only read att.Damage (int), it's atomic-ish on 64bit, but technically racey.
		// However, locking both requires ordering.
		// For now, let's assume reading att.Damage is "safe enough" or we RLock att.

		damage := att.Damage - tgt.Defense
		if damage < 1 {
			damage = 1
		}
		tgt.Health -= damage

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
		tgt.mu.Unlock() // Unlock target before event/death handling to avoid holding too long?
		// No, handleDeath expects target to be locked?
		// Let's check handleDeath contract.
		// In updateProjectiles, target IS locked.
		// So we should keep it locked or re-lock.

		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: tgt.ID, SourceID: att.ID, Amount: damage})
		}

		if isDead {
			tgt.mu.Lock() // Re-lock for death handling
			// Double check if still dead (race condition?)
			if tgt.Health <= 0 && tgt.State != "DEAD" {
				w.handleDeath(tgt, att, nil)
			}
			tgt.mu.Unlock()
		}
	}(attackerID, targetID, delay)

	return 0, true
}

func (w *World) PerformAbility(playerID string, targetX, targetZ float64, targetID string, skillName string) {
	w.mu.Lock()
	defer w.mu.Unlock()

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

	// Class Specific Logic
	switch player.SubType {
	case "Fighter":
		if skillName == "Charge" {
			// Charge
			cost := 20
			if player.Mana >= cost {
				player.Mana -= cost
				player.IsCharging = true
				player.ChargeTargetX = targetX
				player.ChargeTargetZ = targetZ
				player.State = "ATTACKING" // Or special state?
				setCooldown(5 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Whirlwind" {
			// Whirlwind
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				// AoE Damage around player
				radius := 6.0
				damage := int(float64(player.Damage)*0.8) + (player.Stats.Strength * 2)

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					// Skip self
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					// Distance check
					dx := player.X - target.X
					dz := player.Z - target.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}

						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}

				player.State = "ATTACKING"
				setCooldown(8 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Shield Slam" {
			// Shield Slam: Cone Damage
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost

				rangeDist := 4.0
				angleThreshold := math.Pi / 4 // 45 degrees
				damage := int(float64(player.Stats.Strength) * 1.5)

				pDirX := math.Sin(player.Rotation)
				pDirZ := math.Cos(player.Rotation)

				nearby := w.Grid.Nearby(player.X, player.Z, rangeDist)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					dist := math.Sqrt(dx*dx + dz*dz)
					if dist <= rangeDist {
						dirX := dx / dist
						dirZ := dz / dist

						dot := pDirX*dirX + pDirZ*dirZ
						if dot > math.Cos(angleThreshold) {
							target.mu.Lock()
							target.Health -= damage
							isDead := target.Health <= 0
							target.mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}
							if isDead {
								target.mu.Lock()
								w.handleDeath(target, player, nil)
								target.mu.Unlock()
							}
						}
					}
				}
				setCooldown(6 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Sweeping Strike" {
			// Sweeping Strike: Wide Cone
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				rangeDist := 5.0
				angleThreshold := math.Pi / 2 // 90 degrees
				damage := int(float64(player.Stats.Strength) * 1.2)

				pDirX := math.Sin(player.Rotation)
				pDirZ := math.Cos(player.Rotation)

				nearby := w.Grid.Nearby(player.X, player.Z, rangeDist)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					dist := math.Sqrt(dx*dx + dz*dz)
					if dist <= rangeDist {
						dirX := dx / dist
						dirZ := dz / dist

						dot := pDirX*dirX + pDirZ*dirZ
						if dot > math.Cos(angleThreshold) {
							target.mu.Lock()
							target.Health -= damage
							isDead := target.Health <= 0
							target.mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}
							if isDead {
								target.mu.Lock()
								w.handleDeath(target, player, nil)
								target.mu.Unlock()
							}
						}
					}
				}
				setCooldown(4 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Earthshaker" {
			// Earthshaker: AoE
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 6.0
				damage := player.Stats.Strength * 2

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}
						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}
				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Unbreakable Grip" {
			// Pull Target
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost

				var bestTarget *Entity
				minDist := 3.0

				nearby := w.Grid.Nearby(targetX, targetZ, 5.0)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - targetX
					dz := target.Z - targetZ
					target.mu.RUnlock()

					d := math.Sqrt(dx*dx + dz*dz)
					if d < minDist {
						minDist = d
						bestTarget = target
					}
				}

				if bestTarget != nil {
					pDirX := math.Sin(player.Rotation)
					pDirZ := math.Cos(player.Rotation)

					pullX := player.X + pDirX*2.0
					pullZ := player.Z + pDirZ*2.0

					bestTarget.mu.Lock()
					oldX, oldZ := bestTarget.X, bestTarget.Z
					bestTarget.X = pullX
					bestTarget.Z = pullZ
					w.Grid.Update(bestTarget, oldX, oldZ)
					bestTarget.mu.Unlock()
				}

				setCooldown(15 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Juggernaut Charge" {
			// Juggernaut Charge (AoE Shockwave)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 10.0
				damage := player.Stats.Strength * 1

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}
						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}
				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Shattering Charge" {
			// Shattering Charge (Movement)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost
				player.IsCharging = true
				player.ChargeTargetX = targetX
				player.ChargeTargetZ = targetZ
				player.State = "ATTACKING"
				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Executioner Spin" {
			// Executioner Spin
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 6.0
				damage := int(float64(player.Damage)*1.0) + (player.Stats.Strength * 3)

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := player.X - target.X
					dz := player.Z - target.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}

						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}

				player.State = "ATTACKING"
				setCooldown(15 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Iron Fortress" {
			// Iron Fortress (Buff)
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost
				player.IronFortressActive = true
				player.IronFortressEndTime = time.Now().Add(30 * time.Second)
				setCooldown(60 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Guardian Roar" {
			// Guardian Roar (AoE Taunt + Buff)
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost
				player.GuardianRoarActive = true
				player.GuardianRoarEndTime = time.Now().Add(10 * time.Second)

				// Taunt Logic
				radius := 15.0
				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.Lock()
					if target.Type == TypeEnemy && target.State != "DEAD" {
						// Force target to attack player
						target.TargetID = player.ID
						target.State = "CHASING"
					}
					target.mu.Unlock()
				}

				setCooldown(30 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Serrated Edges" {
			// Serrated Edges (Buff)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost
				player.SerratedEdgesActive = true
				player.SerratedEdgesEndTime = time.Now().Add(10 * time.Second)
				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Berserker Edge" {
			// Berserker Edge (Buff)
			// cost := 0 // Passive/Buff usually low cost or free? Client says 45s CD.
			player.BerserkerModeActive = true
			player.BerserkerModeEndTime = time.Now().Add(15 * time.Second)
			player.RecalculateStats()

			// Apply to party
			if player.PartyID != "" {
				party := w.GetParty(player.PartyID)
				if party != nil {
					_, _, members := party.GetSnapshot()
					for _, mid := range members {
						if mid == player.ID {
							continue
						}
						member := w.GetEntity(mid)
						if member != nil {
							// Check distance
							dx := member.X - player.X
							dz := member.Z - player.Z
							dist := math.Sqrt(dx*dx + dz*dz)
							if dist <= 15.0 {
								member.mu.Lock()
								member.BerserkerModeActive = true
								member.BerserkerModeEndTime = time.Now().Add(15 * time.Second)
								member.RecalculateStats()
								member.mu.Unlock()
							}
						}
					}
				}
			}

			setCooldown(45 * time.Second)
			if w.OnEvent != nil {
				w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
			}

		} else if skillName == "Last Stand Rampage" {
			// Last Stand (Buff) - Requires < 30% HP
			hpPercent := float64(player.Health) / float64(player.MaxHealth)
			if hpPercent < 0.30 {
				player.LastStandActive = true
				player.LastStandEndTime = time.Now().Add(10 * time.Second)

				setCooldown(120 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		}

	case "Wizard":
		if skillName == "Spell Focus" {
			// Spell Focus (Buff)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost
				player.SpellFocusActive = true
				player.SpellFocusEndTime = time.Now().Add(15 * time.Second)
				setCooldown(45 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Arcane Shield" {
			// Arcane Shield (Buff/Shield)
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost
				player.ArcaneShieldActive = true
				player.ArcaneShieldHP = 100 + (player.Stats.Intelligence * 5)
				player.ArcaneShieldEndTime = time.Now().Add(20 * time.Second)
				setCooldown(30 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Time Warp" {
			// Time Warp (Buff)
			cost := 50
			if player.Mana >= cost {
				player.Mana -= cost
				player.TimeWarpActive = true
				player.TimeWarpEndTime = time.Now().Add(8 * time.Second)
				setCooldown(60 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Gravity Well" {
			// Gravity Well (AoE Pull + Slow)
			cost := 60
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 8.0
				nearby := w.Grid.Nearby(targetX, targetZ, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.Lock()
					if target.Type == TypeEnemy && target.State != "DEAD" {
						// Pull towards center
						dx := targetX - target.X
						dz := targetZ - target.Z
						dist := math.Sqrt(dx*dx + dz*dz)
						if dist > 0.5 {
							target.X += dx * 0.5 // Move halfway to center
							target.Z += dz * 0.5
							w.Grid.Update(target, target.X-dx*0.5, target.Z-dz*0.5)
						}

						// Apply Slow
						target.Slowed = true
						target.SlowFactor = 0.5
						target.SlowEndTime = time.Now().Add(3 * time.Second)
					}
					target.mu.Unlock()
				}

				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Fireball" {
			// Fireball
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				// Spawn Projectile
				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1 // Avoid div by zero
				}

				velX := (dx / dist) * 20.0 // Speed 20
				velZ := (dz / dist) * 20.0

				damage := 20 + (player.Stats.Wisdom * 2)

				proj := &Entity{
					ID:        fmt.Sprintf("proj-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "Fireball",
					X:         player.X,
					Y:         1.5,
					Z:         player.Z,
					VelX:      velX,
					VelZ:      velZ,
					Radius:    2.0,
					Damage:    damage,
					OwnerID:   player.ID,
					Rotation:  math.Atan2(velX, velZ),
					CreatedAt: time.Now(),
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)

				player.State = "ATTACKING"
				setCooldown(2 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Flame Whip" {
			// Flame Whip (Cone Stun)
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost

				rangeDist := 12.0
				angleThreshold := math.Pi / 4 // 45 degrees
				damage := 25 + (player.Stats.Intelligence * 2)

				pDirX := math.Sin(player.Rotation)
				pDirZ := math.Cos(player.Rotation)

				nearby := w.Grid.Nearby(player.X, player.Z, rangeDist)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					dist := math.Sqrt(dx*dx + dz*dz)
					if dist <= rangeDist {
						dirX := dx / dist
						dirZ := dz / dist

						dot := pDirX*dirX + pDirZ*dirZ
						if dot > math.Cos(angleThreshold) {
							target.mu.Lock()
							target.Health -= damage
							target.Stunned = true
							target.StunEndTime = time.Now().Add(3 * time.Second)
							isDead := target.Health <= 0
							target.mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}

							if isDead {
								target.mu.Lock()
								w.handleDeath(target, player, nil)
								target.mu.Unlock()
							}
						}
					}
				}

				player.State = "ATTACKING"
				setCooldown(10 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}

				go func(pid string) {
					time.Sleep(1 * time.Second)
					w.mu.Lock()
					if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
						p.State = "IDLE"
					}
					w.mu.Unlock()
				}(player.ID)
			}
		} else if skillName == "Flame Tornado" {
			// Flame Tornado
			cost := 50
			if player.Mana >= cost {
				player.Mana -= cost

				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}

				velX := (dx / dist) * 10.0 // Slow speed
				velZ := (dz / dist) * 10.0

				damage := 30 + (player.Stats.Intelligence * 3)

				proj := &Entity{
					ID:        fmt.Sprintf("proj-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "FlameTornado",
					X:         player.X,
					Y:         1.5,
					Z:         player.Z,
					VelX:      velX,
					VelZ:      velZ,
					Radius:    3.0, // Large radius
					Damage:    damage,
					OwnerID:   player.ID,
					Rotation:  math.Atan2(velX, velZ),
					CreatedAt: time.Now(),
					HitList:   make(map[string]bool), // Initialize HitList
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)

				player.State = "ATTACKING"
				setCooldown(8 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}

				go func(pid string) {
					time.Sleep(1 * time.Second)
					w.mu.Lock()
					if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
						p.State = "IDLE"
					}
					w.mu.Unlock()
				}(player.ID)
			}
		} else if skillName == "Meteor Drop" {
			// Meteor Drop
			cost := 60
			if player.Mana >= cost {
				player.Mana -= cost

				// Spawn Projectile instead of async sleep
				// Target is fixed location
				damage := 50 + (player.Stats.Intelligence * 3)

				// Actually, Meteor falls from sky.
				// We can simulate it as a projectile that starts high up at targetX, targetZ and falls down.
				// Or a projectile that travels from player to target.
				// Client visual: "Spawn Meteor high above target".
				// So server should do the same.

				proj := &Entity{
					ID:      fmt.Sprintf("proj-meteor-%d", time.Now().UnixNano()),
					Type:    TypeProjectile,
					SubType: "Meteor",
					X:       targetX,
					Y:       30.0, // High up
					Z:       targetZ,
					VelX:    0,
					VelZ:    0, // Only falls? Server doesn't simulate Y gravity usually.
					// But we can simulate "Time to Impact" by using a timer or just velocity if we had Y.
					// Since server is 2D mostly, we can just use a timer-based projectile or a "Zone" that explodes later.
					// But to match client "projectile", let's use a Zone that triggers after 1.5s.
					// Wait, I said I'd use a projectile.
					// If I use a Zone with 1.5s delay, it's same as sleep but managed in update loop.
					// Let's use a "Meteor" entity that counts down.
					Radius:    8.0,
					Damage:    damage,
					OwnerID:   player.ID,
					CreatedAt: time.Now(),
					// Use LastAttackTime as "Impact Time"
					LastAttackTime: time.Now().Add(1500 * time.Millisecond),
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)

				player.State = "ATTACKING"
				setCooldown(15 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Inferno Cataclysm" {
			// Inferno Cataclysm (AoE Zone)
			cost := 60
			if player.Mana >= cost {
				player.Mana -= cost

				// Spawn Zone
				zone := &Entity{
					ID:        fmt.Sprintf("zone-inferno-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "Zone", // Needs to handle damage ticks in updateEntity
					X:         targetX,
					Y:         0.1,
					Z:         targetZ,
					Radius:    12.0,
					Damage:    30 + player.Stats.Intelligence,
					OwnerID:   player.ID,
					CreatedAt: time.Now(),
				}
				w.Entities[zone.ID] = zone
				w.Grid.Add(zone)

				player.State = "ATTACKING"
				setCooldown(60 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}

				go func(pid string) {
					time.Sleep(1 * time.Second)
					w.mu.Lock()
					if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
						p.State = "IDLE"
					}
					w.mu.Unlock()
				}(player.ID)
			}
		} else if skillName == "Scorch Beam" {
			// Scorch Beam (Line Damage)
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost

				rangeDist := 15.0
				width := 1.0
				damage := 25 + (player.Stats.Intelligence * 2)

				// Line Check
				// Vector from player to target
				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}
				dirX := dx / dist
				dirZ := dz / dist

				// Check all entities
				// This is expensive, maybe optimize with Grid?
				// Grid.Nearby with max range
				nearby := w.Grid.Nearby(player.X, player.Z, rangeDist)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					tx, tz := target.X, target.Z
					target.mu.RUnlock()

					// Project target onto line
					vX := tx - player.X
					vZ := tz - player.Z
					t := vX*dirX + vZ*dirZ

					if t > 0 && t < rangeDist {
						// Closest point on line
						cX := player.X + dirX*t
						cZ := player.Z + dirZ*t

						// Distance to line
						d2 := (tx-cX)*(tx-cX) + (tz-cZ)*(tz-cZ)
						if d2 < width*width {
							// Hit
							target.mu.Lock()
							target.Health -= damage
							// Armor Melt logic?
							isDead := target.Health <= 0
							target.mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}
							if isDead {
								target.mu.Lock()
								w.handleDeath(target, player, nil)
								target.mu.Unlock()
							}
						}
					}
				}

				player.State = "ATTACKING"
				setCooldown(8 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}

				go func(pid string) {
					time.Sleep(1 * time.Second)
					w.mu.Lock()
					if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
						p.State = "IDLE"
					}
					w.mu.Unlock()
				}(player.ID)
			}
		} else if skillName == "Dragonfire Lance" {
			// Dragonfire Lance (Single Target Nuke)
			cost := 50
			if player.Mana >= cost {
				player.Mana -= cost

				damage := 100 + (player.Stats.Intelligence * 5)

				// Projectile
				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}
				velX := (dx / dist) * 40.0
				velZ := (dz / dist) * 40.0

				proj := &Entity{
					ID:        fmt.Sprintf("proj-lance-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "Fireball", // Reuse fireball visual but bigger?
					X:         player.X,
					Y:         1.5,
					Z:         player.Z,
					VelX:      velX,
					VelZ:      velZ,
					Radius:    1.0,
					Damage:    damage,
					OwnerID:   player.ID,
					Rotation:  math.Atan2(velX, velZ),
					CreatedAt: time.Now(),
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)

				player.State = "ATTACKING"
				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}

				go func(pid string) {
					time.Sleep(1 * time.Second)
					w.mu.Lock()
					if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
						p.State = "IDLE"
					}
					w.mu.Unlock()
				}(player.ID)
			}
		} else if skillName == "Frost Nova" {
			// Frost Nova
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 8.0
				damage := 25 + (player.Stats.Intelligence * 2)

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := player.X - target.X
					dz := player.Z - target.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}

						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}

				player.State = "ATTACKING"
				setCooldown(10 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}

				go func(pid string) {
					time.Sleep(1 * time.Second)
					w.mu.Lock()
					if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
						p.State = "IDLE"
					}
					w.mu.Unlock()
				}(player.ID)
			}
		} else if skillName == "Arcane Missiles" {
			// Arcane Missiles
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}

				baseAngle := math.Atan2(dz, dx)
				angles := []float64{baseAngle - 0.2, baseAngle, baseAngle + 0.2}

				for i, angle := range angles {
					velX := math.Cos(angle) * 25.0
					velZ := math.Sin(angle) * 25.0

					damage := 15 + player.Stats.Intelligence

					proj := &Entity{
						ID:        fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
						Type:      TypeProjectile,
						SubType:   "ArcaneMissile",
						X:         player.X,
						Y:         1.5,
						Z:         player.Z,
						VelX:      velX,
						VelZ:      velZ,
						Radius:    1.0,
						Damage:    damage,
						OwnerID:   player.ID,
						Rotation:  angle,
						CreatedAt: time.Now(),
					}
					w.Entities[proj.ID] = proj
					w.Grid.Add(proj)
				}

				player.State = "ATTACKING"
				setCooldown(4 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Teleport" {
			// Teleport
			cost := 40
			if player.Mana >= cost {
				// Max Range Check
				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				maxRange := 15.0

				if dist <= maxRange {
					player.Mana -= cost
					oldX, oldZ := player.X, player.Z

					// Clamp to bounds
					if targetX < -1000 {
						targetX = -1000
					}
					if targetX > 1000 {
						targetX = 1000
					}
					if targetZ < -2200 {
						targetZ = -2200
					}
					if targetZ > 1000 {
						targetZ = 1000
					}

					player.X = targetX
					player.Z = targetZ
					w.Grid.Update(player, oldX, oldZ)

					setCooldown(12 * time.Second)
					if w.OnEvent != nil {
						w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
					}
				}
			}
		}

	case "Rogue":
		if skillName == "Stealth" {
			// Stealth (Buff)
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost
				player.StealthActive = true
				player.StealthEndTime = time.Now().Add(10 * time.Second)
				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Shadow Strike" {
			// Shadow Strike (Teleport + Damage)
			cost := 35
			if player.Mana >= cost {
				// Teleport behind target
				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if dist <= 10.0 { // Max range
					player.Mana -= cost

					// Calculate position behind target
					// Normalize direction
					dirX := dx / dist
					dirZ := dz / dist

					// Teleport to other side
					destX := targetX + dirX*1.0
					destZ := targetZ + dirZ*1.0

					oldX, oldZ := player.X, player.Z
					player.X = destX
					player.Z = destZ
					w.Grid.Update(player, oldX, oldZ)

					// Deal Damage
					damage := int(float64(player.Damage) * 2.0)
					if player.StealthActive {
						damage = int(float64(damage) * 1.5)
						player.StealthActive = false // Break stealth
					}

					// Find target at location
					nearby := w.Grid.Nearby(targetX, targetZ, 2.0)
					for _, target := range nearby {
						if target.ID == player.ID {
							continue
						}
						target.mu.Lock()
						if target.Type == TypeEnemy && target.State != "DEAD" {
							target.Health -= damage

							// Apply Bleed
							target.Bleeding = true
							target.BleedDamage = 10 + (player.Stats.Dexterity / 2)
							target.BleedEndTime = time.Now().Add(10 * time.Second)

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}
							if target.Health <= 0 {
								w.handleDeath(target, player, nil)
							}
						}
						target.mu.Unlock()
					}

					setCooldown(10 * time.Second)
					if w.OnEvent != nil {
						w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
					}
				}
			}
		} else if skillName == "Weak Point Mark" {
			// Weak Point Mark (Debuff)
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost

				// Find target near cursor
				var bestTarget *Entity
				minDist := 3.0
				nearby := w.Grid.Nearby(targetX, targetZ, 5.0)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - targetX
					dz := target.Z - targetZ
					target.mu.RUnlock()

					d := math.Sqrt(dx*dx + dz*dz)
					if d < minDist {
						minDist = d
						bestTarget = target
					}
				}

				if bestTarget != nil {
					bestTarget.mu.Lock()
					bestTarget.WeakPointMarked = true
					bestTarget.WeakPointEndTime = time.Now().Add(10 * time.Second)
					bestTarget.mu.Unlock()
				}

				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Ricochet Blades" {
			// Ricochet Blades (Projectile)
			cost := 20
			if player.Mana >= cost {
				player.Mana -= cost

				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}

				velX := (dx / dist) * 25.0
				velZ := (dz / dist) * 25.0

				damage := 15 + int(float64(player.Stats.Dexterity)*1.2)

				proj := &Entity{
					ID:        fmt.Sprintf("proj-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "Dagger", // Reuse Dagger visual
					X:         player.X,
					Y:         1.0,
					Z:         player.Z,
					VelX:      velX,
					VelZ:      velZ,
					Radius:    1.5,
					Damage:    damage,
					OwnerID:   player.ID,
					Rotation:  math.Atan2(velX, velZ),
					CreatedAt: time.Now(),
					// Bounces logic would need to be in updateProjectiles, but for now just a projectile
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)

				setCooldown(8 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Poison Coating" {
			// Poison Coating (Buff)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost
				player.PoisonCoatingActive = true
				player.PoisonCoatingEndTime = time.Now().Add(15 * time.Second)
				setCooldown(30 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Explosive Trap" {
			// Explosive Trap
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				trap := &Entity{
					ID:        fmt.Sprintf("trap-exp-%d", time.Now().UnixNano()),
					Type:      TypeProjectile, // Handled in updateProjectiles
					SubType:   "ExplosiveTrap",
					X:         player.X,
					Y:         0.5,
					Z:         player.Z,
					VelX:      0,
					VelZ:      0,
					Radius:    1.0,
					Damage:    50 + (player.Stats.Dexterity * 3),
					OwnerID:   player.ID,
					CreatedAt: time.Now(),
					// Custom field for trap duration? Projectiles usually expire by distance/time.
					// We'll need to ensure updateProjectiles doesn't kill it immediately.
				}
				w.Entities[trap.ID] = trap
				w.Grid.Add(trap)

				setCooldown(15 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Snare Trap" {
			// Snare Trap
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost

				trap := &Entity{
					ID:        fmt.Sprintf("trap-snare-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "SnareTrap",
					X:         player.X,
					Y:         0.5,
					Z:         player.Z,
					VelX:      0,
					VelZ:      0,
					Radius:    1.0,
					Damage:    10, // Low damage, mostly root
					OwnerID:   player.ID,
					CreatedAt: time.Now(),
				}
				w.Entities[trap.ID] = trap
				w.Grid.Add(trap)

				setCooldown(18 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Rain of Arrows" {
			// Rain of Arrows (AoE)
			cost := 45
			if player.Mana >= cost {
				player.Mana -= cost

				// Target area
				radius := 6.0
				damage := 20 + (player.Stats.Dexterity * 2)

				nearby := w.Grid.Nearby(targetX, targetZ, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.Lock()
					if target.Type == TypeEnemy && target.State != "DEAD" {
						dx := target.X - targetX
						dz := target.Z - targetZ
						if (dx*dx + dz*dz) <= radius*radius {
							target.Health -= damage
							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}
							if target.Health <= 0 {
								w.handleDeath(target, player, nil)
							}
						}
					}
					target.mu.Unlock()
				}

				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Piercing Throw" {
			// Throw Dagger
			cost := 15
			if player.Mana >= cost {
				player.Mana -= cost

				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}

				velX := (dx / dist) * 35.0 // Speed 35
				velZ := (dz / dist) * 35.0

				damage := 15 + int(float64(player.Stats.Dexterity)*1.5)

				proj := &Entity{
					ID:        fmt.Sprintf("proj-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "Dagger",
					X:         player.X,
					Y:         1.0,
					Z:         player.Z,
					VelX:      velX,
					VelZ:      velZ,
					Radius:    1.5,
					Damage:    damage,
					OwnerID:   player.ID,
					Rotation:  math.Atan2(velX, velZ),
					CreatedAt: time.Now(),
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
				setCooldown(1 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Fan of Knives" {
			// Fan of Knives
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost

				projectileCount := 12
				angleStep := (2 * math.Pi) / float64(projectileCount)

				for i := 0; i < projectileCount; i++ {
					angle := float64(i) * angleStep
					velX := math.Cos(angle) * 25.0
					velZ := math.Sin(angle) * 25.0

					damage := 10 + player.Stats.Dexterity

					proj := &Entity{
						ID:        fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
						Type:      TypeProjectile,
						SubType:   "Dagger",
						X:         player.X,
						Y:         1.0,
						Z:         player.Z,
						VelX:      velX,
						VelZ:      velZ,
						Radius:    1.0,
						Damage:    damage,
						OwnerID:   player.ID,
						Rotation:  angle,
						CreatedAt: time.Now(),
					}
					w.Entities[proj.ID] = proj
					w.Grid.Add(proj)
				}

				setCooldown(6 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Backstab" {
			// Backstab
			cost := 20
			if player.Mana >= cost {
				player.Mana -= cost

				rangeDist := 2.5
				damage := int(float64(player.Damage) * 1.5)

				// Find target
				var bestTarget *Entity
				minDist := rangeDist

				nearby := w.Grid.Nearby(player.X, player.Z, rangeDist)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					d := math.Sqrt(dx*dx + dz*dz)
					if d < minDist {
						minDist = d
						bestTarget = target
					}
				}

				if bestTarget != nil {
					// Check angle for backstab
					bestTarget.mu.RLock()
					tRot := bestTarget.Rotation
					bestTarget.mu.RUnlock()

					tDirX := math.Sin(tRot)
					tDirZ := math.Cos(tRot)

					pDirX := math.Sin(player.Rotation)
					pDirZ := math.Cos(player.Rotation)

					dot := tDirX*pDirX + tDirZ*pDirZ

					if dot > 0.5 { // Same direction -> Behind
						damage = int(float64(damage) * 2.5)
					}

					bestTarget.mu.Lock()
					bestTarget.Health -= damage
					isDead := bestTarget.Health <= 0
					bestTarget.mu.Unlock()

					if w.OnEvent != nil {
						w.OnEvent("damage", DamageEvent{TargetID: bestTarget.ID, SourceID: player.ID, Amount: damage})
					}
					if isDead {
						bestTarget.mu.Lock()
						w.handleDeath(bestTarget, player, nil)
						bestTarget.mu.Unlock()
					}
				}

				setCooldown(6 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Shadow Lunge" {
			// Teleport Behind
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost

				// Find target
				var bestTarget *Entity
				minDist := 10.0 // Range

				nearby := w.Grid.Nearby(targetX, targetZ, 5.0)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - targetX
					dz := target.Z - targetZ
					target.mu.RUnlock()

					d := math.Sqrt(dx*dx + dz*dz)
					if d < minDist {
						minDist = d
						bestTarget = target
					}
				}

				if bestTarget != nil {
					bestTarget.mu.RLock()
					tRot := bestTarget.Rotation
					tx, tz := bestTarget.X, bestTarget.Z
					bestTarget.mu.RUnlock()

					// Behind position
					tDirX := math.Sin(tRot)
					tDirZ := math.Cos(tRot)

					teleX := tx - tDirX*1.5
					teleZ := tz - tDirZ*1.5

					oldX, oldZ := player.X, player.Z
					player.X = teleX
					player.Z = teleZ
					player.Rotation = tRot
					w.Grid.Update(player, oldX, oldZ)
				}

				setCooldown(10 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Blade Storm" {
			// Cone of Daggers
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				dx := targetX - player.X
				dz := targetZ - player.Z
				baseAngle := math.Atan2(dx, dz)
				angleStep := math.Pi / 8

				for i := -2; i <= 2; i++ {
					angle := baseAngle + float64(i)*angleStep
					velX := math.Sin(angle) * 35.0
					velZ := math.Cos(angle) * 35.0

					damage := 10 + player.Stats.Dexterity

					proj := &Entity{
						ID:        fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
						Type:      TypeProjectile,
						SubType:   "Dagger",
						X:         player.X,
						Y:         1.0,
						Z:         player.Z,
						VelX:      velX,
						VelZ:      velZ,
						Radius:    1.0,
						Damage:    damage,
						OwnerID:   player.ID,
						Rotation:  angle,
						CreatedAt: time.Now(),
					}
					w.Entities[proj.ID] = proj
					w.Grid.Add(proj)
				}

				setCooldown(15 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Death Spiral" {
			// AoE
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 4.0
				damage := player.Damage * 2

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}
						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}
				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Cloak & Vanish" {
			// Stealth + Speed
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				player.StealthActive = true
				player.StealthEndTime = time.Now().Add(5 * time.Second)

				setCooldown(30 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Smoke Bomb" {
			// Smoke Bomb (AoE Slow)
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 5.0
				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.Type == TypeEnemy && target.State != "DEAD" {
						target.mu.Lock()
						target.Slowed = true
						target.SlowEndTime = time.Now().Add(5 * time.Second)
						target.mu.Unlock()
					}
				}

				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Tripwire" {
			// Tripwire (Trap)
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost

				trap := &Entity{
					ID:        fmt.Sprintf("trap-trip-%d", time.Now().UnixNano()),
					Type:      TypeProjectile,
					SubType:   "Tripwire",
					X:         player.X,
					Y:         0.1,
					Z:         player.Z,
					Radius:    1.5,
					Damage:    20 + player.Stats.Dexterity,
					OwnerID:   player.ID,
					CreatedAt: time.Now(),
				}
				w.Entities[trap.ID] = trap
				w.Grid.Add(trap)

				setCooldown(15 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Phantom Volley" {
			// Phantom Volley (Rapid Fire Single Target)
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost

				dx := targetX - player.X
				dz := targetZ - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist == 0 {
					dist = 1
				}
				dirX := dx / dist
				dirZ := dz / dist

				// Fire 3 projectiles in a line with spacing to simulate rapid fire
				for i := 0; i < 3; i++ {
					// Offset backwards so they arrive sequentially
					// Speed is 35. 0.15s delay approx 5 units.
					offset := float64(i) * -5.0

					proj := &Entity{
						ID:        fmt.Sprintf("proj-phantom-%d-%d", time.Now().UnixNano(), i),
						Type:      TypeProjectile,
						SubType:   "PhantomArrow",
						X:         player.X + (dirX * offset),
						Y:         1.0,
						Z:         player.Z + (dirZ * offset),
						VelX:      dirX * 35.0,
						VelZ:      dirZ * 35.0,
						Radius:    0.5,
						Damage:    25 + (player.Stats.Dexterity * 2),
						OwnerID:   player.ID,
						Rotation:  math.Atan2(dirX, dirZ),
						CreatedAt: time.Now(),
					}
					w.Entities[proj.ID] = proj
					w.Grid.Add(proj)
				}

				setCooldown(18 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		}

	case "Cleric":
		if skillName == "Divine Intervention" {
			// Divine Intervention (Buff/Heal)
			cost := 60
			if player.Mana >= cost {
				player.Mana -= cost
				player.DivineInterventionActive = true
				player.DivineInterventionEndTime = time.Now().Add(5 * time.Second)

				// Big Heal
				heal := player.MaxHealth / 2
				player.Health += heal
				if player.Health > player.MaxHealth {
					player.Health = player.MaxHealth
				}

				setCooldown(120 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Guardian Embrace" {
			// Guardian Embrace (HoT Aura)
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost
				player.GuardianEmbraceActive = true
				player.GuardianEmbraceEndTime = time.Now().Add(10 * time.Second)
				setCooldown(30 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Purifying Wave" {
			// Purifying Wave (AoE Cleanse)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 8.0
				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.Type == TypePlayer || target.Type == TypeNPC {
						target.mu.Lock()
						// Cleanse Debuffs
						target.Bleeding = false
						target.Poisoned = false
						target.Slowed = false
						target.Stunned = false
						target.Rooted = false
						target.WeakPointMarked = false
						target.mu.Unlock()
					}
				}

				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Spirit Guardians Boost" {
			// Spirit Guardians Boost (Buff)
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost
				player.SpiritsActive = true
				player.SpiritsBoosted = true
				player.SpiritEndTime = time.Now().Add(10 * time.Second)
				// Boost logic would be in updateEntity where spirits do damage
				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Avenging Seraph" {
			// Avenging Seraph (Summon)
			cost := 60
			if player.Mana >= cost {
				player.Mana -= cost

				// Summon Entity
				seraph := &Entity{
					ID:        fmt.Sprintf("summon-seraph-%d", time.Now().UnixNano()),
					Type:      TypeNPC, // Or specialized summon type
					SubType:   "AvengingSeraph",
					X:         player.X,
					Y:         0,
					Z:         player.Z,
					OwnerID:   player.ID,
					Health:    500 + (player.Stats.Wisdom * 10),
					MaxHealth: 500 + (player.Stats.Wisdom * 10),
					Damage:    50 + (player.Stats.Wisdom * 2),
					State:     "IDLE",
					CreatedAt: time.Now(),
				}
				// w.AddEntity(seraph) // DEADLOCK: PerformAbility already holds w.mu
				w.Entities[seraph.ID] = seraph
				w.Grid.Add(seraph)

				setCooldown(45 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Smite" {
			// Smite (Damage + Stun)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				damage := 30 + (player.Stats.Wisdom * 2)

				// Single Target
				var target *Entity
				if targetID != "" {
					if t, ok := w.Entities[targetID]; ok {
						target = t
					}
				} else {
					// Find closest enemy
					minDist := 4.0
					nearby := w.Grid.Nearby(targetX, targetZ, 4.0)
					for _, t := range nearby {
						if t.Type == TypeEnemy && t.State != "DEAD" {
							dx := t.X - targetX
							dz := t.Z - targetZ
							d := math.Sqrt(dx*dx + dz*dz)
							if d < minDist {
								minDist = d
								target = t
							}
						}
					}
				}

				if target != nil {
					target.mu.Lock()
					target.Health -= damage
					target.Stunned = true
					target.StunEndTime = time.Now().Add(2 * time.Second)

					if w.OnEvent != nil {
						w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
					}
					if target.Health <= 0 {
						w.handleDeath(target, player, nil)
					}
					target.mu.Unlock()
				}

				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Blessing of Resolve" {
			// Blessing of Resolve (Buff)
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost
				player.BlessingResolveActive = true
				player.BlessingResolveEndTime = time.Now().Add(20 * time.Second)
				setCooldown(45 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Spirit Guardians" {
			// Guardian Spirits
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost
				player.SpiritsActive = true
				player.SpiritsBoosted = false
				player.SpiritEndTime = time.Now().Add(8 * time.Second)
				player.State = "ATTACKING"
				setCooldown(10 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Healing Light" {
			// Same as Heal
			cost := 25
			if player.Mana >= cost {
				player.Mana -= cost
				healAmount := 30 + (player.Stats.Wisdom * 3)

				var target *Entity
				// Find target near cursor if targetID not set
				if targetID != "" {
					if t, ok := w.Entities[targetID]; ok {
						target = t
					}
				} else {
					// Find closest ally
					minDist := 3.0
					nearby := w.Grid.Nearby(targetX, targetZ, 5.0)
					for _, t := range nearby {
						if t.Type == TypePlayer || t.Type == TypeNPC { // Ally
							dx := t.X - targetX
							dz := t.Z - targetZ
							d := math.Sqrt(dx*dx + dz*dz)
							if d < minDist {
								minDist = d
								target = t
							}
						}
					}
				}

				if target == nil {
					target = player
				}

				target.mu.Lock()
				target.Health += healAmount
				if target.Health > target.MaxHealth {
					target.Health = target.MaxHealth
				}
				target.mu.Unlock()

				setCooldown(5 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Radiant Strike" {
			// Cone Damage
			cost := 20
			if player.Mana >= cost {
				player.Mana -= cost

				rangeDist := 3.0
				angleThreshold := math.Pi / 3 // 60 degrees
				damage := player.Damage + (player.Stats.Wisdom * 2)

				pDirX := math.Sin(player.Rotation)
				pDirZ := math.Cos(player.Rotation)

				nearby := w.Grid.Nearby(player.X, player.Z, rangeDist)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					dist := math.Sqrt(dx*dx + dz*dz)
					if dist <= rangeDist {
						dirX := dx / dist
						dirZ := dz / dist

						dot := pDirX*dirX + pDirZ*dirZ
						if dot > math.Cos(angleThreshold) {
							target.mu.Lock()
							target.Health -= damage
							isDead := target.Health <= 0
							target.mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
							}
							if isDead {
								target.mu.Lock()
								w.handleDeath(target, player, nil)
								target.mu.Unlock()
							}
						}
					}
				}
				setCooldown(4 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Heaven's Trumpet" {
			// AoE Stun/Damage
			cost := 50
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 12.0
				damage := player.Stats.Wisdom * 3

				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}

					target.mu.RLock()
					if target.Type != TypeEnemy || target.State == "DEAD" {
						target.mu.RUnlock()
						continue
					}
					dx := target.X - player.X
					dz := target.Z - player.Z
					target.mu.RUnlock()

					if (dx*dx + dz*dz) <= radius*radius {
						target.mu.Lock()
						target.Health -= damage
						// Stun logic would go here
						isDead := target.Health <= 0
						target.mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: player.ID, Amount: damage})
						}
						if isDead {
							target.mu.Lock()
							w.handleDeath(target, player, nil)
							target.mu.Unlock()
						}
					}
				}
				setCooldown(60 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Consecrated Ground" {
			// Zone AoE
			cost := 40
			if player.Mana >= cost {
				player.Mana -= cost

				// Spawn Zone Entity
				zone := &Entity{
					ID:        fmt.Sprintf("zone-%d", time.Now().UnixNano()),
					Type:      TypeProjectile, // Reuse projectile for now
					SubType:   "Zone",
					X:         player.X,
					Y:         0.1,
					Z:         player.Z,
					Radius:    5.0,
					Damage:    20 + (player.Stats.Wisdom * 1),
					OwnerID:   player.ID,
					CreatedAt: time.Now(),
					// Zone specific data could be stored in fields or inferred from SubType
				}
				w.Entities[zone.ID] = zone
				w.Grid.Add(zone)

				setCooldown(12 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Blessing of Zeal" {
			// AoE Buff
			cost := 35
			if player.Mana >= cost {
				player.Mana -= cost

				radius := 10.0
				nearby := w.Grid.Nearby(player.X, player.Z, radius)
				for _, target := range nearby {
					if target.Type == TypePlayer || target.Type == TypeNPC {
						target.mu.Lock()
						target.ZealActive = true
						target.ZealEndTime = time.Now().Add(8 * time.Second)
						target.mu.Unlock()
					}
				}

				setCooldown(25 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		} else if skillName == "Mark of Weakness" {
			// Mark of Weakness (Debuff)
			cost := 30
			if player.Mana >= cost {
				player.Mana -= cost

				// Find target
				var target *Entity
				if targetID != "" {
					if t, ok := w.Entities[targetID]; ok {
						target = t
					}
				} else {
					// Closest enemy
					minDist := 5.0
					nearby := w.Grid.Nearby(targetX, targetZ, 5.0)
					for _, t := range nearby {
						if t.Type == TypeEnemy && t.State != "DEAD" {
							d := math.Sqrt((t.X-targetX)*(t.X-targetX) + (t.Z-targetZ)*(t.Z-targetZ))
							if d < minDist {
								minDist = d
								target = t
							}
						}
					}
				}

				if target != nil {
					target.mu.Lock()
					target.WeakPointMarked = true
					target.WeakPointEndTime = time.Now().Add(10 * time.Second)
					target.mu.Unlock()
				}

				setCooldown(20 * time.Second)
				if w.OnEvent != nil {
					w.OnEvent("ability", AbilityEvent{SourceID: player.ID, TargetID: targetID, SkillName: skillName, TargetX: targetX, TargetZ: targetZ})
				}
			}
		}
	}
}

func (w *World) PerformSelectBranch(playerID, branch string) (*Entity, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

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
	w.mu.Lock()
	defer w.mu.Unlock()

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
	if target.State == "DEAD" {
		return
	}

	target.Health = 0
	target.State = "DEAD"
	target.LastAttackTime = time.Now()

	if attacker != nil && attacker.Type == TypePlayer && target.Type == TypeEnemy {
		// Capture data for async processing to avoid deadlocks
		tLevel := target.Level
		tSubType := target.SubType
		tID := target.ID
		tX, tZ := target.X, target.Z

		go func() {
			// XP
			baseXpReward := tLevel*10 + 10
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

			// Gold
			baseGold := 0
			if tLevel > 0 {
				baseGold = rand.Intn(tLevel*10) + 10
			}

			// Party Logic
			var partyMembers []*Entity

			// We need to access Party, which requires w.mu.RLock via GetParty
			// Since we are in a goroutine and not holding any locks, this is safe.
			if attacker.PartyID != "" {
				party := w.GetParty(attacker.PartyID)
				if party != nil {
					_, _, memberIDs := party.GetSnapshot()
					for _, mid := range memberIDs {
						member := w.GetEntity(mid)
						if member != nil {
							// Check distance (e.g., 50 units) to share XP
							dx := member.X - tX
							dz := member.Z - tZ
							if math.Sqrt(dx*dx+dz*dz) <= 50.0 {
								partyMembers = append(partyMembers, member)
							}
						}
					}
				}
			}

			if len(partyMembers) > 0 {
				// Calculate Bonus
				bonusMultiplier := 1.0 + (float64(len(partyMembers)) * 0.10)
				totalXP := int(float64(baseXpReward) * bonusMultiplier)
				totalGold := int(float64(baseGold) * bonusMultiplier)

				xpPerMember := totalXP / len(partyMembers)
				goldPerMember := totalGold / len(partyMembers)

				for _, member := range partyMembers {
					member.mu.Lock()
					member.Experience += xpPerMember
					member.Gold += goldPerMember

					// Update Quests for all party members
					w.UpdateQuestProgress(member, tSubType)

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
					member.mu.Unlock()
				}
			} else {
				// Solo Logic
				attacker.mu.Lock()
				attacker.Experience += baseXpReward
				attacker.Gold += baseGold
				if attacker.MaxExperience == 0 {
					attacker.MaxExperience = 100
				}

				// Update Quests
				w.UpdateQuestProgress(attacker, tSubType)

				for attacker.Experience >= attacker.MaxExperience {
					if attacker.Level >= 100 {
						attacker.Experience = attacker.MaxExperience
						break
					}
					attacker.Experience -= attacker.MaxExperience
					attacker.Level++
					// Exponential Curve: 100 * (1.2 ^ (Level-1))
					attacker.MaxExperience = int(100 * math.Pow(1.2, float64(attacker.Level-1)))

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
				attacker.mu.Unlock()
			}

			// Loot
			// Check if Elite
			isElite := strings.HasPrefix(tID, "elite-")
			dropCount := 0
			if isElite {
				dropCount = 3 // Elites drop 3 items guaranteed
			} else if rand.Float64() < 0.5 && tLevel > 0 {
				dropCount = 1 // Normal enemies have 50% chance for 1 item
			}

			if dropCount > 0 {
				w.mu.Lock() // Lock world to add entities
				for i := 0; i < dropCount; i++ {
					var item *Item
					if isElite {
						item = GenerateEliteLoot(tLevel)
					} else {
						item = GenerateLoot(tLevel)
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
				w.mu.Unlock()
			}
		}()
	}
}

func (w *World) GetState() map[string]*Entity {
	w.mu.RLock()
	defer w.mu.RUnlock()

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
	w.mu.RLock()
	defer w.mu.RUnlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return make(map[string]*Entity)
	}

	// Query Grid
	nearby := w.Grid.Nearby(player.X, player.Z, viewDistance)

	// Optimization: Pre-allocate map size to avoid re-allocations
	state := make(map[string]*Entity, len(nearby)+1)

	// Always include self
	state[playerID] = w.copyEntity(player)

	for _, v := range nearby {
		if v.ID == playerID {
			continue
		}
		// Precise distance check
		dx := v.X - player.X
		dz := v.Z - player.Z
		distSq := dx*dx + dz*dz

		if distSq <= viewDistance*viewDistance {
			state[v.ID] = w.copyEntity(v)
		}
	}
	return state
}

func (w *World) copyEntity(v *Entity) *Entity {
	// Shallow copy & strip
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
		Equipment:         v.Equipment,
	}

	if len(e.Equipment) > 0 {
		newEquip := make(map[string]Item)
		for slot, item := range e.Equipment {
			newItem := item
			newItem.Description = ""
			newEquip[slot] = newItem
		}
		e.Equipment = newEquip
	}
	return &e
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

	// Add Equipment Stats
	for _, item := range e.Equipment {
		totalStr += item.Stats["strength"]
		totalDex += item.Stats["dexterity"]
		totalInt += item.Stats["intelligence"]
		totalWis += item.Stats["wisdom"]
		totalVit += item.Stats["vitality"]

		flatDamage += item.Stats["damage"]
		flatDefense += item.Stats["defense"]
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

	e.Damage = (totalStr * 2) + flatDamage
	e.Defense = flatDefense

	// Speed Calculation
	e.Speed = (3.0 + (float64(totalDex) * 0.5)) * 1.2

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
	e.CastSpeed = 1.0 + (float64(totalWis)/5.0)*0.01

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
	if e.Slowed {
		e.Speed *= (1.0 - e.SlowFactor)
	}
}
