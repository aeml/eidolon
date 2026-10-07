package main

import (
	"flag"
	"math"
	"os"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func TestServerDefaultUsesNegotiatedRaisedTerrainWithoutQA(t *testing.T) {
	if flag.Lookup("terrain-profile").DefValue != "earth-elevation-rocks-v1" {
		t.Fatal("ordinary startup still selects the old flat profile")
	}
	w, err := newServerWorld(nil, defaultTerrainProfile, false, false)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if w.TerrainProfile() != "earth-elevation-rocks-v1" {
		t.Fatal("normal server does not advertise the shared raised/rock profile")
	}
	// A legacy save has zero Y. AddEntity must ground it using the negotiated
	// field without replacing its resources or personal progression.
	player := &game.Entity{ID: "terrain-legacy-player", Type: game.TypePlayer,
		X: -570, Y: 0, Z: 410, Health: 37, MaxHealth: 100, Mana: 12, MaxMana: 100,
		Level: 30, Gold: 4321, Experience: 123, State: "IDLE", Radius: 1.25}
	w.AddEntity(player)
	if math.Abs(player.Y-17.926154819938848) > 1e-9 || player.X != -570 || player.Z != 410 ||
		player.Health != 37 || player.Mana != 12 || player.Level != 30 || player.Gold != 4321 || player.Experience != 123 {
		t.Fatal("normal terrain changed saved progress/resources or failed to ground the player")
	}
	for _, tc := range []struct {
		id, instance string
		x, z, y      float64
	}{
		{"town", "", -1.25, 200, 0},
		{"dungeon", "dungeon_existing", -570, 410, 4},
		{"vip", "casino_vip", -570, 410, 8},
		{"water", "", 0, -1400, 0},
		{"fire", "", -2000, 200, 0},
		{"air", "", 2000, 200, 0},
	} {
		actor := &game.Entity{ID: tc.id, Type: game.TypePlayer, InstanceID: tc.instance,
			X: tc.x, Z: tc.z, Y: tc.y, Health: 100, State: "IDLE", Radius: 1.25}
		w.AddEntity(actor)
		if actor.X != tc.x || actor.Z != tc.z || actor.Y != tc.y {
			t.Fatalf("terrain promotion changed %s floor/position", tc.id)
		}
	}
}

func TestServerFlatTerrainRollbackRetainsLegacyCoordinates(t *testing.T) {
	w, err := newServerWorld(nil, "flat-v1", false, false)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	player := &game.Entity{ID: "flat-legacy", Type: game.TypePlayer, X: -570, Z: 410, Y: 0, Health: 37, State: "IDLE"}
	w.AddEntity(player)
	if w.TerrainProfile() != "flat-v1" || player.X != -570 || player.Z != 410 || player.Y != 0 || player.Health != 37 {
		t.Fatal("flat operator rollback rewrote coordinates or resources")
	}
}

func TestServerTerrainQAStillRequiresExplicitAllowlist(t *testing.T) {
	if w, err := newServerWorld(nil, "flat-v1", true, false); err == nil || w != nil {
		t.Fatal("terrain QA bypassed its explicit account allowlist")
	}
	w, err := newServerWorld(nil, "flat-v1", true, true)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if w.TerrainProfile() != "earth-elevation-rocks-v1" {
		t.Fatal("explicit legacy QA option no longer selects its prepared profile")
	}
}

func TestServerTerrainRejectsUnknownProfilesInsteadOfSilentFlatFallback(t *testing.T) {
	for _, profile := range []string{"", "earth-elevation-v2", "arbitrary", "earth-elevation-v1"} {
		if w, err := newServerWorld(nil, profile, false, false); err == nil || w != nil {
			t.Fatal("unknown startup profile silently changed world geometry")
		}
	}
}

func TestServerTerrainDeploymentDefaultAndRollbackMatchStartup(t *testing.T) {
	compose, err := os.ReadFile("docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(compose), "--terrain-profile=${EIDOLON_TERRAIN_PROFILE:-"+defaultTerrainProfile+"}") {
		t.Fatal("deployment cannot retain startup default and explicit terrain rollback")
	}
	template, err := os.ReadFile(".env.example")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(template), "EIDOLON_TERRAIN_PROFILE="+defaultTerrainProfile) {
		t.Fatal("operator template disagrees with negotiated production terrain")
	}
}
