package game

import (
	"fmt"
	"time"
)

// PartyDungeonRun is a small immutable snapshot for portal display and entry.
type PartyDungeonRun struct {
	InstanceID  string            `json:"instanceId"`
	DungeonType string            `json:"dungeonType"`
	Difficulty  DungeonDifficulty `json:"difficulty"`
	RunLevel    int               `json:"runLevel"`
}

func (w *World) partyDungeonRunLocked(partyID string) (PartyDungeonRun, bool) {
	for id, instance := range w.dungeonInstancesSnapshot() {
		instance.Mu.RLock()
		matches := instance.PartyID == partyID &&
			(instance.EmptySince.IsZero() || time.Since(instance.EmptySince) <= 5*time.Minute)
		run := PartyDungeonRun{id, instance.DungeonType, instance.Difficulty, instance.RunLevel}
		instance.Mu.RUnlock()
		if matches {
			return run, true
		}
	}
	return PartyDungeonRun{}, false
}

func (w *World) GetPartyDungeonRun(partyID string) (PartyDungeonRun, bool) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	return w.partyDungeonRunLocked(partyID)
}

// EnterPartyDungeon resolves the actual run, checks access, and moves players
// under one world transaction. Resume affects only the caller; a fresh start
// is leader-owned and qualifies the entire party before creating any instance.
func (w *World) EnterPartyDungeon(playerID, dungeonType string, difficulty DungeonDifficulty, runLevel int) (PartyDungeonRun, []string, error) {
	w.Mu.Lock()
	run, moved, err := w.enterPartyDungeonLocked(playerID, dungeonType, difficulty, runLevel)
	w.Mu.Unlock()
	for _, memberID := range moved {
		w.ensureRestoredCrystalRepair(run.InstanceID, memberID)
	}
	return run, moved, err
}

func (w *World) enterPartyDungeonLocked(playerID, dungeonType string, difficulty DungeonDifficulty, runLevel int) (PartyDungeonRun, []string, error) {
	fail := func(err error) (PartyDungeonRun, []string, error) { return PartyDungeonRun{}, nil, err }
	player := w.Entities[playerID]
	if player == nil {
		return fail(fmt.Errorf("player not found"))
	}
	party := w.Parties[player.PartyID]
	if party == nil {
		return fail(fmt.Errorf("you must be in a party to enter a dungeon"))
	}
	_, leaderID, members := party.GetSnapshot()
	belongs := false
	for _, id := range members {
		belongs = belongs || id == playerID
	}
	if !belongs {
		return fail(fmt.Errorf("you are no longer in this party"))
	}
	run, resuming := w.partyDungeonRunLocked(player.PartyID)
	if !resuming {
		if leaderID != playerID {
			return fail(fmt.Errorf("only the party leader can start a new dungeon run"))
		}
		run = PartyDungeonRun{DungeonType: dungeonType, Difficulty: difficulty, RunLevel: runLevel}
	}
	raidDefinition, elementalRaid := ElementalRaidDefinitionForType(run.DungeonType)
	isRaid := elementalRaid || run.DungeonType == "weekly_raid"
	if isRaid {
		// A saved raid has already passed its launch ready check. Returning
		// members still need the actual raid's group, level and story access;
		// this path must never create a raid or admit an unqualified replacement.
		party.Mu.RLock()
		formedRaid := party.MaxSize == 10 && len(members) >= 5 && len(members) <= 10
		party.Mu.RUnlock()
		if !resuming || !formedRaid {
			return fail(fmt.Errorf("form a 5-10 player raid and complete its launch ready check first"))
		}
	}
	entering := members
	if resuming {
		entering = []string{playerID}
	}
	for _, id := range entering {
		member := w.Entities[id]
		if member == nil {
			return fail(fmt.Errorf("every entering party member must be online"))
		}
		member.Mu.RLock()
		var err error
		if isRaid {
			requiredLevel, quest := MaxPlayerLevel, ChronicleGateOpenedID
			if elementalRaid {
				requiredLevel, quest = raidDefinition.RequiredLevel, raidDefinition.RequiredDungeonQuest
			}
			if member.Level < requiredLevel || !HasCompletedChronicleQuest(member, quest) {
				err = fmt.Errorf("complete this raid's required Chronicle chapter and reach level %d before returning", requiredLevel)
			}
		} else {
			err = ValidateDungeonTypeEntry(member.Level, run.DungeonType)
			if err == nil {
				err = ValidateDungeonEntrySelection(member.Level, run.RunLevel, run.Difficulty)
			}
		}
		if err == nil && (member.Disconnected || member.State == "DEAD") {
			err = fmt.Errorf("every entering member must be online and alive")
		}
		if err == nil && member.InstanceID != "" && member.InstanceID != run.InstanceID {
			err = fmt.Errorf("return to Lanternhold before entering another run")
		}
		member.Mu.RUnlock()
		if err != nil {
			return fail(err)
		}
	}
	if run.DungeonType == "umbral_nexus" {
		for _, id := range members {
			member := w.Entities[id]
			if member == nil {
				return fail(fmt.Errorf("every party member must be online for the Umbral Nexus"))
			}
			member.Mu.RLock()
			unlocked := HasCompletedChronicleQuest(member, ChronicleAirRestoredID)
			member.Mu.RUnlock()
			if !unlocked {
				return fail(fmt.Errorf("the four crystals must be restored by every party member before the Umbral Nexus opens"))
			}
		}
	}
	if !resuming {
		run.InstanceID = w.createDungeonLocked(player.PartyID, run.DungeonType, run.Difficulty, run.RunLevel)
	}
	moved := make([]string, 0, len(entering))
	for _, id := range entering {
		changed, err := w.enterInstanceLocked(id, run.InstanceID)
		if err != nil {
			return run, moved, err
		}
		if changed {
			moved = append(moved, id)
		}
	}
	return run, moved, nil
}
