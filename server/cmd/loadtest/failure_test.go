package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDungeonFailureStagesPreserveFirstCauseWithoutActorData(t *testing.T) {
	for _, scenario := range []string{"checkpoint_position", "dungeon_timeout"} {
		t.Run(scenario, func(t *testing.T) {
			p := raidEncounterFixture(t, "weekly_raid")
			m := &p.dungeon.members[0]
			m.pending = "enter"
			if scenario == "checkpoint_position" {
				me := p.members[0].state
				me.X = m.spawn.x + 4
				p.dungeon.observe(p, 0, me)
			} else {
				m.sentAt = time.Unix(100, 0)
				p.dungeon.step(p, 0, p.members[0].state, m.sentAt.Add(time.Second), time.Second, func(string, interface{}) error { t.Fatal("timed-out entry retried"); return nil })
			}
			p.failAt(failureCastTimeout) // Later cleanup cannot replace first cause.
			if !p.failed || p.failureCode() != scenario {
				t.Fatal("missing immutable, fixed-vocabulary failure stage")
			}
		})
	}
	p := &partyLoad{}
	if p.failureCode() != "none" {
		t.Fatal("healthy controller reports failure")
	}
	p.failed = true
	if p.failureCode() != "unclassified" {
		t.Fatal("unknown failure invents a cause")
	}
}

func TestServerFailureClassificationNeverRetainsRawPayloads(t *testing.T) {
	for _, entry := range []struct{ payload, want string }{
		{`"message rate limit exceeded"`, "server_rate_limit"},
		{`"private account details"`, "server_rejection"},
		{`{"password":"private"}`, "server_rejection"},
	} {
		p := &partyLoad{}
		p.rejectServer(json.RawMessage(entry.payload))
		if p.failureCode() != entry.want {
			t.Fatal("incorrect fixed classification")
		}
		p.rejectServer(json.RawMessage(`"another private error"`))
		if p.failureCode() != entry.want {
			t.Fatal("later rejection replaced first cause")
		}
	}
}
