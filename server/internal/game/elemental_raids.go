package game

import (
	"fmt"
	"math"
	"math/rand"
)

type ElementalRaidDefinition struct {
	Type                 string
	Name                 string
	Element              string
	Crystal              string
	RepairTarget         string
	RequiredDungeonQuest string
	RestoredQuest        string
	RequiredLevel        int
	OriginX              float64
	Color                int
	Trash                string
	Elite                string
	Boss                 string
}

var elementalRaidDefinitions = map[string]ElementalRaidDefinition{
	"earth_crystal_raid": {
		Type: "earth_crystal_raid", Name: "Rootheart Sanctum", Element: "Earth", Crystal: "Rootheart Crystal",
		RepairTarget: "EarthCrystal", RequiredDungeonQuest: ChronicleEarthDungeonID, RestoredQuest: ChronicleEarthRestoredID,
		RequiredLevel: 30, OriginX: 80000, Color: 0x18311e, Trash: "DemonOrc", Elite: "Construct", Boss: "GravenColossus",
	},
	"water_crystal_raid": {
		Type: "water_crystal_raid", Name: "Tidestar Confluence", Element: "Water", Crystal: "Tidestar Crystal",
		RepairTarget: "WaterCrystal", RequiredDungeonQuest: ChronicleWaterDungeonID, RestoredQuest: ChronicleWaterRestoredID,
		RequiredLevel: 60, OriginX: 90000, Color: 0x102d42, Trash: "AquaGolem", Elite: "FrostGuardian", Boss: "TideboundTyrant",
	},
	"fire_crystal_raid": {
		Type: "fire_crystal_raid", Name: "Ember Crown Crucible", Element: "Fire", Crystal: "Ember Crown Crystal",
		RepairTarget: "FireCrystal", RequiredDungeonQuest: ChronicleFireDungeonID, RestoredQuest: ChronicleFireRestoredID,
		RequiredLevel: 70, OriginX: 100000, Color: 0x44150c, Trash: "MagmaGolem", Elite: "InfernalBehemoth", Boss: "AshenImperator",
	},
	"air_crystal_raid": {
		Type: "air_crystal_raid", Name: "Skyglass Eyrie", Element: "Air", Crystal: "Skyglass Crystal",
		RepairTarget: "AirCrystal", RequiredDungeonQuest: ChronicleAirDungeonID, RestoredQuest: ChronicleAirRestoredID,
		RequiredLevel: 70, OriginX: 110000, Color: 0x24394f, Trash: "StormHarpy", Elite: "TempestGiant", Boss: "TempestSovereign",
	},
}

func ElementalRaidDefinitionForType(raidType string) (ElementalRaidDefinition, bool) {
	definition, ok := elementalRaidDefinitions[raidType]
	return definition, ok
}

func ElementalRaidAccessForPlayer(player *Entity) map[string]bool {
	access := make(map[string]bool, len(elementalRaidDefinitions))
	for raidType, definition := range elementalRaidDefinitions {
		access[raidType] = player != nil && player.Level >= definition.RequiredLevel &&
			HasCompletedChronicleQuest(player, definition.RequiredDungeonQuest)
	}
	return access
}

func IsElementalRaidBoss(raidType, subType string) bool {
	definition, ok := ElementalRaidDefinitionForType(raidType)
	return ok && definition.Boss == subType
}

func (w *World) ConvertPartyToRaidForType(leaderID, raidType string) (*Party, error) {
	definition, elemental := ElementalRaidDefinitionForType(raidType)
	if !elemental && raidType != "weekly_raid" {
		return nil, fmt.Errorf("unknown raid")
	}
	w.Mu.RLock()
	leader := w.Entities[leaderID]
	if leader == nil || leader.PartyID == "" {
		w.Mu.RUnlock()
		return nil, fmt.Errorf("leader is not in a party")
	}
	party := w.Parties[leader.PartyID]
	w.Mu.RUnlock()
	if party == nil {
		return nil, fmt.Errorf("party not found")
	}
	leader.Mu.RLock()
	leaderLevel := leader.Level
	unlocked := raidType == "weekly_raid" && leaderLevel >= MaxPlayerLevel
	if elemental {
		unlocked = leaderLevel >= definition.RequiredLevel && HasCompletedChronicleQuest(leader, definition.RequiredDungeonQuest)
	}
	leader.Mu.RUnlock()
	if !unlocked {
		return nil, fmt.Errorf("complete the realm dungeon chapter before forming this raid")
	}
	party.Mu.Lock()
	defer party.Mu.Unlock()
	if party.LeaderID != leaderID {
		return nil, fmt.Errorf("only the party leader can form a raid")
	}
	party.MaxSize = 10
	return party, nil
}

func (w *World) ValidateElementalRaidParty(leaderID, raidType string) (*Party, []string, error) {
	definition, ok := ElementalRaidDefinitionForType(raidType)
	if !ok {
		return nil, nil, fmt.Errorf("unknown elemental raid")
	}
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	leader := w.Entities[leaderID]
	if leader == nil || leader.PartyID == "" {
		return nil, nil, fmt.Errorf("a raid group is required")
	}
	party := w.Parties[leader.PartyID]
	if party == nil {
		return nil, nil, fmt.Errorf("raid group not found")
	}
	party.Mu.RLock()
	defer party.Mu.RUnlock()
	if party.LeaderID != leaderID || party.MaxSize != 10 {
		return nil, nil, fmt.Errorf("the leader must form a raid group first")
	}
	if len(party.Members) < 5 || len(party.Members) > 10 {
		return nil, nil, fmt.Errorf("elemental raids require 5-10 players")
	}
	members := append([]string(nil), party.Members...)
	for _, memberID := range members {
		member := w.Entities[memberID]
		if member == nil {
			return nil, nil, fmt.Errorf("every raid member must be online")
		}
		member.Mu.RLock()
		qualified := member.Level >= definition.RequiredLevel && !member.Disconnected &&
			HasCompletedChronicleQuest(member, definition.RequiredDungeonQuest)
		member.Mu.RUnlock()
		if !qualified {
			return nil, nil, fmt.Errorf("every raider must meet the level requirement and clear the realm dungeon chapter")
		}
		if !party.Ready[memberID] {
			return nil, nil, fmt.Errorf("every raid member must confirm the ready check")
		}
	}
	return party, members, nil
}

// generateElementalRaidLayout creates a distinct assault route. The raid boss
// secures the crystal chamber; defeating it starts the separate three-wave
// repair Vigil in that same arena.
func (w *World) generateElementalRaidLayout(instanceID string, difficulty DungeonDifficulty, raidType string) DungeonLayout {
	definition, ok := ElementalRaidDefinitionForType(raidType)
	if !ok {
		return DungeonLayout{}
	}
	originX, originZ := definition.OriginX, 20000.0
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: originX, Z: originZ, Width: 170, Height: 170, Type: "start", Color: definition.Color})
	for stage := 1; stage <= 2; stage++ {
		roomZ := originZ - float64(stage*230)
		roomType := "normal"
		if stage == 2 {
			roomType = "elite"
		}
		appendDungeonRoomAndConnect(&layout, DungeonRoom{X: originX, Z: roomZ, Width: 170, Height: 160, Type: roomType, Color: definition.Color}, canonicalDungeonCorridorWidth*1.5)
		count := 5 + stage*2
		for enemyIndex := 0; enemyIndex < count; enemyIndex++ {
			angle := (float64(enemyIndex) / float64(count)) * math.Pi * 2
			subType := definition.Trash
			elite := false
			if stage == 2 && enemyIndex%2 == 0 {
				subType, elite = definition.Elite, true
			}
			w.spawnDungeonEnemyInInstance(subType, originX+math.Cos(angle)*25, roomZ+math.Sin(angle)*25, instanceID, difficulty, elite)
		}
	}
	bossZ := originZ - 720
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: originX, Z: bossZ, Width: 270, Height: 250, Type: "boss", Hook: "crystal_vigil", Color: definition.Color}, canonicalDungeonCorridorWidth*2)
	w.spawnBossInInstance(definition.Boss, originX, bossZ, instanceID, difficulty)
	return layout
}

func elementalRaidBossName(subType string) string {
	for _, definition := range elementalRaidDefinitions {
		if definition.Boss == subType {
			return definition.Name + " — " + splitQuestTarget(subType)
		}
	}
	return splitQuestTarget(subType)
}

func elementalRaidWavePosition(centerX, centerZ float64, wave, index, count int) (float64, float64) {
	angle := (float64(index)/float64(max(1, count)))*math.Pi*2 + float64(wave)*0.4
	radius := 58.0 + float64(wave*8) + rand.Float64()*4
	return centerX + math.Cos(angle)*radius, centerZ + math.Sin(angle)*radius
}
