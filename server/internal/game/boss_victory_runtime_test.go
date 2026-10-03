package game

import (
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func bossVictoryCaptureFixture(t *testing.T) (*World, *DungeonInstance, []*Entity, bossVictoryCapture) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	layout := DungeonLayout{Rooms: []DungeonRoom{{Type: "start", Width: 40, Height: 40}, {Type: "boss", X: 100, Width: 60, Height: 60}}}
	inst := &DungeonInstance{ID: "dungeon_boss_capture", DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyMythic, RunLevel: 30,
		Layout: layout, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
	w.storeDungeonInstance(inst.ID, inst)
	input := bossVictoryCapture{instanceID: inst.ID, bossType: "RootboundWarden", partyID: "original-party", spawnX: 100, x: 105,
		baseGold: 100, baseXP: 400, isDungeonBoss: true, killedAt: time.Now(), loot: []*Item{{ID: "public-original", Name: "Original", Type: ItemWeapon, Stack: 1, MaxStack: 1, Stats: map[string]int{"damage": 73}}}}
	input.bossID = input.bossType + "-" + inst.ID
	for index, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		player := fullBossLootPlayer()
		player.Name, player.ID, player.SubType, player.InstanceID = fmt.Sprintf("boss-capture-%d", index), fmt.Sprintf("player-boss-capture-%d", index), class, inst.ID
		player.Level, player.MaxExperience = 30, experienceRequiredForLevel(30)
		player.Quests = []Quest{{ID: "original-accepted", Type: "KILL", Target: input.bossType, Accepted: true, Count: 2, MaxCount: 5},
			{ID: "unaccepted", Type: "KILL", Target: "DungeonBoss", MaxCount: 5}}
		if index == 1 {
			player.Health, player.State = 0, "DEAD"
		}
		w.AddEntity(player)
		input.members = append(input.members, player)
	}
	return w, inst, input.members, input
}

func TestBossVictoryRuntimeCaptureFreezesCohortWithoutAnyEarnedMutation(t *testing.T) {
	w, inst, players, input := bossVictoryCaptureFixture(t)
	before := w.GetEntityCopy(players[0].ID)
	op, err := w.captureBossVictory(input)
	if err != nil || op.Validate() != nil || len(op.Participants) != 4 || len(op.Drops) != 1 || op.RoomIndex != 1 || inst.RoomState.Rooms[1].Cleared || !reflect.DeepEqual(before, w.GetEntityCopy(players[0].ID)) {
		t.Fatal("capture mutated earned value/progress or lost the original cohort", err)
	}
	for _, participant := range op.Participants {
		if len(participant.Items) < 3 || len(participant.Quests) != 1 || participant.Quests[0].Amount != 1 || participant.Gold <= 0 || participant.XP <= 0 {
			t.Fatal("capture lost guaranteed difficulty loot or accepted kill credit")
		}
	}
	players[0].Disconnected, players[0].InstanceID = true, "newer-run"
	players[0].Gold += 999
	players[0].Quests[1].Accepted = true
	input.killedAt = input.killedAt.Add(time.Hour)
	input.members = input.members[1:]
	input.loot[0].Stats["damage"] = 1
	retry, err := w.captureBossVictory(input)
	if err != nil || !reflect.DeepEqual(op, retry) || !retry.Drops[0].ExpiresAt.Equal(op.CreatedAt.Add(time.Minute)) {
		t.Fatal("retry changed eligibility, original rolls, quest credit or ground lifetime", err)
	}
}

func TestBossVictoryRuntimeConcurrentCaptureAndConfirmedWinnerDoNotAlias(t *testing.T) {
	w, _, _, input := bossVictoryCaptureFixture(t)
	var wg sync.WaitGroup
	results := make(chan database.BossVictoryOperation, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			op, err := w.captureBossVictory(input)
			if err != nil {
				t.Error(err)
			}
			results <- op
		}()
	}
	wg.Wait()
	close(results)
	first := <-results
	for op := range results {
		if op.Fingerprint != first.Fingerprint {
			t.Fatal("concurrent capture rerolled one physical encounter")
		}
	}
	mutated := cloneBossVictory(first)
	mutated.Participants[0].Items[0], mutated.Participants[0].Quests[0].Amount, mutated.Drops[0].Item = "changed", 5, "changed"
	if !reflect.DeepEqual(first, w.PendingBossVictoryPlans()[0]) {
		t.Fatal("returned nested outcome aliases the retained cache")
	}
	winner := cloneBossVictory(first)
	winner.Participants[0].Gold++
	winner.Fingerprint, _ = database.BossVictoryFingerprint(winner)
	if err := w.RetainConfirmedBossVictoryPlan(winner); err != nil || !w.BossVictoryPlanConfirmed(first.ID) {
		t.Fatal("strongly stored first winner could not replace a losing local proposal", err)
	}
	if err := w.RetireBossVictoryPlan(first); err == nil || len(w.PendingBossVictoryPlans()) != 1 {
		t.Fatal("old proposal retired the confirmed winner")
	}
	if err := w.RetireBossVictoryPlan(winner); err != nil || len(w.PendingBossVictoryPlans()) != 0 {
		t.Fatal("confirmed terminal winner could not retire", err)
	}
}

func TestBossVictoryRuntimeProgressRequiresMatchingPhysicalBossRoom(t *testing.T) {
	w, inst, _, input := bossVictoryCaptureFixture(t)
	op, err := w.captureBossVictory(input)
	if err != nil {
		t.Fatal(err)
	}
	wrong := cloneBossVictory(op)
	wrong.RoomIndex = 0
	wrong.Fingerprint, _ = database.BossVictoryFingerprint(wrong)
	if err := w.ConfirmBossVictoryProgress(wrong); err == nil || inst.RoomState.Rooms[0].Cleared || inst.RoomState.Rooms[1].Cleared {
		t.Fatal("wrong room mutated shared progress")
	}
	if err := w.ConfirmBossVictoryProgress(op); err != nil || !inst.RoomState.Rooms[1].Cleared || !inst.RoomState.Rooms[1].Rewarded {
		t.Fatal("confirmed boss checkpoint was not projected", err)
	}
	other := input
	other.bossID = "random-restored-id"
	if _, err := w.captureBossVictory(other); err == nil {
		t.Fatal("random restored ID created another physical boss outcome")
	}
}
