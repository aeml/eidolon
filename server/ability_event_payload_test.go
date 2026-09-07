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

func TestAbilityPayloadPreservesExplicitSingleTargetHealing(t *testing.T) {
	for _, radius := range []float64{0, 5.75, 23} {
		event := game.AbilityEvent{SourceID: "caster", TargetID: "ally", SkillName: "Healing Light", TargetX: 60008, TargetZ: 60000, ShapeResolved: true, Radius: radius}
		if radius > 0 {
			event.Arc = 2 * math.Pi
		}
		data, err := json.Marshal(abilityPayloadFromEvent(event))
		if err != nil {
			t.Fatal(err)
		}
		var wire map[string]interface{}
		if err := json.Unmarshal(data, &wire); err != nil {
			t.Fatal(err)
		}
		if wire["shapeResolved"] != true {
			t.Fatalf("resolved healing shape dropped at radius %v: %s", radius, data)
		}
		if radius == 0 && (wire["radius"] != nil || wire["arc"] != nil) {
			t.Fatalf("single target gained area: %s", data)
		}
		if radius > 0 && (wire["radius"] != radius || wire["arc"] != 2*math.Pi) {
			t.Fatalf("area shape changed: %s", data)
		}
	}
}
