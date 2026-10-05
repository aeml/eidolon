package game

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"testing"
)

func TestPlayerBroadcastContextMatchesDetachedProgressAndScene(t *testing.T) {
	w := NewWorld(nil)
	defer w.StopBackground()
	player := &Entity{ID: "context-owner", Type: TypePlayer, X: 17, Z: 31, InstanceID: "raid-context",
		Level: MaxPlayerLevel, ResonanceLevel: 4, ResonanceXP: 53, ResonancePoints: 8,
		ResonanceRanks: map[string]int{"power": 2, "ward": -3, "fortune": MaxResonanceRank + 1, "private-rank": 123},
		Inventory:      []Item{{ID: "private-context-marker"}}, GoldCreditReceipts: map[string]int{"private-context-marker": 7}}
	w.AddEntity(player)
	context, present := w.GetPlayerBroadcastContext(player.ID)
	full := w.GetEntityCopy(player.ID)
	if !present || context.X != full.X || context.Z != full.Z || context.InstanceID != full.InstanceID || !reflect.DeepEqual(context.Progress, full.EndgameProgress()) {
		t.Fatal("lightweight read changed position, scene or normalized owner progress")
	}
	encoded, _ := json.Marshal(context)
	if strings.Contains(string(encoded), "private-context-marker") || strings.Contains(string(encoded), "private-rank") {
		t.Fatal("unneeded private data entered the frame context")
	}
	player.Mu.Lock()
	player.ResonanceRanks["power"] = 9
	player.X, player.Z, player.InstanceID = 55, 89, "dungeon-next"
	player.Mu.Unlock()
	if context.Progress.Ranks["power"] != 2 || context.X != 17 || context.InstanceID != "raid-context" {
		t.Fatal("frame context aliases live actor state")
	}
	next, _ := w.GetPlayerBroadcastContext(player.ID)
	if next.X != 55 || next.Z != 89 || next.InstanceID != "dungeon-next" || next.Progress.Ranks["power"] != 9 {
		t.Fatal("subsequent frame reused stale data")
	}
	w.AddEntity(&Entity{ID: "context-enemy", Type: TypeEnemy})
	for _, id := range []string{"missing-context", "context-enemy"} {
		if _, ok := w.GetPlayerBroadcastContext(id); ok {
			t.Fatal("nonplayer or missing actor was treated as a player context")
		}
	}
}

func TestPlayerBroadcastContextConcurrentChangesStayCoherent(t *testing.T) {
	w := NewWorld(nil)
	defer w.StopBackground()
	player := &Entity{ID: "concurrent-context", Type: TypePlayer, Level: MaxPlayerLevel, ResonanceRanks: map[string]int{"power": 0}}
	w.AddEntity(player)
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		for i := 0; i < 200; i++ {
			w.Mu.Lock()
			player.Mu.Lock()
			player.X, player.Z, player.ResonanceXP = float64(i), float64(i), i
			player.InstanceID = fmt.Sprintf("context-%d", i)
			player.ResonanceRanks["power"] = i % 10
			player.Mu.Unlock()
			w.Mu.Unlock()
		}
	}()
	for i := 0; i < 200; i++ {
		context, ok := w.GetPlayerBroadcastContext(player.ID)
		if !ok || context.X != context.Z || context.X != float64(context.Progress.XP) {
			t.Error("context fields were read from different actor mutations")
		}
		context.Progress.Ranks["power"] = 1234
	}
	workers.Wait()
	if player.ResonanceRanks["power"] == 1234 {
		t.Fatal("returned progress map aliases live data")
	}
}

func TestPlayerBroadcastContextAllocationsIgnorePrivateStorageGrowth(t *testing.T) {
	w := NewWorld(nil)
	defer w.StopBackground()
	player := &Entity{ID: "bounded-frame-context", Type: TypePlayer, Level: MaxPlayerLevel}
	w.AddEntity(player)
	read := func() { _, _ = w.GetPlayerBroadcastContext(player.ID) }
	empty := testing.AllocsPerRun(10, read)
	player.Inventory = make([]Item, 100)
	player.Stash = make([]Item, 400)
	player.GoldCreditReceipts = make(map[string]int, 1024)
	for i := range player.Inventory {
		player.Inventory[i].Stats = map[string]int{"strength": i}
	}
	for i := range player.Stash {
		player.Stash[i].Stats = map[string]int{"intelligence": i}
	}
	for i := 0; i < 1024; i++ {
		player.GoldCreditReceipts[fmt.Sprintf("receipt-%d", i)] = i
	}
	grown := testing.AllocsPerRun(10, read)
	if grown != empty {
		t.Fatalf("frame allocations grew with unneeded private data: empty=%g grown=%g", empty, grown)
	}
}

func BenchmarkPlayerBroadcastContext(b *testing.B) {
	w := NewWorld(nil)
	defer w.StopBackground()
	player := &Entity{ID: "frame-context-benchmark", Type: TypePlayer, Level: MaxPlayerLevel, ResonanceRanks: map[string]int{"power": 3},
		Inventory: make([]Item, 100), Stash: make([]Item, 400), GoldCreditReceipts: map[string]int{}}
	for i := range player.Inventory {
		player.Inventory[i] = Item{ID: fmt.Sprintf("bag-%d", i), Stats: map[string]int{"strength": i}}
	}
	for i := range player.Stash {
		player.Stash[i] = Item{ID: fmt.Sprintf("stash-%d", i), Stats: map[string]int{"intelligence": i}}
	}
	for i := 0; i < 1024; i++ {
		player.GoldCreditReceipts[fmt.Sprintf("receipt-%d", i)] = i
	}
	w.AddEntity(player)
	b.Run("full-character", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_ = w.GetEntityCopy(player.ID).EndgameProgress()
		}
	})
	b.Run("frame-context", func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			_, _ = w.GetPlayerBroadcastContext(player.ID)
		}
	})
}
