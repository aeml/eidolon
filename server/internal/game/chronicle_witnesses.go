package game

import (
	_ "embed"
	"encoding/json"
	"math"
)

//go:embed content/lanternhold-neighborhood.json
var lanternholdNeighborhoodJSON []byte

type townResidentRoute struct {
	ID     string       `json:"id"`
	Name   string       `json:"name"`
	Points [][2]float64 `json:"points"`
	Pause  float64      `json:"pause"`
}

var townResidentRoutes = func() map[string]townResidentRoute {
	var content struct {
		Routes []townResidentRoute `json:"routes"`
	}
	if err := json.Unmarshal(lanternholdNeighborhoodJSON, &content); err != nil || len(content.Routes) != 4 {
		panic("invalid Lanternhold resident routes")
	}
	routes := make(map[string]townResidentRoute, len(content.Routes))
	for _, route := range content.Routes {
		if len(route.Points) < 2 || route.Pause <= 0 {
			panic("invalid town resident route")
		}
		routes[route.ID] = route
	}
	return routes
}()

// Conversational residents retain their identity and saved dialogue rules.
// Only these four town residents walk; services/quest givers stay anchored.
func (w *World) spawnChronicleWitnesses() {
	for _, route := range townResidentRoutes {
		start := route.Points[0]
		w.AddEntity(&Entity{ID: route.ID, Name: route.Name, Type: TypeNPC, SubType: "ChronicleWitness",
			X: start[0], Y: 0.5, Z: start[1], SpawnX: start[0], SpawnZ: start[1], State: "IDLE", Scale: 1})
	}
}

func (w *World) updateTownResident(e *Entity, dt float64, players []*Entity) bool {
	if e.Type != TypeNPC || e.SubType != "ChronicleWitness" || e.InstanceID != "" {
		return false
	}
	route, exists := townResidentRoutes[e.ID]
	if !exists {
		return false
	}
	e.Mu.Lock()
	defer e.Mu.Unlock()
	// Stop for a nearby listener without introducing a new client command.
	for _, player := range players {
		player.Mu.RLock()
		near := player.InstanceID == "" && player.State != "DEAD" && !player.Disconnected &&
			math.Hypot(player.X-e.X, player.Z-e.Z) <= 6.5
		player.Mu.RUnlock()
		if near {
			e.State = "IDLE"
			return true
		}
	}
	e.townResidentClock += math.Min(dt, .1)
	a, b := route.Points[e.townResidentLeg], route.Points[(e.townResidentLeg+1)%len(route.Points)]
	// Cubic easing brings feet to rest at stops, with peak speed 1.6m/s.
	travel := math.Hypot(b[0]-a[0], b[1]-a[1]) * 1.5 / 1.6
	if e.townResidentClock >= route.Pause+travel {
		e.townResidentClock -= route.Pause + travel
		e.townResidentLeg = (e.townResidentLeg + 1) % len(route.Points)
		a, b = b, route.Points[(e.townResidentLeg+1)%len(route.Points)]
		travel = math.Hypot(b[0]-a[0], b[1]-a[1]) * 1.5 / 1.6
	}
	u := math.Max(0, math.Min(1, (e.townResidentClock-route.Pause)/travel))
	weight := u * u * (3 - 2*u)
	oldX, oldZ := e.X, e.Z
	e.X, e.Z = a[0]+(b[0]-a[0])*weight, a[1]+(b[1]-a[1])*weight
	e.State = "IDLE"
	if u > 0 && u < 1 {
		e.State = "MOVING"
		yaw := math.Atan2(b[0]-a[0], b[1]-a[1])
		delta := math.Atan2(math.Sin(yaw-e.Rotation), math.Cos(yaw-e.Rotation))
		e.Rotation += delta * (1 - math.Exp(-6*math.Min(dt, .1)))
	}
	w.Grid.Update(e, oldX, oldZ)
	return true
}
