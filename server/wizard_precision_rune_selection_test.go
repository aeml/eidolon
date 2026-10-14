package main

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestWizardPrecisionRuneSelectionRequiresEarnedLevelAndOwnedSkill(t *testing.T) {
	previous := world
	defer func() { world = previous }()
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	skills := []string{"Fireball", "Scorch Beam", "Arcane Missiles", "Spell Focus", "Dragonfire Lance"}
	owned := map[string]bool{"Scorch Beam": true, "Arcane Missiles": true, "Spell Focus": true, "Dragonfire Lance": true}
	count := 0
	for _, rune := range game.GetAllRunesForClass("Wizard") {
		if !owned[rune.Skill] {
			continue
		}
		count++
		t.Run(rune.ID, func(t *testing.T) {
			player := newAutoStatusPlayer("precision-"+rune.ID, "Precision tester", "available")
			player.SubType, player.SelectedBranch, player.UnlockedSkills = "Wizard", "B", skills
			player.Level = rune.UnlockLevel - 1
			world.AddEntity(player)
			selectRune := func(wantOK bool) {
				t.Helper()
				client := newAutoStatusClient(player.ID)
				payload, err := json.Marshal(map[string]string{"skill": rune.Skill, "runeId": rune.ID, "requestId": "precision-rune"})
				if err != nil {
					t.Fatal(err)
				}
				client.handleMessage(Message{Type: MsgSelectRune, Payload: payload})
				found := false
				for _, message := range drainSentMessages(client.send) {
					if message.Type != "build_action" {
						continue
					}
					var receipt struct {
						RequestID string `json:"requestId"`
						OK        bool   `json:"ok"`
					}
					if err := json.Unmarshal(message.Payload, &receipt); err != nil {
						t.Fatal(err)
					}
					if receipt.RequestID != "precision-rune" || receipt.OK != wantOK {
						t.Fatalf("receipt %+v expected%v", receipt, wantOK)
					}
					found = true
				}
				if !found {
					t.Fatal("missing server receipt")
				}
			}
			selectRune(false)
			if player.SkillRunes[rune.Skill] != "" {
				t.Fatal("unearned rune equipped")
			}
			player.Level = rune.UnlockLevel
			player.UnlockedSkills = []string{"Fireball"}
			selectRune(false)
			if player.SkillRunes[rune.Skill] != "" {
				t.Fatal("cross-branch rune equipped")
			}
			player.UnlockedSkills = skills
			selectRune(true)
			if player.SkillRunes[rune.Skill] != rune.ID {
				t.Fatal("earned rune not selected")
			}
			// The real save path captures a detached world copy before serialization.
			snapshot := characterSnapshot("precision-test", world.GetEntityCopy(player.ID), time.Now())
			data, err := bson.Marshal(snapshot)
			if err != nil {
				t.Fatal(err)
			}
			if err := bson.Unmarshal(data, snapshot); err != nil {
				t.Fatal(err)
			}
			if snapshot.SkillRunes[rune.Skill] != rune.ID {
				t.Fatal("selected rune lost in character save format")
			}
			snapshot.SkillRunes[rune.Skill] = "mutated"
			if player.SkillRunes[rune.Skill] != rune.ID {
				t.Fatal("save aliases the live rune selection")
			}
		})
	}
	if count != 12 {
		t.Fatalf("expected all12 new precision rune choices, got%d", count)
	}
}
