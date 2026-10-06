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

func TestReadinessProbeOperationalCountsActualHTTPAndPrivacy(t *testing.T) {
	for _, scenario := range []string{"valid", "missing", "null", "partial-group", "partial-counter", "negative", "bad-type", "impossible-count", "overflow"} {
		t.Run(scenario, func(t *testing.T) {
			groups := map[string]any{}
			for _, name := range []string{"characterJournal", "characterCommit", "characterCleanup", "characterRecovery", "casinoGold", "casinoEP"} {
				groups[name] = map[string]any{"completed": 2, "failed": 1, "error": "private-marker"}
			}
			health := map[string]any{"status": "ok", "database": "ready", "commit": "abcdef1", "version": "Alpha 1.78.0", "operational": groups, "username": "private-marker"}
			switch scenario {
			case "missing":
				delete(health, "operational")
			case "null":
				health["operational"] = nil
			case "partial-group":
				delete(groups, "casinoEP")
			case "partial-counter":
				delete(groups["casinoEP"].(map[string]any), "failed")
			case "negative":
				groups["casinoEP"].(map[string]any)["failed"] = -1
			case "bad-type":
				groups["casinoEP"].(map[string]any)["failed"] = "private-marker"
			case "impossible-count":
				groups["casinoEP"].(map[string]any)["failed"] = 3
			case "overflow":
				groups["casinoEP"].(map[string]any)["completed"] = json.Number("18446744073709551616")
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				if err := json.NewEncoder(w).Encode(health); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			probe, err := NewProbe(server.URL+"/healthz", "", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			valid := scenario == "valid" || scenario == "missing" || scenario == "null" || scenario == "partial-group" || scenario == "partial-counter"
			if sample.Ready != valid || (sample.Operational != nil) != (scenario == "valid") || !valid && sample.Cause != "invalid_response" {
				t.Fatalf("optional measurement/readiness boundary failed: %+v", sample)
			}
			if scenario == "valid" && (sample.Operational.CharacterJournal.Completed != 2 || sample.Operational.CasinoEP.Failed != 1 || sample.Runtime != nil) {
				t.Fatal("fixed operation counters lost or invented unrelated runtime measurements")
			}
			encoded, _ := json.Marshal(sample)
			if strings.Contains(string(encoded), "private-marker") || strings.Contains(string(encoded), "username") {
				t.Fatal("private account/error label leaked")
			}
		})
	}
}

func TestReadinessProbeOperationalInFlightActualHTTPAndCompatibility(t *testing.T) {
	for _, scenario := range []string{"active", "idle", "unavailable", "legacy", "missing-value", "missing-known", "negative", "bad-value", "bad-known", "unknown-positive", "overflow"} {
		t.Run(scenario, func(t *testing.T) {
			groups := map[string]any{}
			for _, name := range []string{"characterJournal", "characterCommit", "characterCleanup", "characterRecovery", "casinoGold", "casinoEP"} {
				groups[name] = map[string]any{"completed": 2, "failed": 1, "inFlight": 50, "inFlightKnown": true, "account": "private-active-marker"}
			}
			counts := groups["casinoEP"].(map[string]any)
			switch scenario {
			case "idle":
				counts["inFlight"] = 0
			case "unavailable":
				counts["inFlight"], counts["inFlightKnown"] = 0, false
			case "legacy":
				delete(counts, "inFlight")
				delete(counts, "inFlightKnown")
			case "missing-value":
				delete(counts, "inFlight")
			case "missing-known":
				delete(counts, "inFlightKnown")
			case "negative":
				counts["inFlight"] = -1
			case "bad-value":
				counts["inFlight"] = "private-active-marker"
			case "bad-known":
				counts["inFlightKnown"] = "private-active-marker"
			case "unknown-positive":
				counts["inFlightKnown"] = false
			case "overflow":
				counts["inFlight"] = json.Number("18446744073709551616")
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "database": "ready", "commit": "abcdef1", "version": "Alpha 1.78.0", "operational": groups})
			}))
			defer server.Close()
			probe, err := NewProbe(server.URL+"/healthz", "", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			valid := scenario == "active" || scenario == "idle" || scenario == "unavailable" || scenario == "legacy" || scenario == "missing-value" || scenario == "missing-known"
			if sample.Ready != valid || !valid && sample.Cause != "invalid_response" {
				t.Fatal("active-work validation lost readiness boundary", sample)
			}
			if valid {
				if sample.Operational == nil || sample.Operational.CasinoEP.Completed != 2 || sample.Operational.CasinoEP.Failed != 1 {
					t.Fatal("active gauge lost independent completion counts")
				}
				gauge := sample.Operational.CasinoEP
				known := scenario == "active" || scenario == "idle"
				if gauge.InFlightKnown != known || known && scenario == "active" && gauge.InFlight != 50 || scenario != "active" && gauge.InFlight != 0 {
					t.Fatal("missing gauge became measured zero or active work was lost")
				}
			}
			encoded, _ := json.Marshal(sample)
			if strings.Contains(string(encoded), "private-active-marker") || strings.Contains(string(encoded), "account") {
				t.Fatal("unknown active-work label leaked")
			}
		})
	}
}

func TestReadinessProbeOperationalTimingsActualHTTPAndCompatibility(t *testing.T) {
	for _, scenario := range []string{"valid", "measured-zero", "legacy", "partial", "bad-samples", "bad-maximum", "bad-mean", "zero-maximum", "unsampled-positive", "bad-type", "negative", "saturated"} {
		t.Run(scenario, func(t *testing.T) {
			groups := map[string]any{}
			for _, name := range []string{"characterJournal", "characterCommit", "characterCleanup", "characterRecovery", "casinoGold", "casinoEP"} {
				groups[name] = map[string]any{"completed": 2, "failed": 1, "timedSamples": 2, "totalMicros": 1700, "maxMicros": 1000, "username": "private-timing-marker"}
			}
			counts := groups["casinoEP"].(map[string]any)
			switch scenario {
			case "measured-zero":
				counts["totalMicros"], counts["maxMicros"] = 0, 0
			case "legacy":
				delete(counts, "timedSamples")
				delete(counts, "totalMicros")
				delete(counts, "maxMicros")
			case "partial":
				delete(counts, "maxMicros")
			case "bad-samples":
				counts["timedSamples"] = 3
			case "bad-maximum":
				counts["maxMicros"] = 1701
			case "bad-mean":
				counts["totalMicros"] = 2001
			case "zero-maximum":
				counts["maxMicros"] = 0
			case "unsampled-positive":
				counts["timedSamples"] = 0
			case "bad-type":
				counts["maxMicros"] = "private-timing-marker"
			case "negative":
				counts["maxMicros"] = -1
			case "saturated":
				counts["totalMicros"] = ^uint64(0)
				counts["completed"], counts["timedSamples"] = ^uint64(0), ^uint64(0)
				counts["maxMicros"] = 1
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "database": "ready", "commit": "abcdef1", "version": "Alpha 1.78.0", "operational": groups})
			}))
			defer server.Close()
			probe, err := NewProbe(server.URL+"/healthz", "", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			valid := scenario == "valid" || scenario == "measured-zero" || scenario == "legacy" || scenario == "partial" || scenario == "saturated"
			if sample.Ready != valid || !valid && sample.Cause != "invalid_response" {
				t.Fatal("timing validation lost readiness boundary", sample)
			}
			if valid {
				if sample.Operational == nil || (scenario != "saturated" && sample.Operational.CasinoEP.Completed != 2) {
					t.Fatal("compatible call counts lost", sample)
				}
				timing := sample.Operational.CasinoEP
				if (scenario == "legacy" || scenario == "partial") && timing.TimedSamples != 0 {
					t.Fatal("missing timing became a measurement", timing)
				}
				if (scenario == "valid" || scenario == "measured-zero") && timing.TimedSamples != 2 {
					t.Fatal("real timing samples lost", timing)
				}
				if scenario == "valid" && (timing.TotalMicros != 1700 || timing.MaxMicros != 1000) {
					t.Fatal("elapsed timing changed", timing)
				}
				if scenario == "saturated" && timing.TotalMicros != ^uint64(0) {
					t.Fatal("saturated timing lost", timing)
				}
			}
			encoded, _ := json.Marshal(sample)
			if strings.Contains(string(encoded), "private-timing-marker") || strings.Contains(string(encoded), "username") {
				t.Fatal("unknown timing label leaked")
			}
		})
	}
}
