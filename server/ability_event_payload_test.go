package main

import (
	"encoding/json"
	"math"
	"testing"

	"eidolon-server/internal/game"
)

func TestAbilityPayloadEarthshakerFootprintAndDelayedPhase(t *testing.T) {
	for _, entry := range []struct{ kind, phase string }{{"circle", ""}, {"line", ""}, {"circle", "aftershock"}} {
		radius := 8.1
		if entry.phase == "aftershock" {
			radius = 4.725
		}
		event := game.AbilityEvent{SourceID: "quake", SkillName: "Earthshaker", TargetX: 50001, TargetZ: 50000,
			Radius: radius, Arc: 2 * math.Pi, ShapeResolved: true, ShapeKind: entry.kind, Phase: entry.phase,
			Origin: &game.AbilityOrigin{X: 50000, Z: 50000}}
		data, err := json.Marshal(abilityPayloadFromEvent(event))
		if err != nil {
			t.Fatal(err)
		}
		var got AbilityPayload
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatal(err)
		}
		if got.ShapeKind != entry.kind || got.Phase != entry.phase || got.Radius != radius || !got.ShapeResolved ||
			got.Origin == nil || got.Origin.X != 50000 || got.Origin.Z != 50000 || got.TargetX != 50001 || got.TargetZ != 50000 {
			t.Fatalf("wire lost actual quake footprint: %+v", got)
		}
	}
}

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

func TestAbilityPayloadPreservesFighterCones(t *testing.T) {
	for _, tc := range []struct {
		skill       string
		radius, arc float64
	}{
		{"Shield Slam", 5.4, math.Pi / 2}, {"Sweeping Strike", 6.75, math.Pi},
	} {
		event := game.AbilityEvent{SourceID: "cone-caster", SkillName: tc.skill, TargetX: 50000, TargetZ: 50010, Radius: tc.radius, Arc: tc.arc}
		encoded, err := json.Marshal(abilityPayloadFromEvent(event))
		if err != nil {
			t.Fatal(err)
		}
		var wire map[string]interface{}
		if err := json.Unmarshal(encoded, &wire); err != nil {
			t.Fatal(err)
		}
		if wire["sourceId"] != event.SourceID || wire["skillName"] != tc.skill || wire["radius"] != tc.radius || wire["arc"] != tc.arc ||
			wire["targetX"] != event.TargetX || wire["targetZ"] != event.TargetZ {
			t.Fatalf("lost trained cone geometry: %v", wire)
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

func TestAbilityPayloadPreservesDistinctAuthoritativeLanding(t *testing.T) {
	for _, landing := range []*game.AbilityLanding{nil, {X: 0, Z: 0}, {X: 11.5, Z: 34}} {
		event := game.AbilityEvent{SourceID: "caster", TargetID: "target", SkillName: "Shadow Lunge",
			TargetX: 13, TargetZ: 34, Landing: landing}
		payload := abilityPayloadFromEvent(event)
		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		var received map[string]interface{}
		if err := json.Unmarshal(data, &received); err != nil {
			t.Fatal(err)
		}
		if received["targetX"] != 13.0 || received["targetZ"] != 34.0 {
			t.Fatal("aim point changed")
		}
		if landing == nil {
			if _, exists := received["landing"]; exists {
				t.Fatal("legacy ability acquired a landing")
			}
			continue
		}
		point, ok := received["landing"].(map[string]interface{})
		if !ok || point["x"] != landing.X || point["z"] != landing.Z {
			t.Fatalf("landing lost on real wire: %s", data)
		}
		landing.X++
		if payload.Landing.X == landing.X {
			t.Fatal("payload aliases mutable event")
		}
	}
}

func TestAbilityPayloadPreservesTeleportDeparture(t *testing.T) {
	for _, origin := range []*game.AbilityOrigin{nil, {X: 0, Z: 0}, {X: 60000, Z: 60000}} {
		event := game.AbilityEvent{SourceID: "caster", SkillName: "Teleport", Origin: origin,
			TargetX: 60009, TargetZ: 60000, Radius: 5, Arc: 2 * math.Pi, ShapeResolved: true}
		payload := abilityPayloadFromEvent(event)
		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		var received map[string]any
		if err := json.Unmarshal(data, &received); err != nil {
			t.Fatal(err)
		}
		if received["targetX"] != float64(60009) || received["radius"] != float64(5) || received["shapeResolved"] != true {
			t.Fatalf("lost accepted landing/shape: %s", data)
		}
		if origin == nil {
			if received["origin"] != nil {
				t.Fatalf("invented legacy origin: %s", data)
			}
			continue
		}
		point, ok := received["origin"].(map[string]any)
		if !ok || point["x"] != origin.X || point["z"] != origin.Z {
			t.Fatalf("departure lost on real wire: %s", data)
		}
		origin.X++
		if payload.Origin.X == origin.X {
			t.Fatal("payload aliases mutable origin")
		}
	}
}
