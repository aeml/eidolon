package game

import (
	"eidolon-server/internal/database"
	"fmt"
	"slices"
	"time"
)

type WeeklyRaidCompletionEvent struct {
	PlayerID    string    `json:"playerId"`
	InstanceID  string    `json:"instanceId"`
	CompletedAt time.Time `json:"completedAt"`
}

type DungeonCompletionEvent struct {
	InstanceID   string                     `json:"instanceId"`
	DungeonType  string                     `json:"dungeonType"`
	Difficulty   DungeonDifficulty          `json:"difficulty"`
	RunLevel     int                        `json:"runLevel"`
	Duration     time.Duration              `json:"duration"`
	Participants []string                   `json:"participants"`
	CompletedAt  time.Time                  `json:"completedAt"`
	GuildRuns    []database.GuildDungeonRun `json:"-"` // Internal immutable clear snapshots, not a client request.
}

// Capture the server-owned identity while each real recipient is credited,
// without DB lookups in combat or replay-time membership/season attribution.
type dungeonGuildClearSnapshot struct {
	seen map[string]bool
	runs map[string]database.GuildDungeonRun
}

// Caller owns player.Mu. Each player contributes at most once.
func (snapshot *dungeonGuildClearSnapshot) addLocked(player *Entity) {
	if player.Type != TypePlayer || player.GuildID == "" {
		return
	}
	if snapshot.seen == nil {
		snapshot.seen = make(map[string]bool)
		snapshot.runs = make(map[string]database.GuildDungeonRun)
	}
	if snapshot.seen[player.ID] {
		return
	}
	snapshot.seen[player.ID] = true
	run := snapshot.runs[player.GuildID]
	if run.GuildID == "" {
		run.GuildID, run.GuildName, run.GuildTag = player.GuildID, player.GuildName, player.GuildTag
	}
	run.MemberCount++
	snapshot.runs[player.GuildID] = run
}

func (snapshot *dungeonGuildClearSnapshot) finish(event *DungeonCompletionEvent) {
	keys := make([]string, 0, len(snapshot.runs))
	for id := range snapshot.runs {
		keys = append(keys, id)
	}
	slices.Sort(keys)
	for _, id := range keys {
		run := snapshot.runs[id]
		if run.MemberCount < 2 {
			continue
		}
		run.Season = database.CurrentGuildDungeonSeason(event.CompletedAt)
		run.FirstClearAt = event.CompletedAt.UTC()
		run.DungeonType, run.Difficulty, run.RunLevel = event.DungeonType, string(event.Difficulty), event.RunLevel
		run.DurationMS = event.Duration.Milliseconds()
		event.GuildRuns = append(event.GuildRuns, run)
	}
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
	RunComplete       bool                     `json:"runComplete,omitempty"`
	Progression       *ExperienceRewardReceipt `json:"progression,omitempty"`
	PlayerID          string                   `json:"playerId"`
	Title             string                   `json:"title"`
	Subtitle          string                   `json:"subtitle,omitempty"`
	Gold              int                      `json:"gold"`
	XP                int                      `json:"xp"`
	ItemCount         int                      `json:"itemCount"`
	GemCount          int                      `json:"gemCount"`
	HeartCount        int                      `json:"heartCount"`
	BossName          string                   `json:"bossName,omitempty"`
	InstanceType      string                   `json:"instanceType,omitempty"`
	Difficulty        string                   `json:"difficulty,omitempty"`
	RunLevel          int                      `json:"runLevel,omitempty"`
	RoomsCleared      int                      `json:"roomsCleared,omitempty"`
	TotalRooms        int                      `json:"totalRooms,omitempty"`
	EliteRoomsCleared int                      `json:"eliteRoomsCleared,omitempty"`
	TotalEliteRooms   int                      `json:"totalEliteRooms,omitempty"`
	DifficultyNote    string                   `json:"difficultyNote,omitempty"`
	ExitHint          string                   `json:"exitHint,omitempty"`
}

type DungeonRoomClearRewardEvent struct {
	Progression         *ExperienceRewardReceipt `json:"progression,omitempty"`
	PlayerID            string                   `json:"playerId"`
	Title               string                   `json:"title"`
	Subtitle            string                   `json:"subtitle,omitempty"`
	Gold                int                      `json:"gold"`
	XP                  int                      `json:"xp"`
	ItemCount           int                      `json:"itemCount,omitempty"`
	GemCount            int                      `json:"gemCount,omitempty"`
	HeartCount          int                      `json:"heartCount,omitempty"`
	Hint                string                   `json:"hint,omitempty"`
	RoomIndex           int                      `json:"roomIndex"`
	ObjectiveRoomIndex  int                      `json:"objectiveRoomIndex"`
	RoomType            string                   `json:"roomType,omitempty"`
	RoomHook            string                   `json:"roomHook,omitempty"`
	InstanceType        string                   `json:"instanceType,omitempty"`
	Difficulty          string                   `json:"difficulty,omitempty"`
	HealthRestored      int                      `json:"healthRestored,omitempty"`
	ManaRestored        int                      `json:"manaRestored,omitempty"`
	BuffName            string                   `json:"buffName,omitempty"`
	BuffDurationSeconds int                      `json:"buffDurationSeconds,omitempty"`
	DamageReductionPct  int                      `json:"damageReductionPct,omitempty"`
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
	complete, hint := bossRunGuidance(instanceType, bossName)
	return RewardSummaryEvent{
		RunComplete:       complete,
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
		ExitHint:          hint,
	}
}

// A boss reward is not necessarily a completed run. Match the actual activity
// and final guardian; room counters do not establish completion or quest claims.
func bossRunGuidance(instanceType, bossName string) (bool, string) {
	if IsElementalRaidBoss(instanceType, bossName) {
		return false, "The guardian is defeated, but the crystal is not restored. Protect Maelin through all three Vigil waves; then return to Ilyra and personally complete your ready chapter."
	}
	final := map[string]string{
		"verdant_bastion_catacombs": "HollowSentinel", "molten_core": "LordInfernax",
		"tempest_spire": "Zephyrion", "abyssal_well": "Thalorath",
		"umbral_nexus": "EidolonDevourer", "weekly_raid": "UmbraPrime",
	}
	if final[instanceType] == bossName && bossName != "" {
		if instanceType == "weekly_raid" {
			return true, "Malachar is defeated. Your personal weekly cache settles separately; a repeated clear does not grant another cache. Return to Ilyra to personally claim a ready story finale. For your next optional goal, visit the Dungeon Guide."
		}
		return true, "Return to the entrance to leave the dungeon. Personally complete any ready story chapter with Ilyra; boss loot alone does not claim it. Visit the Dungeon Guide to prepare the next activity or help another group."
	}
	return false, "Continue along the dungeon route with your party; this boss reward is not a completed run. Return to the entrance if you need town recovery, then Continue at the Guide to use your latest cleared boss checkpoint."
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
