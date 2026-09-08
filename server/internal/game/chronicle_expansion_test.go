package game

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestChronicleCatchupDescriptionsRemainRetrospectiveAcrossRefresh(t *testing.T) {
	var authored struct {
		Chapters []struct {
			ID                string `json:"id"`
			CatchupAcceptance string `json:"catchupAcceptance"`
		} `json:"chapters"`
	}
	if err := json.Unmarshal(chronicleInvestigationContent, &authored); err != nil {
		t.Fatal(err)
	}
	p := newTestPlayer("catchup-dialogue", "Wizard")
	for _, q := range classicChronicleQuestCatalog() {
		q.Accepted, q.Completed, q.Count = true, true, q.MaxCount
		p.Quests = append(p.Quests, q)
	}
	ensureChronicleLocked(p)
	for _, chapter := range authored.Chapters {
		q := questByID(t, p, chapter.ID)
		if chapter.CatchupAcceptance == "" || q.Description != chapter.CatchupAcceptance {
			t.Fatalf("%s: catch-up offer repeats required-story instructions: %q", q.ID, q.Description)
		}
		if !q.LegacyOptional || q.Accepted || q.Completed || q.Count != 0 {
			t.Fatal("dialogue change granted progress")
		}
	}
	before := append([]Quest(nil), p.Quests...)
	if ensureChronicleLocked(p) || !reflect.DeepEqual(before, p.Quests) {
		t.Fatal("refresh changes the retrospective description or progress")
	}
}

func TestChronicleExpansionSharesRealmRewardsInsteadOfInflatingThem(t *testing.T) {
	classic, expanded := classicChronicleQuestCatalog(), expandChronicleInvestigations(classicChronicleQuestCatalog())
	oldXP, oldGold, newXP, newGold := 0, 0, 0, 0
	for _, q := range classic {
		oldXP += q.RewardXP
		oldGold += q.RewardGold
	}
	for _, q := range expanded {
		newXP += q.RewardXP
		newGold += q.RewardGold
	}
	if oldXP != newXP || oldGold != newGold {
		t.Fatalf("story budget inflated: XP %d→%d, gold %d→%d", oldXP, newXP, oldGold, newGold)
	}
	byID := map[string]Quest{}
	for _, q := range expanded {
		byID[q.ID] = q
	}
	chapters := ChronicleInvestigationCatalog()
	for index := 0; index < len(chapters); index += 2 {
		first, second := chapters[index], chapters[index+1]
		var collection Quest
		for _, q := range classic {
			if q.ID == first.BeforeQuestID {
				collection = q
			}
		}
		parts := []Quest{byID[first.ID], byID[collection.ID], byID[second.ID]}
		xp, gold := 0, 0
		for _, q := range parts {
			xp += q.RewardXP
			gold += q.RewardGold
		}
		if xp != collection.RewardXP || gold != collection.RewardGold {
			t.Fatalf("%s realm budget changed", first.Realm)
		}
		if !(parts[0].Chapter < parts[1].Chapter && parts[1].Chapter < parts[2].Chapter && parts[2].Chapter < byID[second.BeforeQuestID].Chapter) {
			t.Fatalf("%s investigation/collection/dungeon order changed", first.Realm)
		}
	}
}

func TestChronicleExpansionMigratesEveryLegacyMilestoneWithoutRevokingProgress(t *testing.T) {
	classic := classicChronicleQuestCatalog()
	for milestone, active := range classic {
		t.Run(active.ID, func(t *testing.T) {
			p := newTestPlayer("legacy-reader", "Wizard")
			for index := 0; index <= milestone; index++ {
				q := classic[index]
				q.Accepted = true
				q.Completed = index < milestone
				if q.Completed {
					q.Count = q.MaxCount
				} else {
					q.Count = min(2, q.MaxCount)
				}
				if q.Type == "COLLECT" {
					q.MaxCount, q.CollectionVersion, q.Count = 4, 1, min(q.Count, 4)
				}
				q.GrantedXP, q.GrantedGold = index*10, index
				p.Quests = append(p.Quests, q)
			}
			previous := append([]Quest(nil), p.Quests...)
			ensureChronicleLocked(p)
			for _, old := range previous {
				q := questByID(t, p, old.ID)
				if q.Accepted != old.Accepted || q.Completed != old.Completed || q.Count != old.Count || q.GrantedXP != old.GrantedXP || q.GrantedGold != old.GrantedGold || q.LegacyOptional {
					t.Fatalf("legacy milestone changed: old=%+v new=%+v", old, q)
				}
				if q.Type == "COLLECT" && (q.RewardXP != old.RewardXP || q.RewardGold != old.RewardGold || q.MaxCount != 4 || q.CollectionVersion != 1) {
					t.Fatal("accepted collection lost its quoted contract")
				}
				if HasCompletedChronicleQuest(p, old.ID) != old.Completed {
					t.Fatal("earned access changed")
				}
			}
			activeChapter := questByID(t, p, active.ID).Chapter
			optional := 0
			for _, q := range p.Quests {
				if q.Type != "INVESTIGATE" {
					continue
				}
				if !q.LegacyOptional || q.Accepted || q.Completed || q.Count != 0 || q.InvestigationMask != 0 || q.Chapter >= activeChapter {
					t.Fatalf("invalid catch-up record: %+v", q)
				}
				optional++
			}
			wantOptional := min(milestone, 8)
			if optional != wantOptional {
				t.Fatalf("catch-up chapters=%d want=%d", optional, wantOptional)
			}
			before := append([]Quest(nil), p.Quests...)
			if ensureChronicleLocked(p) || !reflect.DeepEqual(before, p.Quests) {
				t.Fatal("migration is not idempotent")
			}
		})
	}
}

func TestChronicleExpansionRequiredEvidenceCannotBeSkippedOrReclassified(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("new-investigator", "Wizard")
	p.X, p.Z = 20, 215
	w.AddEntity(p)
	first := classicChronicleQuestCatalog()[0]
	first.Accepted, first.Completed, first.Count = true, true, first.MaxCount
	p.Quests = []Quest{first}
	ensureChronicleLocked(p)
	diary := questByID(t, p, "chronicle_earth_keepers_house")
	if diary.LegacyOptional || diary.Accepted {
		t.Fatal("fresh investigation was skipped")
	}
	// Even an offered future collection cannot be accepted before the diary.
	collection := *questByID(t, &Entity{Quests: chronicleQuestCatalog()}, "chronicle_02_seeds_first_grove")
	p.Quests = append(p.Quests, collection)
	if _, accepted := w.PerformAcceptQuest(p.ID, collection.ID); accepted {
		t.Fatal("future collection bypassed evidence")
	}
	if _, accepted := w.PerformAcceptQuest(p.ID, diary.ID); !accepted {
		t.Fatal("Ilyra cannot offer required diary")
	}
	ensureChronicleLocked(p)
	if questByID(t, p, diary.ID).LegacyOptional {
		t.Fatal("required investigation became catch-up after accepting")
	}
}

func TestChronicleExpansionCompletedCharactersCanManuallyRecoverMissedLore(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	p := newTestPlayer("veteran-reader", "Wizard")
	p.X, p.Z = 20, 215
	for _, q := range classicChronicleQuestCatalog() {
		q.Accepted, q.Completed, q.Count = true, true, q.MaxCount
		p.Quests = append(p.Quests, q)
	}
	w.AddEntity(p)
	ensureChronicleLocked(p)
	chapter := ChronicleInvestigationCatalog()[0]
	q := questByID(t, p, chapter.ID)
	if !q.LegacyOptional || q.Completed {
		t.Fatal("missed lore was silently completed")
	}
	if _, accepted := w.PerformAcceptQuest(p.ID, q.ID); !accepted {
		t.Fatal("veteran cannot accept catch-up from Ilyra")
	}
	p.X, p.Z = chapter.Sites[0].X, chapter.Sites[0].Z
	if _, err := w.InspectChronicleSite(p.ID, chapter.Sites[0].EntityID); err != nil {
		t.Fatal(err)
	}
	gold := p.Gold
	if _, completed := w.PerformCompleteQuest(p.ID, q.ID); completed {
		t.Fatal("remote inspection paid the reward")
	}
	p.X, p.Z = 20, 215
	var advanced ChronicleAdvanceEvent
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "chronicle_advance" {
			advanced = value.(ChronicleAdvanceEvent)
		}
	}
	if _, completed := w.PerformCompleteQuest(p.ID, q.ID); !completed {
		t.Fatal("manual catch-up turn-in failed")
	}
	if p.Gold != gold+q.RewardGold || !q.Completed || advanced.Finale || advanced.NextID != "" {
		t.Fatal("catch-up reward or finale state incorrect")
	}
	if _, completed := w.PerformCompleteQuest(p.ID, q.ID); completed {
		t.Fatal("catch-up can be rewarded twice")
	}
	for _, id := range []string{ChronicleEarthDungeonID, ChronicleEarthRestoredID, ChronicleWaterRestoredID, ChronicleFireRestoredID, ChronicleAirRestoredID, ChronicleGateOpenedID, ChronicleDarkKingID} {
		if !HasCompletedChronicleQuest(p, id) {
			t.Fatalf("catch-up revoked %s", id)
		}
	}
}
