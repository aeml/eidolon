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
	ID            string               `json:"id"`
	Realm         string               `json:"realm"`
	BeforeQuestID string               `json:"beforeQuestId"`
	Directions    string               `json:"directions"`
	Title         string               `json:"title"`
	Acceptance    string               `json:"acceptance"`
	Completion    string               `json:"completion"`
	Summary       string               `json:"summary"`
	Sites         []ChronicleDiscovery `json:"sites"`
}

//go:embed content/chronicle-investigations.json
var chronicleInvestigationContent []byte

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
