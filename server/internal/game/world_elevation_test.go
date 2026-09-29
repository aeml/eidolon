package game

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"math"
	"testing"
)

func TestWorldElevationCandidateMatchesClientSurface(t *testing.T) {
	f, err := readWorldElevationCandidate()
	if err != nil {
		t.Fatal(err)
	}
	if f.Columns != 125 || f.Rows != 100 || f.MaxGrade > .35 || f.MaxHeight > 20 {
		t.Fatalf("unexpected field dimensions or bounds: %+v", f)
	}
	// Same approved millimeter-quantized vertex digest asserted in JS. Changes
	// must regenerate/review the surface, not silently move server-only ground.
	bytes := make([]byte, len(f.heights)*4)
	for i, height := range f.heights {
		binary.LittleEndian.PutUint32(bytes[i*4:], uint32(math.Round(height*1000)))
	}
	digest := sha256.Sum256(bytes)
	if hex.EncodeToString(digest[:]) != "448de4a61b7baf8c285d8a0d1f8b698b952bb9222f2a89cfc75ea5981da7d897" {
		t.Fatal("server/client elevation vertices differ")
	}
	for _, sample := range [][3]float64{
		{-570, 410, 17.926154819938848}, {-567, 417, 17.867446921287307},
		{110, -330, 14.81358923262669}, {-92, -255, 7.0707241806080905},
		{645, 98, 14.78942771267534}, {0, 200, 0},
		{700, 108, 7.691252208040936}, {-333.3, -271.2, 11.013476398978918},
		{340, 159, 7.717347640109187}, {340, 200, 3.3262967225419064},
		{470, 265, 9.905047832402294}, {470, 200, 1.4918811608706526},
		{600, 260, 6.8557731818569865}, {600, 200, 1.4095926945208903},
	} {
		if height := f.sample(sample[0], sample[1], ""); math.Abs(height-sample[2]) > 1e-9 {
			t.Fatalf("client/server sample mismatch at %v: %.12f", sample, height)
		}
		if f.sample(sample[0], sample[1], "dungeon_test") != 0 {
			t.Fatal("overworld terrain leaked into an instance")
		}
	}
	for x := -100.0; x <= 100; x += 10 {
		for z := 100.0; z <= 300; z += 10 {
			if f.sample(x, z, "") != 0 {
				t.Fatal("town moved off its level foundation")
			}
		}
	}
	for _, point := range [][2]float64{{math.NaN(), 200}, {0, math.Inf(1)}, {1001, 200}, {0, -700}} {
		if f.sample(point[0], point[1], "") != 0 {
			t.Fatal("invalid or other-realm sample must remain zero")
		}
	}
}

func TestWorldElevationUsesTrianglesNotBilinearInterpolation(t *testing.T) {
	f := &worldElevationField{Bounds: elevationBounds{MaxX: 1, MaxZ: 1}, Columns: 1, Rows: 1,
		StepX: 1, StepZ: 1, heights: []float64{0, 2, 4, 9}}
	for _, sample := range [][3]float64{{.2, .3, 1.6}, {.8, .7, 5.9}, {.5, .5, 3}, {1, 1, 9}} {
		if height := f.sample(sample[0], sample[1], ""); math.Abs(height-sample[2]) > 1e-10 {
			t.Fatalf("wrong triangle interpolation: %v got %f", sample, height)
		}
	}
}

func TestWorldElevationRejectsInvalidOrTooSteepDefinitions(t *testing.T) {
	for _, mutate := range []func(*elevationDefinition){
		func(d *elevationDefinition) { d.Spacing = 0 },
		func(d *elevationDefinition) { d.Bounds.MinX = math.NaN() },
		func(d *elevationDefinition) { d.Bounds.MaxX = d.Bounds.MinX },
		func(d *elevationDefinition) { d.Hills[0].RadiusX = 0 },
		func(d *elevationDefinition) { d.Hills[0].Height = math.Inf(1) },
		func(d *elevationDefinition) { d.MaxGrade = .01 },
	} {
		var data elevationDefinition
		if err := json.Unmarshal(worldElevationJSON, &data); err != nil {
			t.Fatal(err)
		}
		mutate(&data)
		if _, err := newWorldElevationField(data); err == nil {
			t.Fatal("accepted an invalid elevation definition")
		}
	}
}
