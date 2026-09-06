package game

import (
	"eidolon-server/internal/database"
	"fmt"
	"hash/fnv"
	"log"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"
)

func hashAngle(key string) float64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	// Map uint32 -> [0, 2pi)
	return (float64(h.Sum32()) / float64(math.MaxUint32)) * (2.0 * math.Pi)
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

type World struct {
	Entities        map[string]*Entity
	Parties         map[string]*Party
	Trading         *TradingSystem
	Grid            *SpatialMap
	InstanceLayouts map[string]*DungeonInstance
	InstanceMu      sync.RWMutex
	DirectTrades    map[string]*DirectTrade
	TradeByPlayer   map[string]string
	Economy         *EconomyTelemetry
	PvP             *PvPSystem
	CrystalRepairs  map[string]*CrystalRepairState
	RepairMu        sync.RWMutex
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
	OnEvent            func(eventType string, data interface{})
	OnQuestUpdate      func(playerID string, quests []Quest)
	OnPvPMatchComplete func(result PvPMatchResult)
	OnPvPMatchUpdate   func(match *PvPMatch)
}

type DamageEvent struct {
	TargetID   string `json:"targetId"`
	SourceID   string `json:"sourceId"`
	Amount     int    `json:"amount"`
	Kind       string `json:"kind,omitempty"`
	InstanceID string `json:"instanceId,omitempty"`
}

type HealEvent struct {
	TargetID   string `json:"targetId"`
	SourceID   string `json:"sourceId"`
	Amount     int    `json:"amount"`
	Kind       string `json:"kind,omitempty"`
	InstanceID string `json:"instanceId,omitempty"`
}

type AbilityEvent struct {
	SourceID  string  `json:"sourceId"`
	TargetID  string  `json:"targetId"` // Optional
	SkillName string  `json:"skillName"`
	TargetX   float64 `json:"targetX"`
	TargetZ   float64 `json:"targetZ"`
}

// ProjectileImpactEvent is emitted at the authoritative collision point. It
// gives every observer the same impact identity and footprint instead of
// asking clients to infer a hit from interpolation or entity disappearance.
type ProjectileImpactEvent struct {
	ProjectileID   string  `json:"projectileId"`
	ProjectileType string  `json:"projectileType"`
	SourceID       string  `json:"sourceId"`
	TargetID       string  `json:"targetId,omitempty"`
	InstanceID     string  `json:"instanceId,omitempty"`
	SkillName      string  `json:"skillName,omitempty"`
	X              float64 `json:"x"`
	Y              float64 `json:"y"`
	Z              float64 `json:"z"`
	DirectionX     float64 `json:"directionX"`
	DirectionZ     float64 `json:"directionZ"`
	Radius         float64 `json:"radius"`
	Terminal       bool    `json:"terminal"`
}

type AttackEvent struct {
	SourceID string  `json:"sourceId"`
	TargetID string  `json:"targetId"`
	TargetX  float64 `json:"targetX"`
	TargetZ  float64 `json:"targetZ"`
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
	SourceID   string  `json:"sourceId"`
	X          float64 `json:"x"`
	Z          float64 `json:"z"`
	Radius     float64 `json:"radius"`
	Duration   float64 `json:"duration"` // seconds before impact
	Theme      string  `json:"theme,omitempty"`
	Attack     string  `json:"attack,omitempty"`
	ThreatTier string  `json:"threatTier,omitempty"`
	Label      string  `json:"label,omitempty"`
}

func NewWorld(db *database.DB) *World {
	economy := NewEconomyTelemetry(time.Now().UTC())
	w := &World{
		Entities:           make(map[string]*Entity),
		Parties:            make(map[string]*Party),
		Trading:            NewTradingSystem(db),
		Grid:               NewSpatialMap(50.0), // 50 unit cell size
		InstanceLayouts:    make(map[string]*DungeonInstance),
		DirectTrades:       make(map[string]*DirectTrade),
		TradeByPlayer:      make(map[string]string),
		Economy:            economy,
		PvP:                NewPvPSystem(),
		CrystalRepairs:     make(map[string]*CrystalRepairState),
		EliteSpawnTimer:    time.Now(),
		RegenTimer:         0,
		Hazards:            make(map[string]*Hazard),
		HazardDamageTimer:  0,
		PlayerHazardTicks:  make(map[string]map[string]float64),
		OnEvent:            func(eventType string, data interface{}) {}, // Default no-op
		OnQuestUpdate:      func(playerID string, quests []Quest) {},
		OnPvPMatchComplete: func(result PvPMatchResult) {},
		OnPvPMatchUpdate:   func(match *PvPMatch) {},
	}
	w.Trading.economy = economy
	w.initWorld()
	return w
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
		level := 50 + rand.Intn(6)
		profile := overworldEnemyCombatProfile("MountainTroll", level, false)

		troll := &Entity{
			ID:             fmt.Sprintf("MountainTroll-%d", i),
			Type:           TypeEnemy,
			SubType:        "MountainTroll",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      profile.BaseStats,
			Health:         profile.Health,
			MaxHealth:      profile.MaxHealth,
			Damage:         profile.Damage,
			Level:          level,
			BaseSpeed:      profile.Speed,
			Speed:          profile.Speed,
			State:          "IDLE",
			AttackSpeed:    profile.AttackSpeed,
			AttackCooldown: profile.AttackCooldown,
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
		level := 55 + rand.Intn(6)
		profile := overworldEnemyCombatProfile("AquaGolem", level, false)

		golem := &Entity{
			ID:             fmt.Sprintf("AquaGolem-%d", i),
			Type:           TypeEnemy,
			SubType:        "AquaGolem",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      profile.BaseStats,
			Health:         profile.Health,
			MaxHealth:      profile.MaxHealth,
			Damage:         profile.Damage,
			Level:          level,
			BaseSpeed:      profile.Speed,
			Speed:          profile.Speed,
			State:          "IDLE",
			AttackSpeed:    profile.AttackSpeed,
			AttackCooldown: profile.AttackCooldown,
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
		level := 60 + rand.Intn(6)
		profile := overworldEnemyCombatProfile("Siren", level, false)

		siren := &Entity{
			ID:             fmt.Sprintf("Siren-%d", i),
			Type:           TypeEnemy,
			SubType:        "Siren",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      profile.BaseStats,
			Health:         profile.Health,
			MaxHealth:      profile.MaxHealth,
			Damage:         profile.Damage,
			Level:          level,
			BaseSpeed:      profile.Speed,
			Speed:          profile.Speed,
			State:          "IDLE",
			AttackSpeed:    profile.AttackSpeed,
			AttackCooldown: profile.AttackCooldown,
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
		level := 65 + rand.Intn(6)
		profile := overworldEnemyCombatProfile("FrostGuardian", level, false)

		fg := &Entity{
			ID:             fmt.Sprintf("FrostGuardian-%d", i),
			Type:           TypeEnemy,
			SubType:        "FrostGuardian",
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      profile.BaseStats,
			Health:         profile.Health,
			MaxHealth:      profile.MaxHealth,
			Damage:         profile.Damage,
			Level:          level,
			BaseSpeed:      profile.Speed,
			Speed:          profile.Speed,
			State:          "IDLE",
			AttackSpeed:    profile.AttackSpeed,
			AttackCooldown: profile.AttackCooldown,
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
	spawnFireArea := func(subType string, minX, maxX float64, baseLevel int) {
		for i := 0; i < count; i++ {
			x := minX + rand.Float64()*(maxX-minX)
			z := minZ + rand.Float64()*(maxZ-minZ)
			level := baseLevel + rand.Intn(6)
			profile := overworldEnemyCombatProfile(subType, level, false)

			enemy := &Entity{
				ID:             fmt.Sprintf("%s-%d", subType, i),
				Type:           TypeEnemy,
				SubType:        subType,
				X:              x,
				Y:              0,
				Z:              z,
				SpawnX:         x,
				SpawnZ:         z,
				BaseStats:      profile.BaseStats,
				Health:         profile.Health,
				MaxHealth:      profile.MaxHealth,
				Damage:         profile.Damage,
				Level:          level,
				BaseSpeed:      profile.Speed,
				Speed:          profile.Speed,
				State:          "IDLE",
				AttackSpeed:    profile.AttackSpeed,
				AttackCooldown: profile.AttackCooldown,
				Scale:          1.0,
			}
			w.AddEntity(enemy)
		}
	}

	// Area 1: Sandstorm Djinn (Lv 70-75) - AoE slow
	spawnFireArea("SandstormDjinn", -1400.0+5.0, -1000.0-5.0, 70)

	// Area 2: Magma Golem (Lv 75-80) - Ground DoT zone
	spawnFireArea("MagmaGolem", -1800.0+5.0, -1400.0-5.0, 75)

	// Area 3: Scorched Wraith (Lv 80-85) - Phase shift invulnerable
	spawnFireArea("ScorchedWraith", -2200.0+5.0, -1800.0-5.0, 80)

	// Area 4: Infernal Behemoth (Lv 85-90) - AoE stun
	spawnFireArea("InfernalBehemoth", -2600.0+5.0, -2200.0-5.0, 85)

	// Area 5: Phoenix Sentinel (Lv 90-95) - Rebirth (heals 50% HP once)
	spawnFireArea("PhoenixSentinel", -3000.0+5.0, -2600.0-5.0, 90)
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
	spawnAirArea := func(subType string, minX, maxX float64, baseLevel int) {
		for i := 0; i < count; i++ {
			x := minX + rand.Float64()*(maxX-minX)
			z := minZ + rand.Float64()*(maxZ-minZ)
			level := baseLevel + rand.Intn(6)
			profile := overworldEnemyCombatProfile(subType, level, false)

			enemy := &Entity{
				ID:             fmt.Sprintf("%s-%d", subType, i),
				Type:           TypeEnemy,
				SubType:        subType,
				X:              x,
				Y:              0,
				Z:              z,
				SpawnX:         x,
				SpawnZ:         z,
				BaseStats:      profile.BaseStats,
				Health:         profile.Health,
				MaxHealth:      profile.MaxHealth,
				Damage:         profile.Damage,
				Level:          level,
				BaseSpeed:      profile.Speed,
				Speed:          profile.Speed,
				State:          "IDLE",
				AttackSpeed:    profile.AttackSpeed,
				AttackCooldown: profile.AttackCooldown,
				Scale:          1.0,
			}
			w.AddEntity(enemy)
		}
	}

	// Area 1: Storm Harpy (Lv 70-75) - Knockback
	spawnAirArea("StormHarpy", 1000.0+5.0, 1400.0-5.0, 70)

	// Area 2: Cloud Elemental (Lv 75-80) - Mist form (50% miss chance)
	spawnAirArea("CloudElemental", 1400.0+5.0, 1800.0-5.0, 75)

	// Area 3: Thunder Roc (Lv 80-85) - Chain lightning
	spawnAirArea("ThunderRoc", 1800.0+5.0, 2200.0-5.0, 80)

	// Area 4: Tempest Giant (Lv 85-90) - Tornado pull
	spawnAirArea("TempestGiant", 2200.0+5.0, 2600.0-5.0, 85)

	// Area 5: Cyclone Avatar (Lv 90-95) - Eye of storm safe zone
	spawnAirArea("CycloneAvatar", 2600.0+5.0, 3000.0-5.0, 90)
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

	profile := overworldEnemyCombatProfile(subType, level, true)

	elite := &Entity{
		ID:             fmt.Sprintf("elite-%s-%d", subType, time.Now().UnixNano()),
		Type:           TypeEnemy,
		SubType:        subType,
		X:              x,
		Y:              0,
		Z:              z,
		SpawnX:         x,
		SpawnZ:         z,
		BaseStats:      profile.BaseStats,
		Health:         profile.Health,
		MaxHealth:      profile.MaxHealth,
		Damage:         profile.Damage,
		Level:          level,
		BaseSpeed:      profile.Speed,
		Speed:          profile.Speed,
		State:          "IDLE",
		AttackSpeed:    profile.AttackSpeed,
		AttackCooldown: profile.AttackCooldown,
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
		X:        -20,         // Outside the Ashen Smithy's east-facing doorway
		Y:        0.5,         // Slightly above ground
		Z:        200,         // Center Z
		Rotation: math.Pi / 2, // Face East toward the town center
		State:    "IDLE",
		Scale:    1.0,
	}
	w.AddEntity(npc)
	w.AddEntity(&Entity{
		ID: "story-wizard-1", Type: TypeNPC, SubType: "StoryWizard",
		Name: "Archmage Ilyra", X: 20, Y: 0.5, Z: 215,
		Rotation: -math.Pi / 2, State: "IDLE", Scale: 1,
	})
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
	w.spawnEnemyRect("Skeleton", 300, -200, 200, -600, 1000, 10)

	// Sector 2 (Left): Lv 10-20 (Imp)
	// X: -600 to -200
	w.spawnEnemyRect("Imp", 300, -600, -200, -600, 1000, 20)

	// Sector 4 (Right): Lv 20-30 (DemonOrc)
	// X: 200 to 600
	w.spawnEnemyRect("DemonOrc", 300, 200, 600, -600, 1000, 30)

	// Sector 1 (Far Left): Lv 30-40 (Construct)
	// X: -1000 to -600
	w.spawnEnemyRect("Construct", 300, -1000, -600, -600, 1000, 40)

	// Sector 5 (Far Right): Lv 40-50 (InfernoTitan)
	// X: 600 to 1000
	w.spawnEnemyRect("InfernoTitan", 300, 600, 1000, -600, 1000, 50)
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

func (w *World) spawnEnemyRect(subType string, count int, minX, maxX, minZ, maxZ float64, level int) {
	for i := 0; i < count; i++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := minZ + rand.Float64()*(maxZ-minZ)

		// Avoid Town Safe Zone if in center sector
		// Town: Rectangular (-100 to 100 X, 100 to 300 Z)
		if x > -100 && x < 100 && z > 100 && z < 300 {
			continue // Skip spawn inside town
		}

		profile := overworldEnemyCombatProfile(subType, level, false)

		enemy := &Entity{
			ID:             fmt.Sprintf("%s-%d", subType, i),
			Type:           TypeEnemy,
			SubType:        subType,
			X:              x,
			Y:              0,
			Z:              z,
			SpawnX:         x,
			SpawnZ:         z,
			BaseStats:      profile.BaseStats,
			Health:         profile.Health,
			MaxHealth:      profile.MaxHealth,
			Mana:           profile.Mana,
			MaxMana:        profile.MaxMana,
			Damage:         profile.Damage,
			Level:          level,
			BaseSpeed:      profile.Speed,
			Speed:          profile.Speed,
			State:          "IDLE",
			AttackSpeed:    profile.AttackSpeed,
			AttackCooldown: profile.AttackCooldown,
			Scale:          1.0,
		}
		w.AddEntity(enemy)
	}
}

func (w *World) AddEntity(e *Entity) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if e.Type == TypePlayer {
		e.SocialStatus = NormalizeSocialStatus(e.SocialStatus)
		// A newly-added/rejoined player must never inherit fractional damage
		// time from an older entity with the same stable ID.
		delete(w.PlayerHazardTicks, e.ID)
	}
	// Remove stale grid entry if entity ID already exists (e.g. re-join)
	if old, exists := w.Entities[e.ID]; exists {
		w.Grid.Remove(old)
	}
	w.Entities[e.ID] = e
	w.Grid.Add(e)
	if e.Type == TypePlayer && strings.HasPrefix(e.InstanceID, "dungeon_") {
		// Login can restore membership directly without EnterInstance. The run
		// is no longer empty once that player is registered in the world.
		w.activateDungeonMembershipLocked(e.InstanceID, e.ID, e.X, e.Z)
	}
}

func (w *World) RemoveEntity(id string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	// Tick state is keyed independently from Entities, so clear it even when
	// the entity was already removed by another lifecycle path.
	delete(w.PlayerHazardTicks, id)
	if e, ok := w.Entities[id]; ok {
		instanceID := e.InstanceID
		w.Grid.Remove(e)
		delete(w.Entities, id)

		if strings.HasPrefix(instanceID, "dungeon_") {
			w.checkAndResetDungeonLocked(instanceID)
		}
	}
}

// SetEntityDisconnected marks a player entity as disconnected and keeps it in the
// world for the session-resume window. Returns false if the entity does not exist.
func (w *World) SetEntityDisconnected(id string, at time.Time) bool {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	e, ok := w.Entities[id]
	if !ok {
		return false
	}
	e.Disconnected = true
	e.DisconnectedAt = at
	e.State = "IDLE"
	e.TargetX = e.X
	e.TargetZ = e.Z
	e.QAHazardInspectionEndTime = time.Time{}
	e.QAHealthRegenPausedUntil = time.Time{}
	// A resume starts a fresh exposure window. It must not complete a damage
	// tick accumulated before the socket went away.
	delete(w.PlayerHazardTicks, id)
	return true
}

// ClearEntityDisconnected removes the disconnected marker from an entity and returns
// the live entity pointer so the caller can rebind a new client to it.
// Returns (entity, true) on success, (nil, false) if the entity is not found or is
// not currently in the disconnected state.
func (w *World) ClearEntityDisconnected(id string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	e, ok := w.Entities[id]
	if !ok || !e.Disconnected {
		return nil, false
	}
	e.Disconnected = false
	e.DisconnectedAt = time.Time{}
	return e, true
}

// CollectExpiredDisconnectedPlayers returns and removes all player entities whose
// disconnected-at time is older than window. Call this periodically to reap players
// that did not resume within the session window.
func (w *World) CollectExpiredDisconnectedPlayers(window time.Duration) []*Entity {
	now := time.Now()
	w.Mu.Lock()
	defer w.Mu.Unlock()
	var expired []*Entity
	for _, e := range w.Entities {
		if e.Type != TypePlayer || !e.Disconnected {
			continue
		}
		if now.Sub(e.DisconnectedAt) > window {
			expired = append(expired, e)
		}
	}
	for _, e := range expired {
		instanceID := e.InstanceID
		w.Grid.Remove(e)
		delete(w.Entities, e.ID)
		if strings.HasPrefix(instanceID, "dungeon_") {
			w.checkAndResetDungeonLocked(instanceID)
		}
	}
	return expired
}

func (w *World) UpdateEntityPosition(id string, x, y, z, rotation float64) {
	w.UpdatePlayerMovement(id, x, y, z, rotation, "", 0)
}

// UpdatePlayerMovement applies one ordered player transform sample and records
// its sequence as an acknowledgement. Legacy/internal callers may pass zero,
// which preserves the pre-sequencing behavior without disturbing the current
// acknowledgement.
func (w *World) UpdatePlayerMovement(id string, x, y, z, rotation float64, state string, sequence uint64) bool {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	e, ok := w.Entities[id]
	if !ok {
		return false
	}
	e.Mu.Lock()
	defer e.Mu.Unlock()
	if e.State == "DEAD" || e.State == "JUMPING" || e.IsCharging || e.Stunned || e.Rooted || time.Now().Before(e.MoveLockUntil) {
		return false
	}

	if sequence > 0 && sequence <= e.LastMoveSequence {
		return false
	}

	if e.Type == TypePlayer {
		if constrainedX, constrainedZ, ok := w.constrainPlayerPointToDungeon(e.InstanceID, x, z); ok {
			x = constrainedX
			z = constrainedZ
		}
		if constrainedX, constrainedZ, ok := w.constrainPvPPoint(e.InstanceID, x, z); ok {
			x = constrainedX
			z = constrainedZ
		}
	}

	oldX, oldZ := e.X, e.Z
	e.X = x
	e.Y = y
	e.Z = z
	e.Rotation = rotation
	if sequence > 0 {
		e.LastMoveSequence = sequence
	}
	if e.State != "JUMPING" {
		if state == "IDLE" || state == "MOVING" {
			e.State = state
		} else {
			e.State = "MOVING" // Default to moving if position updates
		}
	}

	w.Grid.Update(e, oldX, oldZ)
	return true
}

func (w *World) StartPlayerJump(id string, x, y, z float64) bool {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	e, ok := w.Entities[id]
	if !ok || e.Type != TypePlayer {
		return false
	}
	e.Mu.Lock()
	defer e.Mu.Unlock()
	if e.State == "DEAD" || e.IsCharging || e.Stunned || e.Rooted || time.Now().Before(e.MoveLockUntil) {
		return false
	}

	if constrainedX, constrainedZ, ok := w.constrainDungeonMovementDestination(e, x, z); ok {
		x = constrainedX
		z = constrainedZ
	}
	if constrainedX, constrainedZ, ok := w.constrainPvPPoint(e.InstanceID, x, z); ok {
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

func (w *World) GetPlayerInstance(id string) string {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	if e, ok := w.Entities[id]; ok {
		return e.InstanceID
	}
	return ""
}
