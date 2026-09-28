package game

import (
	"strings"
	"testing"
)

func TestFinalCampaignDirectionsRefreshWithoutRewritingSavedContracts(t *testing.T) {
	for _, id := range []string{ChronicleGateOpenedID, ChronicleDarkKingID} {
		for _, completed := range []bool{false, true} {
			player := &Entity{Quests: []Quest{{
				ID: id, Accepted: true, Completed: completed, Count: 2, MaxCount: 5,
				Description: "Beyond the portal waits Malachar.", ObjectiveText: "Saved five-enemy objective.",
				RewardGold: 0, RewardXP: 123, RewardGoldQuoted: true, RewardXPQuoted: true,
				GrantedGold: 456, GrantedXP: 789, GrantedResonanceXP: 321,
			}}}
			ensureChronicleLocked(player)
			quest := questByID(t, player, id)
			if !strings.Contains(quest.Description, "Dungeon Guide") || !strings.Contains(quest.Description, "Lanternhold") ||
				!strings.Contains(quest.Description, "personally complete") || strings.Contains(quest.Description, "Beyond the portal waits") {
				t.Fatalf("%s kept ambiguous or incomplete admission/claim directions: %s", id, quest.Description)
			}
			if quest.Count != 2 || quest.MaxCount != 5 || !quest.Accepted || quest.Completed != completed ||
				quest.ObjectiveText != "Saved five-enemy objective." || quest.RewardGold != 0 || quest.RewardXP != 123 ||
				!quest.RewardGoldQuoted || !quest.RewardXPQuoted || quest.GrantedGold != 456 ||
				quest.GrantedXP != 789 || quest.GrantedResonanceXP != 321 {
				t.Fatalf("%s copy refresh rewrote a saved contract: %+v", id, quest)
			}
		}
	}
}
