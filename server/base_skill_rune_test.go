package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestBaseSkillRunesWithoutSpecialization(t *testing.T) {
	previous := world
	defer func() { world = previous }()
	for _, className := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(className, func(t *testing.T) {
			world = game.NewWorld(nil)
			client := newAutoStatusClient("base-rune-" + className)
			player := newAutoStatusPlayer(client.playerID, "Rune tester", "available")
			player.SubType = className
			player.SelectedBranch = ""
			player.UnlockedSkills = nil
			player.Health, player.MaxHealth = 100, 100
			world.AddEntity(player)
			selectRune := func(skill, rune string, wantOK bool) {
				t.Helper()
				payload, err := json.Marshal(map[string]string{"skill": skill, "runeId": rune, "requestId": "base-rune"})
				if err != nil {
					t.Fatal(err)
				}
				// Independent request fixtures must not accidentally test the
				// transport burst limiter instead of rune authorization.
				requestClient := newAutoStatusClient(client.playerID)
				requestClient.handleMessage(Message{Type: MsgSelectRune, Payload: payload})
				found := false
				for _, message := range drainSentMessages(requestClient.send) {
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
					found = true
					if receipt.RequestID != "base-rune" || receipt.OK != wantOK {
						t.Fatalf("rune %s: receipt %+v, expected success=%v", rune, receipt, wantOK)
					}
				}
				if !found {
					t.Fatal("missing actual build receipt")
				}
			}
			baseRunes := 0
			for _, rune := range game.GetAllRunesForClass(className) {
				if !game.IsBaseClassSkill(className, rune.Skill) {
					continue
				}
				baseRunes++
				player.Level = rune.UnlockLevel - 1
				selectRune(rune.Skill, rune.ID, false)
				if player.SkillRunes[rune.Skill] != "" {
					t.Fatal("locked rune was equipped")
				}
				player.Level = rune.UnlockLevel
				selectRune(rune.Skill, rune.ID, true)
				if player.SkillRunes[rune.Skill] != rune.ID {
					t.Fatal("base rune not applied")
				}
				selectRune(rune.Skill, "", true)
				if player.SkillRunes[rune.Skill] != "" {
					t.Fatal("base rune not removed")
				}
			}
			if baseRunes != 3 {
				t.Fatalf("expected three starting-ability runes, got %d", baseRunes)
			}
			player.Level = 100
			for _, rune := range game.GetAllRunesForClass(className) {
				if game.IsBaseClassSkill(className, rune.Skill) {
					continue
				}
				selectRune(rune.Skill, rune.ID, false)
			}
			foreignClass := "Wizard"
			if className == foreignClass {
				foreignClass = "Fighter"
			}
			for _, rune := range game.GetAllRunesForClass(foreignClass) {
				selectRune(rune.Skill, rune.ID, false)
			}
			if player.SelectedBranch != "" || len(player.UnlockedSkills) != 0 || len(player.SkillRunes) != 0 {
				t.Fatal("rune selection invented specialization/unlocks or retained a rejected rune")
			}
		})
	}
}
