package main

import (
	"eidolon-server/internal/game"
	"strings"
	"testing"
)

func TestWeeklyRewardMessageUsesActualReceipt(t *testing.T) {
	for _, item := range []bool{false, true} {
		message := weeklyRaidRewardMessage(game.WeeklyRaidRewardReceipt{Gold: 123, ResonanceXP: 456, ItemGranted: item})
		if !strings.Contains(message, "+123 gold, +456 Resonance XP") || strings.Contains(message, "Resonance level") {
			t.Fatalf("hardcoded weekly reward: %s", message)
		}
		if strings.Contains(message, "endgame unique") != item || strings.Contains(message, "No equipment") == item {
			t.Fatalf("misleading equipment receipt: %s", message)
		}
	}
}
