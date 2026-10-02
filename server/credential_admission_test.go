package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCredentialFreshConnectionsShareAccountBudget(t *testing.T) {
	for _, kind := range []string{MsgLogin, MsgRegister} {
		t.Run(kind, func(t *testing.T) {
			gate := newCredentialWorkGate(4)
			now := time.Unix(1_700_000_000, 0)
			for index := 0; index < 6; index++ {
				// A fresh connection still has its own full protocol bucket.
				client := &Client{}
				if err := client.acceptInboundMessage(Message{Type: kind}, now); err != nil {
					t.Fatal(err)
				}
				done, err := gate.begin(kind, "same-account", now)
				if index < 5 {
					if err != nil {
						t.Fatal(err)
					}
					done()
				} else if !errors.Is(err, errCredentialRate) || done != nil {
					t.Fatal("new connection bypassed the shared account budget", err)
				}
			}
			done, err := gate.begin(kind, "same-account", now.Add(12*time.Second))
			if err != nil {
				t.Fatal("temporary limit did not refill", err)
			}
			done()
		})
	}
}

func TestCredentialBusyRejectionDoesNotSpendRetryOrRetainName(t *testing.T) {
	gate := newCredentialWorkGate(1)
	now := time.Unix(1_700_000_000, 0)
	done, err := gate.begin(MsgLogin, "held", now)
	if err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 20; attempt++ {
		kind := MsgLogin
		if attempt%2 == 1 {
			kind = MsgRegister
		}
		if release, err := gate.begin(kind, "waiting", now); !errors.Is(err, errCredentialsBusy) || release != nil {
			t.Fatal("credential work was not bounded", err)
		}
	}
	if len(gate.accounts) != 1 {
		t.Fatal("busy requests retained extra names")
	}
	done()
	for attempt := 0; attempt < 5; attempt++ {
		release, err := gate.begin(MsgLogin, "waiting", now)
		if err != nil {
			t.Fatal("busy rejection consumed a retry", err)
		}
		release()
	}
}

func TestCredentialAdmissionKeepsDistinctOwnersAndKindsIndependent(t *testing.T) {
	gate := newCredentialWorkGate(4)
	now := time.Unix(1_700_000_000, 0)
	for index := 0; index < 100; index++ {
		done, err := gate.begin(MsgLogin, fmt.Sprintf("owner-%d", index), now)
		if err != nil {
			t.Fatal("one owner's budget penalized another", err)
		}
		done()
	}
	for attempt := 0; attempt < 4; attempt++ {
		done, err := gate.begin(MsgLogin, "owner-0", now)
		if err != nil {
			t.Fatal(err)
		}
		done()
	}
	for _, request := range []struct{ kind, name string }{
		{MsgRegister, "owner-0"}, {MsgLogin, "OWNER-0"}, {MsgLogin, "主人"},
	} {
		done, err := gate.begin(request.kind, request.name, now)
		if err != nil {
			t.Fatal("registration, case-sensitive or Unicode identity changed", err)
		}
		done()
	}
}

func TestCredentialBudgetStorageIsBoundedAndFullyRefilledKeysExpire(t *testing.T) {
	gate := newCredentialWorkGate(4)
	gate.maxKeys = 2
	now := time.Unix(1_700_000_000, 0)
	for _, name := range []string{"first", "second"} {
		done, err := gate.begin(MsgLogin, name, now)
		if err != nil {
			t.Fatal(err)
		}
		done()
	}
	if done, err := gate.begin(MsgLogin, "third", now); done != nil || !errors.Is(err, errCredentialsBusy) || len(gate.accounts) != 2 || len(gate.slots) != 0 {
		t.Fatal("key capacity or rejected-work release failed", err)
	}
	done, err := gate.begin(MsgLogin, "third", now.Add(time.Minute))
	if err != nil || len(gate.accounts) != 1 {
		t.Fatal("expired full budgets were not reclaimed", err)
	}
	done()
}

func TestCredentialClockRewindCannotCreateAttempts(t *testing.T) {
	gate := newCredentialWorkGate(4)
	now := time.Unix(1_700_000_000, 0)
	for attempt := 0; attempt < 5; attempt++ {
		done, err := gate.begin(MsgLogin, "owner", now.Add(-time.Duration(attempt)*time.Minute))
		if err != nil {
			t.Fatal(err)
		}
		done()
	}
	if done, err := gate.begin(MsgLogin, "owner", now.Add(-time.Hour)); done != nil || !errors.Is(err, errCredentialRate) {
		t.Fatal("clock rewind replenished the account", err)
	}
	done, err := gate.begin(MsgLogin, "owner", now.Add(12*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	done()
}

func TestCredentialConcurrentConnectionsCannotOverspendBudget(t *testing.T) {
	gate := newCredentialWorkGate(32)
	now := time.Unix(1_700_000_000, 0)
	var admitted atomic.Int32
	var workers sync.WaitGroup
	releases := make(chan func(), 64)
	for index := 0; index < 64; index++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			done, err := gate.begin(MsgLogin, "owner", now)
			if err == nil {
				admitted.Add(1)
				releases <- done
			} else if !errors.Is(err, errCredentialRate) && !errors.Is(err, errCredentialsBusy) {
				t.Errorf("unexpected rejection: %v", err)
			}
		}()
	}
	workers.Wait()
	close(releases)
	if admitted.Load() != 5 || len(gate.slots) != 5 {
		t.Fatal("concurrent connections overspent or lost the available budget", admitted.Load(), len(gate.slots))
	}
	for done := range releases {
		done()
	}
	if len(gate.slots) != 0 {
		t.Fatal("credential capacity leaked")
	}
}

func TestCredentialReleaseIsIdempotentAndUnsupportedKindUsesNoCapacity(t *testing.T) {
	gate := newCredentialWorkGate(1)
	now := time.Unix(1_700_000_000, 0)
	if done, err := gate.begin(MsgResumeSession, "owner", now); done != nil || err == nil || len(gate.accounts) != 0 || len(gate.slots) != 0 {
		t.Fatal("non-credential message spent capacity")
	}
	done, err := gate.begin(MsgLogin, "owner", now)
	if err != nil {
		t.Fatal(err)
	}
	finished := make(chan struct{})
	go func() { done(); done(); close(finished) }()
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("repeated release blocked")
	}
	next, err := gate.begin(MsgLogin, "owner", now)
	if err != nil {
		t.Fatal("capacity was not returned", err)
	}
	next()
}

func TestCredentialDispatchRejectsBeforeDatabaseWork(t *testing.T) {
	previousGate, previousDB := credentialAdmission, db
	db = nil // Any actual credential-storage access fails this test.
	t.Cleanup(func() { credentialAdmission, db = previousGate, previousDB })
	for _, kind := range []string{MsgLogin, MsgRegister} {
		for _, reason := range []string{"busy", "rate"} {
			t.Run(kind+"/"+reason, func(t *testing.T) {
				credentialAdmission = newCredentialWorkGate(1)
				now := time.Now()
				expected := errCredentialsBusy
				if reason == "busy" {
					done, err := credentialAdmission.begin(kind, "other-owner", now)
					if err != nil {
						t.Fatal(err)
					}
					defer done()
				} else {
					expected = errCredentialRate
					for attempt := 0; attempt < 5; attempt++ {
						done, err := credentialAdmission.begin(kind, "owner", now)
						if err != nil {
							t.Fatal(err)
						}
						done()
					}
				}
				client := &Client{send: make(chan []byte, 4)}
				payload, _ := json.Marshal(AuthPayload{Username: "owner", Password: "not-checked", Email: "test@example.invalid"})
				client.dispatchMessage(Message{Type: kind, Payload: payload})
				messages := drainSentMessages(client.send)
				if len(messages) != 1 || messages[0].Type != MsgError || string(messages[0].Payload) != fmt.Sprintf("%q", expected.Error()) || client.username != "" {
					t.Fatal("credential admission did not reject safely", messages)
				}
			})
		}
	}
}
