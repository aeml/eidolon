package game

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"testing"
)

// Lock down the shipped fence positions, corner rotations and stable IDs before
// sharing their geography with the atlas. This is not a world-layout migration.
func TestWorldGeographyPreservesFences(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
	w.spawnFence()
	lines := make([]string, 0, len(w.Entities))
	for _, e := range w.Entities {
		lines = append(lines, fmt.Sprintf("%s|%s|%.6f|%.6f|%.6f|%.6f|%s|%.6f", e.ID, e.Type, e.X, e.Y, e.Z, e.Rotation, e.State, e.Scale))
	}
	sort.Strings(lines)
	digest := fmt.Sprintf("%x", sha256.Sum256([]byte(strings.Join(lines, "\n"))))
	if len(lines) != 6050 || digest != "5d183a49d0c00834516876e6eec553ae90111b9a27c9b463d98d3a06c45fc7f6" {
		t.Fatalf("shipped fence layout changed: fences=%d digest=%s", len(lines), digest)
	}
}

func TestWorldGeographyValidation(t *testing.T) {
	for name, mutate := range map[string]func(*worldGeographyDefinition){
		"zero step":        func(g *worldGeographyDefinition) { g.FenceStep = 0 },
		"nan step":         func(g *worldGeographyDefinition) { g.FenceStep = math.NaN() },
		"missing region":   func(g *worldGeographyDefinition) { g.Regions = g.Regions[:4] },
		"duplicate region": func(g *worldGeographyDefinition) { g.Regions[1].ID = "earth" },
		"inverted bounds":  func(g *worldGeographyDefinition) { g.Regions[0].MinX = g.Regions[0].MaxX },
		"infinite bounds":  func(g *worldGeographyDefinition) { g.Regions[0].MaxZ = math.Inf(1) },
		"unknown wall":     func(g *worldGeographyDefinition) { g.Regions[0].Walls[0].Side = "up" },
		"duplicate wall":   func(g *worldGeographyDefinition) { g.Regions[0].Walls[1].Side = "north" },
		"empty gap":        func(g *worldGeographyDefinition) { g.Regions[0].Walls[0].Gap = []float64{} },
		"short gap":        func(g *worldGeographyDefinition) { g.Regions[0].Walls[0].Gap = []float64{0} },
		"outside gap":      func(g *worldGeographyDefinition) { g.Regions[0].Walls[0].Gap = []float64{-2000, 20} },
		"inverted gap":     func(g *worldGeographyDefinition) { g.Regions[0].Walls[0].Gap = []float64{20, -20} },
	} {
		t.Run(name, func(t *testing.T) {
			var g worldGeographyDefinition
			if err := json.Unmarshal(worldGeographyJSON, &g); err != nil {
				t.Fatal(err)
			}
			mutate(&g)
			if validateWorldGeography(g) == nil {
				t.Fatal("accepted invalid geography")
			}
		})
	}
}

func TestWorldGeographyTownSafetyMatchesBounds(t *testing.T) {
	w := &World{}
	for _, p := range [][2]float64{{-100, 100}, {100, 100}, {-100, 300}, {100, 300}, {0, 200}} {
		if w.SafeZoneAt("", p[0], p[1]) != "lanternhold" {
			t.Fatalf("unsafe town point %v", p)
		}
		if w.SafeZoneAt("private-dungeon", p[0], p[1]) != "" {
			t.Fatal("overworld safety leaked into dungeon")
		}
	}
	for _, p := range [][2]float64{{-100.01, 200}, {100.01, 200}, {0, 99.99}, {0, 300.01}} {
		if w.SafeZoneAt("", p[0], p[1]) != "" {
			t.Fatalf("safe outside town: %v", p)
		}
	}
}
