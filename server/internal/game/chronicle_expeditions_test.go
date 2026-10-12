package game

import (
	"fmt"
	"reflect"
	"testing"
)

// Continuous reward/quest-action diagnostic, not combat or human playtime.
// No prep XP, dailies, rested bonus, dungeon encounters or incidental kills.
// Each new step is offered/accepted/credited/claimed in its real order; this
// catches content that can only qualify for its objective AFTER its own reward.
func TestRegionalExpeditionsReachDungeonsWithoutRewardBurstsOrGrinding(t *testing.T) {
	for _, segment := range []struct {
		name, previous, next, dungeon string
		level                         int
	}{
		{"earth", "", ChronicleEarthDungeonID, "verdant_bastion_catacombs", 1},
		{"water", ChronicleEarthDungeonID, ChronicleWaterDungeonID, "abyssal_well", 30},
		{"fire", ChronicleWaterDungeonID, ChronicleFireDungeonID, "molten_core", 60},
		{"air", ChronicleFireDungeonID, ChronicleAirDungeonID, "tempest_spire", 70},
	} {
		for _, size := range []int{1, 4, 5} {
			t.Run(fmt.Sprintf("%s/party%d", segment.name, size), func(t *testing.T) {
				w := newTestWorld()
				w.spawnChronicleInvestigationSites()
				p := newTestPlayer("regional-expedition", "Wizard")
				p.Level, p.Experience, p.MaxExperience = segment.level, 0, experienceRequiredForLevel(segment.level)
				p.X, p.Z = 20, 215
				p.Inventory = make([]Item, 20)
				if segment.previous != "" {
					for _, q := range chronicleQuestCatalog() {
						if q.ID == segment.previous {
							break
						}
						q.Accepted, q.Completed, q.Count = true, true, q.MaxCount
						if q.Type == "INVESTIGATE" {
							q.InvestigationMask = (1 << q.MaxCount) - 1
						}
						p.Quests = append(p.Quests, q)
					}
				}
				ensureChronicleLocked(p)
				w.AddEntity(p)
				started, steps := segment.previous == "", 0
				for _, definition := range chronicleQuestCatalog() {
					started = started || definition.ID == segment.previous
					if !started {
						continue
					}
					if definition.ID == segment.next {
						if p.Level < DungeonEntryLevels()[segment.dungeon] {
							t.Fatalf("dungeon requires grinding: level=%d xp=%d", p.Level, p.Experience)
						}
						t.Logf("REGIONAL_CONTINUOUS realm=%s party=%d steps=%d level=%d xp=%d dailies=0 extra_kills=0 measured=false", segment.name, size, steps, p.Level, p.Experience)
						return
					}
					p.X, p.Z = 20, 215
					if _, ok := w.PerformAcceptQuest(p.ID, definition.ID); !ok {
						t.Fatal("accept", definition.ID)
					}
					q := questByID(t, p, definition.ID)
					quotedXP := q.RewardXP
					if q.LegacyOptional {
						t.Fatal("fresh route unexpectedly optional", q.ID)
					}
					awardKills := func(level, count int) {
						if p.Level < level-4 {
							t.Fatalf("unreachable enemies for %s: player=%d enemies=%d", q.ID, p.Level, level)
						}
						for i := 0; i < count; i++ {
							w.awardExperienceLocked(p, recipientCombatExperience(combatExperienceBudget(level, 0, false, false), false, size, 1))
						}
					}
					if hunt, ok := chronicleHuntByID(q.ID); ok {
						awardKills(hunt.MinEnemyLevel, hunt.Count)
						x, z := 0.0, 0.0
						switch hunt.HuntingRealm {
						case "water":
							z = -800
						case "fire":
							x = -1500
						case "air":
							x = 1500
						}
						for i := 0; i < hunt.Count; i++ {
							w.updateChronicleHuntKillLocked(p, hunt.Enemy, hunt.MinEnemyLevel, "", x, z)
						}
					} else {
						switch q.Type {
						case "INVESTIGATE":
							for _, chapter := range allChronicleInvestigations() {
								if chapter.ID != q.ID {
									continue
								}
								for _, site := range chapter.Sites {
									p.X, p.Z = site.X, site.Z
									if site.Kind == "combat" {
										enemy := w.Entities[site.EntityID]
										if p.Level < enemy.Level-4 {
											t.Fatalf("unreachable command anchor %s: player=%d enemy=%d", q.ID, p.Level, enemy.Level)
										}
										enemy.Health, enemy.State = 0, "DEAD"
										if _, err := w.RecordChronicleInvestigationKill(p.ID, site.EntityID); err != nil {
											t.Fatal(err)
										}
									} else if _, err := w.InspectChronicleSite(p.ID, site.EntityID); err != nil {
										t.Fatal(err)
									}
								}
							}
						case "COLLECT":
							enemyLevel := map[string]int{"Verdant Memory Seed": 3, "Moon-Tide Pearl": 50, "Cinderheart Ore": 70, "Stormglass Pinion": 70}[q.Target]
							if enemyLevel == 0 {
								t.Fatal("unmodeled collection", q.Target)
							}
							awardKills(enemyLevel, q.MaxCount)
							p.Inventory[0] = Item{ID: "regional-fragments", Name: q.Target, Stack: q.MaxCount, MaxStack: q.MaxCount}
							w.UpdateCollectionQuestProgress(p, q.Target, q.MaxCount)
						case "KILL":
							if q.ID == "chronicle_01_bell_below" {
								awardKills(1, q.MaxCount)
							} else if q.ID != segment.previous {
								t.Fatal("unmodeled kill", q.ID)
							}
							for i := 0; i < q.MaxCount; i++ {
								w.UpdateQuestProgress(p, q.Target)
							}
						default:
							t.Fatal("unmodeled objective", q.ID)
						}
					}
					p.X, p.Z = 20, 215
					before := p.Level
					if _, ok := w.PerformCompleteQuest(p.ID, definition.ID); !ok {
						t.Fatal("turnin", definition.ID)
					}
					paid := questByID(t, p, definition.ID)
					if p.Level-before > 2 || paid.GrantedXP != quotedXP {
						t.Fatalf("burst/quote mismatch %s: %d->%d quote=%d paid=%d", paid.ID, before, p.Level, quotedXP, paid.GrantedXP)
					}
					t.Logf("REGIONAL_STEP id=%s before=%d after=%d xp=%d", paid.ID, before, p.Level, paid.GrantedXP)
					steps++
				}
				t.Fatal("missing dungeon entry")
			})
		}
	}
}

func TestExpeditionSitesAreRegisteredAndIndependent(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	rocks, err := readEarthOutcropSolids()
	if err != nil {
		t.Fatal(err)
	}
	for _, chapter := range expeditionInvestigations() {
		p := investigationPlayer(w, chapter, chapter.ID+"-reader")
		for _, site := range chapter.Sites {
			p.X, p.Z = site.X, site.Z
			if insideRockSolids(rocks, rockPoint{site.X, site.Z}, adminLandingRadius) {
				t.Error("site inside outcrop", site.ID)
			}
			if !adminShapesClear(adminLandingColliders.Overworld, site.X, 0, site.Z) {
				t.Errorf("site inside scenery: %s (%v,%v)", site.ID, site.X, site.Z)
			}
			if w.Entities[site.EntityID] == nil {
				t.Fatal("missing site", site.ID)
			}
			for attempt := 0; attempt < 2; attempt++ {
				receipt, err := w.InspectChronicleSite(p.ID, site.EntityID)
				if err != nil || receipt.Recorded != (attempt == 0) || receipt.Count != 1 {
					t.Fatalf("discovery %s: %+v %v", site.ID, receipt, err)
				}
			}
		}
	}
	chapters := expeditionInvestigations()
	chapters[0].Sites[0].Text = "mutated"
	if expeditionInvestigations()[0].Sites[0].Text == "mutated" {
		t.Fatal("shared expedition evidence")
	}
}

func TestExpeditionHuntsHaveAuthoredOverworldTargets(t *testing.T) {
	w := newTestWorld()
	for _, chapter := range chronicleExpeditions {
		if chapter.Type != "KILL" {
			continue
		}
		found := false
		for _, enemy := range w.Entities {
			if enemy.Type == TypeEnemy && huntKillMatches(chapter.ChronicleHunt, enemy.SubType, enemy.Level, enemy.InstanceID, enemy.SpawnX, enemy.SpawnZ) {
				found = true
				break
			}
		}
		if !found {
			t.Error("expedition has no qualifying overworld spawn", chapter.ID)
		}
	}
}

func TestExpeditionAdditionsPreserveEveryPreviousMilestone(t *testing.T) {
	previousCatalog := expandDarkRealmChronicle(expandChronicleHunts(expandChronicleInvestigations(classicChronicleQuestCatalog())))
	if len(previousCatalog) != 55 {
		t.Fatal("historical fixture no longer represents the previous 55 chapters")
	}
	for milestone, active := range previousCatalog {
		t.Run(active.ID, func(t *testing.T) {
			p := newTestPlayer("returning-expedition", "Wizard")
			p.Level, p.Experience, p.MaxExperience, p.Gold = 100, experienceRequiredForLevel(100), experienceRequiredForLevel(100), 777
			for i, q := range previousCatalog {
				if i > milestone {
					break
				}
				q.Accepted, q.Completed = true, i < milestone
				q.RewardXP, q.RewardGold = 2_000_000, 99
				if q.Type == "KILL" {
					q.MaxCount = 60
					q.ObjectiveText = "Saved accepted count of 60."
				}
				q.Count = q.MaxCount
				if q.Type == "INVESTIGATE" {
					q.InvestigationMask = (1 << q.MaxCount) - 1
				}
				if q.Completed {
					q.GrantedXP, q.GrantedGold, q.GrantedResonanceXP = 1_000_000, 99, 1_000_000
				}
				p.Quests = append(p.Quests, q)
			}
			saved := append([]Quest(nil), p.Quests...)
			ensureChronicleLocked(p)
			if p.Level != 100 || p.Experience != experienceRequiredForLevel(100) || p.Gold != 777 {
				t.Fatal("migration changed earned progression")
			}
			for _, old := range saved {
				q := questByID(t, p, old.ID)
				if q.Accepted != old.Accepted || q.Completed != old.Completed || q.Count != old.Count || q.MaxCount != old.MaxCount || q.LegacyOptional || q.InvestigationMask != old.InvestigationMask || q.GrantedXP != old.GrantedXP || q.GrantedGold != old.GrantedGold || q.GrantedResonanceXP != old.GrantedResonanceXP || q.RewardGold != old.RewardGold {
					t.Fatalf("saved progress changed: old=%+v new=%+v", old, q)
				}
				if old.Completed && q.RewardXP != old.RewardXP {
					t.Fatal("paid quote changed", old.ID)
				}
			}
			activeChapter := questByID(t, p, active.ID).Chapter
			for _, newChapter := range chronicleExpeditions {
				for _, definition := range chronicleQuestCatalog() {
					if definition.ID != newChapter.ID || definition.Chapter >= activeChapter {
						continue
					}
					q := questByID(t, p, newChapter.ID)
					if !q.LegacyOptional || q.Accepted || q.Completed || q.Count != 0 || q.InvestigationMask != 0 {
						t.Fatal("new earlier chapter is mandatory or invents progress", q.ID)
					}
				}
			}
			before := append([]Quest(nil), p.Quests...)
			if ensureChronicleLocked(p) || !reflect.DeepEqual(before, p.Quests) {
				t.Fatal("returning-save refresh is not idempotent")
			}
		})
	}
}
