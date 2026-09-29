package game

import (
	"testing"
	"time"
)

func TestRoomClearDoesNotRewardDisconnectedResumeEntities(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	const run = "room-presence"
	layout := DungeonLayout{Rooms: []DungeonRoom{{Type: "normal", Hook: "shrine", Width: 40, Height: 40}}}
	w.InstanceLayouts[run] = &DungeonInstance{ID: run, Layout: layout,
		DungeonType: "verdant_bastion_catacombs", RunLevel: 30,
		RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
	active := newTestPlayer("room-active", "Fighter")
	offline := newTestPlayer("room-offline", "Cleric")
	other := newTestPlayer("room-other-run", "Wizard")
	dead := newTestPlayer("room-dead", "Rogue")
	dying := newTestPlayer("room-lethal-pending", "Fighter")
	for _, p := range []*Entity{active, offline, other, dead, dying} {
		p.InstanceID, p.Level = run, 30
		p.MaxExperience = experienceRequiredForLevel(30)
		p.Health, p.MaxHealth, p.Mana, p.MaxMana = 10, 100, 10, 100
		w.AddEntity(p)
	}
	dead.Health, dead.State = 0, "DEAD"
	dying.Health = 0 // Lethal damage can precede the DEAD-state transition.
	party := w.CreateParty(active.ID)
	for _, p := range []*Entity{offline, other} {
		if err := w.JoinParty(party.ID, p.ID); err != nil {
			t.Fatal(err)
		}
	}
	other.InstanceID = "another-run"
	if !w.SetEntityDisconnected(offline.ID, time.Now()) {
		t.Fatal("disconnect fixture failed")
	}
	recipients := map[string]int{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "room_clear_reward" {
			recipients[data.(DungeonRoomClearRewardEvent).PlayerID]++
		}
	}
	w.MarkDungeonRoomCleared(run, 0)
	if recipients[active.ID] != 1 || active.Experience <= 0 || active.Gold <= 0 || active.Health <= 10 {
		t.Fatal("active party member did not receive room reward and shrine recovery")
	}
	for _, p := range []*Entity{offline, other, dead, dying} {
		wantHealth := 10
		if p == dead || p == dying {
			wantHealth = 0
		}
		if recipients[p.ID] != 0 || p.Experience != 0 || p.Gold != 0 || p.Health != wantHealth || p.Mana != 10 || p.SanctuaryDamageReduction {
			t.Fatalf("ineligible player received room rewards or shrine benefits: %s", p.ID)
		}
	}
	// Retained presence is for reconnect, not a claim on rooms cleared offline.
	offline.Disconnected = false
	xp, gold := active.Experience, active.Gold
	w.MarkDungeonRoomCleared(run, 0)
	if offline.Experience != 0 || offline.Gold != 0 || active.Experience != xp || active.Gold != gold || recipients[active.ID] != 1 {
		t.Fatal("reconnect or duplicate room clear paid a reward again")
	}
}
