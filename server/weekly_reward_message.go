package main

import (
	"eidolon-server/internal/game"
	"fmt"
)

func weeklyRaidRewardMessage(receipt game.WeeklyRaidRewardReceipt) string {
	message := fmt.Sprintf("Weekly Umbra cache: +%d gold, +%d Resonance XP", receipt.Gold, receipt.ResonanceXP)
	if receipt.ItemGranted {
		return message + ", and an endgame unique."
	}
	return message + ". No equipment was added; any full-bag compensation is included in the gold total."
}
