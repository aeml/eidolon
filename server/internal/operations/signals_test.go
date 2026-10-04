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
