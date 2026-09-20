package game

import (
	"fmt"
	"testing"
)

// A conservative content-budget diagnostic, not earned-play or balance approval.
// Start at the previous dungeon's minimum entry level with zero carried XP.
// Include that chapter's turn-in, but omit its entire dungeon combat/room XP,
// investigation enemies, incidental travel kills, equipment and daily rewards.
// Collection counts bracket perfect luck, a representative 20 kills and the
// current 8-fragment/five-kill pity bound. Rested=true assumes full uptime.
func TestChronicleRegionalReadinessBudgetAudit(t *testing.T) {
	quests := chronicleQuestCatalog()
	for _, region := range []struct {
		name, previous, next, collectionEnemy string
		startLevel, entryLevel                int
	}{
		{"water", ChronicleEarthDungeonID, ChronicleWaterDungeonID, "MountainTroll", 30, 60},
		{"fire", ChronicleWaterDungeonID, ChronicleFireDungeonID, "SandstormDjinn", 60, 70},
		{"air", ChronicleFireDungeonID, ChronicleAirDungeonID, "StormHarpy", 70, 70},
	} {
		for _, partySize := range []int{1, 4} {
			for _, rested := range []bool{false, true} {
				for _, collectionKills := range []int{8, 20, 40} {
					t.Run(fmt.Sprintf("%s/party%d/rested%t/collection%d", region.name, partySize, rested, collectionKills), func(t *testing.T) {
						p := &Entity{Type: TypePlayer}
						if rested {
							p.WellRestedSeconds = MaxWellRestedSeconds
						}
						if p.IsWellRested() != rested {
							t.Fatal("rested scenario is not exercising the real player bonus")
						}
						started, finished, collections := false, false, 0
						killXP, questXP, questGold, kills, lastHuntLevel := 0, 0, 0, 0, 0
						for _, quest := range quests {
							if quest.ID == region.next {
								finished = true
								break // This reward cannot help qualify for its own dungeon.
							}
							started = started || quest.ID == region.previous
							if !started {
								continue
							}
							level, count := 0, 0
							switch {
							case quest.ID == region.previous, quest.Type == "INVESTIGATE":
							case quest.Type == "COLLECT":
								if !chronicleDropSources[quest.Target][region.collectionEnemy] || quest.MaxCount != 8 {
									t.Fatal("collection assumptions no longer match authored content")
								}
								collections++
								level, count = dailyHuntContentLevels[region.collectionEnemy], collectionKills
							default:
								hunt, ok := chronicleHuntByID(quest.ID)
								if !ok || hunt.Realm != region.name {
									t.Fatalf("unmodeled objective %s", quest.ID)
								}
								level, count, lastHuntLevel = hunt.MinEnemyLevel, hunt.Count, hunt.MinEnemyLevel
							}
							perKill := wellRestedKillXP(p, recipientCombatExperience(combatExperienceBudget(level, 0, false, false), false, partySize, 1))
							killXP += count * perKill
							kills += count
							questXP += quest.RewardXP
							questGold += quest.RewardGold
						}
						if !started || !finished || collections != 1 || lastHuntLevel == 0 {
							t.Fatal("incomplete regional segment")
						}
						level, remainder := region.startLevel, killXP+questXP
						for level < MaxPlayerLevel && remainder >= experienceRequiredForLevel(level) {
							remainder -= experienceRequiredForLevel(level)
							level++
						}
						needed := 0
						for l := region.startLevel; l < region.entryLevel; l++ {
							needed += experienceRequiredForLevel(l)
						}
						shortfall := max(0, needed-killXP-questXP)
						extraKillXP := wellRestedKillXP(p, recipientCombatExperience(combatExperienceBudget(lastHuntLevel, 0, false, false), false, partySize, 1))
						t.Logf("REGIONAL_HANDOFF realm=%s party=%d rested=%t collection=%d kills=%d kill_xp=%d quest_xp=%d quest_gold=%d level=%d entry=%d shortfall=%d extra_same_level_kills=%d omitted_dungeon_xp=true",
							region.name, partySize, rested, collectionKills, kills, killXP, questXP, questGold, level, region.entryLevel, shortfall, (shortfall+extraKillXP-1)/extraKillXP)
					})
				}
			}
		}
	}
}
