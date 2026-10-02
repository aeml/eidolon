package main

import "eidolon-server/internal/game"

func projectileImpactBroadcast(event game.ProjectileImpactEvent, data []byte) BroadcastMessage {
	return BroadcastMessage{Type: MsgProjectileImpact, Data: data, InstanceID: event.InstanceID,
		Footprint: BroadcastFootprint{Present: true, X: event.X, Z: event.Z, Radius: event.Radius}}
}
