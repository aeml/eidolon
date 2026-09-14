package main

import (
	"bytes"
	"eidolon-server/internal/game"
	"sync"
	"testing"

	"google.golang.org/protobuf/proto"
)

func TestStateBatchParallelEncodingKeepsSharedSnapshotImmutable(t *testing.T) {
	w := game.NewWorld(nil)
	p := &game.Entity{ID: "owner", Type: game.TypePlayer, Health: 100,
		UnlockedSkills: []string{"Fireball"}, Equipment: map[string]game.Item{
			"mainHand": {ID: "staff", Stats: map[string]int{"damage": 7}}}}
	w.AddEntity(p)
	w.AddEntity(&game.Entity{ID: "observer", Type: game.TypePlayer})
	views := w.GetStatesForPlayers([]string{p.ID, "observer"}, 200)
	snapshot := views[p.ID][p.ID]
	if snapshot != views["observer"][p.ID] {
		t.Fatal("test requires shared snapshot")
	}
	before, err := proto.Marshal(entityToProto(snapshot))
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for reader := 0; reader < 8; reader++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 20; i++ {
				encoded, err := proto.Marshal(entityToProto(snapshot))
				if err != nil || !bytes.Equal(before, encoded) {
					t.Error("shared encoding changed snapshot")
				}
				if hasEntityChanged(snapshot, entityToSnapshot(snapshot)) {
					t.Error("static snapshot appears changed")
				}
			}
		}()
	}
	for i := 0; i < 20; i++ {
		p.Mu.Lock()
		p.Equipment["mainHand"].Stats["damage"] = i
		p.UnlockedSkills[0] = "Arcane Shield"
		p.Mu.Unlock()
	}
	wg.Wait()
}
