package main

import (
	"encoding/json"
	"maps"

	"eidolon-server/internal/game"
)

func handleMsgEndgameGet(client *Client, _ Message) {
	sendEndgameState(client)
}

func handleMsgEndgameSpend(client *Client, message Message) {
	var payload EndgameSpendPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid resonance request")
		return
	}
	if _, err := world.SpendResonancePoint(client.playerID, payload.Trait); err != nil {
		client.sendError(err.Error())
		return
	}
	savePlayer(client)
	sendEndgameState(client)
}

func sendEndgameState(client *Client) {
	if client == nil || client.playerID == "" {
		return
	}
	// Serialize snapshot acquisition and enqueue with the world broadcaster so
	// an older snapshot cannot overtake a newer explicit reward/menu update.
	client.stateMu.Lock()
	defer client.stateMu.Unlock()
	progress, ok := world.EndgameProgressForPlayer(client.playerID)
	if !ok {
		return
	}
	client.sendEndgameProgressLocked(progress, true)
}

// Caller holds stateMu. Ordinary kills and room rewards do not have dedicated
// endgame notifications; the world tick catches every authoritative change,
// without sending an unchanged payload each tick or changing the wire format.
func (client *Client) sendEndgameProgressLocked(progress game.EndgameProgress, force bool) {
	last := client.lastEndgame
	if !force && last != nil && last.Unlocked == progress.Unlocked &&
		last.Level == progress.Level && last.XP == progress.XP &&
		last.XPToNext == progress.XPToNext && last.AvailablePoints == progress.AvailablePoints &&
		maps.Equal(last.Ranks, progress.Ranks) {
		return
	}
	payload, _ := json.Marshal(progress)
	if client.sendSafe(createMessage(MsgEndgameUpdate, payload)) {
		client.lastEndgame = &progress
	}
}
