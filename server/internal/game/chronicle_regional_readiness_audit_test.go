package game

import (
	"fmt"
	"strings"
	"testing"
)

// A conservative content-budget diagnostic, not earned-play or balance approval.
// Start at the previous dungeon's minimum entry level with zero carried XP.
// Include that chapter's turn-in; report both the field-only subtotal and a
// generated previous-dungeon budget. Omit investigation enemies, incidental
// travel kills, equipment bonuses and daily rewards.
// Collection counts bracket perfect luck, a representative 20 kills and the
// current 8-fragment/five-kill pity bound. Rested=true assumes full uptime.
func TestChronicleRegionalReadinessBudgetAudit(t *testing.T) {
	quests := chronicleQuestCatalog()
	for _, region := range []struct {
		name, previous, next, collectionEnemy, dungeon string
		startLevel, entryLevel                         int
	}{
		{"water", ChronicleEarthDungeonID, ChronicleWaterDungeonID, "MountainTroll", "verdant_bastion_catacombs", 30, 60},
		{"fire", ChronicleWaterDungeonID, ChronicleFireDungeonID, "SandstormDjinn", "abyssal_well", 60, 70},
		{"air", ChronicleFireDungeonID, ChronicleAirDungeonID, "StormHarpy", "molten_core", 70, 70},
	} {
		for _, partySize := range []int{1, 4} {
			for _, rested := range []bool{false, true} {
				dungeonMin, dungeonMax := regionalDungeonXPBudget(t, region.dungeon, region.startLevel, partySize, rested)
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
						if shortfall > dungeonMin {
							t.Fatalf("%s story plus one prior dungeon leaves a mandatory grinding gap: %d XP", region.name, shortfall-dungeonMin)
						}
						extraKillXP := wellRestedKillXP(p, recipientCombatExperience(combatExperienceBudget(lastHuntLevel, 0, false, false), false, partySize, 1))
						t.Logf("REGIONAL_HANDOFF realm=%s party=%d rested=%t collection=%d kills=%d kill_xp=%d quest_xp=%d quest_gold=%d level=%d entry=%d shortfall=%d extra_same_level_kills=%d omitted_dungeon_xp=true",
							region.name, partySize, rested, collectionKills, kills, killXP, questXP, questGold, level, region.entryLevel, shortfall, (shortfall+extraKillXP-1)/extraKillXP)
						t.Logf("WITH_PREVIOUS_DUNGEON realm=%s seeds=1..3 dungeon_xp_min=%d dungeon_xp_max=%d shortfall_min=%d shortfall_max=%d measured=false",
							region.name, dungeonMin, dungeonMax, max(0, needed-killXP-questXP-dungeonMax), max(0, needed-killXP-questXP-dungeonMin))
					})
				}
			}
		}
	}
}

// Generated-encounter budget, not combat, clear-time or survival evidence.
// Count each initially spawned enemy once and exercise actual room payouts.
// No daily, Fortune, repeat run, summoned add or quest reward is included.
// Three fixed layouts describe a sample range, not all procedural seeds.
func regionalDungeonXPBudget(t *testing.T, dungeon string, level, partySize int, rested bool) (int, int) {
	t.Helper()
	low, high := 0, 0
	for seed := int64(1); seed <= 3; seed++ {
		w := NewWorld(nil)
		id := "regional-budget-" + dungeon
		instance := &DungeonInstance{ID: id, DungeonType: dungeon, Difficulty: DifficultyNormal, RunLevel: level,
			PlayerRoomSummary: map[string]DungeonRoomSummary{}}
		w.InstanceLayouts[id] = instance
		layout := w.generateDungeonLayoutWithSeed(id, DifficultyNormal, dungeon, seed)
		assignDungeonRoomHooks(&layout)
		instance.Layout, instance.RoomState = layout, NewDungeonRoomState(layout)
		if err := validateDungeonProgressionLayout(dungeon, layout); err != nil {
			w.StopBackground()
			t.Fatal(err)
		}
		p := newTestPlayer("budget-recipient", "Wizard")
		p.InstanceID, p.Level, p.MaxExperience = id, level, experienceRequiredForLevel(level)
		if rested {
			p.WellRestedSeconds = MaxWellRestedSeconds
		}
		w.AddEntity(p)
		_, _, bosses := dungeonEncounterCatalog(dungeon)
		bossTypes := map[string]bool{}
		for _, boss := range bosses {
			bossTypes[boss] = true
		}
		total, bossCount := 0, 0
		for _, enemy := range w.Entities {
			if enemy.Type != TypeEnemy || enemy.InstanceID != id {
				continue
			}
			boss := bossTypes[enemy.SubType]
			if boss {
				bossCount++
			}
			base := combatExperienceBudget(enemy.Level, level, boss, strings.HasPrefix(enemy.ID, "elite-"))
			total += wellRestedKillXP(p, recipientCombatExperience(base, boss, partySize, 1))
		}
		if bossCount != len(bosses) {
			w.StopBackground()
			t.Fatalf("%s seed%d: generated %d bosses, want %d", dungeon, seed, bossCount, len(bosses))
		}
		w.OnEvent = func(kind string, value interface{}) {
			if kind == "room_clear_reward" {
				total += value.(DungeonRoomClearRewardEvent).XP
			}
		}
		for index := range layout.Rooms {
			w.MarkDungeonRoomCleared(id, index)
		}
		w.StopBackground()
		if seed == 1 || total < low {
			low = total
		}
		high = max(high, total)
	}
	return low, high
}
