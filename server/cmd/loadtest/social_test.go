package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"
)

func socialFixtureMessages(b *socialLoad) []Message {
	payloads := []interface{}{
		map[string]interface{}{"sender": b.username, "channel": "world", "message": b.text, "timestampMs": 1},
		[]interface{}{map[string]interface{}{"playerId": b.playerID, "name": "Synthetic Hero", "class": "Wizard", "level": 35, "socialStatus": "available"}},
		map[string]interface{}{"friends": nil, "pending": []string{}},
		map[string]interface{}{"guild": nil, "invites": []string{}},
		map[string]interface{}{"queued": 0, "openWorldFlagged": false, "inSafeZone": true, "profile": map[string]interface{}{"playerId": b.playerID, "rating": 1000}},
		map[string]interface{}{"dungeonType": "umbral_nexus", "difficulty": "mythic", "runLevel": 100, "season": "synthetic-season", "runs": nil},
	}
	messages := make([]Message, len(payloads))
	for i, payload := range payloads {
		raw, _ := json.Marshal(payload)
		messages[i] = Message{Type: socialResponses[i], Payload: raw}
	}
	return messages
}

func TestSocialRequiresIssuedRequestsAndAllObservedRegistries(t *testing.T) {
	now := time.Unix(100, 0)
	b := newSocialLoad("synthetic-player", true)
	messages := socialFixtureMessages(b)
	for _, msg := range messages {
		b.receive(msg, now)
	}
	if b.counts().observed != 0 {
		t.Fatal("pre-request pushes manufactured coverage")
	}
	for i, msg := range messages {
		b.step(now, func(kind string, payload interface{}) error {
			if kind != socialRequests[i] {
				t.Fatal("wrong request order")
			}
			return nil
		})
		if b.counts().observed != uint8((1<<i)-1) {
			t.Fatal("send counted as response")
		}
		if recognized, valid := b.receive(msg, now.Add(time.Millisecond)); !recognized || !valid {
			t.Fatal("realistic response rejected")
		}
		b.receive(msg, now.Add(time.Millisecond))
	}
	counts := b.counts()
	if counts.failed || counts.requested != 63 || counts.observed != 63 {
		t.Fatal("incomplete observations")
	}
	b.step(now.Add(time.Hour), func(string, interface{}) error { t.Fatal("completed requests retried"); return nil })
}

func TestSocialOwnLiveChatCannotBeReplacedByPeerHistoryOrDifferentMessage(t *testing.T) {
	for _, field := range []string{"sender", "channel", "message", "history", "timestampMs"} {
		t.Run(field, func(t *testing.T) {
			b := newSocialLoad("synthetic-player", false)
			now := time.Unix(100, 0)
			b.step(now, func(string, interface{}) error { return nil })
			msg := socialFixtureMessages(b)[0]
			var chat map[string]interface{}
			_ = json.Unmarshal(msg.Payload, &chat)
			switch field {
			case "history":
				chat[field] = true
			case "timestampMs":
				chat[field] = 0
			default:
				chat[field] = "different"
			}
			msg.Payload, _ = json.Marshal(chat)
			b.receive(msg, now.Add(time.Millisecond))
			if b.counts().observed != 0 {
				t.Fatal("non-own live chat earned credit")
			}
		})
	}
}

func TestSocialRejectsMalformedMissingForeignAndUnrequestedResults(t *testing.T) {
	for i, response := range socialResponses {
		for _, raw := range []string{"{", "{}", "null", "[]"} {
			t.Run(fmt.Sprintf("%s/%s", response, raw), func(t *testing.T) {
				b := newSocialLoad("synthetic-player", true)
				now := time.Unix(100, 0)
				for j := 0; j <= i; j++ {
					b.step(now, func(string, interface{}) error { return nil })
				}
				b.receive(Message{Type: response, Payload: json.RawMessage(raw)}, now.Add(time.Millisecond))
				if b.counts().observed&(1<<i) != 0 {
					t.Fatal("malformed/empty result earned credit")
				}
			})
		}
	}
	for _, i := range []int{1, 4, 5} {
		b := newSocialLoad("synthetic-player", true)
		now := time.Unix(100, 0)
		for j := 0; j <= i; j++ {
			b.step(now, func(string, interface{}) error { return nil })
		}
		msg := socialFixtureMessages(b)[i]
		switch i {
		case 1:
			msg.Payload = json.RawMessage(`[{"playerId":"other","name":"Peer","class":"Wizard","level":35,"socialStatus":"available"}]`)
		case 4:
			msg.Payload = json.RawMessage(`{"queued":0,"openWorldFlagged":false,"inSafeZone":true,"profile":{"playerId":"other","rating":1000}}`)
		case 5:
			msg.Payload = json.RawMessage(`{"dungeonType":"other","difficulty":"mythic","runLevel":100,"season":"synthetic-season","runs":[]}`)
		}
		b.receive(msg, now.Add(time.Millisecond))
		if b.counts().observed&(1<<i) != 0 {
			t.Fatal("foreign owner/query earned credit")
		}
	}
}

func TestSocialTimeoutWriteAndRejectionNeverBecomeSuccessfulCoverage(t *testing.T) {
	now := time.Unix(100, 0)
	for _, reason := range []string{"timeout", "write", "rejection", "late"} {
		b := newSocialLoad("synthetic-player", true)
		b.step(now, func(string, interface{}) error {
			if reason == "write" {
				return errors.New("synthetic write failure")
			}
			return nil
		})
		switch reason {
		case "timeout":
			b.step(now.Add(socialResponseTimeout), func(string, interface{}) error { t.Fatal("timeout retried"); return nil })
		case "rejection":
			b.receive(Message{Type: "error", Payload: json.RawMessage(`"synthetic"`)}, now)
		case "late":
			b.receive(socialFixtureMessages(b)[0], now.Add(socialResponseTimeout))
		}
		if !b.counts().failed || b.counts().observed != 0 {
			t.Fatal("failed/late exchange credited", reason)
		}
	}
}

func TestSocialCoverageIncludesEveryAssignedZeroResultAndExcludesMixed(t *testing.T) {
	a := []botAssignment{{scenario: "town", observeSocial: true}, {scenario: "social", observeSocial: true}, {scenario: "social"}}
	o := []loadObservation{{social: socialLoadCounts{requested: 1, observed: 1}}, {social: socialLoadCounts{requested: 63, observed: 63}}, {}}
	coverage, valid := summarizeSocial(a, o)
	if !valid || coverage.clients != 2 || coverage.complete != 2 || coverage.observed[0] != 2 || coverage.observed[5] != 1 {
		t.Fatal("coverage ownership incorrect")
	}
	for _, failed := range []socialLoadCounts{{}, {requested: 63}, {requested: 63, observed: 31}, {requested: 63, observed: 63, failed: true}} {
		o[1].social = failed
		if _, valid := summarizeSocial(a, o); valid {
			t.Fatal("zero/partial/failed account omitted")
		}
	}
	if _, valid := summarizeSocial(a, o[:1]); valid {
		t.Fatal("observation count mismatch accepted")
	}
}
