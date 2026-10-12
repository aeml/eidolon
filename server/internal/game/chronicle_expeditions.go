package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

// Expeditions interleave field work and discoveries along the existing roads.
// Existing quest identities remain stable for returning saves.
type chronicleExpedition struct {
	ChronicleHunt
	Type       string               `json:"type"`
	RewardGold int                  `json:"rewardGold"`
	Directions string               `json:"directions"`
	Sites      []ChronicleDiscovery `json:"sites"`
}

//go:embed content/chronicle-expeditions.json
var chronicleExpeditionContent []byte

var chronicleExpeditions = func() []chronicleExpedition {
	var chapters []chronicleExpedition
	if err := json.Unmarshal(chronicleExpeditionContent, &chapters); err != nil {
		panic(err)
	}
	return chapters
}()

func chronicleExpeditionByID(id string) (chronicleExpedition, bool) {
	for _, chapter := range chronicleExpeditions {
		if chapter.ID == id {
			return chapter, true
		}
	}
	return chronicleExpedition{}, false
}

func expeditionInvestigations() []ChronicleInvestigation {
	var result []ChronicleInvestigation
	for _, chapter := range chronicleExpeditions {
		if chapter.Type != "INVESTIGATE" {
			continue
		}
		result = append(result, ChronicleInvestigation{ID: chapter.ID, Realm: chapter.Realm,
			BeforeQuestID: chapter.BeforeQuestID, Directions: chapter.Directions,
			Title: chapter.Title, Acceptance: chapter.Acceptance, Completion: chapter.Completion,
			CatchupAcceptance: chapter.CatchupAcceptance, CatchupCompletion: chapter.CatchupCompletion,
			Summary: chapter.Lore, Sites: append([]ChronicleDiscovery(nil), chapter.Sites...)})
	}
	return result
}

func expandChronicleExpeditions(base []Quest) []Quest {
	before := make(map[string][]chronicleExpedition)
	for _, chapter := range chronicleExpeditions {
		before[chapter.BeforeQuestID] = append(before[chapter.BeforeQuestID], chapter)
	}
	result := make([]Quest, 0, len(base)+len(chronicleExpeditions))
	visited := make(map[string]bool)
	var insert func(string)
	insert = func(anchor string) {
		for _, chapter := range before[anchor] {
			if visited[chapter.ID] {
				panic("cyclic or duplicate Chronicle expedition: " + chapter.ID)
			}
			visited[chapter.ID] = true
			insert(chapter.ID)
			q := Quest{ID: chapter.ID, Type: chapter.Type, Category: QuestCategoryChronicle,
				Title: chapter.Title, Description: chapter.Acceptance, Lore: chapter.Lore,
				RewardXP: contentExperiencePercent(chapter.ContentLevel, 75), RewardGold: chapter.RewardGold}
			switch chapter.Type {
			case "KILL":
				q.Target, q.MaxCount = "ChronicleHunt:"+chapter.ID, chapter.Count
				q.ObjectiveText = fmt.Sprintf("Defeat %d %s of level %d or higher in %s's overworld; return to Ilyra.", chapter.Count, splitQuestTarget(chapter.Enemy), chapter.MinEnemyLevel, chapter.HuntingRealm)
			case "INVESTIGATE":
				q.Target, q.MaxCount = chapter.Realm, len(chapter.Sites)
				q.ObjectiveText = chapter.Directions
			default:
				panic("invalid Chronicle expedition type: " + chapter.Type)
			}
			result = append(result, q)
		}
	}
	for _, q := range base {
		insert(q.ID)
		result = append(result, q)
	}
	if len(visited) != len(chronicleExpeditions) {
		panic("unreachable Chronicle expedition")
	}
	for i := range result {
		result[i].Chapter = i + 1
	}
	return result
}
