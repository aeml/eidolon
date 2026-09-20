package game

import (
	"math"
	"testing"
)

func TestCrystalRepairStaysAtCrystalAfterGuardianDiesNearChamberEdge(t *testing.T) {
	for raidType, definition := range elementalRaidDefinitions {
		t.Run(raidType, func(t *testing.T) {
			w := NewWorld(nil)
			t.Cleanup(w.StopBackground)
			id := w.CreateDungeon("party-hero", raidType, DifficultyNormal, definition.RequiredLevel)
			layout, _ := w.GetInstanceLayout(id)
			chamber := layout.Rooms[len(layout.Rooms)-1]
			// A legitimate kill near the east wall must not move the fixed
			// crystal's ritual, Maelin, or the surrounding wave spawn ring.
			deathX, deathZ := chamber.X+chamber.Width/2-5, chamber.Z
			if !w.StartCrystalRepair(id, raidType, []string{"hero"}, deathX, deathZ) {
				t.Fatal("repair did not start")
			}
			w.RepairMu.RLock()
			state := w.CrystalRepairs[id]
			cx, cz := state.CenterX, state.CenterZ
			w.RepairMu.RUnlock()
			if cx != chamber.X || cz != chamber.Z {
				t.Fatalf("repair followed guardian corpse (%v,%v), not crystal (%v,%v)", cx, cz, chamber.X, chamber.Z)
			}
			maelin := w.GetEntity(state.NPCID)
			if maelin == nil || maelin.X != cx || maelin.Z != cz {
				t.Fatal("Maelin is not repairing the fixed crystal")
			}
			inside := func(x, z, radius float64) bool {
				return math.Abs(x-chamber.X)+radius < chamber.Width/2 &&
					math.Abs(z-chamber.Z)+radius < chamber.Height/2
			}
			for index := 0; index < 4; index++ {
				point := state.vigilPoint(index)
				if !inside(point.X, point.Z, point.Radius) {
					t.Fatalf("ritual point outside chamber: %+v", point)
				}
			}
			for wave := 1; wave <= 3; wave++ {
				for index := 0; index < 12; index++ {
					x, z := elementalRaidWavePosition(cx, cz, wave, index, 12)
					if !inside(x, z, 5) {
						t.Fatalf("wave %d spawn outside chamber: %v,%v", wave, x, z)
					}
				}
			}
		})
	}
}
