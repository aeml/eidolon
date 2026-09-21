package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
)

const darkRealmNexusReadyID = "chronicle_dark_nexus_threshold"

type darkRealmChapter struct {
	ID, District, Type, Title, Acceptance, Completion, Summary, Enemy, Item string
	Count                                                                   int
	Sites                                                                   []ChronicleDiscovery
}

//go:embed content/dark-realm-chronicle.json
var darkRealmCampaignContent []byte

var darkRealmChapters = func() []darkRealmChapter {
	var chapters []darkRealmChapter
	if err := json.Unmarshal(darkRealmCampaignContent, &chapters); err != nil {
		panic(err)
	}
	for i := range chapters {
		for j := range chapters[i].Sites {
			chapters[i].Sites[j].EntityID = "chronicle-site-" + chapters[i].Sites[j].ID
		}
	}
	return chapters
}()

func darkRealmChapterByID(id string) (darkRealmChapter, bool) {
	for _, chapter := range darkRealmChapters {
		if chapter.ID == id {
			return chapter, true
		}
	}
	return darkRealmChapter{}, false
}

func darkRealmCollectionByItem(item string) (darkRealmChapter, bool) {
	for _, chapter := range darkRealmChapters {
		if chapter.Type == "COLLECT" && chapter.Item == item {
			return chapter, true
		}
	}
	return darkRealmChapter{}, false
}

func darkRealmDistrict(id string) (DarkRealmDistrict, bool) {
	for _, district := range DarkRealmDistricts() {
		if district.ID == id {
			return district, true
		}
	}
	return DarkRealmDistrict{}, false
}

func darkRealmDistrictContains(id string, x, z float64) bool {
	district, ok := darkRealmDistrict(id)
	return ok && finiteCoordinate(x) && finiteCoordinate(z) &&
		math.Abs(x-district.Room.X) <= district.Room.Width/2 && math.Abs(z-district.Room.Z) <= district.Room.Height/2
}

func darkRealmCatchupAcceptance(chapter darkRealmChapter) string {
	return "You have already earned passage beyond this part of the expedition. Help me preserve the missing account of “" + chapter.Title + "”. This is optional Chronicle work; your existing access will not change."
}

func darkRealmInvestigations() []ChronicleInvestigation {
	var result []ChronicleInvestigation
	for _, chapter := range darkRealmChapters {
		if chapter.Type != "INVESTIGATE" {
			continue
		}
		district, _ := darkRealmDistrict(chapter.District)
		result = append(result, ChronicleInvestigation{ID: chapter.ID, Realm: "dark", InstanceID: DarkRealmInstanceID,
			Title: chapter.Title, Acceptance: chapter.Acceptance, Completion: chapter.Completion, Summary: chapter.Summary,
			CatchupAcceptance: darkRealmCatchupAcceptance(chapter), CatchupCompletion: "This account joins the Chronicle. " + chapter.Summary,
			Directions: "Investigate the marked records in " + district.Name + "; speak to Ilyra at the Resonant Foothold when finished.",
			Sites:      append([]ChronicleDiscovery(nil), chapter.Sites...)})
	}
	return result
}

// Keep the original regional catalog stable for its source generator. Runtime
// discovery/placement also includes the separately authored expedition content.
func allChronicleInvestigations() []ChronicleInvestigation {
	return append(ChronicleInvestigationCatalog(), darkRealmInvestigations()...)
}

func expandDarkRealmChronicle(catalog []Quest) []Quest {
	result := make([]Quest, 0, len(catalog)+len(darkRealmChapters))
	for _, quest := range catalog {
		if quest.ID == ChronicleGateOpenedID {
			for _, chapter := range darkRealmChapters {
				district, _ := darkRealmDistrict(chapter.District)
				q := Quest{ID: chapter.ID, Category: QuestCategoryChronicle, Type: chapter.Type,
					Title: chapter.Title, Description: chapter.Acceptance, Lore: chapter.Summary,
					RewardXP: contentExperiencePercent(100, 20), RewardGold: 600, MaxCount: chapter.Count}
				switch chapter.Type {
				case "INVESTIGATE":
					q.Target, q.MaxCount, q.RewardGold = "dark", len(chapter.Sites), 400
					q.ObjectiveText = fmt.Sprintf("Level 100 — investigate %d marked records in %s, Dark Realm; return to Ilyra at the Resonant Foothold.", q.MaxCount, district.Name)
				case "KILL":
					q.Target = "DarkRealmHunt:" + chapter.ID
					q.ObjectiveText = fmt.Sprintf("Defeat %d %s in %s, Dark Realm; return to Ilyra at the Resonant Foothold.", q.MaxCount, splitQuestTarget(chapter.Enemy), district.Name)
				case "COLLECT":
					q.Target, q.CollectionVersion, q.RewardGold = chapter.Item, 2, 1000
					q.ObjectiveText = fmt.Sprintf("Recover %d %s from %s in %s, Dark Realm; return to Ilyra at the Resonant Foothold.", q.MaxCount, chapter.Item, splitQuestTarget(chapter.Enemy), district.Name)
				}
				result = append(result, q)
			}
		}
		result = append(result, quest)
	}
	for i := range result {
		result[i].Chapter = i + 1
	}
	return result
}

// Old accepted Nexus/finale contracts retain their access. Fresh characters
// must finish the expedition before entering the dungeon leading to the raid.
func CanEnterUmbralNexus(player *Entity) bool {
	if !DarkRealmEntryAllowed(player) {
		return false
	}
	if HasCompletedChronicleQuest(player, darkRealmNexusReadyID) {
		return true
	}
	for _, quest := range player.Quests {
		if (quest.ID == ChronicleGateOpenedID || quest.ID == ChronicleDarkKingID) && (quest.Accepted || quest.Completed) {
			return true
		}
	}
	return false
}

func (w *World) updateDarkRealmHuntKillLocked(player *Entity, enemy string, level int, instanceID string, x, z float64) {
	if player == nil || level < 100 || instanceID != DarkRealmInstanceID || player.InstanceID != instanceID || !DarkRealmEntryAllowed(player) {
		return
	}
	for _, chapter := range darkRealmChapters {
		if chapter.Type == "KILL" && chapter.Enemy == enemy && darkRealmDistrictContains(chapter.District, x, z) {
			w.UpdateQuestProgress(player, "DarkRealmHunt:"+chapter.ID)
		}
	}
}

func (w *World) spawnDarkRealmEncounters() {
	for _, district := range DarkRealmDistricts()[1:] {
		for row := -2; row <= 2; row++ {
			for col := -2; col <= 2; col++ {
				x, z := district.Room.X+float64(col*85), district.Room.Z+float64(row*85)
				nearSite := false
				for _, chapter := range darkRealmChapters {
					for _, site := range chapter.Sites {
						nearSite = nearSite || math.Hypot(x-site.X, z-site.Z) < 15
					}
				}
				if nearSite {
					continue
				}
				model := "DissonantShade"
				if (row+col)%2 == 0 {
					model = "MemoryReaver"
				}
				profile := overworldEnemyCombatProfile(model, 100, false)
				w.AddEntity(&Entity{ID: fmt.Sprintf("dark-realm-%s-%d-%d", district.ID, row, col),
					Name: district.Name + " · " + splitQuestTarget(model), InstanceID: DarkRealmInstanceID,
					Type: TypeEnemy, SubType: model, Level: 100, X: x, Z: z, SpawnX: x, SpawnZ: z,
					BaseStats: profile.BaseStats, Stats: profile.BaseStats, Health: profile.Health, MaxHealth: profile.MaxHealth,
					Damage: profile.Damage, Speed: profile.Speed, BaseSpeed: profile.Speed,
					AttackSpeed: profile.AttackSpeed, AttackCooldown: profile.AttackCooldown, State: "IDLE", Scale: 1})
			}
		}
	}
}
