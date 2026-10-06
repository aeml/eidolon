package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"
)

const socialResponseTimeout = 15 * time.Second

var socialRequests = [...]string{"chat", "social", "friend_list", "guild_get", "pvp_get", "guild_leaderboard"}
var socialResponses = [...]string{"chat", "social", "friend_list", "guild_update", "pvp_update", "guild_leaderboard"}

type socialLoadCounts struct {
	requested, observed uint8
	failed              bool
}

// These registries have no request IDs: delivered-after-request is observable,
// not a uniquely correlated acknowledgement. Only our nonce-bearing live chat
// has exact correlation. Never retain peer lists, chat or account IDs in totals.
type socialLoad struct {
	mu                       sync.Mutex
	username, playerID, text string
	required                 int
	sent                     [len(socialRequests)]time.Time
	result                   socialLoadCounts
}

func newSocialLoad(username string, full bool) *socialLoad {
	b := &socialLoad{username: username, playerID: "player-" + username, required: 1}
	if full {
		b.required = len(socialRequests)
	}
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil || username == "" {
		b.result.failed = true
	}
	b.text = "Eidolon presence check " + hex.EncodeToString(nonce[:])
	return b
}

// One ordinary request per decision tick; no retries or deadline extension.
// Hold the lock through the write so an immediate response cannot be credited
// before its successful send has been recorded.
func (b *socialLoad) step(now time.Time, write func(string, interface{}) error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.result.failed {
		return
	}
	for i := 0; i < b.required; i++ {
		bit := uint8(1 << i)
		if !b.sent[i].IsZero() {
			if b.result.observed&bit == 0 && now.Sub(b.sent[i]) >= socialResponseTimeout {
				b.result.failed = true
				return
			}
			continue
		}
		var payload interface{} = map[string]interface{}{}
		if i == 0 {
			payload = map[string]string{"channel": "world", "message": b.text}
		}
		if i == 5 {
			payload = map[string]interface{}{"dungeonType": "umbral_nexus", "difficulty": "mythic", "runLevel": 100}
		}
		if write(socialRequests[i], payload) != nil {
			b.result.failed = true
			return
		}
		b.sent[i] = now
		b.result.requested |= bit
		return
	}
}

func (b *socialLoad) receive(msg Message, now time.Time) (recognized, valid bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if msg.Type == "error" {
		// No unique request correlation: conservatively fail this client's check.
		if b.result.requested != 0 {
			b.result.failed = true
		}
		return true, true
	}
	for i := 0; i < b.required; i++ {
		if msg.Type != socialResponses[i] {
			continue
		}
		if now.Before(b.sent[i]) {
			return true, true
		}
		bit := uint8(1 << i)
		if b.sent[i].IsZero() || b.result.observed&bit != 0 {
			return true, true
		}
		if now.Sub(b.sent[i]) >= socialResponseTimeout {
			b.result.failed = true
			return true, true
		}
		matched, ok := b.validate(i, msg.Payload)
		if !ok {
			b.result.failed = true
			return true, false
		}
		if matched {
			b.result.observed |= bit
		}
		return true, true
	}
	return false, true
}

func (b *socialLoad) counts() socialLoadCounts {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.result
}

func (b *socialLoad) validate(i int, payload json.RawMessage) (matched, valid bool) {
	if i == 0 {
		var chat struct {
			Sender, Channel, Message string
			History                  bool
			TimestampMs              int64
		}
		if json.Unmarshal(payload, &chat) != nil {
			return false, false
		}
		return chat.Sender == b.username && chat.Channel == "world" && chat.Message == b.text && !chat.History && chat.TimestampMs > 0, true
	}
	if i == 1 {
		var entries []struct {
			PlayerID, Name, Class, SocialStatus string
			Level                               int
		}
		if json.Unmarshal(payload, &entries) != nil || len(entries) > 1000 {
			return false, false
		}
		for _, entry := range entries {
			if entry.PlayerID != b.playerID {
				continue
			}
			classOK := entry.Class == "Fighter" || entry.Class == "Rogue" || entry.Class == "Wizard" || entry.Class == "Cleric"
			return true, classOK && entry.Name != "" && entry.Level >= 1 && entry.Level <= 100 && entry.SocialStatus != ""
		}
		return false, true
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(payload, &fields) != nil || fields == nil {
		return false, false
	}
	list := func(key string) bool {
		raw, exists := fields[key]
		var entries []json.RawMessage
		return exists && json.Unmarshal(raw, &entries) == nil && len(entries) <= 1000
	}
	switch i {
	case 2:
		return true, list("friends") && list("pending")
	case 3:
		var guild *struct{ ID string }
		raw, exists := fields["guild"]
		return true, exists && json.Unmarshal(raw, &guild) == nil && (guild == nil || guild.ID != "") && list("invites")
	case 4:
		var state struct {
			Queued                       *int
			OpenWorldFlagged, InSafeZone *bool
			Profile                      *struct {
				PlayerID string
				Rating   *int
			}
		}
		valid := json.Unmarshal(payload, &state) == nil && state.Queued != nil && *state.Queued >= 0 && state.OpenWorldFlagged != nil && state.InSafeZone != nil && state.Profile != nil && state.Profile.Rating != nil && *state.Profile.Rating >= 0
		return valid && state.Profile.PlayerID == b.playerID, valid
	case 5:
		var board struct {
			DungeonType, Difficulty, Season string
			RunLevel                        int
		}
		valid := json.Unmarshal(payload, &board) == nil && board.Season != "" && list("runs")
		return board.DungeonType == "umbral_nexus" && board.Difficulty == "mythic" && board.RunLevel == 100, valid
	}
	return false, false
}

type socialCoverage struct {
	clients, complete, failed int
	requested, observed       [len(socialRequests)]int
}

func summarizeSocial(assignments []botAssignment, observations []loadObservation) (socialCoverage, bool) {
	var result socialCoverage
	if len(assignments) != len(observations) {
		return result, false
	}
	for index, assignment := range assignments {
		if !assignment.observeSocial {
			continue
		}
		result.clients++
		counts := observations[index].social
		required := uint8(1)
		if assignment.scenario == "social" {
			required = (1 << len(socialRequests)) - 1
		}
		if counts.failed {
			result.failed++
		}
		if !counts.failed && counts.requested&required == required && counts.observed&required == required {
			result.complete++
		}
		for i := range socialRequests {
			if counts.requested&(1<<i) != 0 {
				result.requested[i]++
			}
			if counts.observed&(1<<i) != 0 {
				result.observed[i]++
			}
		}
	}
	return result, result.clients > 0 && result.clients == result.complete && result.failed == 0
}
