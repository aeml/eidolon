package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
)

type ChronicleHunt struct {
	ID                string `json:"id"`
	BeforeQuestID     string `json:"beforeQuestId"`
	PreviousQuestID   string `json:"previousQuestId"`
	Realm             string `json:"realm"`
	HuntingRealm      string `json:"huntingRealm"`
	Enemy             string `json:"enemy"`
	MinEnemyLevel     int    `json:"minEnemyLevel"`
	ContentLevel      int    `json:"contentLevel"`
	Count             int    `json:"count"`
	Title             string `json:"title"`
	Acceptance        string `json:"acceptance"`
	Completion        string `json:"completion"`
	Handoff           string `json:"handoff"`
	Lore              string `json:"lore"`
	CatchupAcceptance string `json:"catchupAcceptance"`
	CatchupCompletion string `json:"catchupCompletion"`
}

//go:embed content/chronicle-hunts.json
var chronicleHuntContent []byte

var chronicleHunts = func() []ChronicleHunt {
	var hunts []ChronicleHunt
	if err := json.Unmarshal(chronicleHuntContent, &hunts); err != nil {
		panic(err)
	}
	return hunts
}()

func ChronicleHuntCatalog() []ChronicleHunt { return append([]ChronicleHunt(nil), chronicleHunts...) }

func chronicleHuntByID(id string) (ChronicleHunt, bool) {
	for _, hunt := range chronicleHunts {
		if hunt.ID == id {
			return hunt, true
		}
	}
	return ChronicleHunt{}, false
}

func isOptionalChronicleAddition(q Quest) bool {
	_, hunt := chronicleHuntByID(q.ID)
	return q.Type == "INVESTIGATE" || hunt
}

func expandChronicleHunts(quests []Quest) []Quest {
	result := make([]Quest, 0, len(quests)+len(chronicleHunts))
	for _, q := range quests {
		for _, hunt := range chronicleHunts {
			if hunt.BeforeQuestID != q.ID {
				continue
			}
			result = append(result, Quest{ID: hunt.ID, Type: "KILL", Target: "ChronicleHunt:" + hunt.ID,
				Category: QuestCategoryChronicle, Title: hunt.Title, Description: hunt.Acceptance,
				Lore: hunt.Lore, MaxCount: hunt.Count, RewardXP: contentExperiencePercent(hunt.ContentLevel, 75),
				RewardGold:    hunt.ContentLevel * 10,
				ObjectiveText: fmt.Sprintf("Defeat %d %s of level %d or higher in %s's overworld; return to Ilyra.", hunt.Count, splitQuestTarget(hunt.Enemy), hunt.MinEnemyLevel, hunt.HuntingRealm)})
		}
		result = append(result, q)
	}
	for i := range result {
		result[i].Chapter = i + 1
	}
	return result
}

func huntKillMatches(hunt ChronicleHunt, enemy string, level int, instanceID string, x, z float64) bool {
	if instanceID != "" || enemy != hunt.Enemy || level < hunt.MinEnemyLevel || math.IsNaN(x) || math.IsNaN(z) || math.IsInf(x, 0) || math.IsInf(z, 0) {
		return false
	}
	switch hunt.HuntingRealm {
	case "earth":
		return x >= -1000 && x <= 1000 && z >= -600 && z <= 1000
	case "water":
		return x >= -1000 && x <= 1000 && z < -600 && z >= -2200
	case "fire":
		return x < -1000 && x >= -3000 && z >= -600 && z <= 1000
	case "air":
		return x > 1000 && x <= 3000 && z >= -600 && z <= 1000
	}
	return false
}

// Called once by the real death pipeline for each normally eligible recipient,
// already holding the recipient lock. Spawn coordinates prevent dragging a
// creature across a border from changing which expedition it belongs to.
func (w *World) updateChronicleHuntKillLocked(player *Entity, enemy string, level int, instanceID string, spawnX, spawnZ float64) {
	if player == nil {
		return
	}
	for _, hunt := range chronicleHunts {
		if huntKillMatches(hunt, enemy, level, instanceID, spawnX, spawnZ) {
			w.UpdateQuestProgress(player, "ChronicleHunt:"+hunt.ID)
		}
	}
}
