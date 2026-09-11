package game

import (
	"sync"
	"testing"
	"time"
)

func TestPartyKillRecipientsAreFrozenBeforeDelayedRewardDelivery(t *testing.T) {
	for _, worldLocked := range []bool{false, true} {
		name := "timed-impact"
		if worldLocked {
			name = "ability-dispatch"
		}
		t.Run(name, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			const instanceID = "kill-time-presence"
			var members []*Entity
			for _, class := range []string{"Fighter", "Cleric", "Wizard"} {
				p := newTestPlayer("kill-time-"+class, class)
				p.Level, p.MaxExperience = 30, experienceRequiredForLevel(30)
				p.Inventory = make([]Item, MaxInventorySize)
				p.InstanceID = instanceID
				completedChronicleThrough(p, 2)
				w.AddEntity(p)
				members = append(members, p)
			}
			party := w.CreateParty(members[0].ID)
			for _, member := range members[1:] {
				if err := w.JoinParty(party.ID, member.ID); err != nil {
					t.Fatal(err)
				}
			}
			members[1].X = 1000        // Still inside; no boss proximity requirement.
			members[2].InstanceID = "" // Arrives only after the kill.
			// A prepared normal room gives an existing event boundary before
			// boss reward delivery. This is not a generated dungeon clear.
			layout := DungeonLayout{Rooms: []DungeonRoom{{Width: 40, Height: 40, Type: "normal"}}}
			w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, Layout: layout,
				DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyNormal, RunLevel: 30,
				RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
			paused, release := make(chan struct{}), make(chan struct{})
			var pauseOnce, releaseOnce sync.Once
			unblock := func() { releaseOnce.Do(func() { close(release) }) }
			defer unblock() // Release before background draining on test failure.
			w.OnEvent = func(kind string, _ interface{}) {
				if kind == "room_clear_reward" {
					pauseOnce.Do(func() { close(paused); <-release })
				}
			}
			boss := &Entity{ID: "kill-time-sentinel", Type: TypeEnemy, SubType: "HollowSentinel",
				Level: 30, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
			w.AddEntity(boss)
			if worldLocked {
				w.Mu.Lock()
			}
			boss.Mu.Lock()
			w.handleDeathWithWorldLock(boss, members[0], nil, worldLocked)
			boss.Mu.Unlock()
			if worldLocked {
				w.Mu.Unlock()
			}
			select {
			case <-paused:
			case <-time.After(5 * time.Second):
				t.Fatal("reward pipeline did not reach its room event boundary")
			}
			members[1].Mu.Lock()
			members[1].InstanceID = "" // Leaves after earning the kill.
			members[1].Mu.Unlock()
			members[2].Mu.Lock()
			members[2].InstanceID = instanceID // Too late to earn this kill.
			members[2].Mu.Unlock()
			unblock()
			w.StopBackground()
			for index, member := range members {
				q := questByID(t, member, ChronicleEarthDungeonID)
				want := 1
				if index == 2 {
					want = 0
				}
				if q.Count != want || q.Completed {
					t.Fatalf("%s kill-time credit=%d completed=%v, want unclaimed count%d", member.SubType, q.Count, q.Completed, want)
				}
				if index == 2 && (member.Experience != 0 || member.Gold != 0) {
					t.Fatal("late arrival received earlier kill rewards")
				}
			}
		})
	}
}
