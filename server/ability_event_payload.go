package main

import "eidolon-server/internal/game"

func abilityPayloadFromEvent(event game.AbilityEvent) AbilityPayload {
	return AbilityPayload{SourceID: event.SourceID, TargetID: event.TargetID,
		SkillName: event.SkillName, TargetX: event.TargetX, TargetZ: event.TargetZ,
		Radius: event.Radius, Arc: event.Arc, ShapeResolved: event.ShapeResolved}
}
