package game

import (
	"fmt"
	"math"
	"math/rand"
	"runtime"
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

	TargetX float64 `json:"-"`
	TargetZ float64 `json:"-"`
	SpawnX  float64 `json:"-"`
	SpawnZ  float64 `json:"-"`
	State   string  `json:"state"` // IDLE, MOVING, ATTACKING, DEAD

	// Combat
	LastAttackTime  time.Time     `json:"-"`
	AttackCooldown  time.Duration `json:"-"`
	LastAbilityTime time.Time     `json:"-"`
	AbilityCooldown time.Duration `json:"-"`
	LastRespawnTime time.Time     `json:"-"`

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
	SpiritEndTime  time.Time `json:"-"`
	LastSpiritTick time.Time `json:"-"`
	IsCharging     bool      `json:"isCharging,omitempty"`
	ChargeTargetX  float64   `json:"-"`
	ChargeTargetZ  float64   `json:"-"`
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

func NewWorld() *World {
	w := &World{
		Entities:        make(map[string]*Entity),
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
	// Area 1: 50-54 (Siren)
	// Z range: -600 to -1000
	// X range: -1000 to 1000 (Width of the snow path)

	count := 300
	minZ := -1000.0 + 5.0
	maxZ := -600.0 - 5.0
	minX := -1000.0 + 5.0
	maxX := 1000.0 - 5.0

	for i := 0; i < count; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := minZ + rand.Float64()*(maxZ-minZ)

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
			Level:          52,
			Speed:          5.4,
			State:          "IDLE",
			AttackSpeed:    attackSpeed,
			AttackCooldown: attackCooldown,
		}
		w.AddEntity(siren)
	}

	// Area 2: 54-58 (Frost Guardian)
	// Z range: -1000 to -1400 (North of Sirens)
	// X range: -1000 to 1000

	fgCount := 300
	fgMinZ := -1400.0 + 5.0
	fgMaxZ := -1000.0 - 5.0

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
			Level:          56,
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

func (w *World) spawnMerchant() {
	merchant := &Entity{
		ID:       "merchant-1",
		Type:     TypeNPC,
		SubType:  "DwarfSalesman",
		X:        5,
		Y:        0,
		Z:        205, // Moved to new town center (0, 200)
		Rotation: 0,
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
			case "Siren":
				expectedXP = 1000000
			case "FrostGuardian":
				expectedXP = 1500000
			}
			if expectedXP > 0 && q.RewardXP != expectedXP {
				q.RewardXP = expectedXP
				updated = true
			}
		}
		if updated {
			fmt.Printf("Updated daily quest rewards for %s\n", player.Name)
		}
		return player // Already has quests for today
	}

	fmt.Printf("Generating daily quests for %s (Last: %v, Now: %v)\n", player.Name, player.LastDailyQuest, now)

	// Generate 7 Daily Quests
	player.Quests = []Quest{
		{ID: "daily_skeleton", Type: "KILL", Target: "Skeleton", Count: 0, MaxCount: 100, RewardXP: 50000, Completed: false, Accepted: false},
		{ID: "daily_imp", Type: "KILL", Target: "Imp", Count: 0, MaxCount: 100, RewardXP: 150000, Completed: false, Accepted: false},
		{ID: "daily_demonorc", Type: "KILL", Target: "DemonOrc", Count: 0, MaxCount: 100, RewardXP: 300000, Completed: false, Accepted: false},
		{ID: "daily_construct", Type: "KILL", Target: "Construct", Count: 0, MaxCount: 100, RewardXP: 500000, Completed: false, Accepted: false},
		{ID: "daily_infernotitan", Type: "KILL", Target: "InfernoTitan", Count: 0, MaxCount: 100, RewardXP: 800000, Completed: false, Accepted: false},
		{ID: "daily_siren", Type: "KILL", Target: "Siren", Count: 0, MaxCount: 100, RewardXP: 1000000, Completed: false, Accepted: false},
		{ID: "daily_frostguardian", Type: "KILL", Target: "FrostGuardian", Count: 0, MaxCount: 100, RewardXP: 1500000, Completed: false, Accepted: false},
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
	player.X = 0
	player.Z = 200
	player.TargetX = 0
	player.TargetZ = 200
	w.Grid.Update(player, oldX, oldZ) // Force update to 0,200
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
		// Lifetime check
		if time.Since(e.CreatedAt) > 5*time.Second {
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

				// Splash Damage (Fireball)
				if subType == "Fireball" {
					splashTargets := w.Grid.Nearby(projX, projZ, 10.0)
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

				if subType != "Dagger" {
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
		} else if e.SpiritsActive {
			// Cleric Spirits
			if time.Now().After(e.SpiritEndTime) {
				e.SpiritsActive = false
				e.mu.Unlock()
			} else {
				if time.Since(e.LastSpiritTick) >= 500*time.Millisecond {
					e.LastSpiritTick = time.Now()
					damage := 10 + (e.Stats.Wisdom * 1)
					pX, pZ := e.X, e.Z
					e.mu.Unlock() // Unlock before interaction

					nearby := w.Grid.Nearby(pX, pZ, 16.0)
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
					e.mu.Unlock()
				}
			}
		} else {
			e.mu.Unlock()
		}
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
			if e.State != "DEAD" {
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
		w.mu.Lock()
		defer w.mu.Unlock()

		att, ok := w.Entities[attID]
		if !ok || att.State == "DEAD" {
			return
		}
		tgt, ok := w.Entities[tgtID]
		if !ok || tgt.State == "DEAD" {
			return
		}

		damage := att.Damage - tgt.Defense
		if damage < 1 {
			damage = 1
		}
		tgt.Health -= damage

		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: tgt.ID, SourceID: att.ID, Amount: damage})
		}

		if tgt.Health <= 0 {
			w.handleDeath(tgt, att, nil)
		}
	}(attackerID, targetID, delay)

	return 0, true
}

func (w *World) PerformAbility(playerID string, targetX, targetZ float64, targetID string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok || player.State == "DEAD" {
		return
	}

	// Check Global Cooldown or Ability Cooldown
	// Apply Cooldown Reduction
	cooldown := player.AbilityCooldown
	if player.CooldownReduction > 0 {
		cooldown = time.Duration(float64(cooldown) * (1.0 - player.CooldownReduction))
	}

	if time.Since(player.LastAbilityTime) < cooldown {
		return
	}

	// Class Specific Logic
	switch player.SubType {
	case "Fighter":
		// Charge
		cost := 20
		if player.Mana >= cost {
			player.Mana -= cost
			player.IsCharging = true
			player.ChargeTargetX = targetX
			player.ChargeTargetZ = targetZ
			player.State = "ATTACKING" // Or special state?
			player.AbilityCooldown = 5 * time.Second
			player.LastAbilityTime = time.Now()
		}

	case "Wizard":
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
			player.AbilityCooldown = 2 * time.Second
			player.LastAbilityTime = time.Now()
		}

	case "Rogue":
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
			player.AbilityCooldown = 1 * time.Second
			player.LastAbilityTime = time.Now()
		}

	case "Cleric":
		// Guardian Spirits
		cost := 40
		if player.Mana >= cost {
			player.Mana -= cost
			player.SpiritsActive = true
			player.SpiritEndTime = time.Now().Add(8 * time.Second)
			player.State = "ATTACKING"
			player.AbilityCooldown = 10 * time.Second
			player.LastAbilityTime = time.Now()
		}
	}
}

func (w *World) handleDeath(target *Entity, attacker *Entity, deferred *deferredActions) {
	if target.State == "DEAD" {
		return
	}

	target.Health = 0
	target.State = "DEAD"
	target.LastAttackTime = time.Now()

	if attacker != nil && attacker.Type == TypePlayer && target.Type == TypeEnemy {
		// XP
		xpReward := target.Level*10 + 10
		if target.SubType == "InfernoTitan" {
			xpReward *= 3
		}
		if target.SubType == "Siren" {
			xpReward *= 3
		}

		attacker.Experience += xpReward
		if attacker.MaxExperience == 0 {
			attacker.MaxExperience = 100
		}

		// Update Quests
		w.UpdateQuestProgress(attacker, target.SubType)

		for attacker.Experience >= attacker.MaxExperience {
			if attacker.Level >= 100 {
				attacker.Experience = attacker.MaxExperience
				break
			}
			attacker.Experience -= attacker.MaxExperience
			attacker.Level++
			// Exponential Curve: 100 * (1.2 ^ (Level-1))
			attacker.MaxExperience = int(100 * math.Pow(1.2, float64(attacker.Level-1)))

			// Update Base Stats
			attacker.BaseStats.Vitality += 2
			attacker.BaseStats.Strength += 2
			attacker.BaseStats.Dexterity += 1
			attacker.BaseStats.Intelligence += 1
			attacker.BaseStats.Wisdom += 1

			attacker.RecalculateStats()
			attacker.Health = attacker.MaxHealth
		} // Loot
		gold := 0
		if target.Level > 0 {
			gold = rand.Intn(target.Level*10) + 10
		}
		attacker.Gold += gold

		// Check if Elite
		isElite := strings.HasPrefix(target.ID, "elite-")
		dropCount := 0
		if isElite {
			dropCount = 3 // Elites drop 3 items guaranteed
		} else if rand.Float64() < 0.5 && target.Level > 0 {
			dropCount = 1 // Normal enemies have 50% chance for 1 item
		}

		for i := 0; i < dropCount; i++ {
			var item *Item
			if isElite {
				item = GenerateEliteLoot(target.Level)
			} else {
				item = GenerateLoot(target.Level)
			}

			// Offset loot slightly so they don't stack perfectly
			offsetX := (rand.Float64() - 0.5) * 1.0
			offsetZ := (rand.Float64() - 0.5) * 1.0

			lootEntity := &Entity{
				ID:       fmt.Sprintf("loot-%d-%d", time.Now().UnixNano(), i),
				Type:     TypeLoot,
				X:        target.X + offsetX,
				Y:        0.5,
				Z:        target.Z + offsetZ,
				LootItem: item,
				LootTime: time.Now(),
			}
			if deferred != nil {
				deferred.addAddition(lootEntity)
			} else {
				w.Entities[lootEntity.ID] = lootEntity
				w.Grid.Add(lootEntity)
			}
		}
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
}
