package game

import (
	"fmt"
	"time"
)

func (w *World) DropLoot(item Item, x, z float64) {
	w.DropLootInInstance(item, x, z, "")
}

func (w *World) DropLootInInstance(item Item, x, z float64, instanceID string) {
	now := time.Now()
	loot := &Entity{
		ID:         fmt.Sprintf("loot-%d", now.UnixNano()),
		Type:       TypeLoot,
		X:          x,
		Y:          0.5,
		Z:          z,
		LootItem:   &item,
		CreatedAt:  now,
		LootTime:   now,
		InstanceID: instanceID,
	}
	w.AddEntity(loot)
}
