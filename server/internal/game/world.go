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

	// Loot
	LootItem *Item     `json:"lootItem,omitempty"` // If Type == TypeLoot
	LootTime time.Time `json:"-"`

	// Projectile
	OwnerID string  `json:"ownerId,omitempty"`
	VelX    float64 `json:"velX"`
	VelZ    float64 `json:"velZ"`
	Radius  float64 `json:"-"`

	// Abilities
	SpiritsActive  bool      `json:"spiritsActive"`
	SpiritEndTime  time.Time `json:"-"`
	LastSpiritTick time.Time `json:"-"`
	IsCharging     bool      `json:"isCharging,omitempty"`
	ChargeTargetX  float64   `json:"-"`
	ChargeTargetZ  float64   `json:"-"`
}

type World struct {
	Entities map[string]*Entity
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
}

func (w *World) spawnInitialElites() {
	// Spawn one elite in each area
	// Level 5 Area (Radius 60-150)
	w.spawnEliteInArea(5, 60, 150)
	// Level 10 Area (Radius 160-250)
	w.spawnEliteInArea(10, 160, 250)
	// Level 15 Area (Radius 260-350)
	w.spawnEliteInArea(15, 260, 350)
	// Level 20+ Area (Radius 360-450)
	w.spawnEliteInArea(20, 360, 450)
}

func (w *World) spawnEliteInArea(level int, minR, maxR float64) {
	// Pick random type
	types := []string{"Skeleton", "Imp", "DemonOrc", "Construct"}
	subType := types[rand.Intn(len(types))]

	angle := rand.Float64() * 2 * math.Pi
	radius := minR + rand.Float64()*(maxR-minR)
	x := math.Cos(angle) * radius
	z := math.Sin(angle) * radius

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
	}

	maxHealth := int(float64(baseStats.Vitality*10) * mult)
	damage := int(float64(baseStats.Strength*2) * mult)

	elite := &Entity{
		ID:             fmt.Sprintf("elite-%s-%d", subType, time.Now().UnixNano()),
		Type:           TypeEnemy,
		SubType:        subType, // Client can scale mesh based on ID or we add IsElite flag
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
		Speed:          4.0, // Slightly faster
		State:          "IDLE",
		AttackCooldown: 1000 * time.Millisecond,
	}
	// Hack: Append "Elite" to ID so client knows to scale it?
	// Or add a field. Let's add a field later if needed, but for now ID prefix "elite-" is good enough if client checks it.
	// Actually client checks `isElite` property usually.
	// Let's just rely on ID for now or add property to Entity struct if we want to be clean.
	// For now, just spawn it.
	w.Entities[elite.ID] = elite

	// Announce Spawn
	if w.OnEvent != nil {
		w.OnEvent("elite_spawn", fmt.Sprintf("An Elite %s has spawned in the Level %d area!", subType, level))
	}
}

func (w *World) spawnMerchant() {
	merchant := &Entity{
		ID:      "merchant-1",
		Type:    TypeNPC,
		SubType: "DwarfSalesman",
		X:       5,
		Y:       0,
		Z:       5,
		State:   "IDLE",
	}
	// Merchant doesn't need combat stats for now
	w.AddEntity(merchant)
}

func (w *World) spawnEnemies() {
	// Skeleton: 50 count, 60-150 radius
	w.spawnEnemyGroup("Skeleton", 50, 60, 150, 5, Stats{Strength: 5, Intelligence: 2, Dexterity: 3, Wisdom: 2, Vitality: 5})

	// Imp: 50 count, 160-250 radius
	w.spawnEnemyGroup("Imp", 50, 160, 250, 10, Stats{Strength: 12, Intelligence: 4, Dexterity: 6, Wisdom: 4, Vitality: 12})

	// Demon Orc: 50 count, 260-350 radius
	w.spawnEnemyGroup("DemonOrc", 50, 260, 350, 15, Stats{Strength: 25, Intelligence: 8, Dexterity: 10, Wisdom: 8, Vitality: 25})

	// Construct: 50 count, 360-450 radius
	w.spawnEnemyGroup("Construct", 50, 360, 450, 20, Stats{Strength: 40, Intelligence: 15, Dexterity: 5, Wisdom: 15, Vitality: 40})
}

func (w *World) spawnEnemyGroup(subType string, count int, minRadius, maxRadius float64, level int, baseStats Stats) {
	angleStep := (math.Pi * 2) / float64(count)

	for i := 0; i < count; i++ {
		baseAngle := float64(i) * angleStep
		jitter := (rand.Float64() - 0.5) * angleStep * 0.8
		angle := baseAngle + jitter

		radius := minRadius + rand.Float64()*(maxRadius-minRadius)

		x := math.Cos(angle) * radius
		z := math.Sin(angle) * radius

		// Calculate derived stats
		maxHealth := baseStats.Vitality * 10
		maxMana := baseStats.Intelligence * 10
		damage := baseStats.Strength * 2
		speed := 3.0 + (float64(baseStats.Dexterity) * 0.5)

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
}

func (w *World) RemoveEntity(id string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.Entities, id)
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
			if time.Since(e.LootTime) > 5*time.Minute {
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
						delete(w.Entities, id)
					}
					continue
				}

				// Respawn Logic for normal mobs
				if time.Since(e.LastAttackTime) > 10*time.Second { // Use LastAttackTime as death time for simplicity
					e.State = "IDLE"
					e.Health = e.MaxHealth
					e.X = e.SpawnX
					e.Z = e.SpawnZ
				}
				continue
			}
		}

		// --- Projectiles ---
		if e.Type == TypeProjectile {
			// Move
			e.X += e.VelX * dt
			e.Z += e.VelZ * dt

			// Check Collision with Enemies
			for _, target := range enemies {
				dx := e.X - target.X
				dz := e.Z - target.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist < (e.Radius + 0.5) { // 0.5 is approx enemy radius
					// Hit!
					damage := e.Damage
					target.Health -= damage
					if target.Health <= 0 {
						w.handleDeath(target, w.Entities[e.OwnerID])
					}

					// Splash Damage (Fireball)
					if e.SubType == "Fireball" {
						for _, splashTarget := range enemies {
							if splashTarget == target {
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

					// Destroy Projectile
					delete(w.Entities, id)
					break
				}
			}

			// Cleanup if too far
			if e.X < -1000 || e.X > 1000 || e.Z < -1000 || e.Z > 1000 {
				delete(w.Entities, id)
			}
			continue
		}

		// --- Player Abilities ---
		if e.Type == TypePlayer {
			// Fighter Charge
			if e.IsCharging {
				dx := e.ChargeTargetX - e.X
				dz := e.ChargeTargetZ - e.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				speed := 25.0
				moveDist := speed * dt

				if moveDist >= dist {
					e.X = e.ChargeTargetX
					e.Z = e.ChargeTargetZ
					e.IsCharging = false
					e.State = "IDLE"
				} else {
					e.X += (dx / dist) * moveDist
					e.Z += (dz / dist) * moveDist
					e.Rotation = math.Atan2(dx, dz)
				}
			}

			// Cleric Spirits
			if e.SpiritsActive {
				if time.Now().After(e.SpiritEndTime) {
					e.SpiritsActive = false
				} else {
					if time.Since(e.LastSpiritTick) >= 500*time.Millisecond {
						e.LastSpiritTick = time.Now()
						damage := 10 + (e.BaseStats.Wisdom * 1)
						for _, target := range enemies {
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
			for _, p := range players {
				// Check if player is in Safe Zone (Town: -50 to 50)
				if p.X > -50 && p.X < 50 && p.Z > -50 && p.Z < 50 {
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
						newX := e.X + (dx/dist)*moveDist
						newZ := e.Z + (dz/dist)*moveDist

						// Prevent entering Safe Zone
						if newX > -50 && newX < 50 && newZ > -50 && newZ < 50 {
							// Blocked
							e.State = "IDLE"
						} else {
							e.X = newX
							e.Z = newZ
							e.Rotation = math.Atan2(dx, dz)
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
					newX := e.X + (dx/dist)*moveDist
					newZ := e.Z + (dz/dist)*moveDist

					// Prevent entering Safe Zone
					if newX > -50 && newX < 50 && newZ > -50 && newZ < 50 {
						e.TargetX = e.SpawnX
						e.TargetZ = e.SpawnZ
					} else {
						e.X = newX
						e.Z = newZ
						e.Rotation = math.Atan2(dx, dz)
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
			MinR, MaxR float64
			Level      int
		}
		areas := []SpawnArea{
			{60, 150, 5},
			{160, 250, 10},
			{260, 350, 15},
			{360, 450, 20},
		}
		area := areas[rand.Intn(len(areas))]
		w.spawnEliteInArea(area.Level, area.MinR, area.MaxR)
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

			damage := 20 + (player.Stats.Intelligence * 2)

			proj := &Entity{
				ID:       fmt.Sprintf("proj-%d", time.Now().UnixNano()),
				Type:     TypeProjectile,
				SubType:  "Fireball",
				X:        player.X,
				Y:        1.5,
				Z:        player.Z,
				VelX:     velX,
				VelZ:     velZ,
				Radius:   2.0,
				Damage:   damage,
				OwnerID:  player.ID,
				Rotation: math.Atan2(velX, velZ),
			}
			w.Entities[proj.ID] = proj

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
				ID:       fmt.Sprintf("proj-%d", time.Now().UnixNano()),
				Type:     TypeProjectile,
				SubType:  "Dagger",
				X:        player.X,
				Y:        1.0,
				Z:        player.Z,
				VelX:     velX,
				VelZ:     velZ,
				Radius:   1.5,
				Damage:   damage,
				OwnerID:  player.ID,
				Rotation: math.Atan2(velX, velZ),
			}
			w.Entities[proj.ID] = proj

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

	for k, v := range w.Entities {
		// Check distance
		dx := v.X - player.X
		dz := v.Z - player.Z
		distSq := dx*dx + dz*dz

		// Include if within distance OR if it's the player themselves
		if distSq <= viewDistance*viewDistance || k == playerID {
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
			state[k] = &e
		}
	}
	return state
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

	e.Speed = (3.0 + (float64(totalDex) * 0.5)) * 1.2
	e.AttackSpeed = 1.0 + (float64(totalDex)/5.0)*0.05

	e.ManaRegen = float64(totalWis) * 0.5
	e.CastSpeed = 1.0 + (float64(totalWis)/5.0)*0.01

	if e.Mana > e.MaxMana {
		e.Mana = e.MaxMana
	}
}
