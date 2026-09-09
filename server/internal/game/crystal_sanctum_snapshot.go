package game

// CrystalSanctumSnapshot is current scene state, not a quest award or a replayed
// callout. It travels in the existing room summary on entry, reconnect and live
// updates so missing a one-shot ritual event cannot strand a fractured visual.
type CrystalSanctumSnapshot struct {
	InstanceID string  `json:"instanceId"`
	RaidType   string  `json:"raidType"`
	Element    string  `json:"element"`
	Name       string  `json:"name"`
	Stage      string  `json:"stage"`
	Wave       int     `json:"wave"`
	TotalWaves int     `json:"totalWaves"`
	Progress   int     `json:"progress"`
	X          float64 `json:"x"`
	Z          float64 `json:"z"`
}

func (w *World) crystalSanctumSnapshot(instanceID, playerID string) *CrystalSanctumSnapshot {
	instance, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return nil
	}
	instance.Mu.RLock()
	definition, elemental := ElementalRaidDefinitionForType(instance.DungeonType)
	if !elemental || instance.RoomState == nil || len(instance.Layout.Rooms) == 0 {
		instance.Mu.RUnlock()
		return nil
	}
	lastIndex := len(instance.Layout.Rooms) - 1
	chamber := instance.Layout.Rooms[lastIndex]
	guardianCleared := lastIndex < len(instance.RoomState.Rooms) && instance.RoomState.Rooms[lastIndex].Cleared
	partyID := instance.PartyID
	instance.Mu.RUnlock()
	if chamber.Type != "boss" {
		return nil
	}
	snapshot := &CrystalSanctumSnapshot{
		InstanceID: instanceID, RaidType: definition.Type, Element: definition.Element,
		Name: definition.Crystal, Stage: "fractured", TotalWaves: 3, X: chamber.X, Z: chamber.Z,
	}
	w.RepairMu.RLock()
	repair := w.CrystalRepairs[instanceID]
	if repair != nil {
		snapshot.Stage = "repairing"
		snapshot.Wave = min(3, max(0, repair.Wave))
		snapshot.Progress = min(99, max(0, repair.ClearedWaves*33))
		if repair.Completed {
			snapshot.Stage, snapshot.Wave, snapshot.Progress = "restored", 3, 100
		}
	}
	w.RepairMu.RUnlock()
	if repair == nil && guardianCleared {
		// After a process restart, partial waves intentionally restart. Only
		// durable, exact repair completion by every member restores the visual;
		// readiness does not auto-claim Ilyra's quest or open the Dark Realm.
		if _, allRestored := w.crystalVigilPartyReadiness(partyID, playerID, definition); allRestored {
			snapshot.Stage, snapshot.Wave, snapshot.Progress = "restored", 3, 100
		}
	}
	return snapshot
}
