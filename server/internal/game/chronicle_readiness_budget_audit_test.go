package game

import (
	"fmt"
	"testing"
)

// This is a content-budget diagnostic, NOT earned gameplay or balance approval.
// It brackets rest uptime and collection luck, omits incidental investigation
// combat, and uses the lowest qualifying road skeletons. Party members receive
// normal shared combat XP but each claims their own authored quest reward.
// Run with -v; the real story-only browser handoff remains required.
func TestChronicleEarthReadinessBudgetAudit(t *testing.T) {
	for _, size := range []int{1, 2, 5} {
		for _, rested := range []bool{false, true} {
			for _, collectionKills := range []int{8, 20} {
				t.Run(fmt.Sprintf("players=%d/rested=%t/collection_kills=%d", size, rested, collectionKills), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("readiness-budget", "Wizard")
					p.Level, p.Experience, p.MaxExperience = 1, 0, experienceRequiredForLevel(1)
					p.BaseStats = canonicalBaseStatsForClass(p.SubType)
					p.Gold = 0
					if rested {
						p.WellRestedSeconds = MaxWellRestedSeconds
					}
					killXP, questXP, chapters, kills := 0, 0, 0, 0
					for _, definition := range chronicleQuestCatalog() {
						if definition.ID == ChronicleEarthDungeonID {
							break // Its reward is unavailable before entering the dungeon.
						}
						level, count := 0, 0
						switch definition.ID {
						case "chronicle_01_bell_below":
							level, count = 1, definition.MaxCount
						case "chronicle_02_seeds_first_grove":
							level, count = 3, collectionKills
							if count < definition.MaxCount {
								t.Fatal("collection scenario cannot supply the required fragments")
							}
						default:
							if hunt, ok := chronicleHuntByID(definition.ID); ok {
								if hunt.HuntingRealm != "earth" {
									t.Fatal("non-Earth hunt before first dungeon")
								}
								level, count = hunt.MinEnemyLevel, hunt.Count
							} else if definition.Type != "INVESTIGATE" {
								t.Fatalf("unmodeled pre-dungeon objective %s", definition.ID)
							}
						}
						stageKillXP := 0
						for i := 0; i < count; i++ {
							base := combatExperienceBudget(level, 0, false, false)
							amount := wellRestedKillXP(p, recipientCombatExperience(base, false, size, 1))
							w.awardExperienceLocked(p, amount)
							stageKillXP += amount
						}
						quote := definition
						w.awardQuestRewardsLocked(p, &quote)
						if quote.GrantedXP != definition.RewardXP || quote.GrantedGold != definition.RewardGold {
							t.Fatal("quest diagnostic did not preserve the catalog quote")
						}
						killXP += stageKillXP
						questXP += quote.GrantedXP
						kills += count
						chapters++
						t.Logf("EARTH_STAGE quest=%s kills=%d kill_xp=%d quest_xp=%d end_level=%d xp=%d next=%d",
							definition.ID, count, stageKillXP, quote.GrantedXP, p.Level, p.Experience, p.MaxExperience)
					}
					if chapters != 7 || kills != 153+collectionKills {
						t.Fatalf("incomplete modeled Earth route: chapters=%d kills=%d", chapters, kills)
					}
					entry := DungeonEntryLevels()["verdant_bastion_catacombs"]
					needed, accounted := 0, p.Experience
					for level := 1; level < entry; level++ {
						needed += experienceRequiredForLevel(level)
					}
					for level := 1; level < p.Level; level++ {
						accounted += experienceRequiredForLevel(level)
					}
					if accounted != killXP+questXP {
						t.Fatal("level transition does not reconcile with modeled reward sources")
					}
					t.Logf("EARTH_HANDOFF players=%d rested_all_kills=%t collection_kills=%d total_kills=%d kill_xp=%d quest_xp=%d total_xp=%d level=%d required_level=%d shortfall_xp=%d gold=%d incidental_combat=omitted",
						size, rested, collectionKills, kills, killXP, questXP, accounted, p.Level, entry, max(0, needed-accounted), p.Gold)
				})
			}
		}
	}
}
