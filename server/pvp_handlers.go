package main

import (
	"encoding/json"
	"fmt"
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
	sendPvPEntry(match)
	sendPvPMatchState(match)
}

func handleMsgArenaQueue(client *Client, message Message) {
	var payload ArenaQueuePayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid arena queue request")
		return
	}
	if err := hydratePvPProfile(client.playerID); err != nil && !payload.Practice {
		client.sendError(err.Error())
		return
	}
	if payload.TeamSize == 2 {
		if player := world.GetEntityCopy(client.playerID); player != nil {
			if party := world.GetParty(player.PartyID); party != nil {
				_, _, members := party.GetSnapshot()
				for _, id := range members {
					if id != client.playerID {
						if err := hydratePvPProfile(id); err != nil && !payload.Practice {
							client.sendError("Team member's arena profile is unavailable or still syncing.")
							return
						}
					}
				}
			}
		}
	}
	match, err := world.JoinArenaQueueWithMode(client.playerID, payload.TeamSize, payload.Practice)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	if match == nil {
		client.sendSystemChat("Queued for arena.")
		sendPvPState(client)
		return
	}
	sendPvPEntry(match)
	sendPvPMatchState(match)
	if !containsString(match.TeamA, client.playerID) && !containsString(match.TeamB, client.playerID) {
		// This join may have unlocked a match between two older queued teams.
		// The caller still needs its own authoritative waiting snapshot.
		sendPvPState(client)
	}
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

func hydratePvPProfile(playerID string) error {
	// Keep an admitted match's season/profile stable through settlement. A UI
	// refresh at midnight must not roll the DB ahead of its pending result.
	if world != nil && world.HasPvPMatch(playerID) {
		return nil
	}
	if db == nil || playerID == "" {
		return fmt.Errorf("arena profile service unavailable")
	}
	// A rollover must not consume the revision of a still-journaled match.
	if err := retryPendingPvPResults(); err != nil {
		return fmt.Errorf("arena results are still syncing; try again shortly")
	}
	profile, err := db.GetPvPProfile(playerID)
	if err != nil || profile == nil {
		return fmt.Errorf("arena profile service unavailable")
	}
	if world.PvPProfileRevision(playerID) > profile.Revision {
		return fmt.Errorf("your last arena result is still syncing; try again shortly")
	}
	world.SetPvPProfile(game.PvPProfile{
		SeasonVictories: profile.SeasonVictories, SeasonHistory: profile.SeasonHistory,
		LastResult: profile.LastResult, RewardState: profile.RewardState,
		Revision: profile.Revision, LastMatchID: profile.LastMatchID, Season: profile.Season,
		PlayerID: profile.PlayerID, Rating: profile.Rating, Wins: profile.Wins, Losses: profile.Losses,
		Honor: profile.Honor, SeasonPoints: profile.SeasonPoints, UpdatedAt: profile.UpdatedAt,
	})
	return nil
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

// Match/score snapshots do not load a world. Send the same explicit scene
// contract used by dungeons at initial admission, never on elimination updates.
func sendPvPEntry(match *game.PvPMatch) {
	if match == nil {
		return
	}
	layout, exists := world.GetInstanceLayout(match.ID)
	if !exists {
		return
	}
	for _, id := range append(append([]string(nil), match.TeamA...), match.TeamB...) {
		client, player := getClientByPlayerID(id), world.GetEntityCopy(id)
		if client == nil || player == nil || player.InstanceID != match.ID {
			continue
		}
		sendPvPScene(client, player, "pvp_arena", &layout)
	}
}

func sendPvPScene(client *Client, player *game.Entity, sceneType string, layout *game.DungeonLayout) {
	payload, _ := json.Marshal(map[string]interface{}{
		"instanceId": player.InstanceID, "type": sceneType, "layout": layout,
		"spawn": map[string]float64{"x": player.X, "y": player.Y, "z": player.Z},
	})
	client.sendSafe(createMessage(MsgEnterInstance, payload))
}

func persistPvPMatchResult(result game.PvPMatchResult) {
	commitErr := commitPvPResult(result)
	if commitErr != nil {
		log.Printf("Arena result %s remains journaled for retry: %v", result.MatchID, commitErr)
	}
	// Practice results have no profiles to persist, but every participant still
	// needs the cleared match state and a result message.
	for _, playerID := range append(append([]string(nil), result.WinnerIDs...), result.LoserIDs...) {
		if client := getClientByPlayerID(playerID); client != nil {
			// Completion callbacks can arrive after another action. Never replace
			// a newer dungeon or arena with a stale overworld result scene.
			if player := world.GetEntityCopy(playerID); player != nil && player.InstanceID == "" && !world.HasPvPMatch(playerID) {
				sendPvPScene(client, player, "overworld", nil)
			}
			if commitErr != nil {
				client.sendSystemChat("Arena result recorded safely. Rating and rewards are syncing; ranked queue will reopen when synchronization finishes.")
			} else if len(result.WinnerIDs) == 0 {
				client.sendSystemChat("PvP match cancelled. No ranked rewards or rating changes.")
			} else if result.Mode == game.PvPModeDuel || result.Practice {
				label := "Practice arena"
				if result.Mode == game.PvPModeDuel {
					label = "Practice duel"
				}
				if containsString(result.WinnerIDs, playerID) {
					client.sendSystemChat(label + " victory! No rating, honor, or season points awarded.")
				} else {
					client.sendSystemChat(label + " complete. Your ranked record is unchanged.")
				}
			} else {
				for _, profile := range result.Profiles {
					if profile.PlayerID == playerID {
						summary := profile.LastResult
						client.sendSystemChat(fmt.Sprintf("Arena result: rating %+d → %d, +%d Honor, +%d season points. %s", summary.RatingChange, profile.Rating, summary.HonorAwarded, summary.SeasonAwarded, summary.Reason))
						break
					}
				}
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
