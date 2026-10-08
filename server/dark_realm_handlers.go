package main

import (
	"encoding/json"

	"eidolon-server/internal/game"
	"github.com/google/uuid"
)

const darkRealmAdminAuditAction = "admin_dark_realm_access"

func handleEnterDarkRealm(client *Client, message Message) {
	// No destination, party or player IDs come from this request.
	var request struct{}
	if len(message.Payload) > 0 && json.Unmarshal(message.Payload, &request) != nil {
		client.sendError("invalid Dark Realm request")
		return
	}
	player := world.GetEntityCopy(client.playerID)
	administrator := false
	if !game.DarkRealmEntryAllowed(player) && darkRealmAdministrator(client) {
		// Audit the permission before travel, not a fabricated successful move.
		// Audit failure or role/session loss cannot admit a privileged journey.
		authorization := auditAdminReadResult(client, darkRealmAdminAuditAction, adminReadResult{
			ID: uuid.NewString(), Authorized: true, Success: true,
			Message: "Dark Realm story-gate bypass authorized; normal level and travel checks still apply.",
		})
		administrator = authorization.Success && authorization.Authorized && darkRealmAdministrator(client)
	}
	if client.transportClosed.Load() || !currentCharacterConnection(client) {
		client.sendError("Your connection changed. Reconnect before entering the Dark Realm.")
		return
	}
	var err error
	if administrator {
		err = world.EnterDarkRealmForAdministrator(client.playerID)
	} else {
		err = world.EnterDarkRealm(client.playerID)
	}
	if err != nil {
		client.sendError(err.Error())
		return
	}
	player = world.GetEntityCopy(client.playerID)
	if player == nil || player.InstanceID != game.DarkRealmInstanceID {
		return
	}
	// Recall gives the client a recovery movement context. Realm entry clears
	// it on the server, so publish that reset before accepting new scene input.
	// Otherwise the client walks locally while every move is rejected as stale.
	sendMovementContext(client)
	payload, _ := json.Marshal(map[string]interface{}{
		"instanceId": game.DarkRealmInstanceID, "type": game.DarkRealmInstanceType,
		"layout": game.DarkRealmLayout(),
		"spawn":  map[string]float64{"x": player.X, "y": player.Y, "z": player.Z},
	})
	client.sendSafe(createMessage(MsgEnterInstance, payload))
}

func darkRealmAdministrator(client *Client) bool {
	return client != nil && client.username != "" && adminAuthorityDenial(client) == ""
}
