package game

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestPartyDungeonEntryConcurrentResumePreservesRun(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("resume-concurrent", "Fighter")
	w.AddEntity(player)
	w.SetPlayerLevel(player.ID, 100)
	party := w.CreateParty(player.ID)
	run, moved, err := w.EnterPartyDungeon(player.ID, "abyssal_well", DifficultyHeroic, 80)
	if err != nil || len(moved) != 1 {
		t.Fatalf("initial entry: %v %v", moved, err)
	}
	player.Mu.Lock()
	player.X += 12
	player.TargetX = player.X + 3
	x, targetX := player.X, player.TargetX
	player.Mu.Unlock()
	before, _ := w.GetDungeonResumeSnapshot(run.InstanceID)
	var workers sync.WaitGroup
	for i := 0; i < 32; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			actual, entered, err := w.EnterPartyDungeon(player.ID, "verdant_bastion_catacombs", DifficultyNormal, 30)
			if err != nil || actual != run || len(entered) != 0 {
				t.Errorf("duplicate resume: %+v %v %v", actual, entered, err)
			}
		}()
	}
	workers.Wait()
	after, _ := w.GetDungeonResumeSnapshot(run.InstanceID)
	if before.Layout.GenerationSeed != after.Layout.GenerationSeed || player.X != x || player.TargetX != targetX {
		t.Fatal("resume changed geometry or movement")
	}
	if current, ok := w.GetPartyDungeonRun(party.ID); !ok || current != run {
		t.Fatal("lost authoritative run")
	}
}

func TestRaidResumeChecksReturningMemberWithoutMovingTheGroup(t *testing.T) {
	for _, raidType := range []string{"earth_crystal_raid", "weekly_raid"} {
		t.Run(raidType, func(t *testing.T) {
			w := NewWorld(nil)
			var party *Party
			members := make([]*Entity, 0, 5)
			quest := ChronicleGateOpenedID
			if raidType == "earth_crystal_raid" {
				quest = ChronicleEarthDungeonID
			}
			for i := 0; i < 5; i++ {
				player := newTestPlayer(fmt.Sprintf("raid-resume-%d", i), "Wizard")
				w.AddEntity(player)
				w.SetPlayerLevel(player.ID, 100)
				player.Quests = append(player.Quests, Quest{ID: quest, Completed: true})
				if i == 0 {
					party = w.CreateParty(player.ID)
				} else if err := w.JoinParty(party.ID, player.ID); err != nil {
					t.Fatal(err)
				}
				members = append(members, player)
			}
			party.MaxSize = 10
			id := w.CreateDungeon(party.ID, raidType, DifficultyNormal, 30)
			if err := w.EnterInstance(members[0].ID, id); err != nil {
				t.Fatal(err)
			}
			members[0].X += 20
			x := members[0].X
			// The original launch required readiness; continuing a saved run
			// does not demand another ready check or teleport everyone again.
			run, moved, err := w.EnterPartyDungeon(members[1].ID, "crypt", DifficultyNormal, 30)
			if err != nil || run.InstanceID != id || len(moved) != 1 || moved[0] != members[1].ID {
				t.Fatalf("qualified non-leader could not resume: %+v %v %v", run, moved, err)
			}
			if members[0].X != x {
				t.Fatal("raid resume displaced the leader")
			}
			members[2].Quests = nil
			if _, _, err := w.EnterPartyDungeon(members[2].ID, "crypt", DifficultyNormal, 30); err == nil {
				t.Fatal("unqualified replacement bypassed the raid's actual Chronicle gate")
			}
			if members[2].InstanceID != "" {
				t.Fatal("rejected raider entered anyway")
			}
		})
	}
}

func TestExpiredRunRequiresFreshLeaderEntry(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("expired-leader", "Wizard")
	w.AddEntity(player)
	w.SetPlayerLevel(player.ID, 100)
	party := w.CreateParty(player.ID)
	old := w.CreateDungeon(party.ID, "abyssal_well", DifficultyNormal, 60)
	instance, _ := w.getDungeonInstance(old)
	instance.EmptySince = time.Now().Add(-6 * time.Minute)
	if _, ok := w.GetPartyDungeonRun(party.ID); ok {
		t.Fatal("expired run displayed as resumable")
	}
	run, moved, err := w.EnterPartyDungeon(player.ID, "tempest_spire", DifficultyMythic, 100)
	if err != nil || run.InstanceID == old || run.DungeonType != "tempest_spire" || len(moved) != 1 {
		t.Fatalf("fresh entry did not replace expired run: %+v %v %v", run, moved, err)
	}
	if _, exists := w.GetInstanceLayout(old); exists {
		t.Fatal("expired layout was orphaned")
	}
}

func TestRestoredLoginActivatesDungeonMembership(t *testing.T) {
	original := NewWorld(nil)
	id := original.CreateDungeon("restored-membership", "abyssal_well", DifficultyNormal, 60)
	snapshot, _ := original.GetDungeonResumeSnapshot(id)
	w := NewWorld(nil)
	if err := w.RestoreDungeon(snapshot); err != nil {
		t.Fatal(err)
	}
	player := newTestPlayer("restored-member", "Wizard")
	player.InstanceID, player.PartyID = id, snapshot.PartyID
	player.X, player.Z = snapshot.Layout.Rooms[1].X, snapshot.Layout.Rooms[1].Z
	w.AddEntity(player)
	instance, _ := w.getDungeonInstance(id)
	if !instance.EmptySince.IsZero() {
		t.Fatal("login left an occupied restored run on the empty-instance expiry timer")
	}
	if active, left := w.GetDungeonStatus(snapshot.PartyID); !active || left != 0 {
		t.Fatal("restored occupied run displayed as idle")
	}
	if _, ok := instance.PlayerRoomSummary[player.ID]; !ok {
		t.Fatal("restored membership has no room summary")
	}
}
