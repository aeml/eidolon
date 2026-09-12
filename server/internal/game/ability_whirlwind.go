package game

import (
	"math"
	"time"
)

const whirlwindPulseInterval = 500 * time.Millisecond

// The paid cast owns its footprint; subsequent talent changes cannot resize
// later pulses. Zero is the legacy (untrained) active-cast representation.
func (player *Entity) WhirlwindAreaRadius() float64 {
	if player.WhirlwindRadius < 6 || player.WhirlwindRadius > 8.1+1e-9 || math.IsNaN(player.WhirlwindRadius) {
		return 6
	}
	return player.WhirlwindRadius
}

// WhirlwindRemaining is presentation state, not a client-controlled timer.
// Call with the entity read lock held or on an owned broadcast copy.
func (player *Entity) WhirlwindRemaining(now time.Time) float64 {
	if !player.WhirlwindActive || player.State == "DEAD" || player.Health <= 0 || player.Disconnected {
		return 0
	}
	return math.Max(0, player.WhirlwindEndTime.Sub(now).Seconds())
}

// A normal spin lasts one second, matching the authored Fighter spin. Extended
// doubles that window and halves each pulse, not the total raw damage budget.
func (w *World) beginWhirlwind(player *Entity, now time.Time, contexts ...*abilityImpactContext) bool {
	// Production passes its world-locked cast batch. Standalone callers own
	// no world lock and finish their first-pulse reactions before returning.
	impacts := &abilityImpactContext{world: w}
	if len(contexts) > 0 && contexts[0] != nil {
		impacts = contexts[0]
	} else {
		defer impacts.flush()
	}
	player.Mu.Lock()
	cost := resolveAbilityManaCost(player, "Whirlwind", 30)
	if player.Mana < cost {
		player.Mu.Unlock()
		return false
	}
	player.Mana -= cost
	runeID := player.GetRuneForSkill("Whirlwind")
	budget := int((float64(player.Damage)*0.8 + float64(player.Stats.Strength)*2) * 1.3 * player.GetSkillDamageMultiplier("Whirlwind"))
	if player.ActiveCombo == "whirlwind_damage_boost" {
		budget = int(float64(budget) * 1.5)
		player.ActiveCombo = ""
	}
	player.WhirlwindActive = true
	player.WhirlwindRadius = effectiveAbilityAreaRadius(player, "Whirlwind", 6)
	player.WhirlwindStartTime = now
	player.WhirlwindTotalTicks = 2
	if runeID == "whirlwind_extended" {
		player.WhirlwindTotalTicks = 4
	}
	player.WhirlwindEndTime = now.Add(time.Duration(player.WhirlwindTotalTicks) * whirlwindPulseInterval)
	player.WhirlwindInstanceID = player.InstanceID
	player.WhirlwindRuneID = runeID
	player.WhirlwindDamageBudget = budget
	player.WhirlwindTickCount = 0
	player.WhirlwindHitTargets = make(map[string]bool)
	player.Mu.Unlock()
	// The cast's first pulse shares its batch, so reflection runs after the
	// outer PerformAbility bookkeeping instead of having DEAD overwritten.
	w.updateWhirlwindImpacts(player, now, nil, impacts, false)
	return true
}

// Caller holds the player lock. Transient spins never survive scene changes,
// death, disconnect or a new session. No private pulse state is persisted.
func clearWhirlwindLocked(player *Entity) {
	player.WhirlwindActive = false
	player.WhirlwindRadius = 0
	player.WhirlwindStartTime, player.WhirlwindEndTime = time.Time{}, time.Time{}
	player.WhirlwindRuneID, player.WhirlwindInstanceID = "", ""
	player.WhirlwindTickCount, player.WhirlwindTotalTicks, player.WhirlwindDamageBudget = 0, 0, 0
	player.WhirlwindHitTargets = nil
}

// No caller actor lock: snapshots precede target locks, including two players
// spinning in parallel. At most four pulses can be processed in one update.
func (w *World) updateWhirlwind(player *Entity, now time.Time, deferred *deferredActions, worldLocked ...bool) {
	impacts := &abilityImpactContext{world: w, worldLocked: len(worldLocked) > 0 && worldLocked[0]}
	defer impacts.flush()
	w.updateWhirlwindImpacts(player, now, deferred, impacts, true)
}

func (w *World) updateWhirlwindImpacts(player *Entity, now time.Time, deferred *deferredActions, impacts *abilityImpactContext, flushEachPulse bool) {
	for {
		player.Mu.Lock()
		if !player.WhirlwindActive {
			player.Mu.Unlock()
			return
		}
		if player.State == "DEAD" || player.Health <= 0 || player.Disconnected ||
			player.InstanceID != player.WhirlwindInstanceID || !now.Before(player.WhirlwindEndTime) ||
			player.WhirlwindTotalTicks < 2 || player.WhirlwindTotalTicks > 4 {
			clearWhirlwindLocked(player)
			player.Mu.Unlock()
			return
		}
		i, total, budget := player.WhirlwindTickCount, player.WhirlwindTotalTicks, player.WhirlwindDamageBudget
		if i >= total || now.Before(player.WhirlwindStartTime.Add(time.Duration(i)*whirlwindPulseInterval)) {
			player.Mu.Unlock()
			return
		}
		// Cumulative integer division preserves the exact cast budget, even
		// when it is not divisible by the number of pulses.
		damage := budget*(i+1)/total - budget*i/total
		player.WhirlwindTickCount++
		attacker := snapshotCombatAttackerLocked(player)
		attacker.X, attacker.Z, attacker.PartyID = player.X, player.Z, player.PartyID
		originX, originZ := player.X, player.Z
		radius := player.WhirlwindAreaRadius()
		start, runeID := player.WhirlwindStartTime, player.WhirlwindRuneID
		seen := make(map[string]bool, len(player.WhirlwindHitTargets))
		for id := range player.WhirlwindHitTargets {
			seen[id] = true
		}
		player.Mu.Unlock()
		walkRects := w.dungeonWalkRectsSnapshot(attacker.InstanceID)
		newHits := []string{}
		for _, target := range w.Grid.Nearby(originX, originZ, expandedAbilityRadius("Whirlwind", radius), attacker.InstanceID) {
			if target.ID == attacker.ID {
				continue
			}
			target.Mu.Lock()
			if !w.CanDamage(attacker, target) || target.State == "DEAD" ||
				!withinDungeonAbilityRadius(walkRects, "Whirlwind", originX, originZ, target, radius) {
				target.Mu.Unlock()
				continue
			}
			finalDamage := impacts.damage(attacker, target, damage, "physical", "Whirlwind")
			addThreatLocked(target, attacker.ID, float64(finalDamage))
			dead := target.Health <= 0
			if !seen[target.ID] {
				newHits = append(newHits, target.ID)
				if runeID == "whirlwind_bladestorm" && !dead && !target.CCImmune && !target.IronFortressImmovable {
					dx, dz := originX-target.X, originZ-target.Z
					distance := math.Hypot(dx, dz)
					if distance > 1 {
						oldX, oldZ := target.X, target.Z
						pull := math.Min(2, distance)
						target.X += dx / distance * pull
						target.Z += dz / distance * pull
						w.Grid.Update(target, oldX, oldZ)
					}
				}
			}
			target.Mu.Unlock()
			w.fireDamageEvent(player, target.ID, finalDamage, "physical", attacker.InstanceID)
			if dead {
				target.Mu.Lock()
				w.handleDeathWithWorldLock(target, player, deferred, impacts.worldLocked)
				target.Mu.Unlock()
			}
		}
		player.Mu.Lock()
		healed := 0
		if player.WhirlwindActive && player.WhirlwindStartTime.Equal(start) && player.InstanceID == attacker.InstanceID &&
			player.State != "DEAD" && player.Health > 0 && !player.Disconnected {
			for _, id := range newHits {
				player.WhirlwindHitTargets[id] = true
			}
			if runeID == "whirlwind_bloodwhirl" && len(newHits) > 0 {
				before := player.Health
				player.Health = min(player.MaxHealth, player.Health+applyHealingReceived(player, player.MaxHealth*2*len(newHits)/100))
				healed = player.Health - before
			}
		}
		player.Mu.Unlock()
		if healed > 0 {
			w.fireHealEvent(attacker.ID, attacker.ID, healed, "self_restore", attacker.InstanceID)
		}
		if flushEachPulse {
			// No actor locks are held. A lethal reflection must cancel any
			// remaining catch-up pulses when the loop rechecks the caster.
			impacts.flush()
		}
	}
}
