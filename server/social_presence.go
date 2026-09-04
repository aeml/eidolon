package main

import (
	"encoding/json"
	"log"
	"strings"

	"eidolon-server/internal/game"
)

func autoSetSocialStatus(c *Client, playerID, newStatus string) {
	status, changed := world.SetPlayerSocialStatusAutomatic(playerID, newStatus)
	if !changed {
		return
	}
	// Ack to the affected player so their UI dropdown reflects the new value.
	ackPayload, _ := json.Marshal(SocialStatusPayload{Status: status})
	c.sendSafe(createMessage(MsgSocialStatus, ackPayload))
	// Broadcast fresh list to all sessions.
	go broadcastSocialToAll()
}

func buildSocialList() []SocialEntry {
	return buildSocialListFor("")
}

func buildSocialListFor(viewerUsername string) []SocialEntry {
	var list []SocialEntry
	sessionsMu.Lock()
	ids := make([]string, 0, len(activeSessions))
	for _, client := range activeSessions {
		if client.playerID != "" {
			ids = append(ids, client.playerID)
		}
	}
	sessionsMu.Unlock()

	for _, id := range ids {
		entity := world.GetEntity(id)
		if entity == nil {
			continue
		}
		entity.Mu.RLock()
		if viewerUsername != "" && chatService.shouldFilter(viewerUsername, entity.Name) {
			entity.Mu.RUnlock()
			continue
		}
		entry := SocialEntry{
			Name:         entity.Name,
			Class:        entity.SubType,
			Level:        entity.Level,
			SocialStatus: game.NormalizeSocialStatus(entity.SocialStatus),
		}
		entity.Mu.RUnlock()
		list = append(list, entry)
	}
	return list
}

// broadcastSocialToAll sends a fresh MsgSocial list to every active session.
// Called whenever a player's social status changes (0.37.3).
func broadcastSocialToAll() {
	sessionsMu.Lock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, c := range activeSessions {
		clients = append(clients, c)
	}
	sessionsMu.Unlock()

	for _, c := range clients {
		payload, _ := json.Marshal(buildSocialListFor(c.username))
		msg := createMessage(MsgSocial, payload)
		c.sendSafe(msg)
	}
}

// usernameToPlayerID returns the canonical playerID for a given username.
func usernameToPlayerID(username string) string {
	return "player-" + username
}

// playerIDToUsername strips the "player-" prefix to recover the username.
func playerIDToUsername(playerID string) string {
	return strings.TrimPrefix(playerID, "player-")
}

// buildFriendListPayload assembles a FriendListPayload for the given playerID.
// It reads accepted friends and pending incoming requests from the DB, then
// cross-references activeSessions to determine online status.
func buildFriendListPayload(playerID string) FriendListPayload {
	friends, err := db.GetFriends(playerID)
	if err != nil {
		log.Printf("buildFriendListPayload: DB error for %s: %v", playerID, err)
		return FriendListPayload{Friends: []FriendEntry{}, Pending: []string{}}
	}

	pendingDocs, err := db.GetPendingRequests(playerID)
	if err != nil {
		log.Printf("buildFriendListPayload: pending DB error for %s: %v", playerID, err)
		pendingDocs = nil
	}

	entries := make([]FriendEntry, 0, len(friends))
	for _, f := range friends {
		otherID := f.RequesterID
		if f.RequesterID == playerID {
			otherID = f.AddresseeID
		}
		otherUsername := playerIDToUsername(otherID)

		entry := FriendEntry{Username: otherUsername}

		sessionsMu.Lock()
		otherClient, online := activeSessions[otherUsername]
		sessionsMu.Unlock()

		if online && otherClient.playerID != "" {
			entry.Online = true
			entity := world.GetEntity(otherClient.playerID)
			if entity != nil {
				entity.Mu.RLock()
				entry.SocialStatus = game.NormalizeSocialStatus(entity.SocialStatus)
				entity.Mu.RUnlock()
			}
		}
		entries = append(entries, entry)
	}

	pendingUsernames := make([]string, 0, len(pendingDocs))
	for _, p := range pendingDocs {
		pendingUsernames = append(pendingUsernames, playerIDToUsername(p.RequesterID))
	}

	return FriendListPayload{Friends: entries, Pending: pendingUsernames}
}

// notifyFriendsPresence pushes a MsgFriendPresence packet to every online friend of username.
// Called on login (online=true) and disconnect (online=false).
func notifyFriendsPresence(username string, online bool) {
	playerID := usernameToPlayerID(username)
	friends, err := db.GetFriends(playerID)
	if err != nil {
		log.Printf("notifyFriendsPresence: DB error for %s: %v", username, err)
		return
	}

	payload, _ := json.Marshal(FriendPresencePayload{Username: username, Online: online})
	msg := createMessage(MsgFriendPresence, payload)

	for _, f := range friends {
		otherID := f.RequesterID
		if f.RequesterID == playerID {
			otherID = f.AddresseeID
		}
		otherUsername := playerIDToUsername(otherID)

		sessionsMu.Lock()
		otherClient, ok := activeSessions[otherUsername]
		sessionsMu.Unlock()
		if ok {
			otherClient.sendSafe(msg)
		}
	}
}
