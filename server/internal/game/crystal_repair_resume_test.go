package game

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestCrystalRepairResumeChecksEveryRaidMember(t *testing.T) {
	definition := elementalRaidDefinitions["earth_crystal_raid"]
	for _, mode := range []string{"all-defended", "one-unfinished", "one-missing"} {
		t.Run(mode, func(t *testing.T) {
			w := NewWorld(nil)
			t.Cleanup(w.StopBackground)
			var party *Party
			for index := 0; index < 5; index++ {
				id := fmt.Sprintf("returning-raider-%d", index)
				player := &Entity{ID: id, Type: TypePlayer, State: "IDLE", Level: 30, Health: 100, MaxHealth: 100,
					Quests: []Quest{{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget,
						Accepted: true, Count: 1, MaxCount: 1}}}
				if mode == "one-unfinished" && index == 4 {
					player.Quests[0].Count = 0
				}
				if mode != "one-missing" || index != 4 {
					w.AddEntity(player)
				}
				if index == 0 {
					party = w.CreateParty(id)
					if party == nil {
						t.Fatal("missing raid party")
					}
					party.MaxSize = 10
				} else {
					party.Members = append(party.Members, id)
					player.PartyID = party.ID
				}
			}
			instanceID := w.CreateDungeon(party.ID, definition.Type, DifficultyNormal, 30)
			instance, _ := w.getDungeonInstance(instanceID)
			instance.Mu.Lock()
			instance.RoomState.Rooms[len(instance.RoomState.Rooms)-1].Cleared = true
			instance.Mu.Unlock()
			if err := w.EnterInstance(party.LeaderID, instanceID); err != nil {
				t.Fatal(err)
			}
			w.RepairMu.RLock()
			restarted := w.CrystalRepairs[instanceID] != nil
			w.RepairMu.RUnlock()
			if restarted != (mode != "all-defended") {
				t.Fatalf("restarted=%v for %s", restarted, mode)
			}
		})
	}
}

func TestCrystalVigilReadinessRequiresTheActualAcceptedRepair(t *testing.T) {
	definition := elementalRaidDefinitions["earth_crystal_raid"]
	ready := Quest{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget,
		Accepted: true, Count: 1, MaxCount: 1}
	for _, tc := range []struct {
		name   string
		mutate func(*Quest)
		want   bool
	}{
		{"ready", func(q *Quest) {}, true},
		{"unclaimed-partial", func(q *Quest) { q.Count = 0 }, false},
		{"not-accepted", func(q *Quest) { q.Accepted = false }, false},
		{"zero-requirement", func(q *Quest) { q.MaxCount = 0 }, false},
		{"different-crystal", func(q *Quest) { q.Target = "WaterCrystal" }, false},
		{"different-objective", func(q *Quest) { q.Type = "KILL" }, false},
		{"different-chapter", func(q *Quest) { q.ID = ChronicleEarthDungeonID }, false},
		{"legacy-completed", func(q *Quest) { *q = Quest{ID: definition.RestoredQuest, Completed: true} }, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			quest := ready
			tc.mutate(&quest)
			player := &Entity{Quests: []Quest{quest}}
			if got := hasFinishedCrystalVigil(player, definition); got != tc.want {
				t.Fatalf("readiness=%v, want %v", got, tc.want)
			}
			if player.Quests[0] != quest || player.Gold != 0 || player.Experience != 0 {
				t.Fatal("readiness inspection mutated the character")
			}
		})
	}
	if hasFinishedCrystalVigil(nil, definition) || hasFinishedCrystalVigil(&Entity{}, definition) {
		t.Fatal("missing character/objective was treated as a completed defense")
	}
}

func TestRestoredRaidPreservesReadyUnclaimedCrystalRepair(t *testing.T) {
	for raidType, definition := range elementalRaidDefinitions {
		t.Run(raidType, func(t *testing.T) {
			original := NewWorld(nil)
			t.Cleanup(original.StopBackground)
			instanceID := original.CreateDungeon("party-returning-hero", raidType, DifficultyNormal, definition.RequiredLevel)
			instance, _ := original.getDungeonInstance(instanceID)
			instance.Mu.Lock()
			for index := range instance.RoomState.Rooms {
				instance.RoomState.Rooms[index].Cleared = true
			}
			instance.Mu.Unlock()
			snapshot, ok := original.GetDungeonResumeSnapshot(instanceID)
			if !ok {
				t.Fatal("missing saved raid")
			}

			// Rebuild the world from its durable room snapshot, not the original
			// in-memory CrystalRepairs map. Quest fields cross serialization too.
			for _, completed := range []bool{false, true} {
				label := "ready-awaiting-Ilyra"
				if completed {
					label = "already-turned-in"
				}
				t.Run(label, func(t *testing.T) {
					w := NewWorld(nil)
					t.Cleanup(w.StopBackground)
					if err := w.RestoreDungeon(snapshot); err != nil {
						t.Fatal(err)
					}
					quest := Quest{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget,
						Accepted: true, Count: 1, MaxCount: 1, Completed: completed}
					saved, err := json.Marshal([]Quest{quest})
					if err != nil {
						t.Fatal(err)
					}
					player := &Entity{ID: "returning-hero", Type: TypePlayer, State: "IDLE", Level: definition.RequiredLevel,
						Health: 100, MaxHealth: 100, Inventory: make([]Item, MaxInventorySize)}
					if err := json.Unmarshal(saved, &player.Quests); err != nil {
						t.Fatal(err)
					}
					w.AddEntity(player)
					for attempt := 0; attempt < 2; attempt++ {
						if err := w.EnterInstance(player.ID, instanceID); err != nil {
							t.Fatal(err)
						}
						w.RepairMu.RLock()
						repair := w.CrystalRepairs[instanceID]
						w.RepairMu.RUnlock()
						if repair != nil {
							t.Fatal("completed defense restarted solely because its reward was not claimed")
						}
					}
					if player.Gold != 0 || player.Experience != 0 || player.Quests[0] != quest {
						t.Fatal("restoring the raid changed quest progress or granted a reward")
					}
					if HasCompletedChronicleQuest(player, definition.RestoredQuest) != completed {
						t.Fatal("repair readiness bypassed manual quest turn-in")
					}
				})
			}
		})
	}
}
