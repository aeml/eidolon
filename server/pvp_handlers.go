package main

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func handleMsgDuelRequest(client *Client, message Message) {
	var payload GuildTargetPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || strings.TrimSpace(payload.Username) == "" {
		client.sendError("invalid duel request")
		return
	}
	target := activeClientByUsername(strings.TrimSpace(payload.Username))
	if target == nil || target.playerID == "" {
		client.sendError("duel player is offline")
		return
	}
	if chatService.shouldFilter(target.username, client.username) || chatService.shouldFilter(client.username, target.username) {
		client.sendError("duel player is unavailable")
		return
	}
	if _, err := world.RequestDuel(client.playerID, target.playerID); err != nil {
		client.sendError(err.Error())
		return
	}
	client.sendSystemChat("Duel challenge sent to " + target.username + ".")
	sendPvPState(target)
}

func handleMsgDuelRespond(client *Client, message Message) {
	var payload DuelRespondPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.RequesterID == "" {
		client.sendError("invalid duel response")
		return
	}
	match, err := world.RespondDuel(client.playerID, payload.RequesterID, payload.Accept)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	if match == nil {
		client.sendSystemChat("Duel declined.")
		sendPvPState(client)
		return
	}
	sendPvPMatchState(match)
}

func handleMsgArenaQueue(client *Client, message Message) {
	var payload ArenaQueuePayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid arena queue request")
		return
	}
	hydratePvPProfile(client.playerID)
	match, err := world.JoinArenaQueue(client.playerID, payload.TeamSize)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	if match == nil {
		client.sendSystemChat("Queued for arena.")
		sendPvPState(client)
		return
	}
	sendPvPMatchState(match)
}

func handleMsgArenaLeave(client *Client, _ Message) {
	world.ForfeitPvP(client.playerID)
	sendPvPState(client)
}

func handleMsgPvPGet(client *Client, _ Message) {
	hydratePvPProfile(client.playerID)
	sendPvPState(client)
}

func handleMsgPvPLeaderboard(client *Client, _ Message) {
	profiles, err := db.PvPLeaderboard(20)
	if err != nil {
		client.sendError("failed to load arena leaderboard")
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{"profiles": profiles, "season": database.CurrentArenaSeason(worldTime())})
	client.sendSafe(createMessage(MsgPvPLeaderboard, payload))
}

func handleMsgPvPFlag(client *Client, message Message) {
	var payload PvPFlagPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid PvP flag request")
		return
	}
	if err := world.SetOpenWorldPvP(client.playerID, payload.Enabled); err != nil {
		client.sendError(err.Error())
		return
	}
	if payload.Enabled {
		client.sendSystemChat("Open-world PvP enabled. Combat remains disabled inside the town safe zone.")
	} else {
		client.sendSystemChat("Open-world PvP disabled.")
	}
	sendPvPState(client)
}

func worldTime() time.Time { return time.Now().UTC() }

func hydratePvPProfile(playerID string) {
	if db == nil || playerID == "" {
		return
	}
	profile, err := db.GetPvPProfile(playerID)
	if err != nil || profile == nil {
		return
	}
	world.SetPvPProfile(game.PvPProfile{
		PlayerID: profile.PlayerID, Rating: profile.Rating, Wins: profile.Wins, Losses: profile.Losses,
		Honor: profile.Honor, SeasonPoints: profile.SeasonPoints, UpdatedAt: profile.UpdatedAt,
	})
}

func sendPvPState(client *Client) {
	if client == nil || client.playerID == "" {
		return
	}
	payload, _ := json.Marshal(world.PvPStatus(client.playerID))
	client.sendSafe(createMessage(MsgPvPUpdate, payload))
}

func sendPvPMatchState(match *game.PvPMatch) {
	if match == nil {
		return
	}
	for _, playerID := range append(append([]string(nil), match.TeamA...), match.TeamB...) {
		if client := getClientByPlayerID(playerID); client != nil {
			sendPvPState(client)
		}
	}
}

func persistPvPMatchResult(result game.PvPMatchResult) {
	for _, profile := range result.Profiles {
		err := db.SavePvPProfile(database.PvPProfile{
			PlayerID: profile.PlayerID, Rating: profile.Rating, Wins: profile.Wins, Losses: profile.Losses,
			Honor: profile.Honor, SeasonPoints: profile.SeasonPoints, UpdatedAt: profile.UpdatedAt,
		})
		if err != nil {
			log.Printf("save PvP profile %s: %v", profile.PlayerID, err)
		}
	}
	// Practice results have no profiles to persist, but every participant still
	// needs the cleared match state and a result message.
	for _, playerID := range append(append([]string(nil), result.WinnerIDs...), result.LoserIDs...) {
		if client := getClientByPlayerID(playerID); client != nil {
			if len(result.WinnerIDs) == 0 {
				client.sendSystemChat("PvP match cancelled. No ranked rewards or rating changes.")
			} else if result.Mode == game.PvPModeDuel {
				if containsString(result.WinnerIDs, playerID) {
					client.sendSystemChat("Practice duel victory! No rating, honor, or season points awarded.")
				} else {
					client.sendSystemChat("Practice duel complete. Your ranked record is unchanged.")
				}
			} else if containsString(result.WinnerIDs, playerID) {
				client.sendSystemChat("PvP victory! +50 honor, rating increased.")
			} else {
				client.sendSystemChat("PvP match complete. +15 honor.")
			}
			sendPvPState(client)
		}
	}
}

func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
