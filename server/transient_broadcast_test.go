package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func isolatedTransientQueues(t *testing.T, normal, encounter int) {
	t.Helper()
	previousNormal, previousEncounter := broadcast, encounterBroadcast
	previousStopping := serverStopping.Load()
	previousDrops, previousEncounterDrops, previousInvalid := transientBroadcastDropped.Load(), encounterBroadcastDropped.Load(), invalidBroadcastDropped.Load()
	broadcast, encounterBroadcast = make(chan BroadcastMessage, normal), make(chan BroadcastMessage, encounter)
	serverStopping.Store(false)
	transientBroadcastDropped.Store(0)
	encounterBroadcastDropped.Store(0)
	invalidBroadcastDropped.Store(0)
	t.Cleanup(func() {
		broadcast, encounterBroadcast = previousNormal, previousEncounter
		serverStopping.Store(previousStopping)
		transientBroadcastDropped.Store(previousDrops)
		encounterBroadcastDropped.Store(previousEncounterDrops)
		invalidBroadcastDropped.Store(previousInvalid)
	})
}

func TestTransientBroadcastSaturationReservesEncounterLaneAndRecovers(t *testing.T) {
	isolatedTransientQueues(t, 2, 1)
	visual := BroadcastMessage{Type: MsgAbility, InstanceID: "dungeon_queue", Data: []byte(`{"cast":1}`)}
	if !enqueueTransientBroadcast(visual) || !enqueueTransientBroadcast(visual) || enqueueTransientBroadcast(visual) {
		t.Fatal("ordinary backlog did not admit exactly its bounded capacity")
	}
	warning := BroadcastMessage{Type: MsgTelegraph, InstanceID: visual.InstanceID, Data: []byte(`{"warning":1}`)}
	if !enqueueTransientBroadcast(warning) || enqueueTransientBroadcast(warning) {
		t.Fatal("encounter lane is not independently reserved/bounded")
	}
	got := <-encounterBroadcast
	if got.Type != MsgTelegraph || got.InstanceID != warning.InstanceID || !bytes.Equal(got.Data, warning.Data) {
		t.Fatal("encounter backlog lost payload or captured scene")
	}
	<-broadcast
	if !enqueueTransientBroadcast(BroadcastMessage{Type: MsgAttack, InstanceID: visual.InstanceID, Data: []byte(`{"attack":1}`)}) {
		t.Fatal("normal delivery did not resume after pressure eased")
	}
	metrics := transientBroadcastMetrics()
	if metrics.Queued != 2 || metrics.EncounterQueued != 0 || metrics.Dropped != 1 || metrics.EncounterDropped != 1 || metrics.InvalidDropped != 0 {
		t.Fatalf("incorrect bounded queue/drop metrics: %+v", metrics)
	}
}

func TestTransientBroadcastOwnsBytesAndRejectsOversizeOrPrivateReplies(t *testing.T) {
	isolatedTransientQueues(t, 2, 1)
	data := []byte(`{"original":true}`)
	if !enqueueTransientBroadcast(BroadcastMessage{Type: MsgDamage, Data: data}) {
		t.Fatal("ordinary presentation rejected")
	}
	data[2] = 'X'
	if got := <-broadcast; string(got.Data) != `{"original":true}` {
		t.Fatal("caller changed already-queued message bytes")
	}
	for _, message := range []BroadcastMessage{
		{Type: MsgAbility},
		{Type: MsgAbility, Data: make([]byte, maxTransientBroadcastBytes+1)},
		{Type: MsgTelegraph, InstanceID: strings.Repeat("x", maxBroadcastSceneBytes+1), Data: []byte(`{}`)},
		{Type: "wallet_update", Data: []byte(`{}`)},
	} {
		if enqueueTransientBroadcast(message) {
			t.Fatal("empty/oversized/private or unsupported reply entered lossy presentation queue")
		}
	}
	if metrics := transientBroadcastMetrics(); metrics.Queued != 0 || metrics.EncounterQueued != 0 || metrics.InvalidDropped != 4 {
		t.Fatalf("invalid messages retained or miscounted: %+v", metrics)
	}
	if !enqueueTransientBroadcast(BroadcastMessage{Type: MsgAbility, InstanceID: strings.Repeat("x", maxBroadcastSceneBytes), Data: make([]byte, maxTransientBroadcastBytes)}) {
		t.Fatal("exact byte boundary rejected")
	}
}

func TestTransientBroadcastConcurrentProducersCannotGrowBacklog(t *testing.T) {
	isolatedTransientQueues(t, 8, 2)
	var accepted atomic.Int64
	var producers sync.WaitGroup
	for worker := 0; worker < 64; worker++ {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for i := 0; i < 8; i++ {
				if enqueueTransientBroadcast(BroadcastMessage{Type: MsgAbility, Data: []byte(`{}`)}) {
					accepted.Add(1)
				}
			}
		}()
	}
	producers.Wait()
	metrics := transientBroadcastMetrics()
	if accepted.Load() != 8 || metrics.Queued != 8 || metrics.Dropped != 504 || metrics.EncounterQueued != 0 {
		t.Fatalf("concurrent producers bypassed capacity/accounting: accepted=%d metrics=%+v", accepted.Load(), metrics)
	}
}

func TestTransientBroadcastStopsWithoutBlockingAndHealthReportsPressure(t *testing.T) {
	isolatedTransientQueues(t, 2, 1)
	serverStopping.Store(true)
	if enqueueTransientBroadcast(BroadcastMessage{Type: MsgTelegraph, Data: []byte(`{}`)}) {
		t.Fatal("shutdown admitted more transient work")
	}
	serverStopping.Store(false)
	broadcast = nil
	if enqueueTransientBroadcast(BroadcastMessage{Type: MsgAbility, Data: []byte(`{}`)}) {
		t.Fatal("unavailable queue accepted work")
	}
	broadcast = make(chan BroadcastMessage, 2)
	enqueueTransientBroadcast(BroadcastMessage{Type: MsgAbility, Data: []byte(`{}`)})
	recorder := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return nil })(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	var response healthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != http.StatusOK || response.Status != "ok" || response.Database != "ready" || response.BroadcastQueues != transientBroadcastMetrics() {
		t.Fatalf("health lost readiness or pressure metrics: %+v", response)
	}
}
