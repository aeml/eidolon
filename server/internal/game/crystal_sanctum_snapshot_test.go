package game

import (
	"encoding/json"
	"testing"
	"time"
)

// Inspect the existing entry/reconnect/periodic room-state wire contract, not
// a transient callout or an invented client-side quest inference.
func readCrystalSanctumWire(t *testing.T, w *World, instanceID, playerID string) map[string]interface{} {
	t.Helper()
	summary, ok := w.GetDungeonRoomSummary(instanceID, playerID)
	if !ok {
		t.Fatal("missing room summary")
	}
	data, err := json.Marshal(summary)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatal(err)
	}
	crystal, _ := payload["crystal"].(map[string]interface{})
	return crystal
}

func TestCrystalSanctumSnapshotHasAuthoritativeIdentityBeforeCombat(t *testing.T) {
	for raidType, definition := range elementalRaidDefinitions {
		t.Run(raidType, func(t *testing.T) {
			w := NewWorld(nil)
			t.Cleanup(w.StopBackground)
			id := w.CreateDungeon("party-hero", raidType, DifficultyNormal, definition.RequiredLevel)
			layout, _ := w.GetInstanceLayout(id)
			chamber := layout.Rooms[len(layout.Rooms)-1]
			crystal := readCrystalSanctumWire(t, w, id, "hero")
			if crystal == nil || crystal["instanceId"] != id || crystal["raidType"] != raidType ||
				crystal["element"] != definition.Element || crystal["name"] != definition.Crystal ||
				crystal["stage"] != "fractured" || crystal["progress"] != float64(0) ||
				crystal["x"] != chamber.X || crystal["z"] != chamber.Z {
				t.Fatalf("missing or incorrect initial crystal identity: %+v", crystal)
			}
		})
	}
}

func TestCrystalSanctumSnapshotReadsLiveRepairWithoutCallouts(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	id := w.CreateDungeon("party-hero", "earth_crystal_raid", DifficultyNormal, 30)
	state := &CrystalRepairState{InstanceID: id, RaidType: "earth_crystal_raid", Wave: 2}
	w.RepairMu.Lock()
	w.CrystalRepairs[id] = state
	w.RepairMu.Unlock()
	crystal := readCrystalSanctumWire(t, w, id, "hero")
	if crystal == nil || crystal["stage"] != "repairing" || crystal["wave"] != float64(2) || crystal["totalWaves"] != float64(3) {
		t.Fatalf("join during the Vigil lost current state: %+v", crystal)
	}
	w.completeCrystalRepair(state)
	crystal = readCrystalSanctumWire(t, w, id, "hero")
	if crystal == nil || crystal["stage"] != "restored" || crystal["progress"] != float64(100) {
		t.Fatalf("completed ritual is absent without an event listener: %+v", crystal)
	}
}

func TestCrystalSanctumSnapshotDoesNotInventRestorationFromBossOrWrongQuest(t *testing.T) {
	definition := elementalRaidDefinitions["earth_crystal_raid"]
	for _, mode := range []string{"boss-only", "wrong-crystal", "unaccepted", "ready-unclaimed", "claimed", "quest-without-cleared-raid"} {
		t.Run(mode, func(t *testing.T) {
			w := NewWorld(nil)
			t.Cleanup(w.StopBackground)
			id := w.CreateDungeon("party-hero", definition.Type, DifficultyNormal, 30)
			instance, _ := w.getDungeonInstance(id)
			instance.Mu.Lock()
			instance.RoomState.Rooms[len(instance.RoomState.Rooms)-1].Cleared = mode != "quest-without-cleared-raid"
			instance.Mu.Unlock()
			quest := Quest{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget, Accepted: true, Count: 1, MaxCount: 1}
			switch mode {
			case "boss-only":
				quest.Count = 0
			case "wrong-crystal":
				quest.Target = "WaterCrystal"
			case "unaccepted":
				quest.Accepted = false
			case "claimed":
				quest.Completed = true
			}
			player := &Entity{ID: "hero", Type: TypePlayer, Quests: []Quest{quest}}
			w.AddEntity(player)
			crystal := readCrystalSanctumWire(t, w, id, player.ID)
			want := "fractured"
			if mode == "ready-unclaimed" || mode == "claimed" {
				want = "restored"
			}
			if crystal == nil || crystal["stage"] != want {
				t.Fatalf("%s: got %+v, want %s", mode, crystal, want)
			}
			if player.Quests[0] != quest || player.Gold != 0 || player.Experience != 0 {
				t.Fatal("visual snapshot mutated progress or bypassed manual turn-in")
			}
		})
	}
}

func TestCrystalSanctumSnapshotIsAbsentInOrdinaryDungeons(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	id := w.CreateDungeon("party-hero", "verdant_bastion_catacombs", DifficultyNormal, 30)
	if crystal := readCrystalSanctumWire(t, w, id, "hero"); crystal != nil {
		t.Fatalf("ordinary dungeon received an elemental raid crystal: %+v", crystal)
	}
}

func TestCrystalSanctumSnapshotTracksActualWaveWorker(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	id := w.CreateDungeon("party-hero", "earth_crystal_raid", DifficultyNormal, 30)
	events := make(chan CrystalRepairEvent, 16)
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "crystal_repair" {
			events <- value.(CrystalRepairEvent)
		}
	}
	if !w.StartCrystalRepair(id, "earth_crystal_raid", []string{"hero"}, 0, 0) {
		t.Fatal("ritual failed to start")
	}
	for {
		select {
		case event := <-events:
			snapshot := w.crystalSanctumSnapshot(id, "hero")
			if snapshot == nil {
				t.Fatal("missing live snapshot")
			}
			switch event.Stage {
			case "wave_start":
				if snapshot.Stage != "repairing" || snapshot.Wave != event.Wave || snapshot.Progress != (event.Wave-1)*33 {
					t.Fatalf("wave state does not match actual worker: %+v / %+v", snapshot, event)
				}
				// Mutating a delivered value must not mutate server-owned state.
				snapshot.Progress = 100
				if w.crystalSanctumSnapshot(id, "hero").Progress == 100 {
					t.Fatal("wire snapshot aliases the authoritative ritual")
				}
				w.RepairMu.RLock()
				ids := append([]string(nil), w.CrystalRepairs[id].WaveEnemyIDs...)
				w.RepairMu.RUnlock()
				if len(ids) != 4+event.Wave*2 {
					t.Fatal("worker did not create every expected attacker")
				}
				// Explicit server fixture clears the worker's real attacker set.
				// This is lifecycle proof, not earned player-combat acceptance.
				for _, enemyID := range ids {
					enemy := w.GetEntity(enemyID)
					enemy.Mu.Lock()
					enemy.Health, enemy.State = 0, "DEAD"
					enemy.Mu.Unlock()
				}
			case "wave_clear":
				if snapshot.Progress < event.Wave*33 {
					t.Fatalf("defeated wave was not represented: %+v", snapshot)
				}
			case "complete":
				if snapshot.Stage != "restored" || snapshot.Progress != 100 || snapshot.Wave != 3 {
					t.Fatalf("completed worker lost restoration: %+v", snapshot)
				}
				return
			}
		case <-time.After(5 * time.Second):
			t.Fatal("ritual worker stopped making progress")
		}
	}
}
