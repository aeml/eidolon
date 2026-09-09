package game

import (
	"testing"
	"time"
)

func TestChronicleAnchorActualAttackSharesOnlyEligiblePreparedPartyEvidence(t *testing.T) {
	w := newTestWorld()
	w.spawnChronicleInvestigationSites()
	chapter := ChronicleInvestigationCatalog()[5]
	ash, anchor := chapter.Sites[0], chapter.Sites[1]
	players := []*Entity{
		investigationPlayer(w, chapter, "anchor-attacker"),
		investigationPlayer(w, chapter, "prepared-party"),
		investigationPlayer(w, chapter, "unprepared-party"),
		investigationPlayer(w, chapter, "distant-party"),
	}
	party := w.CreateParty(players[0].ID)
	for index, p := range players {
		if index > 0 {
			if err := w.JoinParty(party.ID, p.ID); err != nil {
				t.Fatal(err)
			}
		}
		if index != 2 {
			p.X, p.Z = ash.X, ash.Z
			if _, err := w.InspectChronicleSite(p.ID, ash.EntityID); err != nil {
				t.Fatal(err)
			}
		}
		p.X, p.Z = anchor.X+2, anchor.Z
	}
	players[3].Z += 500
	attacker := players[0]
	// Prepared damage fixture, but the accepted ordinary attack, wind-up,
	// impact, death and party-credit pipelines are all production code.
	attacker.SubType, attacker.Level, attacker.Damage = "Fighter", 75, 1_000_000
	updates := make(chan string, 8)
	w.OnQuestUpdate = func(playerID string, quests []Quest) {
		for _, q := range quests {
			if q.ID == chapter.ID && q.InvestigationMask == 3 {
				updates <- playerID
			}
		}
	}
	if _, accepted := w.PerformAttack(attacker.ID, anchor.EntityID); !accepted {
		t.Fatal("real anchor attack rejected")
	}
	seen := map[string]bool{}
	for len(seen) < 2 {
		select {
		case id := <-updates:
			seen[id] = true
		case <-time.After(3 * time.Second):
			t.Fatal("real lethal impact did not publish party discoveries")
		}
	}
	if !seen[attacker.ID] || !seen[players[1].ID] {
		t.Fatalf("wrong recipients: %+v", seen)
	}
	if enemy := w.GetEntityCopy(anchor.EntityID); enemy.State != "DEAD" || enemy.Health != 0 {
		t.Fatal("discovery preceded an actual defeat")
	}
	for index, p := range players {
		copy := w.GetEntityCopy(p.ID)
		want := uint32(3)
		if index == 2 {
			want = 0
		} else if index == 3 {
			want = 1
		}
		q := copy.Quests[0]
		if q.InvestigationMask != want || q.Completed || q.GrantedXP != 0 || q.GrantedGold != 0 {
			t.Fatalf("invalid combat evidence/reward: %+v", q)
		}
	}
}
