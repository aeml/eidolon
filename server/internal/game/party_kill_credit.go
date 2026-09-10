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
