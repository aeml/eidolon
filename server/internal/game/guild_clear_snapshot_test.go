package game

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestDungeonGuildSnapshotCapturesOriginalSeasonAndUniqueMembers(t *testing.T) {
	at := time.Date(2026, 9, 30, 23, 59, 59, 0, time.UTC)
	var snapshot dungeonGuildClearSnapshot
	first := &Entity{ID: "first", Type: TypePlayer, GuildID: "old-guild", GuildTag: "OLD", GuildName: "Old Watch"}
	second := &Entity{ID: "second", Type: TypePlayer, GuildID: "old-guild", GuildTag: "OLD", GuildName: "Old Watch"}
	snapshot.addLocked(first)
	snapshot.addLocked(first) // A duplicate participant must not qualify a guild.
	event := DungeonCompletionEvent{InstanceID: "clear", DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyNormal,
		RunLevel: 30, Duration: 3 * time.Minute, CompletedAt: at}
	snapshot.finish(&event)
	if len(event.GuildRuns) != 0 {
		t.Fatal("one real member qualified through duplicates")
	}
	snapshot.addLocked(second)
	snapshot.addLocked(&Entity{ID: "solo", Type: TypePlayer, GuildID: "solo-guild"})
	snapshot.addLocked(&Entity{ID: "enemy", Type: TypeEnemy, GuildID: "old-guild"})
	first.GuildID, first.GuildTag, first.GuildName = "new-guild", "NEW", "New Watch"
	snapshot.finish(&event)
	if len(event.GuildRuns) != 1 {
		t.Fatal("qualification included nonplayers or single-member guild")
	}
	run := event.GuildRuns[0]
	if run.GuildID != "old-guild" || run.GuildTag != "OLD" || run.GuildName != "Old Watch" ||
		run.MemberCount != 2 || run.Season != "2026-Q3" || !run.FirstClearAt.Equal(at) || run.DurationMS != 180000 {
		t.Fatal("delayed clear changed membership, season, time or unique count", run)
	}
	snapshot.runs[run.GuildID] = run
	event.GuildRuns[0].MemberCount = 99
	if snapshot.runs[run.GuildID].MemberCount != 2 {
		t.Fatal("event aliases mutable capture state")
	}
}

func TestDungeonGuildSnapshotComesFromActualPartyBossRecipients(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	const instanceID = "guild-clear-instance"
	w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, DungeonType: "verdant_bastion_catacombs",
		Difficulty: DifficultyNormal, RunLevel: 30, CreatedAt: time.Now().Add(-3 * time.Minute)}
	players := make([]*Entity, 4)
	for i := range players {
		players[i] = newTestPlayer(fmt.Sprintf("guild-recipient-%d", i), "Fighter")
		players[i].Level, players[i].InstanceID = 30, instanceID
		players[i].GuildID, players[i].GuildTag, players[i].GuildName = "party-guild", "TEST", "Party Watch"
		w.AddEntity(players[i])
	}
	party := w.CreateParty(players[0].ID)
	for _, player := range players[1:] {
		if err := w.JoinParty(party.ID, player.ID); err != nil {
			t.Fatal(err)
		}
	}
	completed := make(chan DungeonCompletionEvent, 1)
	w.OnEvent = func(kind string, payload interface{}) {
		if kind == "dungeon_complete" {
			completed <- payload.(DungeonCompletionEvent)
		}
	}
	boss := &Entity{ID: "guild-final-boss", Type: TypeEnemy, SubType: "HollowSentinel", Level: 30,
		Health: 1, MaxHealth: 1, InstanceID: instanceID, State: "IDLE"}
	w.AddEntity(boss)
	boss.Mu.Lock()
	w.handleDeath(boss, players[0], nil)
	boss.Mu.Unlock()
	select {
	case event := <-completed:
		if len(event.GuildRuns) != 1 || event.GuildRuns[0].MemberCount != 4 || len(event.Participants) != 4 ||
			event.CompletedAt.IsZero() || !event.GuildRuns[0].FirstClearAt.Equal(event.CompletedAt) ||
			event.Duration != event.CompletedAt.Sub(w.InstanceLayouts[instanceID].CreatedAt) {
			t.Fatal("actual death handoff lost party identities or original kill time", event)
		}
	case <-time.After(time.Second):
		t.Fatal("actual final-boss completion not emitted")
	}
}

func TestCrystalGuildClearCountsRepeatParticipantsWithoutStoryQuests(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	const instanceID = "guild-repair-instance"
	w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, DungeonType: "earth_crystal_raid",
		Difficulty: DifficultyNormal, RunLevel: 30, CreatedAt: time.Now().Add(-3 * time.Minute)}
	for _, id := range []string{"first", "second", "left", "offline"} {
		player := newTestPlayer(id, "Fighter")
		player.InstanceID, player.GuildID, player.GuildName, player.GuildTag = instanceID, "repeat-guild", "Repeat Watch", "RPT"
		if id == "left" {
			player.InstanceID = ""
		}
		player.Disconnected = id == "offline"
		w.AddEntity(player) // No active story quest on any participant.
	}
	var completion DungeonCompletionEvent
	completionCount := 0
	w.OnEvent = func(kind string, payload interface{}) {
		if kind == "dungeon_complete" {
			completion = payload.(DungeonCompletionEvent)
			completionCount++
		}
	}
	state := &CrystalRepairState{InstanceID: instanceID, RaidType: "earth_crystal_raid",
		Participants: []string{"first", "second", "left", "offline"}, RepairTarget: "irrelevant-to-repeat-clear"}
	w.completeCrystalRepair(state)
	if len(completion.Participants) != 2 || len(completion.GuildRuns) != 1 || completion.GuildRuns[0].MemberCount != 2 {
		t.Fatal("repeat raid required quest advancement, or counted departed/disconnected players", completion)
	}
	w.completeCrystalRepair(state)
	if !state.Completed || completionCount != 1 {
		t.Fatal("repair lost completion state or emitted a duplicate clear")
	}
}

func TestGuildClearCaptureDoesNotExposePrivateRunSnapshots(t *testing.T) {
	player := &Entity{ID: "private-capture", Type: TypePlayer, GuildID: "public-guild", GuildTag: "PUB", GuildName: "Hidden Capture Name"}
	wire, err := json.Marshal(player)
	if err != nil || strings.Contains(string(wire), "Hidden Capture Name") {
		t.Fatal("internal guild name cache leaked into actor JSON", err)
	}
	var snapshot dungeonGuildClearSnapshot
	snapshot.addLocked(player)
	player.ID = "second"
	snapshot.addLocked(player)
	event := DungeonCompletionEvent{CompletedAt: time.Now()}
	snapshot.finish(&event)
	wire, err = json.Marshal(event)
	if err != nil || strings.Contains(string(wire), "Hidden Capture Name") || strings.Contains(string(wire), "guildId") {
		t.Fatal("internal captured leaderboard runs exposed in event wire JSON", err)
	}
}
