package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestDuelHandlerExactConsentAndFreshBlockChecks(t *testing.T) {
	for _, scenario := range []string{"missing-id", "stale-id", "requester-blocked", "recipient-blocked", "surrender"} {
		t.Run(scenario, func(t *testing.T) {
			oldWorld, oldChat, oldDB := world, chatService, db
			sessionsMu.Lock()
			oldSessions := activeSessions
			a, b := newAutoStatusClient("duel-a"), newAutoStatusClient("duel-b")
			activeSessions = map[string]*Client{a.username: a, b.username: b}
			sessionsMu.Unlock()
			world, chatService, db = game.NewWorld(nil), newStructuredChatService(10), nil
			defer func() {
				world.StopBackground()
				world, chatService, db = oldWorld, oldChat, oldDB
				sessionsMu.Lock()
				activeSessions = oldSessions
				sessionsMu.Unlock()
			}()
			for _, client := range []*Client{a, b} {
				actor := newAutoStatusPlayer(client.playerID, client.username, "available")
				actor.MaxHealth, actor.Health, actor.MaxMana, actor.Mana = 100, 31, 80, 9
				actor.X, actor.Z = 0, 240
				world.AddEntity(actor)
			}
			request, _ := json.Marshal(GuildTargetPayload{Username: b.username})
			handleMsgDuelRequest(a, Message{Payload: request})
			challenge, ok := world.PvPStatus(b.playerID)["challenge"].(game.DuelChallenge)
			if !ok || challenge.ID == "" {
				t.Fatal("normal challenge handler failed")
			}
			drainSentMessages(a.send)
			drainSentMessages(b.send)
			response := DuelRespondPayload{RequesterID: a.playerID, ChallengeID: challenge.ID, Accept: true}
			var replacement game.DuelChallenge
			switch scenario {
			case "missing-id":
				response.ChallengeID = ""
			case "stale-id":
				var err error
				if _, err := world.RespondDuel(b.playerID, a.playerID, challenge.ID, false); err != nil {
					t.Fatal(err)
				}
				replacement, err = world.RequestDuel(a.playerID, b.playerID)
				if err != nil {
					t.Fatal(err)
				}
			case "requester-blocked":
				chatService.SetBlocked(a.username, b.username, true)
			case "recipient-blocked":
				chatService.SetBlocked(b.username, a.username, true)
			}
			payload, _ := json.Marshal(response)
			handleMsgDuelRespond(b, Message{Payload: payload})
			if scenario == "surrender" {
				if !world.HasPvPMatch(a.playerID) || !world.HasPvPMatch(b.playerID) {
					t.Fatal("normal consent did not admit players")
				}
				world.OnPvPMatchComplete = persistPvPMatchResult
				handleMsgArenaLeave(b, Message{})
				for _, client := range []*Client{a, b} {
					actor := world.GetEntityCopy(client.playerID)
					if actor.InstanceID != "" || actor.X != 0 || actor.Z != 240 || actor.Health != 31 || actor.Mana != 9 || world.HasPvPMatch(client.playerID) {
						t.Fatal("surrender did not restore original resources and scene")
					}
					profile := world.PvPStatus(client.playerID)["profile"].(game.PvPProfile)
					if profile.Rating != 1000 || profile.Honor != 0 || profile.SeasonPoints != 0 || profile.Wins != 0 {
						t.Fatal("practice duel granted ranked rewards")
					}
				}
				return
			}
			if world.HasPvPMatch(a.playerID) || world.HasPvPMatch(b.playerID) {
				t.Fatal("invalid consent created a match")
			}
			var sawError, sawState bool
			for _, message := range drainSentMessages(b.send) {
				sawError = sawError || message.Type == MsgError
				sawState = sawState || message.Type == MsgPvPUpdate
			}
			if !sawError || !sawState {
				t.Fatal("rejected consent did not refresh recipient")
			}
			if replacement.ID != "" {
				current, ok := world.PvPStatus(b.playerID)["challenge"].(game.DuelChallenge)
				if !ok || current.ID != replacement.ID {
					t.Fatal("old consent consumed replacement")
				}
			}
		})
	}
}
