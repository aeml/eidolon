package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"eidolon-server/internal/operations"
)

func TestCombinedPhaseEvidenceIsBoundedPrivateAndRequiresObservedPhases(t *testing.T) {
	for _, scenario := range []string{"observed", "legacy", "partial", "invalid", "redirect", "oversized"} {
		t.Run(scenario, func(t *testing.T) {
			metrics := operationalMetricsSnapshot()
			counts := operations.OutcomeCounts{InFlightKnown: true, Completed: 2, TimedSamples: 2, TotalMicros: 50, MaxMicros: 30}
			metrics.RealtimeUpdate, metrics.StateBroadcast = counts, counts
			metrics.CharacterJournal, metrics.CharacterCommit, metrics.CharacterCleanup = counts, counts, counts
			metrics.CharacterRecovery, metrics.CasinoGold, metrics.CasinoEP = counts, counts, counts
			payload := map[string]any{"status": "ok", "database": "ready", "commit": "abcdef1", "version": "Alpha 1.74.7", "operational": metrics,
				"private": "private-fixture-credentials-and-player-marker"}
			if scenario == "legacy" {
				metrics.RealtimeUpdate, metrics.StateBroadcast = operations.OutcomeCounts{}, operations.OutcomeCounts{}
				payload["operational"] = metrics
			}
			if scenario == "partial" {
				metrics.StateBroadcast = operations.OutcomeCounts{}
				payload["operational"] = metrics
			}
			if scenario == "invalid" {
				metrics.StateBroadcast.Failed = 3
				payload["operational"] = metrics
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if scenario == "redirect" {
					http.Redirect(w, r, "https://example.invalid/private", http.StatusFound)
					return
				}
				if scenario == "oversized" {
					_, _ = w.Write([]byte(strings.Repeat("x", 1024*1024)))
					return
				}
				_ = json.NewEncoder(w).Encode(payload)
			}))
			defer server.Close()
			value, err := readCombinedPhaseEvidence(strings.TrimPrefix(server.URL, "http://"))
			if scenario != "observed" {
				if err == nil || value != nil {
					t.Fatal("unavailable/invalid diagnostics presented as observed counters")
				}
				return
			}
			var result combinedPhaseEvidence
			if err != nil || json.Unmarshal(value, &result) != nil || result.Update != counts || result.Broadcast != counts ||
				strings.Contains(string(value), "private") || strings.Contains(string(value), "commit") {
				t.Fatal("fixed numeric evidence lost its observations or privacy boundary")
			}
			var fields map[string]operations.OutcomeCounts
			if json.Unmarshal(value, &fields) != nil || len(fields) != 8 {
				t.Fatal("diagnostic field set changed or includes unbounded data")
			}
			for _, key := range []string{"characterJournal", "characterCommit", "characterCleanup", "characterRecovery", "casinoGold", "casinoEP", "realtimeUpdate", "stateBroadcast"} {
				if fields[key] != counts {
					t.Fatal("fixed wallet/save/frame phase lost its observed counts", key)
				}
			}
		})
	}
	for _, address := range []string{"server.eidolonrealms.com:443", "192.0.2.1:8080", "127.0.0.1:80/private", "invalid"} {
		if value, err := readCombinedPhaseEvidence(address); err == nil || value != nil {
			t.Fatal("non-disposable endpoint accepted")
		}
	}
}
