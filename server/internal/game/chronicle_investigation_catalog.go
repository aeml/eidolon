package game

import (
	_ "embed"
	"encoding/json"
)

type ChronicleDiscovery struct {
	ID       string  `json:"id"`
	EntityID string  `json:"entityId"`
	Kind     string  `json:"kind"`
	Model    string  `json:"model"`
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Requires string  `json:"requires,omitempty"`
	Title    string  `json:"title"`
	Text     string  `json:"text"`
}

type ChronicleInvestigation struct {
	ID                string               `json:"id"`
	Realm             string               `json:"realm"`
	BeforeQuestID     string               `json:"beforeQuestId"`
	Directions        string               `json:"directions"`
	Title             string               `json:"title"`
	Acceptance        string               `json:"acceptance"`
	Completion        string               `json:"completion"`
	CatchupAcceptance string               `json:"catchupAcceptance"`
	CatchupCompletion string               `json:"catchupCompletion"`
	Summary           string               `json:"summary"`
	Sites             []ChronicleDiscovery `json:"sites"`
}

//go:embed content/chronicle-investigations.json
var chronicleInvestigationContent []byte

// Immutable presentation lookup avoids decoding the full catalog for every
// optional quest during metadata refresh. No caller receives the mutable map.
var chronicleCatchupAcceptances = func() map[string]string {
	result := make(map[string]string)
	for _, chapter := range ChronicleInvestigationCatalog() {
		result[chapter.ID] = chapter.CatchupAcceptance
	}
	return result
}()

func withChronicleCatchupDescription(quest Quest) Quest {
	if quest.LegacyOptional {
		if hunt, ok := chronicleHuntByID(quest.ID); ok {
			quest.Description = hunt.CatchupAcceptance
		}
	}
	if quest.LegacyOptional && quest.Type == "INVESTIGATE" {
		if description := chronicleCatchupAcceptances[quest.ID]; description != "" {
			quest.Description = description
		}
	}
	return quest
}

// ChronicleInvestigationCatalog returns detached content. Registering these
// authored definitions does not itself grant quests, credit or crystal access.
func ChronicleInvestigationCatalog() []ChronicleInvestigation {
	var content struct {
		SchemaVersion int                      `json:"schemaVersion"`
		Chapters      []ChronicleInvestigation `json:"chapters"`
	}
	if err := json.Unmarshal(chronicleInvestigationContent, &content); err != nil || content.SchemaVersion != 1 {
		panic("invalid generated Chronicle investigation content")
	}
	return content.Chapters
}
