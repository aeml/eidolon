package game

import (
	"fmt"
	"time"
)

type WeeklyRaidCompletionEvent struct {
	PlayerID   string `json:"playerId"`
	InstanceID string `json:"instanceId"`
}

type DungeonCompletionEvent struct {
	InstanceID   string            `json:"instanceId"`
	DungeonType  string            `json:"dungeonType"`
	Difficulty   DungeonDifficulty `json:"difficulty"`
	RunLevel     int               `json:"runLevel"`
	Duration     time.Duration     `json:"duration"`
	Participants []string          `json:"participants"`
}

func isFinalDungeonBoss(subType string) bool {
	switch subType {
	case "HollowSentinel", "LordInfernax", "Zephyrion", "Thalorath", "EidolonDevourer":
		return true
	default:
		return false
	}
}

type RewardSummaryEvent struct {
	PlayerID          string `json:"playerId"`
	Title             string `json:"title"`
	Subtitle          string `json:"subtitle,omitempty"`
	Gold              int    `json:"gold"`
	XP                int    `json:"xp"`
	ItemCount         int    `json:"itemCount"`
	GemCount          int    `json:"gemCount"`
	HeartCount        int    `json:"heartCount"`
	BossName          string `json:"bossName,omitempty"`
	InstanceType      string `json:"instanceType,omitempty"`
	Difficulty        string `json:"difficulty,omitempty"`
	RunLevel          int    `json:"runLevel,omitempty"`
	RoomsCleared      int    `json:"roomsCleared,omitempty"`
	TotalRooms        int    `json:"totalRooms,omitempty"`
	EliteRoomsCleared int    `json:"eliteRoomsCleared,omitempty"`
	TotalEliteRooms   int    `json:"totalEliteRooms,omitempty"`
	DifficultyNote    string `json:"difficultyNote,omitempty"`
	ExitHint          string `json:"exitHint,omitempty"`
}

type DungeonRoomClearRewardEvent struct {
	PlayerID            string `json:"playerId"`
	Title               string `json:"title"`
	Subtitle            string `json:"subtitle,omitempty"`
	Gold                int    `json:"gold"`
	XP                  int    `json:"xp"`
	ItemCount           int    `json:"itemCount,omitempty"`
	GemCount            int    `json:"gemCount,omitempty"`
	HeartCount          int    `json:"heartCount,omitempty"`
	Hint                string `json:"hint,omitempty"`
	RoomIndex           int    `json:"roomIndex"`
	ObjectiveRoomIndex  int    `json:"objectiveRoomIndex"`
	RoomType            string `json:"roomType,omitempty"`
	RoomHook            string `json:"roomHook,omitempty"`
	InstanceType        string `json:"instanceType,omitempty"`
	Difficulty          string `json:"difficulty,omitempty"`
	HealthRestored      int    `json:"healthRestored,omitempty"`
	ManaRestored        int    `json:"manaRestored,omitempty"`
	BuffName            string `json:"buffName,omitempty"`
	BuffDurationSeconds int    `json:"buffDurationSeconds,omitempty"`
	DamageReductionPct  int    `json:"damageReductionPct,omitempty"`
}

func formatDungeonLabel(instanceType string) string {
	switch instanceType {
	case "verdant_bastion_catacombs":
		return "Verdant Bastion Catacombs"
	case "molten_core":
		return "Molten Core"
	case "tempest_spire":
		return "Tempest Spire"
	case "abyssal_well":
		return "Abyssal Well"
	case "umbral_nexus":
		return "Umbral Nexus"
	case "weekly_raid":
		return "Dark Realm: Malachar's Court"
	case "earth_crystal_raid":
		return "Rootheart Sanctum"
	case "water_crystal_raid":
		return "Tidestar Confluence"
	case "fire_crystal_raid":
		return "Ember Crown Crucible"
	case "air_crystal_raid":
		return "Skyglass Eyrie"
	default:
		return "Dungeon"
	}
}

func formatDungeonDifficultyLabel(difficulty DungeonDifficulty) string {
	switch difficulty {
	case DifficultyHeroic:
		return "Heroic"
	case DifficultyMythic:
		return "Mythic"
	default:
		return "Normal"
	}
}

func countRewardDrops(items []*Item) (itemCount, gemCount int) {
	for _, item := range items {
		if item == nil {
			continue
		}
		if item.Type == ItemGem {
			gemCount++
			continue
		}
		itemCount++
	}
	return itemCount, gemCount
}

func buildBossRewardSummary(playerID, bossName, instanceType string, difficulty DungeonDifficulty, runLevel, roomsCleared, eliteRoomsCleared, totalRooms, totalEliteRooms, gold, xp, heartCount int, lootItems []*Item) RewardSummaryEvent {
	itemCount, gemCount := countRewardDrops(lootItems)
	return RewardSummaryEvent{
		PlayerID:          playerID,
		Title:             fmt.Sprintf("Boss Defeated: %s", bossName),
		Subtitle:          fmt.Sprintf("%s • %s", formatDungeonLabel(instanceType), formatDungeonDifficultyLabel(difficulty)),
		Gold:              gold,
		XP:                xp,
		ItemCount:         itemCount,
		GemCount:          gemCount,
		HeartCount:        heartCount,
		BossName:          bossName,
		InstanceType:      instanceType,
		Difficulty:        string(difficulty),
		RunLevel:          runLevel,
		RoomsCleared:      roomsCleared,
		TotalRooms:        totalRooms,
		EliteRoomsCleared: eliteRoomsCleared,
		TotalEliteRooms:   totalEliteRooms,
		DifficultyNote:    difficultyRewardNote(difficulty),
		ExitHint:          "Return to the entrance to leave the dungeon.",
	}
}

func difficultyRewardNote(difficulty DungeonDifficulty) string {
	switch difficulty {
	case DifficultyHeroic:
		return "Heroic bosses guarantee one bonus gem drop."
	case DifficultyMythic:
		return "Mythic bosses guarantee one bonus gem and one unique-effect item."
	default:
		return ""
	}
}

func formatDungeonRoomLabel(roomType string, roomIndex int) string {
	switch roomType {
	case "elite":
		return fmt.Sprintf("Elite Chamber %d", roomIndex)
	case "boss":
		return "Boss Chamber"
	case "start":
		return "Entry Hall"
	default:
		return fmt.Sprintf("Room %d", roomIndex)
	}
}

func buildDungeonRoomClearRewardSummary(playerID string, roomIndex, objectiveRoomIndex, gold, xp, itemCount, gemCount, heartCount int, instanceType string, difficulty DungeonDifficulty, roomType, roomHook string, healthRestored, manaRestored int) DungeonRoomClearRewardEvent {
	hint := "Path opened deeper into the dungeon"
	buffName := ""
	buffDurationSeconds := 0
	damageReductionPct := 0
	if roomHook == "shrine" {
		hint = "Shrine restored your strength for the next push"
		buffName = "Sanctuary"
		buffDurationSeconds = 8
		damageReductionPct = 25
	} else if roomHook == "chest" {
		hint = "Treasure secured — cash in before the boss"
	} else if roomHook == "elite_ambush" {
		hint = "Ambush survived — momentum and spoils increased"
	} else if objectiveRoomIndex >= 0 {
		if roomType == "elite" {
			hint = "Elite cleared — push toward the next objective"
		} else {
			hint = "Path opened to the boss room"
		}
	}

	return DungeonRoomClearRewardEvent{
		PlayerID:            playerID,
		Title:               fmt.Sprintf("Room Cleared: %s", formatDungeonRoomLabel(roomType, roomIndex)),
		Subtitle:            fmt.Sprintf("%s • %s", formatDungeonLabel(instanceType), formatDungeonDifficultyLabel(difficulty)),
		Gold:                gold,
		XP:                  xp,
		ItemCount:           itemCount,
		GemCount:            gemCount,
		HeartCount:          heartCount,
		Hint:                hint,
		RoomIndex:           roomIndex,
		ObjectiveRoomIndex:  objectiveRoomIndex,
		RoomType:            roomType,
		RoomHook:            roomHook,
		InstanceType:        instanceType,
		Difficulty:          string(difficulty),
		HealthRestored:      healthRestored,
		ManaRestored:        manaRestored,
		BuffName:            buffName,
		BuffDurationSeconds: buffDurationSeconds,
		DamageReductionPct:  damageReductionPct,
	}
}
