package game

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"eidolon-server/internal/database"
)

//go:embed content/admin-landing-colliders.json
var adminLandingGeometryJSON []byte

type adminLandingShapes struct {
	Boxes   [][7]float64 `json:"boxes"`
	Circles [][3]float64 `json:"circles"`
}
type adminLandingGeometry struct {
	Version   int                   `json:"version"`
	Overworld adminLandingShapes    `json:"overworld"`
	Casino    adminLandingShapes    `json:"casino"`
	Entities  map[string][7]float64 `json:"entities"`
	Furniture map[string][7]float64 `json:"furniture"`
}

var adminLandingColliders = func() adminLandingGeometry {
	var data adminLandingGeometry
	if err := json.Unmarshal(adminLandingGeometryJSON, &data); err != nil || data.Version != 1 || len(data.Overworld.Boxes) == 0 || len(data.Entities) != 3 {
		panic("invalid canonical administration landing geometry")
	}
	return data
}()

const adminLandingRadius = 1.3 // Player capsule plus rounding/edge clearance.
var ErrAdminTeleportRejected = errors.New("administration teleport rejected")

// A private server-planned landing, never coordinates accepted from a client.
// Both endpoints and membership are checked again after the intent is durable.
type AdminTeleportPlan struct {
	SourceInstance string  `json:"sourceInstance"`
	SourceVIP      bool    `json:"sourceVIP"`
	Instance       string  `json:"instance"`
	VIP            bool    `json:"vip"`
	X              float64 `json:"x"`
	Y              float64 `json:"y"`
	Z              float64 `json:"z"`
	AnchorPlayer   string  `json:"anchorPlayer,omitempty"`
	AnchorX        float64 `json:"anchorX,omitempty"`
	AnchorZ        float64 `json:"anchorZ,omitempty"`
}

func adminBoxBlocks(box [7]float64, x, y, z, radius float64) bool {
	if y > box[6]+radius || y < box[5]-radius {
		return false
	}
	dx, dz := x-box[0], z-box[1]
	c, s := math.Cos(box[4]), math.Sin(box[4])
	lx, lz := c*dx-s*dz, s*dx+c*dz
	lx -= math.Max(-box[2], math.Min(box[2], lx))
	lz -= math.Max(-box[3], math.Min(box[3], lz))
	return lx*lx+lz*lz < radius*radius
}

func adminShapesClear(shapes adminLandingShapes, x, y, z float64) bool {
	for _, box := range shapes.Boxes {
		if adminBoxBlocks(box, x, y, z, adminLandingRadius) {
			return false
		}
	}
	for _, circle := range shapes.Circles {
		if math.Hypot(x-circle[0], z-circle[1]) < circle[2]+adminLandingRadius {
			return false
		}
	}
	return true
}

// World lock held; no entity lock held. Uses actual static client footprints,
// canonical dungeon floors, server-owned venue boundaries and live occupancy.
func (w *World) adminLandingClearLocked(plan AdminTeleportPlan, playerID string) bool {
	if !finiteCoordinate(plan.X) || !finiteCoordinate(plan.Y) || !finiteCoordinate(plan.Z) {
		return false
	}
	x, y, z, r := plan.X, plan.Y, plan.Z, adminLandingRadius
	switch {
	case plan.Instance == "":
		if y != 0 || plan.VIP || z < -2200+r || z > 1000-r || math.Abs(x) > 3000-r || z < -600 && math.Abs(x) > 1000-r {
			return false
		}
		if !adminShapesClear(adminLandingColliders.Overworld, x, y, z) {
			return false
		}
	case plan.Instance == CasinoInstanceID:
		if plan.VIP {
			if y != 8 || math.Abs(x) > 32-r || z < 130+r || z > 201-r || z > 141-r && math.Abs(x) < 26+r {
				return false
			}
		} else if y != 0 || math.Abs(x) > 33-r || z < 130+r || z > 203-r || math.Abs(x) < 6+r && z < 148+r {
			return false
		}
		if !adminShapesClear(adminLandingColliders.Casino, x, y, z) {
			return false
		}
		for _, table := range CasinoTables() {
			shape, exists := adminLandingColliders.Furniture[table.Game]
			if !exists {
				return false
			}
			shape[0], shape[1] = table.X, table.Z
			shape[5], shape[6] = shape[5]+table.Y, shape[6]+table.Y
			if adminBoxBlocks(shape, x, y, z, r) {
				return false
			}
		}
	case w.isDungeonInstance(plan.Instance):
		if y != 0 || plan.VIP {
			return false
		}
		inside := false
		for _, rect := range w.dungeonWalkRectsSnapshot(plan.Instance) {
			if x >= rect.X-rect.Width/2+r && x <= rect.X+rect.Width/2-r && z >= rect.Z-rect.Height/2+r && z <= rect.Z+rect.Height/2-r {
				inside = true
				break
			}
		}
		if !inside {
			return false
		}
	default:
		return false // Unknown/private PvP scenes are never generic destinations.
	}
	for _, entity := range w.Grid.Nearby(x, z, 64, plan.Instance) {
		if entity.ID == playerID {
			continue
		}
		entity.Mu.RLock()
		blocked := false
		if shape, exists := adminLandingColliders.Entities[string(entity.Type)]; exists {
			shape[0], shape[1], shape[4] = entity.X, entity.Z, entity.Rotation
			shape[5], shape[6] = shape[5]+entity.Y, shape[6]+entity.Y
			blocked = adminBoxBlocks(shape, x, y, z, r)
		} else if (entity.Type == TypePlayer || entity.Type == TypeEnemy || entity.Type == TypeNPC) && entity.Health > 0 && entity.State != "DEAD" && math.Abs(entity.Y-y) < 3 {
			blocked = math.Hypot(x-entity.X, z-entity.Z) < r+math.Max(1, entity.ReplicatedBodyRadius())
		}
		entity.Mu.RUnlock()
		if blocked {
			return false
		}
	}
	return true
}

func (w *World) adminTeleportReadyLocked(player *Entity) bool {
	return player != nil && player.Type == TypePlayer && !player.Disconnected && player.Health > 0 &&
		(player.State == "IDLE" || player.State == "MOVING") && !player.IsCharging && !player.Stunned && !player.Rooted &&
		player.CasinoSeat == nil && w.TradeByPlayer[player.ID] == "" && !w.HasPvPMatch(player.ID)
}

// Actor/target/destination account work locks must already be held by the server.
func (w *World) PlanAdminTeleport(playerID, destination, anchorID string) (AdminTeleportPlan, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	var plan AdminTeleportPlan
	player := w.Entities[playerID]
	if player == nil {
		return plan, fmt.Errorf("%w: recipient is offline", ErrAdminTeleportRejected)
	}
	player.Mu.RLock()
	ready := w.adminTeleportReadyLocked(player)
	plan.SourceInstance, plan.SourceVIP = player.InstanceID, player.CasinoVIPFloor
	partyID, vipUntil := player.PartyID, player.VIPUntil
	player.Mu.RUnlock()
	if !ready {
		return plan, fmt.Errorf("%w: finish combat, trading or seating first", ErrAdminTeleportRejected)
	}
	x, z := -1.25, 200.0
	if destination == "player" {
		anchor := w.Entities[anchorID]
		if anchor == nil || anchor == player {
			return plan, fmt.Errorf("%w: destination player unavailable", ErrAdminTeleportRejected)
		}
		anchor.Mu.RLock()
		ready = w.adminTeleportReadyLocked(anchor)
		plan.Instance, plan.VIP, plan.Y = anchor.InstanceID, anchor.CasinoVIPFloor, 0
		x, z = anchor.X, anchor.Z
		anchorParty := anchor.PartyID
		anchor.Mu.RUnlock()
		if !ready || !finiteCoordinate(x) || !finiteCoordinate(z) {
			return plan, fmt.Errorf("%w: destination player is unavailable or busy", ErrAdminTeleportRejected)
		}
		if plan.Instance != "" && plan.Instance != CasinoInstanceID && (plan.Instance != plan.SourceInstance || partyID == "" || partyID != anchorParty) {
			return plan, fmt.Errorf("%w: enter the same party instance normally first", ErrAdminTeleportRejected)
		}
		if plan.VIP {
			if !time.Now().Before(vipUntil) || plan.SourceInstance != CasinoInstanceID || !plan.SourceVIP {
				return plan, fmt.Errorf("%w: use the VIP guard before teleporting upstairs", ErrAdminTeleportRejected)
			}
			plan.Y = 8
		}
		plan.AnchorPlayer, plan.AnchorX, plan.AnchorZ = anchorID, x, z
	} else if destination != "town" || anchorID != "" {
		return plan, fmt.Errorf("%w: unknown approved destination", ErrAdminTeleportRejected)
	}
	// Prefer a nearby free capsule, not the occupied destination player's centre.
	for _, radius := range []float64{0, 3, 5, 7} {
		for step := 0; step < 16; step++ {
			if radius == 0 && (step > 0 || plan.AnchorPlayer != "") {
				continue
			}
			angle := float64(step) * math.Pi / 8
			plan.X, plan.Z = x+math.Cos(angle)*radius, z+math.Sin(angle)*radius
			if w.adminLandingClearLocked(plan, playerID) {
				return plan, nil
			}
		}
	}
	return plan, fmt.Errorf("%w: no clear landing near the destination", ErrAdminTeleportRejected)
}

// Retry checks the receipt before movement/state checks; a saved teleport must
// not happen again after the player has moved away, died or re-entered a scene.
func (w *World) ApplyDurableAdminTeleport(playerID, id, fingerprint string, plan AdminTeleportPlan) (found, changed bool, err error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, false, nil
	}
	player.Mu.RLock()
	replayed, err := database.AdminOperationApplied(player.AdminOperationReceipts, id, fingerprint)
	ready := w.adminTeleportReadyLocked(player) && player.InstanceID == plan.SourceInstance && player.CasinoVIPFloor == plan.SourceVIP
	partyID, vipUntil := player.PartyID, player.VIPUntil
	player.Mu.RUnlock()
	if err != nil || replayed {
		return true, false, err
	}
	if !ready || plan.VIP && (!plan.SourceVIP || !time.Now().Before(vipUntil)) {
		return true, false, fmt.Errorf("%w: recipient state changed", ErrAdminTeleportRejected)
	}
	if plan.AnchorPlayer != "" {
		anchor := w.Entities[plan.AnchorPlayer]
		if anchor == nil || anchor == player {
			return true, false, fmt.Errorf("%w: destination player left", ErrAdminTeleportRejected)
		}
		anchor.Mu.RLock()
		valid := w.adminTeleportReadyLocked(anchor) && anchor.InstanceID == plan.Instance && anchor.CasinoVIPFloor == plan.VIP &&
			math.Hypot(anchor.X-plan.AnchorX, anchor.Z-plan.AnchorZ) <= 1 &&
			(plan.Instance == "" || plan.Instance == CasinoInstanceID || plan.Instance == plan.SourceInstance && partyID != "" && partyID == anchor.PartyID)
		anchor.Mu.RUnlock()
		if !valid || math.Hypot(plan.X-plan.AnchorX, plan.Z-plan.AnchorZ) > 7.01 {
			return true, false, fmt.Errorf("%w: destination player or instance changed", ErrAdminTeleportRejected)
		}
	} else if plan.Instance != "" || plan.VIP || math.Hypot(plan.X+1.25, plan.Z-200) > 7.01 {
		return true, false, fmt.Errorf("%w: invalid approved destination", ErrAdminTeleportRejected)
	}
	if !w.adminLandingClearLocked(plan, playerID) {
		return true, false, fmt.Errorf("%w: landing is obstructed", ErrAdminTeleportRejected)
	}
	player.Mu.Lock()
	oldInstance := player.InstanceID
	w.Grid.Remove(player)
	player.InstanceID, player.X, player.Z = plan.Instance, plan.X, plan.Z
	resetSceneMovementLocked(player)
	player.Y, player.CasinoVIPFloor = plan.Y, plan.VIP
	player.TargetX, player.TargetZ = plan.X, plan.Z
	setRecoveryMovementContextLocked(player, id[:54])
	delete(w.PlayerHazardTicks, playerID)
	if player.AdminOperationReceipts == nil {
		player.AdminOperationReceipts = make(map[string]string)
	}
	player.AdminOperationReceipts[id] = fingerprint
	player.UnjournaledSave = true
	w.Grid.Add(player)
	player.Mu.Unlock()
	if oldInstance != plan.Instance && w.isDungeonInstance(oldInstance) {
		w.checkAndResetDungeonLocked(oldInstance)
	}
	return true, true, nil
}
