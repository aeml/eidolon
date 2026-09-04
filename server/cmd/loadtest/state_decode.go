package main

import (
	"bytes"
	"fmt"

	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

var stateFrameMagic = []byte{'E', 'D', 'P', 'B'}

const stateFrameVersion byte = 2

type stateUpdate struct {
	full      bool
	entities  map[string]Entity
	removedID []string
}

func decodeStateFrame(frame []byte) (stateUpdate, bool, error) {
	if len(frame) < len(stateFrameMagic) || !bytes.Equal(frame[:len(stateFrameMagic)], stateFrameMagic) {
		return stateUpdate{}, false, nil
	}
	if len(frame) < 5 {
		return stateUpdate{}, true, fmt.Errorf("truncated EDPB state frame")
	}
	if frame[4] != stateFrameVersion {
		return stateUpdate{}, true, fmt.Errorf("unsupported EDPB wire version %d", frame[4])
	}

	envelope := &statepb.StateEnvelope{}
	if err := proto.Unmarshal(frame[5:], envelope); err != nil {
		return stateUpdate{}, true, fmt.Errorf("decode EDPB envelope: %w", err)
	}
	if envelope.Version != uint32(stateFrameVersion) {
		return stateUpdate{}, true, fmt.Errorf("unsupported state envelope version %d", envelope.Version)
	}

	update := stateUpdate{entities: make(map[string]Entity)}
	switch payload := envelope.Payload.(type) {
	case *statepb.StateEnvelope_Full:
		update.full = true
		if payload.Full != nil {
			for _, entity := range payload.Full.Entities {
				converted := entityFromProto(entity)
				if converted.ID != "" {
					update.entities[converted.ID] = converted
				}
			}
		}
	case *statepb.StateEnvelope_Delta:
		if payload.Delta != nil {
			for _, entity := range payload.Delta.Entities {
				converted := entityFromProto(entity)
				if converted.ID != "" {
					update.entities[converted.ID] = converted
				}
			}
			update.removedID = append(update.removedID, payload.Delta.RemovedIds...)
		}
	default:
		return stateUpdate{}, true, fmt.Errorf("state envelope has no payload")
	}
	return update, true, nil
}

func applyStateUpdate(worldState map[string]Entity, update stateUpdate) {
	if update.full {
		clear(worldState)
	}
	for id, entity := range update.entities {
		worldState[id] = entity
	}
	for _, id := range update.removedID {
		delete(worldState, id)
	}
}

func entityFromProto(entity *statepb.Entity) Entity {
	if entity == nil {
		return Entity{}
	}
	equipment := make(map[string]Item, len(entity.Equipment))
	for slot, item := range entity.Equipment {
		equipment[slot] = itemFromProto(item)
	}
	return Entity{
		ID:        entity.Id,
		Type:      entity.Type,
		X:         float64(entity.X),
		Z:         float64(entity.Z),
		State:     entity.State,
		Health:    int(entity.Health),
		Level:     int(entity.Level),
		Equipment: equipment,
	}
}

func itemFromProto(item *statepb.Item) Item {
	if item == nil {
		return Item{}
	}
	return Item{
		ID:     item.Id,
		Name:   item.Name,
		Slot:   item.Slot,
		Level:  int(item.Level),
		Rarity: item.Rarity,
		Value:  int(item.Value),
	}
}
