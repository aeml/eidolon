package game

import (
	"testing"
	"time"
)

func TestPublicEventWaitsForItsPendingKillEffects(t *testing.T) {
	for _, champion := range []bool{false, true} {
		name := "wave"
		if champion {
			name = "champion"
		}
		t.Run(name, func(t *testing.T) {
			w, player, now := publicEventFixture(0)
			if champion {
				w.Mu.Lock()
				w.publicEvent.Wave = 3
				w.spawnPublicEventWaveLocked(w.publicEvent, 1)
				w.Mu.Unlock()
			}
			event := w.publicEvent
			event.Charge = event.ChargeNeeded
			pending := event.enemies[0]
			pending.Mu.Lock()
			w.beginDungeonCombatRewardLocked(pending)
			pending.Mu.Unlock()
			for _, enemy := range event.enemies {
				enemy.Health, enemy.State = 0, "DEAD"
				w.RemoveEntity(enemy.ID)
			}
			wave, phase := event.Wave, event.Phase
			w.UpdatePublicEvent(now.Add(time.Second))
			if event.Wave != wave || event.Phase != phase || !event.CalmedUntil.IsZero() {
				t.Fatal("encounter advanced before its removed corpse's kill effects finished")
			}
			w.endDungeonCombatReward(pending.ID)
			w.UpdatePublicEvent(now.Add(2 * time.Second))
			if champion {
				if event.Phase != "complete" || event.CalmedUntil.IsZero() {
					t.Fatal("finished champion effects did not complete the encounter")
				}
			} else if event.Wave != wave+1 {
				t.Fatal("finished wave effects did not advance the encounter")
			}
			if player.Gold != 100 {
				t.Fatal("event transition created an extra currency reward")
			}
		})
	}
}

func TestCrystalVigilWaitsForRemovedWaveEnemyKillEffects(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
	p := newTestPlayer("vigil-player", "Fighter")
	p.InstanceID, p.X, p.Z = "raid-pending-vigil", 0, 0
	w.AddEntity(p)
	state := &CrystalRepairState{InstanceID: p.InstanceID, Participants: []string{p.ID}}
	enemy := &Entity{ID: "removed-vigil-enemy", Type: TypeEnemy, InstanceID: p.InstanceID}
	w.beginDungeonCombatRewardLocked(enemy)
	players, defeated, contested := w.observeCrystalVigil(state, []string{enemy.ID})
	if len(players) != 1 || defeated || contested {
		t.Fatal("missing corpse bypassed unfinished wave effects")
	}
	w.endDungeonCombatReward(enemy.ID)
	_, defeated, _ = w.observeCrystalVigil(state, []string{enemy.ID})
	if !defeated {
		t.Fatal("finished wave effects remained reserved")
	}
}

func TestPublicEventUnrelatedPendingKillDoesNotBlockWave(t *testing.T) {
	w, _, now := publicEventFixture(0)
	event := w.publicEvent
	event.Charge = event.ChargeNeeded
	w.beginDungeonCombatRewardLocked(&Entity{ID: "other-event-enemy", Type: TypeEnemy, WorldEventID: "other-event"})
	for _, enemy := range event.enemies {
		enemy.Health, enemy.State = 0, "DEAD"
	}
	w.UpdatePublicEvent(now.Add(time.Second))
	if event.Wave != 2 {
		t.Fatal("unrelated encounter blocked this wave")
	}
	w.endDungeonCombatReward("other-event-enemy")
}

func TestPublicEventNonPlayerDeathReleasesKillReservation(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
	defer w.StopBackground()
	enemy := &Entity{ID: "event-environment-kill", Type: TypeEnemy, WorldEventID: "event", Health: 1, State: "IDLE"}
	w.AddEntity(enemy)
	enemy.Mu.Lock()
	w.handleDeath(enemy, nil, nil)
	enemy.Mu.Unlock()
	w.StopBackground()
	w.dungeonCombatRewardMu.Lock()
	defer w.dungeonCombatRewardMu.Unlock()
	if len(w.dungeonCombatRewards) != 0 {
		t.Fatal("nonplayer death leaked an encounter reservation")
	}
}

func TestCrystalVigilActualDeathWorkerFinishesCreditBeforeWave(t *testing.T) {
	w := newTestWorld()
	instance := &DungeonInstance{ID: "dungeon_pending_vigil", Difficulty: DifficultyNormal}
	w.storeDungeonInstance(instance.ID, instance)
	p := newTestPlayer("vigil-killer", "Fighter")
	p.InstanceID = instance.ID
	p.Quests = []Quest{{ID: "vigil-kills", Type: "KILL", Target: "Goblin", Accepted: true, MaxCount: 3}}
	w.AddEntity(p)
	enemy := &Entity{ID: "actual-vigil-death", Type: TypeEnemy, SubType: "Goblin", Level: 30, InstanceID: instance.ID, Health: 1, State: "IDLE"}
	w.AddEntity(enemy)
	state := &CrystalRepairState{InstanceID: instance.ID, Participants: []string{p.ID}, CenterX: p.X, CenterZ: p.Z}
	// Hold only the difficulty read, before the ordinary asynchronous worker
	// takes a recipient lock. The observer remains free to inspect the scene.
	instance.Mu.Lock()
	locked := true
	defer func() {
		if locked {
			instance.Mu.Unlock()
		}
		w.StopBackground()
	}()
	enemy.Mu.Lock()
	w.handleDeath(enemy, p, nil)
	enemy.Mu.Unlock()
	w.RemoveEntity(enemy.ID)
	_, defeated, _ := w.observeCrystalVigil(state, []string{enemy.ID})
	if defeated || p.Quests[0].Count != 0 {
		t.Fatal("actual corpse cleanup overtook its paused ordinary kill worker")
	}
	instance.Mu.Unlock()
	locked = false
	w.StopBackground()
	_, defeated, _ = w.observeCrystalVigil(state, []string{enemy.ID})
	if !defeated || p.Quests[0].Count != 1 || p.Quests[0].Completed || p.Experience == 0 || p.Gold == 0 {
		t.Fatal("finished ordinary death did not release the wave with earned manual-turn-in credit")
	}
}
