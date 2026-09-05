package game

import (
	"math"
	"strings"
	"time"
)

// QAWaypointProtectionDuration bounds protection after a fixed QA teleport.
const QAWaypointProtectionDuration = 5 * time.Minute
const QAHazardInspectionDuration = 45 * time.Second

// QAWaypointMovementLockDuration lets the authoritative teleport reach the
// browser before a movement packet queued at the old position can overwrite
// it. Normal input resumes as soon as this short handoff window expires.
const QAWaypointMovementLockDuration = time.Second
const AbilityMovementLockDuration = 500 * time.Millisecond
const EnemySightRange = 45.0
const QADeathHostileAcquireRadius = EnemySightRange

// MovePlayerToQAWaypoint moves an overworld player to a bounded release-QA
// waypoint. Authorization belongs to the server command layer. Combat and
// Verdant use fixed coordinates; encounter selects the live overworld enemy
// nearest the fixed combat anchor and places the player eight metres toward
// that anchor. No arbitrary coordinate or enemy mutation is accepted.
func (w *World) MovePlayerToQAWaypoint(playerID, waypoint string) (*Entity, bool) {
	normalizedWaypoint := strings.ToLower(strings.TrimSpace(waypoint))
	if normalizedWaypoint != "combat" && normalizedWaypoint != "encounter" && normalizedWaypoint != "verdant" {
		return nil, false
	}

	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer || player.InstanceID != "" {
		return nil, false
	}

	var x, z float64
	switch normalizedWaypoint {
	case "combat":
		x, z = 120, 200
	case "verdant":
		x, z = 800, 200
	case "encounter":
		const anchorX, anchorZ = 120.0, 200.0
		nearestDistanceSq := math.MaxFloat64
		var enemyX, enemyZ float64
		foundEnemy := false
		for _, candidate := range w.Entities {
			candidate.Mu.RLock()
			eligible := candidate.Type == TypeEnemy && candidate.InstanceID == "" &&
				candidate.State != "DEAD" && candidate.Health > 0
			candidateX, candidateZ := candidate.X, candidate.Z
			candidate.Mu.RUnlock()
			if !eligible {
				continue
			}
			dx, dz := candidateX-anchorX, candidateZ-anchorZ
			distanceSq := dx*dx + dz*dz
			if distanceSq < nearestDistanceSq {
				nearestDistanceSq = distanceSq
				enemyX, enemyZ = candidateX, candidateZ
				foundEnemy = true
			}
		}
		if !foundEnemy {
			return nil, false
		}
		towardAnchorX, towardAnchorZ := anchorX-enemyX, anchorZ-enemyZ
		directionLength := math.Hypot(towardAnchorX, towardAnchorZ)
		if directionLength < 0.001 {
			towardAnchorX, towardAnchorZ, directionLength = -1, 0, 1
		}
		x = enemyX + towardAnchorX/directionLength*8
		z = enemyZ + towardAnchorZ/directionLength*8
	}

	oldX, oldZ := player.X, player.Z
	player.X = x
	player.Y = 0
	player.Z = z
	player.TargetX = x
	player.TargetZ = z
	player.TargetID = ""
	player.State = "IDLE"
	player.MoveLockUntil = time.Now().Add(QAWaypointMovementLockDuration)
	player.QAWaypointProtectionEndTime = time.Now().Add(QAWaypointProtectionDuration)
	player.QAHazardInspectionEndTime = time.Time{}
	player.QAHealthRegenPausedUntil = time.Time{}
	delete(w.PlayerHazardTicks, playerID)
	w.Grid.Update(player, oldX, oldZ)

	return player, true
}

// MovePlayerToQAHazard places an allowlisted release-QA character at one exact
// canonical overworld hazard anchor, or returns it to Lanternhold. The regular
// waypoint protection continues to block unrelated hostile attacks while the
// separate bounded inspection clock lets only authoritative hazard damage
// through. No arbitrary coordinates or gameplay values are accepted.
func (w *World) MovePlayerToQAHazard(playerID, destination string) (*Entity, *Hazard, bool) {
	normalizedDestination := strings.ToLower(strings.TrimSpace(destination))
	type target struct {
		x, z     float64
		hazardID string
	}
	targets := map[string]target{
		"earth": {x: -800, z: -450, hazardID: "hazard-sandstorm-0"},
		"water": {x: -50, z: -750, hazardID: "hazard-lightning-0"},
		"fire":  {x: -1150, z: 100, hazardID: "hazard-lava-0"},
		"air":   {x: 1150, z: 100, hazardID: "hazard-wind-0"},
		"town":  {x: -1.25, z: 200},
	}
	destinationTarget, ok := targets[normalizedDestination]
	if !ok {
		return nil, nil, false
	}

	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer || player.InstanceID != "" || player.State == "DEAD" {
		return nil, nil, false
	}

	var hazard *Hazard
	if destinationTarget.hazardID != "" {
		hazard = w.Hazards[destinationTarget.hazardID]
		if hazard == nil || math.Hypot(hazard.X-destinationTarget.x, hazard.Z-destinationTarget.z) > 0.000001 {
			return nil, nil, false
		}
	}

	now := time.Now()
	oldX, oldZ := player.X, player.Z
	player.X = destinationTarget.x
	player.Y = 0
	player.Z = destinationTarget.z
	player.TargetX = destinationTarget.x
	player.TargetZ = destinationTarget.z
	player.TargetID = ""
	player.State = "IDLE"
	player.Health = player.MaxHealth
	player.MoveLockUntil = now.Add(QAWaypointMovementLockDuration)
	player.QAWaypointProtectionEndTime = now.Add(QAWaypointProtectionDuration)
	player.QAHealthRegenPausedUntil = now.Add(QAHazardInspectionDuration)
	if hazard == nil {
		player.QAHazardInspectionEndTime = time.Time{}
		player.QAHealthRegenPausedUntil = time.Time{}
	} else {
		player.QAHazardInspectionEndTime = now.Add(QAHazardInspectionDuration)
	}
	delete(w.PlayerHazardTicks, playerID)
	w.Grid.Update(player, oldX, oldZ)
	return player, hazard, true
}

// ArmPlayerQADungeonFallback selects the real retry-exhaustion route for one
// fresh dungeon. It changes no level, access gate, enemy health or quest state.
// The messaging layer restricts this command to the configured QA allowlist.
func (w *World) ArmPlayerQADungeonFallback(playerID string) bool {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return false
	}
	if party := w.Parties[player.PartyID]; party != nil {
		_, leaderID, _ := party.GetSnapshot()
		if leaderID != playerID {
			return false
		}
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.InstanceID != "" || player.State == "DEAD" {
		return false
	}
	player.QADungeonFallbackNext = true
	return true
}

// ArmPlayerQAGuaranteedLoot makes one subsequent enemy encounter deterministic:
// the next accepted basic attack can finish the enemy and that kill uses the
// normal equipment generator even when its random 50% roll would miss.
// Authorization is enforced by the server command layer, and the flag is
// consumed on kill.
func (w *World) ArmPlayerQAGuaranteedLoot(playerID string) bool {
	player := w.GetEntity(playerID)
	if player == nil || player.Type != TypePlayer {
		return false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	player.QAGuaranteedLoot = true
	return true
}

// PreparePlayerForAnimationQA refills one dedicated QA character and clears
// its ability readiness gates. Authorization is enforced by the chat command
// layer. It never creates an effect, ability event, target, or damage.
// nearDeath leaves one health so a subsequent real hostile hit can exercise
// the authoritative death path without depending on the character's gear,
// retained health recovery, or an owned effect left active by the preceding
// all-ability matrix.
func (w *World) PreparePlayerForAnimationQA(playerID string, lowHealth, persistent, nearDeath bool) bool {
	w.Mu.Lock()
	player, ok := w.Entities[playerID]
	if !ok || player.Type != TypePlayer {
		w.Mu.Unlock()
		return false
	}
	if nearDeath {
		player.Mu.RLock()
		playerX, playerZ, playerInstanceID := player.X, player.Z, player.InstanceID
		player.Mu.RUnlock()
		for id, entity := range w.Entities {
			ownedProjectile := entity.OwnerID == playerID && entity.Type == TypeProjectile
			ownedSeraph := entity.OwnerID == playerID && entity.Type == TypeNPC && entity.SubType == "AvengingSeraph"
			if ownedProjectile || ownedSeraph {
				w.Grid.Remove(entity)
				delete(w.Entities, id)
				continue
			}

			// The class matrix runs immediately after another QA browser closes.
			// A nearby enemy can briefly retain that prior character's threat and
			// animate attacks without striking the character under test. Give only
			// nearby live hostiles decisive threat on this allowlisted character;
			// the enemy must still acquire it through normal AI and complete its
			// normal range, cooldown, swing delay, and damage path.
			if entity.Type != TypeEnemy {
				continue
			}
			entity.Mu.Lock()
			if entity.State != "DEAD" && entity.InstanceID == playerInstanceID &&
				math.Hypot(entity.X-playerX, entity.Z-playerZ) <= QADeathHostileAcquireRadius {
				if entity.Threat == nil {
					entity.Threat = make(map[string]float64)
				}
				entity.Threat[playerID] = 1_000_000_000
			}
			entity.Mu.Unlock()
		}
	}
	w.Mu.Unlock()

	player.Mu.Lock()
	defer player.Mu.Unlock()
	player.Mana = player.MaxMana
	player.Health = player.MaxHealth
	player.QAHealthRegenPausedUntil = time.Time{}
	player.QAHazardInspectionEndTime = time.Time{}
	if nearDeath {
		// The death check follows a complete ability/rune pass. End any movement,
		// absorb, lethal-prevention, mitigation, or healing state that could
		// legitimately survive the final cast. Owned projectiles and the Seraph
		// were removed above. Waypoint protection is kept separate and must
		// still be explicitly removed by /qa-protection off.
		player.IsCharging = false
		player.ChargeTargetX = player.X
		player.ChargeTargetZ = player.Z
		player.ChargeRuneID = ""
		player.ChargeSkillName = ""
		player.WhirlwindActive = false
		player.WhirlwindRuneID = ""
		player.ArcaneShieldActive = false
		player.ArcaneShieldHP = 0
		player.ArcaneShieldEndTime = time.Time{}
		player.ArcaneShieldRuneID = ""
		player.ArcaneShieldAbsorbed = 0
		player.DivineInterventionActive = false
		player.DivineInterventionEndTime = time.Time{}
		player.SanctuaryDamageReduction = false
		player.SanctuaryEndTime = time.Time{}
		player.ConsecratedSanctuaryEndTime = time.Time{}
		player.DivineInterventionGuardian = false
		player.DivineInterventionGuardTime = time.Time{}
		player.HealingLightHoTActive = false
		player.HealingLightHoTTicksRemaining = 0
		player.HealingLightHoTEndTime = time.Time{}
		player.GuardianEmbraceActive = false
		player.GuardianEmbraceEndTime = time.Time{}
		player.SpiritsActive = false
		player.SpiritEndTime = time.Time{}
		player.InvulnerableEndTime = time.Time{}
		player.Health = 1
		player.QAHealthRegenPausedUntil = time.Now().Add(time.Minute)
	} else if lowHealth {
		player.Health = max(1, player.MaxHealth/4)
	}
	player.AbilityCooldown = 0
	player.LastAbilityTime = time.Time{}
	player.Cooldowns = make(map[string]time.Time)
	player.QAPersistentDuration = 0
	if persistent {
		player.QAPersistentDuration = 45 * time.Second
	}
	if player.State != "DEAD" {
		player.State = "IDLE"
	}
	return true
}

// DisablePlayerQAProtection lets a dedicated QA character exercise a genuine
// hostile damage/death/respawn path after using a protected fixed waypoint. A
// nearby enemy is primed for one explicit attack on that character so another
// recently disconnected QA session cannot consume the validation swing.
func (w *World) DisablePlayerQAProtection(playerID string) bool {
	player := w.GetEntity(playerID)
	if player == nil || player.Type != TypePlayer {
		return false
	}
	player.Mu.Lock()
	player.QAWaypointProtectionEndTime = time.Time{}
	player.QAHazardInspectionEndTime = time.Time{}
	playerX, playerZ, playerInstanceID := player.X, player.Z, player.InstanceID
	player.Mu.Unlock()

	var nearest *Entity
	nearestDistance := math.MaxFloat64
	for _, candidate := range w.Grid.Nearby(playerX, playerZ, QADeathHostileAcquireRadius, playerInstanceID) {
		candidate.Mu.RLock()
		isLiveHostile := candidate.Type == TypeEnemy && candidate.State != "DEAD" &&
			candidate.InstanceID == playerInstanceID
		distance := math.Hypot(candidate.X-playerX, candidate.Z-playerZ)
		candidate.Mu.RUnlock()
		if isLiveHostile && distance < nearestDistance {
			nearest = candidate
			nearestDistance = distance
		}
	}

	if nearest != nil {
		nearest.Mu.Lock()
		if nearest.Threat == nil {
			nearest.Threat = make(map[string]float64)
		}
		nearest.Threat[playerID] = 1_000_000_000
		nearest.LastAttackTime = time.Time{}
		nearest.State = "IDLE"
		nearest.Stunned = false
		nearest.StunEndTime = time.Time{}
		nearest.AccuracyReduction = 0
		nearest.AccuracyReductionEndTime = time.Time{}
		nearest.Mu.Unlock()
		_, _ = w.PerformAttack(nearest.ID, playerID)
	}

	return true
}
