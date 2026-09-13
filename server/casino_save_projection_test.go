package main

import (
	"eidolon-server/internal/game"
	"testing"
	"time"
)

func TestCasinoSaveProjectsWalkableExitWithoutRestoringResources(t *testing.T) {
	w := &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	table := game.CasinoTables()[0]
	position := table.Seats[0]
	p := &game.Entity{ID: "casino-save", Type: game.TypePlayer, InstanceID: game.CasinoInstanceID, State: "IDLE", X: position.ExitX, Z: position.ExitZ, Health: 37, MaxHealth: 100, Mana: 11, MaxMana: 50, WellRestedSeconds: 23}
	w.AddEntity(p)
	if _, err := w.TakeCasinoSeat(p.ID, table.ID, 0, time.Now()); err != nil {
		t.Fatal(err)
	}
	snapshot := w.GetEntityCopy(p.ID)
	char := characterSnapshot("casino-save", snapshot, time.Now())
	if char.X != position.ExitX || char.Z != position.ExitZ || char.Y != 0 || char.InstanceID != game.CasinoInstanceID {
		t.Fatal("saved chair coordinate")
	}
	if char.Resources.Health != 37 || char.Resources.Mana != 11 || char.Resources.Dead || char.WellRested.RemainingSeconds != 23 {
		t.Fatal("seat save changed resources")
	}
	if p.CasinoSeat == nil || p.X != position.X {
		t.Fatal("save projection mutated live seat")
	}
}
