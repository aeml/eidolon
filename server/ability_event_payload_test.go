package main

import (
	"encoding/json"
	"math"
	"testing"

	"eidolon-server/internal/game"
)

func TestAbilityPayloadPreservesOptionalResolvedShape(t *testing.T) {
	for _, shaped := range []bool{false, true} {
		event := game.AbilityEvent{SourceID: "caster", TargetID: "target", SkillName: "Flame Whip", TargetX: 12, TargetZ: 34}
		if shaped {
			event.Radius = 21.75
			event.Arc = 2 * math.Pi
		}
		payload, err := json.Marshal(abilityPayloadFromEvent(event))
		if err != nil {
			t.Fatal(err)
		}
		var wire map[string]interface{}
		if err := json.Unmarshal(payload, &wire); err != nil {
			t.Fatal(err)
		}
		if wire["sourceId"] != "caster" || wire["targetId"] != "target" || wire["targetX"] != 12.0 || wire["targetZ"] != 34.0 || wire["skillName"] != "Flame Whip" {
			t.Fatal(wire)
		}
		if shaped {
			if wire["radius"] != 21.75 || wire["arc"] != 2*math.Pi {
				t.Fatal(wire)
			}
		} else {
			if _, ok := wire["radius"]; ok {
				t.Fatal("legacy cast gained shape")
			}
			if _, ok := wire["arc"]; ok {
				t.Fatal("legacy cast gained arc")
			}
		}
	}
}
