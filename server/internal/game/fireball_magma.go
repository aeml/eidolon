package game

import (
	"fmt"
	"time"
)

// The real hit has already paid outgoing bonuses/crit/recipient PvP scaling.
// The field inherits that budget once, rather than copying a mobile bleed or
// rereading caster gear at every pulse. This update owns no world lock: publish
// the new field through the frame's normal deferred-addition boundary.
func (w *World) queueMagmaGround(deferred *deferredActions, instanceID, ownerID string, x, z float64, hit int, pvpScaled bool) {
	damage := hit / 6
	if damage <= 0 {
		return
	}
	now := time.Now()
	y := 0.0
	if ground, active := w.overworldGroundHeight(instanceID, x, z); active {
		y += ground
	}
	deferred.addAddition(&Entity{
		ID:   fmt.Sprintf("zone-magma-%s-%d", ownerID, now.UnixNano()),
		Type: TypeProjectile, SubType: "MagmaGround", InstanceID: instanceID, OwnerID: ownerID,
		X: x, Y: y, Z: z, Radius: 5, Scale: 1, Damage: damage, CreatedAt: now,
		LastAttackTime: now.Add(-time.Second), ZoneEndTime: now.Add(3 * time.Second),
		ProjectileRuneID: "fireball_magma", ProjectileSkill: "Fireball", ZoneDamagePvPScaled: pvpScaled,
	})
}
