package game

import "math"

// Two default 16:9 desktop screen widths: 2 * (2 * camera zoom15 * 16/9)
// is106.67 world units. Round to110 and keep it server-owned: client zoom,
// resolution and phone orientation must never expand reward eligibility.
const OverworldPartyRewardRadius = 110.0

func partyKillUsesDungeonPresence(instanceType string) bool {
	_, dungeon := supportedDungeonTypes[instanceType]
	_, raid := ElementalRaidDefinitionForType(instanceType)
	return dungeon || raid || instanceType == "weekly_raid" || instanceType == "crypt"
}

// Caller holds member.Mu. Presence, not damage contribution or proximity to
// the boss, determines dungeon credit. A corpse still inside counts; a player
// who recalled, changed instances or disconnected does not.
func eligibleForPartyKillCredit(member *Entity, instanceID string, dungeon bool, x, z float64) bool {
	if member == nil || member.Type != TypePlayer || member.Disconnected || member.InstanceID != instanceID {
		return false
	}
	if dungeon && instanceID != "" {
		return true
	}
	return math.Hypot(member.X-x, member.Z-z) <= OverworldPartyRewardRadius
}

// Take the recipient snapshot before queuing reward work. Ability dispatch
// already owns w.Mu; timed attacks and world ticks do not. No actor lock may be
// held by the caller. The unlocked path releases the world read lock before
// reading actors, preserving the update loop's fine-grained locking order.
func (w *World) snapshotPartyKillRecipients(partyID, instanceID string, x, z float64, worldLocked bool) []*Entity {
	if partyID == "" {
		return nil
	}
	var candidates []*Entity
	var instance *DungeonInstance
	func() {
		if !worldLocked {
			w.Mu.RLock()
			defer w.Mu.RUnlock()
		}
		party := w.Parties[partyID]
		if party == nil {
			return
		}
		_, _, ids := party.GetSnapshot()
		for _, id := range ids {
			if member := w.Entities[id]; member != nil {
				candidates = append(candidates, member)
			}
		}
		instance = w.InstanceLayouts[instanceID]
	}()
	dungeon := false
	if instance != nil {
		instance.Mu.RLock()
		dungeon = partyKillUsesDungeonPresence(instance.DungeonType)
		instance.Mu.RUnlock()
	}
	var eligible []*Entity
	for _, member := range candidates {
		member.Mu.RLock()
		include := eligibleForPartyKillCredit(member, instanceID, dungeon, x, z)
		member.Mu.RUnlock()
		if include {
			eligible = append(eligible, member)
		}
	}
	return eligible
}
