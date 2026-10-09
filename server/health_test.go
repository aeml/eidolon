package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"eidolon-server/internal/game"
)

func TestHealthTerrainProfileUsesInitializedWorld(t *testing.T) {
	originalWorld, originalFlag := world, *terrainProfileFlag
	t.Cleanup(func() { world, *terrainProfileFlag = originalWorld, originalFlag })
	for _, profile := range []string{game.FlatTerrainProfile, game.RaisedEarthTerrainProfile} {
		t.Run(profile, func(t *testing.T) {
			var err error
			world, err = game.NewWorldWithTerrainProfile(nil, profile)
			if err != nil {
				t.Fatal(err)
			}
			// A changed startup flag is not proof of a changed running world.
			*terrainProfileFlag = "unapplied-configuration"
			for _, databaseReady := range []bool{true, false} {
				recorder := httptest.NewRecorder()
				healthHandler(func(context.Context) error {
					if !databaseReady {
						return errors.New("offline")
					}
					return nil
				})(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
				var response healthResponse
				if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
					t.Fatal(err)
				}
				if response.TerrainProfile != profile {
					t.Fatalf("health profile=%q, initialized=%q", response.TerrainProfile, profile)
				}
			}
		})
	}
	world = nil
	response, _ := collectHealthResponse(context.Background(), func(context.Context) error { return nil })
	if response.TerrainProfile != "" {
		t.Fatal("uninitialized world advertised a terrain profile")
	}
}

func TestHealthHandlerReportsReleaseAndDatabaseReadiness(t *testing.T) {
	originalCommit, originalVersion := buildCommit, buildVersion
	buildCommit, buildVersion = "abc123", "Alpha test"
	t.Cleanup(func() { buildCommit, buildVersion = originalCommit, originalVersion })

	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return nil })(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	var response healthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	if response.Status != "ok" || response.Database != "ready" {
		t.Fatalf("unexpected health state: %+v", response)
	}
	if response.Commit != "abc123" || response.Version != "Alpha test" {
		t.Fatalf("unexpected release identity: %+v", response)
	}
	if response.Goroutines <= 0 || response.HeapAllocBytes == 0 || response.HeapObjects == 0 {
		t.Fatalf("runtime telemetry was not populated: %+v", response)
	}
	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("expected no-store cache policy, got %q", got)
	}
}

func TestHealthHandlerReturnsUnavailableWhenDatabasePingFails(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return errors.New("offline") })(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", recorder.Code)
	}
	var response healthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	if response.Status != "unavailable" || response.Database != "unavailable" {
		t.Fatalf("unexpected health state: %+v", response)
	}
}

func TestHealthHandlerRejectsUnsupportedMethods(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	recorder := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return nil })(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", recorder.Code)
	}
}
