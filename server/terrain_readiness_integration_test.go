package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

// Two short real-process checks against an explicitly owned disposable Mongo.
// No browser, gameplay grants, campaign replay or production setting changes.
func TestTerrainActualHealthMatchesLoginProfile(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	for index, profile := range []string{game.RaisedEarthTerrainProfile, game.FlatTerrainProfile} {
		t.Run(profile, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
			defer cancel()
			check := exec.CommandContext(ctx, binary, "--check-schema", "--mongo-uri", uri, "--terrain-profile", profile)
			output, err := check.CombinedOutput()
			if err != nil || !strings.Contains(string(output), "Schema preflight passed:") {
				t.Fatalf("actual profile preflight failed: %v %s", err, output)
			}
			address, stop := compatStartServer(t, binary, uri, 1890+index,
				"--terrain-profile", profile, "--save-journal-dir", t.TempDir())
			defer stop()
			client := &http.Client{Timeout: 2 * time.Second}
			response, err := client.Get("http://" + address + "/healthz")
			if err != nil {
				t.Fatal(err)
			}
			var health healthResponse
			err = json.NewDecoder(io.LimitReader(response.Body, 32<<10)).Decode(&health)
			response.Body.Close()
			if err != nil || response.StatusCode != 200 || health.Database != "ready" ||
				health.Commit != filepath.Base(binary) || health.TerrainProfile != profile {
				t.Fatalf("actual health/profile mismatch: err=%v status=%d profile=%q", err, response.StatusCode, health.TerrainProfile)
			}
			connection, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
			if err != nil {
				t.Fatal(err)
			}
			defer connection.Close()
			resourceSend(t, connection, MsgLogin, map[string]string{"username": fixture.Name, "password": password})
			var login struct {
				TerrainProfile string `json:"terrainProfile"`
			}
			resourceReadMessage(t, connection, "login_success", &login)
			if login.TerrainProfile != health.TerrainProfile {
				t.Fatal("HTTP readiness and ordinary login disagree")
			}
		})
	}
	// This must fail on terrain selection before attempting an unavailable DB.
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	check := exec.CommandContext(ctx, binary, "--check-schema", "--mongo-uri", "mongodb://127.0.0.1:1",
		"--terrain-profile", "earth-elevation-v1")
	output, err := check.CombinedOutput()
	if err == nil || ctx.Err() != nil || !strings.Contains(string(output), "unsupported terrain profile") {
		t.Fatalf("invalid actual preflight did not reject terrain before database IO: %v %s", err, output)
	}
}
