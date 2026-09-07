package game

import (
	"errors"
	"math"
	"math/bits"
	"strings"
)

type ChronicleDiscoveryReceipt struct {
	QuestID  string `json:"questId"`
	SiteID   string `json:"siteId"`
	Recorded bool   `json:"recorded"`
	Count    int    `json:"count"`
	Mask     uint32 `json:"mask"`
}

func investigationSite(entityID string) (ChronicleInvestigation, ChronicleDiscovery, int, bool) {
	if !strings.HasPrefix(entityID, "chronicle-site-") {
		return ChronicleInvestigation{}, ChronicleDiscovery{}, 0, false
	}
	for _, chapter := range ChronicleInvestigationCatalog() {
		for index, site := range chapter.Sites {
			if site.EntityID == entityID {
				return chapter, site, index, true
			}
		}
	}
	return ChronicleInvestigation{}, ChronicleDiscovery{}, 0, false
}

// This registration remains separate from initWorld until the rendered sites,
// interaction protocol and migration-safe quest graph are integrated together.
func (w *World) spawnChronicleInvestigationSites() {
	for _, chapter := range ChronicleInvestigationCatalog() {
		for _, site := range chapter.Sites {
			entity := &Entity{ID: site.EntityID, Type: TypeNPC, SubType: "ChronicleSite", Name: site.Title,
				X: site.X, Z: site.Z, SpawnX: site.X, SpawnZ: site.Z, State: "IDLE", Scale: 1}
			if site.Kind == "combat" {
				profile := overworldEnemyCombatProfile(site.Model, 75, false)
				entity.Type, entity.SubType, entity.Level = TypeEnemy, site.Model, 75
				entity.BaseStats, entity.Stats = profile.BaseStats, profile.BaseStats
				entity.Health, entity.MaxHealth = profile.Health, profile.MaxHealth
				entity.Damage = profile.Damage
				entity.Speed, entity.BaseSpeed = profile.Speed, profile.Speed
				entity.AttackSpeed, entity.AttackCooldown = profile.AttackSpeed, profile.AttackCooldown
			}
			w.AddEntity(entity)
		}
	}
}

func (w *World) InspectChronicleSite(playerID, entityID string) (ChronicleDiscoveryReceipt, error) {
	return w.recordChronicleDiscovery(playerID, entityID, false)
}

// RecordChronicleInvestigationKill is for authoritative combat, not a client
// claim. It still checks the real defeated enemy, position and accepted quest.
func (w *World) RecordChronicleInvestigationKill(playerID, entityID string) (ChronicleDiscoveryReceipt, error) {
	return w.recordChronicleDiscovery(playerID, entityID, true)
}

func (w *World) recordChronicleDiscovery(playerID, entityID string, combat bool) (ChronicleDiscoveryReceipt, error) {
	chapter, site, index, found := investigationSite(entityID)
	if !found {
		return ChronicleDiscoveryReceipt{}, errors.New("Unknown Chronicle discovery")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, exists := w.Entities[playerID]
	if !exists || player.Type != TypePlayer {
		return ChronicleDiscoveryReceipt{}, errors.New("Player not found")
	}
	object := w.Entities[entityID]
	if object == nil {
		return ChronicleDiscoveryReceipt{}, errors.New("This discovery is not available here")
	}
	// Snapshot the object before locking the player; combat can hold the enemy
	// lock while updating its attacker, so do not nest them in the reverse order.
	object.Mu.RLock()
	objectType, objectSubtype, objectState, objectInstance := object.Type, object.SubType, object.State, object.InstanceID
	objectHealth := object.Health
	objectX, objectZ := object.X, object.Z
	if combat {
		objectX, objectZ = object.SpawnX, object.SpawnZ
	}
	object.Mu.RUnlock()
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.State == "DEAD" || player.Health <= 0 || player.InstanceID != "" || objectInstance != "" {
		return ChronicleDiscoveryReceipt{}, errors.New("This discovery is not available here")
	}
	// A matching ID at an arbitrary location is not the authored site.
	if objectX != site.X || objectZ != site.Z || math.IsNaN(player.X) || math.IsNaN(player.Z) || math.IsInf(player.X, 0) || math.IsInf(player.Z, 0) {
		return ChronicleDiscoveryReceipt{}, errors.New("Invalid discovery position")
	}
	rangeSquared := 25.0
	if combat {
		rangeSquared = 200 * 200
	}
	dx, dz := player.X-site.X, player.Z-site.Z
	if dx*dx+dz*dz > rangeSquared {
		return ChronicleDiscoveryReceipt{}, errors.New("Move closer to investigate")
	}
	if combat {
		if site.Kind != "combat" || objectType != TypeEnemy || objectSubtype != site.Model || objectState != "DEAD" || objectHealth > 0 {
			return ChronicleDiscoveryReceipt{}, errors.New("The command anchor has not been defeated")
		}
	} else if site.Kind != "inspect" || objectType != TypeNPC || objectSubtype != "ChronicleSite" {
		return ChronicleDiscoveryReceipt{}, errors.New("This discovery requires combat, not inspection")
	}
	for i := range player.Quests {
		quest := &player.Quests[i]
		if quest.ID != chapter.ID || quest.Type != "INVESTIGATE" || !quest.Accepted {
			continue
		}
		bit := uint32(1) << index
		if quest.InvestigationMask&bit != 0 {
			return ChronicleDiscoveryReceipt{QuestID: quest.ID, SiteID: site.ID, Count: quest.Count, Mask: quest.InvestigationMask}, nil
		}
		if quest.Completed {
			return ChronicleDiscoveryReceipt{}, errors.New("This quest is already complete")
		}
		for requiredIndex, prerequisite := range chapter.Sites {
			if prerequisite.ID == site.Requires && quest.InvestigationMask&(1<<requiredIndex) == 0 {
				return ChronicleDiscoveryReceipt{}, errors.New("Investigate the earlier evidence first")
			}
		}
		quest.InvestigationMask = (quest.InvestigationMask | bit) & ((1 << len(chapter.Sites)) - 1)
		quest.Count = bits.OnesCount32(quest.InvestigationMask)
		// Deliberate discovery records evidence only. Ilyra's existing manual
		// completion path will be the sole place to grant the quest reward.
		return ChronicleDiscoveryReceipt{QuestID: quest.ID, SiteID: site.ID, Recorded: true, Count: quest.Count, Mask: quest.InvestigationMask}, nil
	}
	return ChronicleDiscoveryReceipt{}, errors.New("Accept this investigation from Ilyra first")
}
