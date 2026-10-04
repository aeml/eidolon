package main

import (
	"fmt"
	"sync"
	"testing"

	"eidolon-server/internal/game"
)

func setupSlotCacheTest(t *testing.T) {
	t.Helper()
	oldWorld, oldCache, oldPending := world, slotsCache, slotsPending
	t.Cleanup(func() { world, slotsCache, slotsPending = oldWorld, oldCache, oldPending })
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
}

func TestSlotCacheOnlyKeepsHeldSeatsAndNeverDropsPendingRecovery(t *testing.T) {
	setupSlotCacheTest(t)
	for i := 0; i < 1000; i++ {
		owner := fmt.Sprintf("player-offline-%d", i)
		state := preparedWinningSlot(t, owner)
		state.Owed, state.Payment = 0, ""
		key := slotRecordKey(owner, "earth")
		markSlotPending(key, owner)
		if len(slotsCache) != 0 {
			t.Fatal("offline pending record allocated presentation")
		}
		cacheSettledSlot(key, state)
	}
	if len(slotsCache) != 0 || len(slotsPending) != 0 {
		t.Fatal("historical sessions retained presentation or stale recovery")
	}
	owner := "player-seated"
	p := &game.Entity{ID: owner, Name: "seated", Type: game.TypePlayer, InstanceID: game.CasinoInstanceID, CasinoSeat: &game.CasinoSeatSession{TableID: "public-slots-earth"}}
	world.Entities[owner] = p
	state := preparedWinningSlot(t, owner)
	state.Owed, state.Payment = 0, ""
	key := slotRecordKey(owner, "earth")
	cacheSettledSlot(key, state)
	if len(slotsCache) != 1 {
		t.Fatal("held machine was not cached")
	}
	p.Disconnected = true
	pruneUnseatedSlotCache()
	if len(slotsCache) != 1 {
		t.Fatal("resume-window held seat lost presentation")
	}
	markSlotPending(key, owner)
	p.CasinoSeat = nil
	pruneUnseatedSlotCache()
	if len(slotsCache) != 0 || slotsPending[key] != "seated" {
		t.Fatal("cache pruning discarded a durable pending settlement")
	}
	// Reseating recreates only presentation; recovery remains authoritative.
	p.CasinoSeat = &game.CasinoSeatSession{TableID: "public-slots-earth"}
	cacheSettledSlot(key, state)
	world.Entities = map[string]*game.Entity{}
	pruneUnseatedSlotCache()
	if len(slotsCache) != 0 {
		t.Fatal("expired character retained presentation")
	}
}

func TestSlotCacheConcurrentPruningAndReseatingUsesConsistentLockOrder(t *testing.T) {
	setupSlotCacheTest(t)
	owner := "player-seated"
	p := &game.Entity{ID: owner, Name: "seated", Type: game.TypePlayer, InstanceID: game.CasinoInstanceID}
	world.Entities[owner] = p
	state := preparedWinningSlot(t, owner)
	state.Owed, state.Payment = 0, ""
	key := slotRecordKey(owner, "earth")
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			world.Mu.Lock()
			p.Mu.Lock()
			p.CasinoSeat = &game.CasinoSeatSession{TableID: "public-slots-earth"}
			p.Mu.Unlock()
			world.Mu.Unlock()
			cacheSettledSlot(key, state)
			world.Mu.Lock()
			p.Mu.Lock()
			p.CasinoSeat = nil
			p.Mu.Unlock()
			world.Mu.Unlock()
		}
	}()
	for i := 0; i < 200; i++ {
		pruneUnseatedSlotCache()
	}
	wg.Wait()
	p.CasinoSeat = &game.CasinoSeatSession{TableID: "public-slots-earth"}
	cacheSettledSlot(key, state)
	pruneUnseatedSlotCache()
	if len(slotsCache) != 1 {
		t.Fatal("completed same-key reseat was pruned")
	}
}
