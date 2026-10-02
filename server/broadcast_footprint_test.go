package main

import (
	"math"
	"testing"

	"eidolon-server/internal/game"
)

func TestBroadcastFootprintUsesCircleAndRetainsDangerAtViewEdge(t *testing.T) {
	for _, kind := range []string{MsgTelegraph, MsgProjectileImpact} {
		for _, offset := range []float64{0, 300000} {
			message := BroadcastMessage{Type: kind, Footprint: BroadcastFootprint{Present: true, X: offset, Z: offset}}
			for _, tc := range []struct {
				name       string
				x, z, area float64
				want       bool
			}{
				{"center", 0, 0, 0, true}, {"boundary", 200, 0, 0, true},
				{"outside", 200.01, 0, 0, false}, {"square-corner", 150, 150, 0, false},
				{"visible-effect-edge", 212, 0, 12, true}, {"past-effect-edge", 212.01, 0, 12, false},
			} {
				message.Footprint.Radius = tc.area
				if got := broadcastFootprintVisible(message, offset+tc.x, offset+tc.z); got != tc.want {
					t.Fatalf("%s offset%v %s visible=%v, want%v", kind, offset, tc.name, got, tc.want)
				}
			}
		}
	}
}

func TestBroadcastFootprintInvalidOrMissingMetadataFailsClosed(t *testing.T) {
	for _, f := range []BroadcastFootprint{
		{}, {Present: true, X: math.NaN()}, {Present: true, Z: math.Inf(1)},
		{Present: true, Radius: -1}, {Present: true, Radius: math.Inf(1)},
		{Present: true, Radius: math.NaN()},
	} {
		if broadcastFootprintVisible(BroadcastMessage{Footprint: f}, 0, 0) {
			t.Fatalf("invalid footprint granted an audience: %+v", f)
		}
	}
	for _, value := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		message := BroadcastMessage{Footprint: BroadcastFootprint{Present: true}}
		if broadcastFootprintVisible(message, value, 0) || broadcastFootprintVisible(message, 0, value) {
			t.Fatal("invalid recipient origin granted an audience")
		}
	}
}

func TestBroadcastFootprintMatchesActorSnapshotViewCircle(t *testing.T) {
	w := &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	w.AddEntity(&game.Entity{ID: "viewer", Type: game.TypePlayer, X: 300000, Z: 300000, InstanceID: "dungeon_a"})
	for _, tc := range []struct {
		id, scene string
		x, z      float64
	}{
		{"near", "dungeon_a", 300100, 300000},
		{"boundary", "dungeon_a", 300200, 300000},
		{"far", "dungeon_a", 300201, 300000},
		{"corner", "dungeon_a", 300150, 300150},
		{"other-instance", "dungeon_b", 300000, 300000},
	} {
		w.AddEntity(&game.Entity{ID: tc.id, Type: game.TypeEnemy, X: tc.x, Z: tc.z, InstanceID: tc.scene})
		message := BroadcastMessage{Type: MsgProjectileImpact, InstanceID: tc.scene,
			Footprint: BroadcastFootprint{Present: true, X: tc.x, Z: tc.z}}
		x, z, scene, joined := w.GetPlayerViewPosition("viewer")
		got := joined && broadcastMatchesInstance(message, scene) && broadcastFootprintVisible(message, x, z)
		view := w.GetStateForPlayer("viewer", stateBroadcastRadius)
		if got != (view[tc.id] != nil) {
			t.Fatalf("%s: interest does not match actual world-state view", tc.id)
		}
	}
}

func TestTransientBroadcastOwnsCapturedFootprint(t *testing.T) {
	isolatedTransientQueues(t, 1, 1)
	warning, err := telegraphBroadcast(game.TelegraphEvent{X: 300000, Z: 300010, Radius: 12, InstanceID: "dungeon_a"})
	if err != nil || !enqueueTransientBroadcast(warning) {
		t.Fatalf("queue warning: %v", err)
	}
	expected := warning.Footprint
	warning.Footprint.X, warning.InstanceID = -999999, "other-instance"
	queued := <-encounterBroadcast
	if queued.Footprint != expected || queued.InstanceID != "dungeon_a" {
		t.Fatal("caller mutated already-queued routing metadata")
	}
}

func TestBroadcastDeliveryUsesCurrentRecipientPosition(t *testing.T) {
	previousWorld, previousClients := world, clients
	defer func() { world, clients = previousWorld, previousClients }()
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	client := newAutoStatusClient("moving-viewer")
	clients = map[*Client]bool{client: true}
	actor := &game.Entity{ID: client.playerID, Type: game.TypePlayer, InstanceID: "dungeon_a"}
	world.AddEntity(actor)
	warning, err := telegraphBroadcast(game.TelegraphEvent{InstanceID: actor.InstanceID, Radius: 12})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		x            float64
		scene        string
		disconnected bool
		want         int
	}{
		{0, "dungeon_a", false, 1}, {1000, "dungeon_a", false, 0},
		{0, "dungeon_b", false, 0}, {0, "dungeon_a", true, 0},
		{0, "dungeon_a", false, 1},
	} {
		actor.Mu.Lock()
		actor.X, actor.InstanceID, actor.Disconnected = tc.x, tc.scene, tc.disconnected
		actor.Mu.Unlock()
		deliverBroadcast(warning)
		if got := len(drainSentMessages(client.send)); got != tc.want {
			t.Fatalf("current recipient %+v got%d events, want%d", tc, got, tc.want)
		}
	}
}

func TestBroadcastDeliveryFiltersCapturedEffectsButKeepsSceneProgress(t *testing.T) {
	previousWorld, previousClients := world, clients
	defer func() { world, clients = previousWorld, previousClients }()
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	clients = make(map[*Client]bool)
	for _, scene := range []string{"", "dungeon_party_a"} {
		for _, tc := range []struct {
			id string
			x  float64
		}{
			{"near", 300000}, {"edge", 300210},
			{"far", 300250},
		} {
			id := tc.id + scene
			client := newAutoStatusClient(id)
			world.AddEntity(&game.Entity{ID: id, Type: game.TypePlayer, InstanceID: scene, X: tc.x, Z: 300000})
			clients[client] = true
		}
	}
	for _, scene := range []string{"", "dungeon_party_a"} {
		warning := game.TelegraphEvent{SourceID: "already-removed-boss", InstanceID: scene, X: 300000, Z: 300000, Radius: 12}
		telegraph, err := telegraphBroadcast(warning)
		if err != nil {
			t.Fatal(err)
		}
		impact := game.ProjectileImpactEvent{SourceID: "already-removed-caster", InstanceID: scene, X: warning.X, Z: warning.Z, Radius: 12}
		projectile := projectileImpactBroadcast(impact, createMessage(MsgProjectileImpact, []byte(`{}`)))
		// Creation-time metadata remains valid after source disappearance/movement;
		// adapters do not retain pointers into the caller's event.
		warning.X, impact.X = -999999, -999999
		for _, message := range []BroadcastMessage{telegraph, projectile} {
			deliverBroadcast(message)
			for client := range clients {
				actor := world.GetEntity(client.playerID)
				want := 0
				if actor.InstanceID == scene && actor.X <= 300212 {
					want = 1
				}
				if got := len(drainSentMessages(client.send)); got != want {
					t.Fatalf("%s: recipient%s got%d, want%d", message.Type, client.playerID, got, want)
				}
			}
			message.Footprint = BroadcastFootprint{}
			deliverBroadcast(message)
			for client := range clients {
				if len(drainSentMessages(client.send)) != 0 {
					t.Fatal("missing effect metadata failed open")
				}
			}
		}
		// Progress notices are instance-wide. Kill/XP/quest credit never enters
		// this effect filter, and far party members must still learn raid phase.
		for _, kind := range []string{"raid_phase", "crystal_repair"} {
			deliverBroadcast(BroadcastMessage{Type: kind, InstanceID: scene, Data: createMessage(kind, []byte(`{}`))})
			for client := range clients {
				want := 0
				if world.GetEntity(client.playerID).InstanceID == scene {
					want = 1
				}
				if got := len(drainSentMessages(client.send)); got != want {
					t.Fatalf("%s lost scene-wide progress for%s", kind, client.playerID)
				}
			}
		}
	}
}
