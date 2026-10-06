package operations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReadinessRealtimePhaseCompatibilityAndValidation(t *testing.T) {
	for _, scenario := range []string{"active-broadcast", "legacy", "missing-phase", "missing-count", "negative", "bad-type", "impossible-count", "unknown-positive", "impossible-timing"} {
		t.Run(scenario, func(t *testing.T) {
			groups := map[string]any{}
			for _, name := range []string{"characterJournal", "characterCommit", "characterCleanup", "characterRecovery", "casinoGold", "casinoEP", "realtimeUpdate", "stateBroadcast"} {
				groups[name] = map[string]any{"completed": 1, "failed": 0, "inFlightKnown": true, "inFlight": 0,
					"timedSamples": 1, "totalMicros": 10, "maxMicros": 10, "error": "private-frame-marker"}
			}
			phase := groups["stateBroadcast"].(map[string]any)
			phase["inFlight"] = 1
			switch scenario {
			case "legacy":
				delete(groups, "realtimeUpdate")
				delete(groups, "stateBroadcast")
			case "missing-phase":
				delete(groups, "stateBroadcast")
			case "missing-count":
				delete(phase, "completed")
			case "negative":
				phase["inFlight"] = -1
			case "bad-type":
				phase["totalMicros"] = "private-frame-marker"
			case "impossible-count":
				phase["failed"] = 2
			case "unknown-positive":
				phase["inFlightKnown"] = false
			case "impossible-timing":
				phase["maxMicros"] = 11
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				if err := json.NewEncoder(w).Encode(map[string]any{"status": "ok", "database": "ready", "commit": "abcdef1", "version": "Alpha 1.78.0", "operational": groups}); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			probe, err := NewProbe(server.URL+"/healthz", "", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			valid := scenario == "active-broadcast" || scenario == "legacy"
			if sample.Ready != valid || !valid && sample.Cause != "invalid_response" {
				t.Fatalf("wrong phase compatibility/validation: %+v", sample)
			}
			if scenario == "active-broadcast" && (sample.Operational == nil || sample.Operational.StateBroadcast.InFlight != 1 || sample.Operational.RealtimeUpdate.Completed != 1) {
				t.Fatal("fixed phase measurements were lost")
			}
			if scenario == "legacy" && (sample.Operational == nil || sample.Operational.StateBroadcast.InFlightKnown || sample.Operational.RealtimeUpdate.TimedSamples != 0) {
				t.Fatal("legacy absence was mislabeled as measured idle")
			}
			encoded, _ := json.Marshal(sample)
			if strings.Contains(string(encoded), "private-frame-marker") {
				t.Fatal("peer diagnostics leaked through phase measurements")
			}
		})
	}
}
