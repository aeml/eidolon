package game

import (
	"fmt"
	"math/rand"
	"time"
)

// Caller holds w.Mu. Budget check, personal roll and insertion are one atomic
// publication, so simultaneous deaths cannot reserve the same missing fragment.
// There is no persisted reservation counter to strand a character after expiry,
// instance cleanup or server restart: the actual world drops are the reservation.
func (w *World) spawnChronicleDropLocked(playerID, defeatedSubType, instanceID string, x, z, roll float64) *Entity {
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.InstanceID != instanceID {
		return nil // The captured recipient has since left this encounter.
	}
	var objective *Quest
	for i := range player.Quests {
		q := &player.Quests[i]
		if q.Category == QuestCategoryChronicle && q.Type == "COLLECT" && q.Accepted && !q.Completed && q.Count < q.MaxCount {
			objective = q
			break
		}
	}
	if objective == nil || !chronicleDropSources[objective.Target][defeatedSubType] {
		return nil
	}
	remaining := objective.MaxCount - objective.Count
	for _, entity := range w.Entities {
		if entity.Type != TypeLoot || entity.LootOwnerID != playerID || entity.LootItem == nil ||
			entity.LootItem.Name != objective.Target || !IsChronicleQuestItem(*entity.LootItem) {
			continue
		}
		remaining -= max(0, entity.LootItem.Stack)
		if remaining <= 0 {
			// Do not consume a roll or advance/reset saved bad-luck protection
			// when enough personal fragments are already waiting for pickup.
			return nil
		}
	}
	item := ChronicleDropForKill(player, defeatedSubType, roll)
	if item == nil {
		return nil
	}
	loot := &Entity{
		ID: fmt.Sprintf("story-loot-%d-%s", time.Now().UnixNano(), playerID), Type: TypeLoot,
		InstanceID: instanceID, X: x + (rand.Float64()-0.5)*1.5, Y: 0.5, Z: z + (rand.Float64()-0.5)*1.5,
		LootItem: item, LootTime: time.Now(), LootOwnerID: playerID,
	}
	w.Entities[loot.ID] = loot
	w.Grid.Add(loot)
	return loot
}
