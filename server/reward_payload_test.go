package main

import (
	"bytes"
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestRewardPayloadPreservesEarnedProgressionAndCompletion(t *testing.T) {
	for _, earned := range []game.ExperienceRewardReceipt{
		{XP: 100}, {ResonanceXP: 100}, {XP: 40, ResonanceXP: 60},
	} {
		boss := game.RewardSummaryEvent{PlayerID: "recipient", Title: "Actual boss reward",
			XP: 100, Gold: 42, RunComplete: true, Progression: &earned,
			InstanceType: "weekly_raid", ExitHint: "Personal cache settles separately."}
		room := game.DungeonRoomClearRewardEvent{PlayerID: "recipient", Title: "Actual room reward",
			XP: 100, Gold: 42, RoomIndex: 2, ObjectiveRoomIndex: 3, Progression: &earned,
			HealthRestored: 20, BuffName: "Sanctuary", BuffDurationSeconds: 15}
		for _, pair := range []struct{ event, payload any }{
			{boss, RewardSummaryPayload(boss)}, {room, RoomClearRewardPayload(room)},
		} {
			expected, err := json.Marshal(pair.event)
			if err != nil {
				t.Fatal(err)
			}
			actual, err := json.Marshal(pair.payload)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(expected, actual) {
				t.Fatalf("transport changed the earned reward: expected %s; got %s", expected, actual)
			}
			var wire struct {
				PlayerID    string                        `json:"playerId"`
				Gold        int                           `json:"gold"`
				Progression *game.ExperienceRewardReceipt `json:"progression"`
			}
			if err := json.Unmarshal(actual, &wire); err != nil {
				t.Fatal(err)
			}
			if wire.PlayerID != "recipient" || wire.Gold != 42 || wire.Progression == nil || *wire.Progression != earned {
				t.Fatalf("recipient, Gold or XP/Resonance receipt was dropped: %+v", wire)
			}
		}
	}
}
