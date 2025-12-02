package game

import (
	"fmt"
	"math"
	"math/rand"
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
)

type Stats struct {
	Strength     int `json:"strength"`
	Dexterity    int `json:"dexterity"`
	Intelligence int `json:"intelligence"`
	Wisdom       int `json:"wisdom"`
	Vitality     int `json:"vitality"`
}

type Entity struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Type          EntityType `json:"type"`
	SubType       string     `json:"subType"` // e.g., "Fighter", "Skeleton"
	X             float64    `json:"x"`
	Y             float64    `json:"y"`
	Z             float64    `json:"z"`
	Rotation      float64    `json:"rotation"` // Y-axis rotation in radians
	Health        int        `json:"health"`
	MaxHealth     int        `json:"maxHealth"`
	Mana          int        `json:"mana"`
	MaxMana       int        `json:"maxMana"`
	Level         int        `json:"level"`
	Experience    int        `json:"experience"`
	MaxExperience int        `json:"maxExperience"`
	Gold          int        `json:"gold"`

	// Inventory
	Inventory []Item          `json:"-"`
	Equipment map[string]Item `json:"equipment"`

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
	k := sm.key(e.X, e.Z)
	if sm.cells[k] == nil {
		sm.cells[k] = make(map[string]*Entity)
	}
	sm.cells[k][e.ID] = e
}

func (sm *SpatialMap) Remove(e *Entity) {
	k := sm.key(e.X, e.Z)
	if sm.cells[k] != nil {
		delete(sm.cells[k], e.ID)
		if len(sm.cells[k]) == 0 {
			delete(sm.cells, k)
		}
	}
}

func (sm *SpatialMap) Update(e *Entity, oldX, oldZ float64) {
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
	OnEvent func(eventType string, data interface{})
}

func NewWorld() *World {
	w := &World{
		Entities:        make(map[string]*Entity),
		Grid:            NewSpatialMap(50.0), // 50 unit cell size
		EliteSpawnTimer: time.Now(),
		RegenTimer:      0,
		OnEvent:         func(eventType string, data interface{}) {}, // Default no-op
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
			AttackCooldown: 1500 * time.Millisecond,
		}
		w.AddEntity(siren)
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
	mult := 3.0

	// Base stats for the type (simplified lookup)
	var baseStats Stats
	switch subType {
	case "Skeleton":
		baseStats = Stats{Strength: 5, Intelligence: 2, Dexterity: 3, Wisdom: 2, Vitality: 5}
	case "Imp":
		baseStats = Stats{Strength: 12, Intelligence: 4, Dexterity: 6, Wisdom: 4, Vitality: 12}
	case "DemonOrc":
		baseStats = Stats{Strength: 25, Intelligence: 8, Dexterity: 10, Wisdom: 8, Vitality: 25}
	case "Construct":
		baseStats = Stats{Strength: 40, Intelligence: 15, Dexterity: 5, Wisdom: 15, Vitality: 40}
	case "InfernoTitan":
		baseStats = Stats{Strength: 120, Intelligence: 40, Dexterity: 20, Wisdom: 40, Vitality: 120}
	case "Siren":
		baseStats = Stats{Strength: 150, Intelligence: 80, Dexterity: 40, Wisdom: 80, Vitality: 150}
	}

	maxHealth := int(float64(baseStats.Vitality*10) * mult)
	damage := int(float64(baseStats.Strength*2) * mult)

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
		AttackCooldown: 1000 * time.Millisecond,
	}
	w.Entities[elite.ID] = elite
	w.Grid.Add(elite)

	if w.OnEvent != nil {
		w.OnEvent("elite_spawn", fmt.Sprintf("An Elite %s has spawned!", subType))
	}
}

func (w *World) spawnMerchant() {
	merchant := &Entity{
		ID:      "merchant-1",
		Type:    TypeNPC,
		SubType: "DwarfSalesman",
		X:       5,
		Y:       0,
		Z:       205, // Moved to new town center (0, 200)
		State:   "IDLE",
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

		// Attack cooldown based on dexterity? For now fixed.
		attackCooldown := 1500 * time.Millisecond

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
	// Deep copy
	newE := *e
	if e.Inventory != nil {
		newE.Inventory = make([]Item, len(e.Inventory))
		copy(newE.Inventory, e.Inventory)
	}
	if e.Equipment != nil {
		newE.Equipment = make(map[string]Item)
		for k, v := range e.Equipment {
			newE.Equipment[k] = v
		}
	}
	return &newE
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

	cost := 500
	if player.Gold < cost {
		return nil, false
	}
	if len(player.Inventory) >= 20 {
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

func (w *World) Update(dt float64) {
	w.mu.Lock()
	defer w.mu.Unlock()

	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Recovered from panic in Update: %v\n", r)
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

	// 1. Identify potential targets (Players & Enemies)
	var players []*Entity
	var enemies []*Entity
	for _, e := range w.Entities {
		if e.Type == TypePlayer && e.State != "DEAD" {
			players = append(players, e)
		} else if e.Type == TypeEnemy && e.State != "DEAD" {
			enemies = append(enemies, e)
		}
	}

	// 2. Update Entities
	for id, e := range w.Entities {
		// --- Loot Cleanup ---
		if e.Type == TypeLoot {
			if time.Since(e.LootTime) > 1*time.Minute {
				w.Grid.Remove(e)
				delete(w.Entities, id)
			}
			continue
		}

		// --- Respawn Logic for Enemies and NPCs ---
		if e.Type == TypeEnemy || e.Type == TypeNPC {
			if e.State == "DEAD" {
				// Check if Elite
				if strings.HasPrefix(e.ID, "elite-") {
					// Elites do not respawn, they are removed after death animation time
					if time.Since(e.LastAttackTime) > 5*time.Second {
						w.Grid.Remove(e)
						delete(w.Entities, id)
					}
					continue
				}

				// Respawn Logic for normal mobs
				if time.Since(e.LastAttackTime) > 10*time.Second { // Use LastAttackTime as death time for simplicity
					e.State = "IDLE"
					e.Health = e.MaxHealth
					oldX, oldZ := e.X, e.Z
					e.X = e.SpawnX
					e.Z = e.SpawnZ
					w.Grid.Update(e, oldX, oldZ)
				}
				continue
			}
		}

		// --- Projectiles ---
		if e.Type == TypeProjectile {
			// Lifetime check (prevent memory leaks from stationary or lost projectiles)
			if time.Since(e.CreatedAt) > 5*time.Second {
				w.Grid.Remove(e)
				delete(w.Entities, id)
				continue
			}

			// Move
			oldX, oldZ := e.X, e.Z
			e.X += e.VelX * dt
			e.Z += e.VelZ * dt
			w.Grid.Update(e, oldX, oldZ)

			// Check Collision with Enemies
			// Optimization: Use Grid
			nearbyEnemies := w.Grid.Nearby(e.X, e.Z, e.Radius+2.0) // +2 buffer
			for _, target := range nearbyEnemies {
				if target.Type != TypeEnemy || target.State == "DEAD" {
					continue
				}
				dx := e.X - target.X
				dz := e.Z - target.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist < (e.Radius + 0.5) { // 0.5 is approx enemy radius
					// Check if already hit (for piercing projectiles)
					if e.HitList == nil {
						e.HitList = make(map[string]bool)
					}
					if e.HitList[target.ID] {
						continue
					}

					// Hit!
					e.HitList[target.ID] = true

					damage := e.Damage
					target.Health -= damage
					if target.Health <= 0 {
						w.handleDeath(target, w.Entities[e.OwnerID])
					}

					// Splash Damage (Fireball)
					if e.SubType == "Fireball" {
						// Optimization: Use Grid for splash too
						splashTargets := w.Grid.Nearby(e.X, e.Z, 10.0)
						for _, splashTarget := range splashTargets {
							if splashTarget.Type != TypeEnemy || splashTarget == target || splashTarget.State == "DEAD" {
								continue
							}
							sdx := e.X - splashTarget.X
							sdz := e.Z - splashTarget.Z
							sdist := math.Sqrt(sdx*sdx + sdz*sdz)
							if sdist < 10.0 {
								splashTarget.Health -= int(float64(damage) * 0.4)
								if splashTarget.Health <= 0 {
									w.handleDeath(splashTarget, w.Entities[e.OwnerID])
								}
							}
						}
					}

					// Destroy Projectile unless it's a Dagger (Piercing)
					if e.SubType != "Dagger" {
						w.Grid.Remove(e)
						delete(w.Entities, id)
						break
					}
				}
			}

			// Cleanup if too far
			if e.X < -1000 || e.X > 1000 || e.Z < -1000 || e.Z > 1000 {
				w.Grid.Remove(e)
				delete(w.Entities, id)
			}
			continue
		}

		// --- Player Abilities ---
		if e.Type == TypePlayer {
			// Teleporter Check REMOVED as per user request (connected world)
			/*
				if e.X > -50 && e.X < 50 && e.Z < -590 && e.Z > -610 {
					// Teleport to Snow World
					oldX, oldZ := e.X, e.Z
					e.X = 20000
					e.Z = 20000
					e.TargetX = 20000
					e.TargetZ = 20000
					e.State = "IDLE"
					w.Grid.Update(e, oldX, oldZ)
				}
			*/

			// Fighter Charge
			if e.IsCharging {
				dx := e.ChargeTargetX - e.X
				dz := e.ChargeTargetZ - e.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				speed := 50.0 // Increased speed
				moveDist := speed * dt

				oldX, oldZ := e.X, e.Z
				if moveDist >= dist {
					e.X = e.ChargeTargetX
					e.Z = e.ChargeTargetZ
					e.IsCharging = false
					e.State = "IDLE"

					// Deal AoE Damage on Impact (Radius 16.0 like Spirit Guardians)
					damage := int(float64(e.Damage) * 1.5)

					// Optimization: Use Grid
					nearby := w.Grid.Nearby(e.X, e.Z, 16.0)
					for _, target := range nearby {
						if target.Type != TypeEnemy || target.State == "DEAD" {
							continue
						}
						dx := e.X - target.X
						dz := e.Z - target.Z
						dist := math.Sqrt(dx*dx + dz*dz)
						if dist < 16.0 {
							target.Health -= damage
							if target.Health <= 0 {
								w.handleDeath(target, e)
							}
						}
					}
				} else {
					e.X += (dx / dist) * moveDist
					e.Z += (dz / dist) * moveDist
					e.Rotation = math.Atan2(dx, dz)
				}
				w.Grid.Update(e, oldX, oldZ)
			}

			// Cleric Spirits
			if e.SpiritsActive {
				if time.Now().After(e.SpiritEndTime) {
					e.SpiritsActive = false
				} else {
					if time.Since(e.LastSpiritTick) >= 500*time.Millisecond {
						e.LastSpiritTick = time.Now()
						damage := 10 + (e.Stats.Wisdom * 1)

						// Optimization: Use Grid
						nearby := w.Grid.Nearby(e.X, e.Z, 16.0)
						for _, target := range nearby {
							if target.Type != TypeEnemy || target.State == "DEAD" {
								continue
							}
							dx := e.X - target.X
							dz := e.Z - target.Z
							dist := math.Sqrt(dx*dx + dz*dz)
							if dist < 16.0 {
								target.Health -= damage
								if target.Health <= 0 {
									w.handleDeath(target, e)
								}
							}
						}
					}
				}
			}
		}

		if e.Type == TypeEnemy {
			// AI Logic
			var target *Entity
			minDist := 1000.0 // Far

			// Find nearest player
			// Optimization: Use Grid? Or just iterate players?
			// Iterating players is fine if player count is low (100), but Grid is better if players are spread out.
			// Let's stick to iterating players for now as it's simpler than querying grid for "nearest player" specifically
			// unless we maintain a separate list of players.
			// Actually, we have `players` slice from step 1.
			for _, p := range players {
				// Check if player is in Safe Zone (Town: Rectangular (-100 to 100 X, 100 to 300 Z))
				if p.X > -100 && p.X < 100 && p.Z > 100 && p.Z < 300 {
					continue
				}

				dx := p.X - e.X
				dz := p.Z - e.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist < minDist {
					minDist = dist
					target = p
				}
			}

			sightRange := 45.0
			attackRange := 2.5
			roamRadius := 10.0

			if target != nil && minDist <= sightRange {
				// Chase or Attack
				if minDist <= attackRange {
					// Attack
					if time.Since(e.LastAttackTime) >= e.AttackCooldown {
						// Perform Attack
						damage := e.Damage - target.Defense
						if damage < 1 {
							damage = 1
						}
						target.Health -= damage
						e.LastAttackTime = time.Now()
						e.State = "ATTACKING" // Client can play animation

						if target.Health <= 0 {
							target.Health = 0
							target.State = "DEAD"
							// TODO: Handle player death (respawn logic is usually client request or server timer)
						}
					} else {
						// Waiting for cooldown
						// Only reset to IDLE if enough time has passed for the attack animation (e.g. 500ms)
						if time.Since(e.LastAttackTime) > 500*time.Millisecond {
							if e.State == "ATTACKING" {
								e.State = "IDLE"
							}
						}
					}
				} else {
					// Chase
					e.TargetX = target.X
					e.TargetZ = target.Z
					e.State = "MOVING"

					// Move
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

						// Prevent entering Safe Zone (Town: Rectangular (-100 to 100 X, 100 to 300 Z))
						if newX > -100 && newX < 100 && newZ > 100 && newZ < 300 {
							// Blocked
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
				// If no target or reached target, pick new one
				dx := e.TargetX - e.X
				dz := e.TargetZ - e.Z
				distToTarget := math.Sqrt(dx*dx + dz*dz)

				if distToTarget < 0.5 || (e.TargetX == 0 && e.TargetZ == 0) {
					// Pick new random target around Spawn Point
					angle := rand.Float64() * 2 * math.Pi
					dist := rand.Float64() * roamRadius
					e.TargetX = e.SpawnX + math.Cos(angle)*dist
					e.TargetZ = e.SpawnZ + math.Sin(angle)*dist
					e.State = "MOVING"
				}

				// Move towards roam target
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

					// Prevent entering Safe Zone (Town: Rectangular (-100 to 100 X, 100 to 300 Z))
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

	// 3. Elite Spawning Logic (Every 5 minutes)
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

	// Apply Damage
	damage := attacker.Damage - target.Defense
	if damage < 1 {
		damage = 1
	}
	target.Health -= damage

	attacker.LastAttackTime = time.Now()
	attacker.State = "ATTACKING"

	// Reset state to IDLE after a short delay (handled in Update or client prediction)
	// For now, we just set it, and next movement will override it.

	if target.Health <= 0 {
		w.handleDeath(target, attacker)
	}

	return damage, true
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

			player.State = "ATTACKING"
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

func (w *World) handleDeath(target *Entity, attacker *Entity) {
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

		attacker.Experience += xpReward
		if attacker.MaxExperience == 0 {
			attacker.MaxExperience = 100
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

			fmt.Printf("Loot dropped: %s (Rarity: %s) at %.2f, %.2f\n", item.Name, item.Rarity, target.X, target.Z)
			lootEntity := &Entity{
				ID:       fmt.Sprintf("loot-%d-%d", time.Now().UnixNano(), i),
				Type:     TypeLoot,
				X:        target.X + offsetX,
				Y:        0.5,
				Z:        target.Z + offsetZ,
				LootItem: item,
				LootTime: time.Now(),
			}
			w.Entities[lootEntity.ID] = lootEntity
			w.Grid.Add(lootEntity)
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
		e := *v

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

	state := make(map[string]*Entity)

	// Always include self
	state[playerID] = w.copyEntity(player)

	// Query Grid
	nearby := w.Grid.Nearby(player.X, player.Z, viewDistance)
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
	e := *v
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

	e.AttackSpeed = 1.0 + (float64(totalDex)/5.0)*0.05

	e.ManaRegen = float64(totalWis) * 0.5
	e.CastSpeed = 1.0 + (float64(totalWis)/5.0)*0.01

	if e.Mana > e.MaxMana {
		e.Mana = e.MaxMana
	}
}
