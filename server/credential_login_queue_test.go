package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"
)

func waitForPendingLogins(t *testing.T, gate *credentialWorkGate, count int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for len(gate.logins) != count {
		if time.Now().After(deadline) {
			t.Fatal("login did not enter bounded wait", len(gate.logins))
		}
		time.Sleep(time.Millisecond)
	}
}

func TestCredentialLoginWaitSharesWorkersAndPreservesBudget(t *testing.T) {
	gate := newCredentialWorkGate(1)
	now := time.Now()
	held, err := gate.begin(MsgRegister, "held-registration", now)
	if err != nil {
		t.Fatal(err)
	}
	defer held()
	type result struct {
		done func()
		err  error
	}
	ready := make(chan result, 1)
	go func() { done, err := gate.beginLogin("waiting", now); ready <- result{done, err} }()
	waitForPendingLogins(t, gate, 1)
	if len(gate.slots) != 1 || len(gate.accounts) != 1 {
		t.Fatal("waiter increased worker capacity or retained an account")
	}
	held()
	select {
	case result := <-ready:
		if result.err != nil || result.done == nil || len(gate.slots) != 1 || len(gate.logins) != 0 {
			t.Fatal("released shared worker was not admitted cleanly", result.err)
		}
		result.done()
		result.done()
	case <-time.After(time.Second):
		t.Fatal("released login did not complete")
	}
	for attempt := 0; attempt < 5; attempt++ {
		done, err := gate.beginLogin("waiting", now)
		if attempt < 4 {
			if err != nil || done == nil {
				t.Fatal("queued login spent more than one attempt", err)
			}
			done()
		} else if done != nil || !errors.Is(err, errCredentialRate) {
			t.Fatal("queue bypassed five-attempt account budget", err)
		}
	}
	if len(gate.slots) != 0 || len(gate.logins) != 0 {
		t.Fatal("login worker or waiter capacity leaked")
	}
}

func TestCredentialLoginWaitTimeoutAndOverflowFailClosed(t *testing.T) {
	gate := newCredentialWorkGate(1)
	now := time.Now()
	held, err := gate.begin(MsgLogin, "held", now)
	if err != nil {
		t.Fatal(err)
	}
	defer held()
	ready := make(chan error, maxPendingLogins)
	for index := 0; index < maxPendingLogins; index++ {
		go func() {
			done, err := gate.beginLogin(fmt.Sprintf("queued-%d", index), now)
			if done != nil {
				done()
				err = errors.New("waiter started while shared worker held")
			}
			ready <- err
		}()
	}
	waitForPendingLogins(t, gate, maxPendingLogins)
	started := time.Now()
	if done, err := gate.beginLogin("overflow", now); done != nil || !errors.Is(err, errCredentialsBusy) {
		t.Fatal("overflow did not reject", err)
	}
	if time.Since(started) >= loginAdmissionWait {
		t.Fatal("overflow consumed a wait slot")
	}
	for range maxPendingLogins {
		select {
		case err := <-ready:
			if !errors.Is(err, errCredentialsBusy) {
				t.Fatal("held-worker timeout did not fail closed", err)
			}
		case <-time.After(time.Second):
			t.Fatal("login wait did not expire")
		}
	}
	if len(gate.logins) != 0 || len(gate.slots) != 1 || len(gate.accounts) != 1 {
		t.Fatal("timeout leaked capacity or retained waiting account names")
	}
	held()
	for attempt := 0; attempt < 5; attempt++ {
		done, err := gate.beginLogin("queued-0", now)
		if done == nil || err != nil {
			t.Fatal("timeout spent an account retry", err)
		}
		done()
	}
}

func TestAuthQueuedLoginClosedOrRetiredCannotQueryStorage(t *testing.T) {
	previousGate, previousDB := credentialAdmission, db
	db = nil
	t.Cleanup(func() { credentialAdmission, db = previousGate, previousDB })
	for _, scenario := range []struct{ state, release string }{{"closed", "released"}, {"retired", "released"}, {"closed", "timeout"}, {"retired", "timeout"}} {
		t.Run(scenario.state+"/"+scenario.release, func(t *testing.T) {
			credentialAdmission = newCredentialWorkGate(1)
			held, err := credentialAdmission.begin(MsgLogin, "held", time.Now())
			if err != nil {
				t.Fatal(err)
			}
			defer held()
			client := &Client{send: make(chan []byte, 4)}
			payload, _ := json.Marshal(AuthPayload{Username: "waiting", Password: "not-queried"})
			finished := make(chan struct{})
			go func() { client.dispatchMessage(Message{Type: MsgLogin, Payload: payload}); close(finished) }()
			waitForPendingLogins(t, credentialAdmission, 1)
			if scenario.state == "closed" {
				client.markTransportClosed()
			} else {
				client.retired.Store(true)
			}
			if scenario.release == "released" {
				held()
			}
			select {
			case <-finished:
			case <-time.After(time.Second):
				t.Fatal("closed/retired queued login did not stop")
			}
			held()
			if client.username != "" || len(client.send) != 0 || len(credentialAdmission.slots) != 0 || len(credentialAdmission.logins) != 0 {
				t.Fatal("unavailable queued login changed ownership, replied or leaked capacity")
			}
		})
	}
}
