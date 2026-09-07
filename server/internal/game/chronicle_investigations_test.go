package game

import (
	"math"
	"reflect"
	"sync"
	"testing"
)

func TestChronicleInvestigationContentHasEightDistinctChapters(t *testing.T) {
	catalog := ChronicleInvestigationCatalog()
	if len(catalog) != 8 {
		t.Fatalf("chapters=%d", len(catalog))
	}
	ids, sites, realms := map[string]bool{}, map[string]bool{}, map[string]int{}
	before := map[string]bool{}
	for _, quest := range chronicleQuestCatalog() {
		before[quest.ID] = true
	}
	for index, chapter := range catalog {
		if ids[chapter.ID] || !before[chapter.BeforeQuestID] || len(chapter.Acceptance) < 100 || len(chapter.Completion) < 100 || len(chapter.Summary) < 80 || chapter.Directions == "" {
			t.Fatalf("incomplete/unplaced narrative: %+v", chapter)
		}
		ids[chapter.ID], realms[chapter.Realm] = true, realms[chapter.Realm]+1
		expected := 1
		if index%2 == 1 {
			expected = 3
		}
		if len(chapter.Sites) != expected {
			t.Fatalf("%s expected %d distinct discoveries", chapter.ID, expected)
		}
		seen := map[string]bool{}
		for _, site := range chapter.Sites {
			if sites[site.EntityID] || site.Title == "" || len(site.Text) < 90 || (site.Requires != "" && !seen[site.Requires]) {
				t.Fatalf("invalid/repeated discovery: %+v", site)
			}
			sites[site.EntityID], seen[site.ID] = true, true
			inRealm := (chapter.Realm == "earth" && site.X > -1000 && site.X < 1000 && site.Z > -600 && site.Z < 1000) ||
				(chapter.Realm == "water" && site.X > -1000 && site.X < 1000 && site.Z < -600) ||
				(chapter.Realm == "fire" && site.X < -1000 && site.X > -3000) ||
				(chapter.Realm == "air" && site.X > 1000 && site.X < 3000)
			if !inRealm {
				t.Fatalf("%s outside %s", site.ID, chapter.Realm)
			}
		}
	}
	if len(sites) != 16 || !reflect.DeepEqual(realms, map[string]int{"earth": 2, "water": 2, "fire": 2, "air": 2}) {
		t.Fatal("missing realm discoveries")
	}
	catalog[0].Sites[0].Text = "mutated"
	if ChronicleInvestigationCatalog()[0].Sites[0].Text == "mutated" {
		t.Fatal("callers share mutable content")
	}
}

func investigationPlayer(w *World, chapter ChronicleInvestigation, id string) *Entity {
	p := newTestPlayer(id, "Wizard")
	p.X, p.Z = chapter.Sites[0].X, chapter.Sites[0].Z
	p.Quests = []Quest{{ID: chapter.ID, Type: "INVESTIGATE", Category: QuestCategoryChronicle, Accepted: true, MaxCount: len(chapter.Sites)}}
	w.AddEntity(p)
	return p
}

func TestChronicleInvestigationRequiresDistinctPersonalEvidence(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	chapter := ChronicleInvestigationCatalog()[1]
	p, other := investigationPlayer(w, chapter, "reader"), investigationPlayer(w, chapter, "other-reader")
	for index, site := range chapter.Sites {
		p.X, p.Z = site.X, site.Z
		for attempt := 0; attempt < 3; attempt++ {
			receipt, err := w.InspectChronicleSite(p.ID, site.EntityID)
			if err != nil || receipt.Count != index+1 || receipt.Recorded != (attempt == 0) {
				t.Fatalf("duplicate changed credit: %+v %v", receipt, err)
			}
		}
	}
	if p.Quests[0].InvestigationMask != 7 || p.Quests[0].Completed || p.Gold != 0 || p.Experience != 0 {
		t.Fatal("discovery granted rewards or completed the quest")
	}
	if other.Quests[0].Count != 0 || other.Quests[0].InvestigationMask != 0 {
		t.Fatal("another player's discovery was credited")
	}
}

func TestChronicleInvestigationRejectsInvalidInteractionState(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	chapter := ChronicleInvestigationCatalog()[0]
	site := chapter.Sites[0]
	p := investigationPlayer(w, chapter, "invalid-reader")
	for _, test := range []struct {
		name   string
		change func()
	}{
		{"not_accepted", func() { p.Quests[0].Accepted = false }},
		{"wrong_type", func() { p.Quests[0].Type = "KILL" }},
		{"dead", func() { p.State = "DEAD" }},
		{"lethal_health", func() { p.Health = 0 }},
		{"wrong_instance", func() { p.InstanceID = "dungeon" }},
		{"too_far", func() { p.X += 6 }},
		{"nonfinite", func() { p.Z = math.NaN() }},
		{"moved_site", func() { w.Entities[site.EntityID].X++ }},
	} {
		t.Run(test.name, func(t *testing.T) {
			p.X, p.Z, p.InstanceID, p.State = site.X, site.Z, "", "IDLE"
			p.Health = p.MaxHealth
			p.Quests[0].Accepted, p.Quests[0].Type = true, "INVESTIGATE"
			w.Entities[site.EntityID].X = site.X
			test.change()
			if _, err := w.InspectChronicleSite(p.ID, site.EntityID); err == nil {
				t.Fatal("invalid discovery was accepted")
			}
			if p.Quests[0].Count != 0 || p.Quests[0].InvestigationMask != 0 {
				t.Fatal("rejected interaction granted credit")
			}
		})
	}
}

func TestChronicleInvestigationFireAnchorRequiresDefeatedAnchorAndOrderedEvidence(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	chapter := ChronicleInvestigationCatalog()[5]
	p := investigationPlayer(w, chapter, "ember-reader")
	ash, anchor, ember := chapter.Sites[0], chapter.Sites[1], chapter.Sites[2]
	p.X, p.Z = anchor.X, anchor.Z
	if _, err := w.InspectChronicleSite(p.ID, anchor.EntityID); err == nil {
		t.Fatal("click replaced the anchor fight")
	}
	if _, err := w.RecordChronicleInvestigationKill(p.ID, anchor.EntityID); err == nil {
		t.Fatal("living anchor granted kill credit")
	}
	w.Entities[anchor.EntityID].State = "DEAD"
	w.Entities[anchor.EntityID].Health = 0
	if _, err := w.RecordChronicleInvestigationKill(p.ID, anchor.EntityID); err == nil {
		t.Fatal("anchor credited before studying the ash")
	}
	p.X, p.Z = ember.X, ember.Z
	if _, err := w.InspectChronicleSite(p.ID, ember.EntityID); err == nil {
		t.Fatal("ember released before anchor")
	}
	p.X, p.Z = ash.X, ash.Z
	if _, err := w.InspectChronicleSite(p.ID, ash.EntityID); err != nil {
		t.Fatal(err)
	}
	// A legitimate guardian may chase before dying; bind to its authored spawn,
	// not its exact final combat coordinate.
	w.Entities[anchor.EntityID].X += 10
	if _, err := w.RecordChronicleInvestigationKill(p.ID, anchor.EntityID); err != nil {
		t.Fatal(err)
	}
	p.X, p.Z = ember.X, ember.Z
	if _, err := w.InspectChronicleSite(p.ID, ember.EntityID); err != nil {
		t.Fatal(err)
	}
	if p.Quests[0].Count != 3 || p.Quests[0].Completed {
		t.Fatal("ordered discoveries did not preserve manual completion")
	}
}

func TestChronicleInvestigationRepairsDistinctSavedEvidenceWithoutInventingCredit(t *testing.T) {
	definition := Quest{ID: "chronicle_earth_returning_scar", Type: "INVESTIGATE", MaxCount: 3}
	for _, test := range []struct {
		mask      uint32
		count     int
		wantMask  uint32
		wantCount int
	}{
		{5, 99, 5, 2},
		{0, 3, 0, 0},
		{1 << 31, 1, 0, 0},
		{7, -1, 7, 3},
	} {
		progress := Quest{Accepted: true, Count: test.count, InvestigationMask: test.mask}
		repaired := copyQuestDefinition(progress, definition)
		if repaired.InvestigationMask != test.wantMask || repaired.Count != test.wantCount || repaired.Completed || !repaired.Accepted {
			t.Fatalf("invalid repair for %+v: %+v", test, repaired)
		}
	}
}

func TestChronicleInvestigationConcurrentInspectionAndSaves(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	chapter := ChronicleInvestigationCatalog()[0]
	p := investigationPlayer(w, chapter, "concurrent-reader")
	var workers sync.WaitGroup
	for i := 0; i < 8; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for j := 0; j < 25; j++ {
				w.InspectChronicleSite(p.ID, chapter.Sites[0].EntityID)
				w.GetEntityCopy(p.ID)
			}
		}()
	}
	workers.Wait()
	if p.Quests[0].Count != 1 || p.Quests[0].InvestigationMask != 1 {
		t.Fatal("concurrent inspection duplicated discovery")
	}
}
