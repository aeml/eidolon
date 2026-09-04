package game

import (
	"fmt"
	"math"
	"math/rand"
	"runtime"
	"sync"
	"time"
)

func (w *World) Update(dt float64) {
	w.UpdatePvP(time.Now())
	// Note: We do NOT hold w.Mu during the main update loop to allow parallelism.
	// However, we need to snapshot the entity list safely.

	w.Mu.Lock()
	worldLocked := true

	defer func() {
		if r := recover(); r != nil {
			if worldLocked {
				w.Mu.Unlock()
			}
			fmt.Printf("Recovered from panic in Update: %v\n", r)
		}
	}()

	// Global Regeneration (1 second tick)
	w.RegenTimer += dt
	if w.RegenTimer >= 1.0 {
		w.RegenTimer -= 1.0
		regenNow := time.Now()
		for _, e := range w.Entities {
			e.Mu.Lock()
			// Prevent regen if dead or effectively dead (<= 0 HP)
			if e.State != "DEAD" && e.Health > 0 {
				qaHealthRegenPaused := regenNow.Before(e.QAHealthRegenPausedUntil)
				if e.Health < e.MaxHealth && !qaHealthRegenPaused {
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
			e.Mu.Unlock()
		}
	}

	// 1. Identify potential targets (Players) & Snapshot Entities
	players := make([]*Entity, 0, 100)
	allEntities := make([]*Entity, 0, len(w.Entities))

	for _, e := range w.Entities {
		allEntities = append(allEntities, e)
		e.Mu.RLock()
		isActivePlayer := e.Type == TypePlayer && e.State != "DEAD" && !e.Disconnected
		e.Mu.RUnlock()
		if isActivePlayer {
			players = append(players, e)
		}
	}
	w.Mu.Unlock() // Unlock World so parallel updates can happen
	worldLocked = false

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
	worldLocked = true

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
	worldLocked = false

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
		player.Mu.RLock()
		px, pz := player.X, player.Z
		playerID := player.ID
		maxHealth := player.MaxHealth
		playerState := player.State
		playerHealth := player.Health
		instanceID := player.InstanceID
		disconnected := player.Disconnected
		qaProtectionEnd := player.QAWaypointProtectionEndTime
		qaHazardInspectionEnd := player.QAHazardInspectionEndTime
		player.Mu.RUnlock()
		if playerState == "DEAD" || playerHealth <= 0 || disconnected {
			delete(w.PlayerHazardTicks, playerID)
			continue
		}

		// Players in town are safe (Town: X -100 to 100, Z 100 to 300)
		if px >= -100 && px <= 100 && pz >= 100 && pz <= 300 {
			delete(w.PlayerHazardTicks, playerID)
			continue
		}

		// Players in dungeon instances don't get world hazard damage
		if instanceID != "" {
			delete(w.PlayerHazardTicks, playerID)
			continue
		}

		// The allowlisted release waypoint promises a protected inspection
		// window. Keep it independent from gameplay-rune invulnerability and do
		// not bank a partial environmental tick while that window is active.
		now := time.Now()
		qaHazardInspectionActive := !qaHazardInspectionEnd.IsZero() && now.Before(qaHazardInspectionEnd)
		if !qaProtectionEnd.IsZero() && now.Before(qaProtectionEnd) && !qaHazardInspectionActive {
			delete(w.PlayerHazardTicks, playerID)
			continue
		}

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
					if player.Health <= 0 {
						w.handleDeath(player, nil, nil)
					}
					playerDied := player.State == "DEAD"
					player.Mu.Unlock()
					if playerDied {
						delete(w.PlayerHazardTicks, playerID)
					}

					// Emit damage event
					if w.OnEvent != nil {
						w.OnEvent("hazard_damage", HazardDamageEvent{
							PlayerID:   playerID,
							HazardID:   hazardID,
							HazardType: hazard.HazardType,
							Damage:     damage,
						})
					}

					// Check for death
					if playerDied && w.OnEvent != nil {
						// Emit death event (player died to hazard)
						w.OnEvent("death", map[string]interface{}{
							"entityId":  playerID,
							"killedBy":  hazardID,
							"wasPlayer": true,
						})
					}
					if playerDied {
						break
					}
				}
			} else {
				// Player left hazard zone, reset their tick for this hazard
				delete(w.PlayerHazardTicks[playerID], hazardID)
			}
		}
	}
}
