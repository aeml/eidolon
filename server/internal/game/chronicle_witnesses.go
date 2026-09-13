package game

import "math"

// Static, non-combat residents. Dialogue reads existing quest receipts on the
// client; these NPCs do not accept quests, sell anything or produce rewards.
// Positions stay in the open southern plaza, inside the camp exclusion radius.
func (w *World) spawnChronicleWitnesses() {
	for _, witness := range []struct {
		id, name string
		x        float64
	}{
		{"chronicle-witness-mara", "Mara Fen", -24},
		{"chronicle-witness-dain", "Dain", -8},
		{"chronicle-witness-hessa", "Hessa", 8},
		{"chronicle-witness-selen", "Selen", 24},
	} {
		w.AddEntity(&Entity{ID: witness.id, Name: witness.name, Type: TypeNPC, SubType: "ChronicleWitness",
			X: witness.x, Y: 0.5, Z: 235, SpawnX: witness.x, SpawnZ: 235, Rotation: math.Pi, State: "IDLE", Scale: 1})
	}
}
