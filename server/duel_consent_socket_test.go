package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

type duelSocketState struct {
	Challenge *game.DuelChallenge `json:"challenge"`
	Match     *game.PvPMatch      `json:"match"`
}

func TestDuelActualSocketsReplacementConsentAndSurrender(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable Mongo and built server required")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	names := []string{fmt.Sprintf("duel-a-%d", time.Now().UnixNano()), fmt.Sprintf("duel-b-%d", time.Now().UnixNano())}
	for _, name := range names {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
	}
	address, stop := compatStartServer(t, binary, uri, 82, "-save-journal-dir", t.TempDir())
	defer stop()
	connections := make([]*websocket.Conn, 2)
	for index, class := range []string{"Fighter", "Wizard"} {
		connections[index], _ = resourceLoginCharacter(t, address, names[index], names[index]+"-local-only", class)
		defer connections[index].Close()
	}
	read := func(index int, match func(duelSocketState) bool) duelSocketState {
		for count := 0; count < 20; count++ {
			var state duelSocketState
			resourceReadMessage(t, connections[index], MsgPvPUpdate, &state)
			if match(state) {
				return state
			}
		}
		t.Fatal("duel socket did not reach expected current state")
		return duelSocketState{}
	}
	request := func(previous string) game.DuelChallenge {
		resourceSend(t, connections[0], MsgDuelRequest, GuildTargetPayload{Username: names[1]})
		state := read(1, func(state duelSocketState) bool { return state.Challenge != nil && state.Challenge.ID != previous })
		if state.Challenge.ID == "" || state.Challenge.RequesterID != "player-"+names[0] || state.Challenge.TargetID != "player-"+names[1] {
			t.Fatal("challenge lost exact identities")
		}
		return *state.Challenge
	}
	first := request("")
	resourceSend(t, connections[1], MsgDuelRespond, DuelRespondPayload{RequesterID: first.RequesterID, ChallengeID: first.ID, Accept: false})
	read(1, func(state duelSocketState) bool { return state.Challenge == nil && state.Match == nil })
	current := request(first.ID)
	resourceSend(t, connections[1], MsgDuelRespond, DuelRespondPayload{RequesterID: first.RequesterID, ChallengeID: first.ID, Accept: true})
	var rejection string
	resourceReadMessage(t, connections[1], MsgError, &rejection)
	if !strings.Contains(rejection, "challenge") {
		t.Fatal("stale consent rejected for wrong reason", rejection)
	}
	read(1, func(state duelSocketState) bool {
		return state.Match == nil && state.Challenge != nil && state.Challenge.ID == current.ID
	})
	resourceSend(t, connections[1], MsgDuelRespond, DuelRespondPayload{RequesterID: current.RequesterID, ChallengeID: current.ID, Accept: false})
	read(1, func(state duelSocketState) bool { return state.Challenge == nil && state.Match == nil })
	accepted := request(current.ID)
	resourceSend(t, connections[1], MsgDuelRespond, DuelRespondPayload{RequesterID: accepted.RequesterID, ChallengeID: accepted.ID, Accept: true})
	var matchID string
	for index := range connections {
		var scene struct {
			InstanceID string `json:"instanceId"`
			Type       string `json:"type"`
		}
		resourceReadMessage(t, connections[index], MsgEnterInstance, &scene)
		if scene.InstanceID == "" || scene.Type != "pvp_arena" {
			t.Fatal("duel consent did not enter an authoritative PvP scene", scene)
		}
		state := read(index, func(state duelSocketState) bool { return state.Match != nil })
		if state.Match.Mode != game.PvPModeDuel || state.Match.Status != game.PvPMatchActive || state.Match.ID != scene.InstanceID {
			t.Fatal("wrong duel match")
		}
		if matchID == "" {
			matchID = state.Match.ID
		} else if state.Match.ID != matchID {
			t.Fatal("players entered different matches")
		}
	}
	resourceSend(t, connections[1], MsgArenaLeave, struct{}{})
	for index := range connections {
		var scene struct {
			InstanceID string `json:"instanceId"`
			Type       string `json:"type"`
		}
		resourceReadMessage(t, connections[index], MsgEnterInstance, &scene)
		if scene.InstanceID != "" || scene.Type != "overworld" {
			t.Fatal("surrender did not return both players")
		}
		read(index, func(state duelSocketState) bool { return state.Match == nil })
		character := resourceCloseAndWait(t, repo, connections[index], names[index])
		if character.Level != 1 || character.XP != 0 || character.Gold != 0 || character.EP != 0 || character.InstanceID != "" || character.Resources == nil || character.Resources.Dead {
			t.Fatal("practice changed ordinary progression or persisted arena death")
		}
		profile, err := repo.GetPvPProfile("player-" + names[index])
		if err != nil || profile.Rating != 1000 || profile.Wins != 0 || profile.Losses != 0 || profile.Honor != 0 || profile.SeasonPoints != 0 || profile.RewardState.DeserterUntil != 0 {
			t.Fatal("practice duel granted ranked rewards or penalties", profile, err)
		}
	}
	// All accounts/data belong to this explicitly disposable loopback fixture.
}
