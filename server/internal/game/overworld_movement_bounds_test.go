package game

import (
	"math"
	"testing"
)

func TestOverworldMovementCannotJumpWalkOrBlinkOntoOcean(t *testing.T) {
	for _, point := range [][4]float64{{0, 995, 0, 1050}, {0, -2195, 0, -2250}, {-2995, 200, -3050, 200}, {2995, 200, 3050, 200}, {-1010, -595, -995, -610}, {1010, -595, 995, -610}} {
		t.Run("boundary", func(t *testing.T) {
			w := NewWorld(nil)
			p := newTestPlayer("shore", "Wizard")
			p.X, p.Z = point[0], point[1]
			w.AddEntity(p)
			if !w.StartPlayerJump(p.ID, point[2], 0, point[3]) {
				t.Fatal("clipped jump should start")
			}
			for i := 0; i <= 100; i++ {
				x := p.JumpStartX + (p.JumpTargetX-p.JumpStartX)*float64(i)/100
				z := p.JumpStartZ + (p.JumpTargetZ-p.JumpStartZ)*float64(i)/100
				cx, cz, _ := constrainPointToWalkRects(overworldWalkRects, x, z)
				if math.Hypot(cx-x, cz-z) > 1e-8 {
					t.Fatalf("flight crossed ocean: %v %v", x, z)
				}
			}
			wantX, wantZ := p.JumpTargetX, p.JumpTargetZ
			if math.Hypot(wantX-point[2], wantZ-point[3]) < .01 {
				t.Fatal("ocean destination accepted")
			}
			p.State, p.X, p.Z = "IDLE", point[0], point[1]
			if !w.UpdatePlayerMovement(p.ID, point[2], 0, point[3], 0, "MOVING", 1) || math.Hypot(p.X-wantX, p.Z-wantZ) > .00001 {
				t.Fatal("walk does not match jump boundary")
			}
			p.X, p.Z = point[0], point[1]
			p.Mana = 10000
			p.Level = 50
			p.UnlockedSkills = []string{"Teleport"}
			dx, dz := point[2]-p.X, point[3]-p.Z
			distance := math.Hypot(dx, dz)
			tx, tz := p.X+dx/distance*12, p.Z+dz/distance*12
			result := w.PerformAbility(p.ID, tx, tz, "", "Teleport")
			if !result.Accepted {
				t.Fatalf("bounded teleport rejected: %+v", result)
			}
			cx, cz, _ := constrainPointToWalkRects(overworldWalkRects, p.X, p.Z)
			if cx != p.X || cz != p.Z {
				t.Fatal("teleport escaped onto ocean")
			}
		})
	}
}

func TestOverworldBoundsKeepGatewaysAndRecoverSavedOceanPositions(t *testing.T) {
	for _, p := range [][4]float64{{0, -590, 0, -610}, {-990, 200, -1010, 200}, {990, 200, 1010, 200}, {0, 200, 20, 220}} {
		x, z := constrainOverworldMovement(p[0], p[1], p[2], p[3])
		if x != p[2] || z != p[3] {
			t.Fatal("gateway blocked")
		}
	}
	w := NewWorld(nil)
	p := newTestPlayer("stranded", "Fighter")
	p.X, p.Z, p.Y = 3050, 200, 15
	w.AddEntity(p)
	if p.X != 2997.5 || p.Z != 200 || p.Y != 0 {
		t.Fatalf("saved ocean position not recovered: %+v", p)
	}
	p2 := newTestPlayer("instance", "Fighter")
	p2.InstanceID = "dungeon_test"
	p2.X, p2.Z = 50000, 50000
	w.AddEntity(p2)
	if p2.X != 50000 || p2.Z != 50000 {
		t.Fatal("instance incorrectly recovered to overworld")
	}
}

func TestOverworldNetworkCommandsAcknowledgeShoreClampWithoutAirborneFloor(t *testing.T) {
	w, p, now := movementBudgetWorld()
	p.X, p.Z = 2999, 200
	if !w.updatePlayerMovementAt(p.ID, 3008, 900, 200, 0, "MOVING", 1, &p.MovementContext, now) {
		t.Fatal("clipped walking sample rejected")
	}
	if p.X != 2999.95 || p.Y != 0 || p.LastMoveSequence != 1 {
		t.Fatalf("invalid canonical correction: x=%v y=%v ack=%v", p.X, p.Y, p.LastMoveSequence)
	}
	p.State = "IDLE"
	if !w.StartPlayerJumpWithContext(p.ID, 3040, 900, 200, p.MovementContext) {
		t.Fatal("clipped network jump rejected")
	}
	if p.JumpTargetX > 3000 || p.JumpTargetY != 0 {
		t.Fatal("network jump escaped or accepted supplied height")
	}
}
