package main

import (
	"encoding/json"
	"fmt"
	"testing"

	"eidolon-server/internal/game"
)

func TestAbilityDispatchRejectsFiniteJSONCoordinateOverflow(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	for _, spec := range []struct{ class, skill string }{
		{"Wizard", "Fireball"}, {"Fighter", "Charge"},
		{"Rogue", "Piercing Throw"}, {"Cleric", "Spirit Guardians"},
	} {
		for _, axis := range []string{"targetX", "targetZ"} {
			t.Run(spec.class+"/"+axis, func(t *testing.T) {
				world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
				client := newAutoStatusClient("invalid-coordinate")
				player := newAutoStatusPlayer(client.playerID, "Caster", "available")
				player.SubType, player.Mana, player.MaxMana = spec.class, 200, 200
				world.AddEntity(player)
				payload := json.RawMessage(fmt.Sprintf(`{"%s":1e39,"skillName":%q}`, axis, spec.skill))
				client.handleMessage(Message{Type: MsgAbility, Payload: payload})
				messages := drainSentMessages(client.send)
				if len(messages) != 1 || messages[0].Type != MsgAbilityResult {
					t.Fatalf("invalid JSON coordinate should produce one rejection, got %+v", messages)
				}
				var result game.AbilityResult
				if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
					t.Fatal(err)
				}
				if result.Accepted || result.Reason != "invalid_target" || result.SkillName != spec.skill || result.Mana != 200 ||
					player.Mana != 200 || len(player.Cooldowns) != 0 || len(world.Entities) != 1 {
					t.Fatalf("overflow was not rejected without spending/publishing effects: %+v", result)
				}
			})
		}
	}
}
