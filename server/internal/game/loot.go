package game

import (
	"fmt"
	"time"
)

func (w *World) DropLoot(item Item, x, y float64) {
	// Create Loot Entity
	loot := &Entity{
		ID:         fmt.Sprintf("loot-%d", time.Now().UnixNano()),
		Type:       TypeLoot,
		X:          x,
		Y:          0.5,
		Z:          y,
		LootItem:   &item,
		CreatedAt:  time.Now(),
		InstanceID: "", // Loot drops in overworld by default unless specified
	}
	// If we want loot to drop in instances, we need to pass the instance ID to DropLoot
	// For now, let's assume DropLoot is only called for overworld or we need to update it.
	// Actually, DropLoot is usually called from handleDeath, which has access to the dead entity.
	// We should update DropLoot to take instanceID.
	w.AddEntity(loot)
}

func (w *World) DropLootInInstance(item Item, x, y float64, instanceID string) {
	loot := &Entity{
		ID:         fmt.Sprintf("loot-%d", time.Now().UnixNano()),
		Type:       TypeLoot,
		X:          x,
		Y:          0.5,
		Z:          y,
		LootItem:   &item,
		CreatedAt:  time.Now(),
		InstanceID: instanceID,
	}
	w.AddEntity(loot)
}
