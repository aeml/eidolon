package game

import (
	"testing"
	"time"
)

// Prepared reward-pipeline regression, NOT an earned boss/dungeon clear. The
// separate four-browser route proves actual inputs, healing and combat.
func TestFourRolePartySharesBossCreditAndRequiresIndividualWizardTurnIn(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	const instanceID = "party-chronicle-credit"
	var members []*Entity
	for _, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		p := newTestPlayer("credit-"+class, class)
		p.Level, p.Experience, p.MaxExperience = 30, 0, experienceRequiredForLevel(30)
		p.BaseStats = applyLevelGrowth(InitialPlayerStats(), 30)
		p.Inventory = make([]Item, MaxInventorySize)
		p.InstanceID = instanceID
		completedChronicleThrough(p, 2)
		w.AddEntity(p)
		members = append(members, p)
	}
	party := w.CreateParty(members[0].ID)
	for _, member := range members[1:] {
		if err := w.JoinParty(party.ID, member.ID); err != nil {
			t.Fatal(err)
		}
	}
	// They are still in this dungeon, but nowhere near the final boss. A
	// downed healer must retain credit too; no damage contribution is required.
	members[1].X, members[1].State = 1000, "DEAD"
	members[3].Z = -1000
	w.AddEntity(&Entity{ID: "story-wizard-1", Type: TypeNPC})
	layout := DungeonLayout{Rooms: []DungeonRoom{{Width: 40, Height: 40, Type: "boss"}}}
	w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, Layout: layout,
		DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyNormal, RunLevel: 30,
		RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
	receipts := make(chan RewardSummaryEvent, 8)
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "reward_summary" {
			receipts <- value.(RewardSummaryEvent)
		}
	}
	boss := &Entity{ID: "credit-sentinel", Type: TypeEnemy, SubType: "HollowSentinel",
		Level: 30, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
	w.AddEntity(boss)
	boss.Mu.Lock()
	w.handleDeath(boss, members[2], nil) // Wizard kill; healer dealt no damage.
	boss.Mu.Unlock()
	byPlayer := map[string]RewardSummaryEvent{}
	deadline := time.After(5 * time.Second)
	for len(byPlayer) < len(members) {
		select {
		case receipt := <-receipts:
			if _, duplicate := byPlayer[receipt.PlayerID]; duplicate {
				t.Fatal("duplicate party boss receipt")
			}
			byPlayer[receipt.PlayerID] = receipt
		case <-deadline:
			t.Fatalf("only %d of four members received boss rewards", len(byPlayer))
		}
	}
	if err := w.RequirePartyChronicleQuest(party.ID, ChronicleEarthDungeonID); err == nil {
		t.Fatal("unclaimed objectives unlocked the party crystal raid")
	}
	for _, member := range members {
		snapshot := w.GetEntityCopy(member.ID)
		q := *questByID(t, snapshot, ChronicleEarthDungeonID)
		gold, xp := snapshot.Gold, snapshot.Experience
		receipt := byPlayer[member.ID]
		// This release line retains the old reward curve, so the kill can
		// cross levels. Count earned XP, not only the remainder in this level.
		earnedXP := xp
		for level := 30; level < snapshot.Level; level++ {
			earnedXP += experienceRequiredForLevel(level)
		}
		if receipt.Gold <= 0 || receipt.XP <= 0 || gold != receipt.Gold || earnedXP != receipt.XP {
			t.Fatalf("%s did not receive its recorded combat reward: gold=%d xp=%d receipt=%+v", member.SubType, gold, xp, receipt)
		}
		if q.Count != q.MaxCount || q.Completed || q.GrantedGold != 0 || q.GrantedXP != 0 {
			t.Fatalf("%s boss credit must be ready but unclaimed: %+v", member.SubType, q)
		}
		if _, ok := w.PerformCompleteQuest(member.ID, q.ID); ok {
			t.Fatal("quest claimed remotely from the dungeon")
		}
		member.Mu.Lock()
		member.InstanceID = "" // Prepared town proximity, not a Recall receipt.
		member.X, member.Z, member.State = 0, 0, "IDLE"
		member.Mu.Unlock()
	}
	for index, member := range members {
		member.Mu.RLock()
		beforeGold := member.Gold
		member.Mu.RUnlock()
		if _, ok := w.PerformCompleteQuest(member.ID, ChronicleEarthDungeonID); !ok {
			t.Fatalf("%s could not explicitly turn in to Ilyra", member.SubType)
		}
		snapshot := w.GetEntityCopy(member.ID)
		q := *questByID(t, snapshot, ChronicleEarthDungeonID)
		gold, xp, level := snapshot.Gold, snapshot.Experience, snapshot.Level
		if !q.Completed || q.GrantedGold <= 0 || q.GrantedXP <= 0 || gold-beforeGold != q.GrantedGold {
			t.Fatalf("%s manual quest payout mismatch: %+v", member.SubType, q)
		}
		if _, ok := w.PerformCompleteQuest(member.ID, ChronicleEarthDungeonID); ok {
			t.Fatal("duplicate quest turn-in accepted")
		}
		member.Mu.RLock()
		unchanged := member.Gold == gold && member.Experience == xp && member.Level == level
		member.Mu.RUnlock()
		if !unchanged {
			t.Fatal("duplicate turn-in changed rewards")
		}
		err := w.RequirePartyChronicleQuest(party.ID, ChronicleEarthDungeonID)
		if (index == len(members)-1) != (err == nil) {
			t.Fatalf("party raid unlock must wait for every individual turn-in, claimed=%d: %v", index+1, err)
		}
	}
}
