package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"time"

	"eidolon-server/internal/operations"
)

// Fixed numeric diagnostic only. Lifetime maxima are not interval maxima,
// CPU usage, percentiles or proof of per-player network latency.
type combinedPhaseEvidence struct {
	Journal   operations.OutcomeCounts `json:"characterJournal"`
	Commit    operations.OutcomeCounts `json:"characterCommit"`
	Cleanup   operations.OutcomeCounts `json:"characterCleanup"`
	Recovery  operations.OutcomeCounts `json:"characterRecovery"`
	Gold      operations.OutcomeCounts `json:"casinoGold"`
	EP        operations.OutcomeCounts `json:"casinoEP"`
	Update    operations.OutcomeCounts `json:"realtimeUpdate"`
	Broadcast operations.OutcomeCounts `json:"stateBroadcast"`
}

func readCombinedPhaseEvidence(address string) ([]byte, error) {
	host, _, err := net.SplitHostPort(address)
	if err != nil || host != "127.0.0.1" {
		return nil, errors.New("invalid disposable phase endpoint")
	}
	probe, err := operations.NewProbe("http://"+address+"/healthz", "", time.Second)
	if err != nil {
		return nil, errors.New("phase probe unavailable")
	}
	sample := probe.Check(context.Background())
	if !sample.Ready || sample.Operational == nil || !sample.Operational.RealtimeUpdate.InFlightKnown || !sample.Operational.StateBroadcast.InFlightKnown {
		return nil, errors.New("phase measurements unavailable")
	}
	// Never marshal the response, arbitrary fields or the full health sample.
	m := sample.Operational
	return json.Marshal(combinedPhaseEvidence{
		Journal: m.CharacterJournal, Commit: m.CharacterCommit, Cleanup: m.CharacterCleanup,
		Recovery: m.CharacterRecovery, Gold: m.CasinoGold, EP: m.CasinoEP,
		Update: m.RealtimeUpdate, Broadcast: m.StateBroadcast,
	})
}
