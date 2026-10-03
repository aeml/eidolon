package game

import (
	"encoding/json"
	"errors"
	"math"
	"slices"
	"time"

	"eidolon-server/internal/database"
)

var (
	ErrDungeonRoomRewardFull     = errors.New("room reward retained until bag space is available")
	ErrDungeonRoomRewardConflict = errors.New("room reward identity or saved state conflicts")
)

func dungeonRoomRewardScale(room DungeonRoom) float64 {
	scale := 1.0
	if room.Type == "elite" {
		scale = 1.5
	}
	if room.Hook == "chest" {
		scale += .35
	}
	if room.Hook == "elite_ambush" {
		scale += .45
	}
	return scale
}

// Pure capture for the durable coordinator. No room flag, actor, Gold,
// item or XP is mutated here. The coordinator must freeze the FIRST plan before
// changing cleared progress; callers must not reroll after an unknown result.
func (w *World) PrepareDungeonRoomReward(instanceID string, roomIndex int) (database.DungeonRoomRewardOperation, error) {
	op := database.DungeonRoomRewardOperation{}
	instance, found := w.getDungeonInstance(instanceID)
	if !found {
		return op, ErrDungeonRoomRewardConflict
	}
	instance.Mu.RLock()
	if instance.RoomState == nil || roomIndex < 0 || roomIndex >= len(instance.Layout.Rooms) || roomIndex >= len(instance.RoomState.Rooms) ||
		instance.RoomState.Rooms[roomIndex].Cleared || instance.RoomState.Rooms[roomIndex].Rewarded {
		instance.Mu.RUnlock()
		return op, ErrDungeonRoomRewardConflict
	}
	room := instance.Layout.Rooms[roomIndex]
	op = database.DungeonRoomRewardOperation{Version: 1, ID: database.DungeonRoomRewardID(instanceID, roomIndex), InstanceID: instanceID,
		RoomIndex: roomIndex, RoomType: room.Type, RoomHook: room.Hook, DungeonType: instance.DungeonType, Difficulty: string(instance.Difficulty),
		RunLevel: instance.RunLevel, Objective: instance.RoomState.ObjectiveRoomIndex(), CreatedAt: time.Now().UTC().Truncate(time.Millisecond)}
	instance.Mu.RUnlock()
	if op.Difficulty == "" {
		op.Difficulty = string(DifficultyNormal)
	}
	w.Mu.RLock()
	actors := make([]*Entity, 0)
	for _, actor := range w.Entities {
		if actor.Type == TypePlayer {
			actors = append(actors, actor)
		}
	}
	w.Mu.RUnlock()
	for _, actor := range actors {
		actor.Mu.RLock()
		if actor.InstanceID != instanceID || actor.Disconnected || actor.Health <= 0 || actor.State == "DEAD" {
			actor.Mu.RUnlock()
			continue
		}
		multiplier := dungeonRoomRewardScale(room) * resonanceRewardMultiplier(actor)
		participant := database.DungeonRoomRewardRecipient{Username: actor.Name, PlayerID: actor.ID,
			Gold: int(float64(max(25, op.RunLevel*3)) * multiplier), XP: int(float64(max(50, op.RunLevel*10)) * multiplier)}
		if room.Hook == "shrine" {
			participant.Health, participant.Mana = max(1, int(float64(actor.MaxHealth)*.30)), max(1, int(float64(actor.MaxMana)*.30))
		}
		actor.Mu.RUnlock()
		var rewardItem *Item
		if room.Hook == "chest" {
			rewardItem = GenerateRandomGemByLevel(max(20, op.RunLevel), false)
		} else if room.Hook == "elite_ambush" {
			rewardItem = GenerateEliteLoot(max(20, op.RunLevel))
		}
		if rewardItem != nil {
			payload, err := json.Marshal(normalizedGroundItem(*rewardItem))
			if err != nil {
				return op, err
			}
			participant.Items = []string{string(payload)}
		}
		op.Participants = append(op.Participants, participant)
	}
	slices.SortFunc(op.Participants, func(a, b database.DungeonRoomRewardRecipient) int {
		if a.Username < b.Username {
			return -1
		}
		if a.Username > b.Username {
			return 1
		}
		return 0
	})
	var err error
	op.Fingerprint, err = database.DungeonRoomRewardFingerprint(op)
	if err != nil {
		return op, err
	}
	return op, op.Validate()
}

// Caller owns actor.Mu or this is an isolated offline entity. Only a confirmed
// shared operation may reach this method in runtime. The existing private
// receipt must be saved with the entire grant before acknowledging delivery.
func (player *Entity) ApplyDungeonRoomRewardCharacterEffect(op database.DungeonRoomRewardOperation) (ExperienceRewardReceipt, bool, error) {
	var progression ExperienceRewardReceipt
	if err := op.Validate(); err != nil {
		return progression, false, err
	}
	if player == nil || player.Type != TypePlayer || player.Level < 1 || player.Level > MaxPlayerLevel {
		return progression, false, ErrDungeonRoomRewardConflict
	}
	participant, eligible := database.DungeonRoomRewardRecipientFor(op, player.Name)
	if !eligible || player.ID != participant.PlayerID {
		return progression, false, ErrDungeonRoomRewardConflict
	}
	if fingerprint, found := player.ItemDeliveryReceipts[op.ID]; found {
		if fingerprint != op.Fingerprint {
			return progression, false, ErrDungeonRoomRewardConflict
		}
		return progression, false, nil
	}
	if player.Gold < 0 || player.Gold > math.MaxInt-participant.Gold || player.Experience < 0 ||
		(player.Level < MaxPlayerLevel && player.Experience > math.MaxInt-participant.XP) ||
		player.ResonanceXP < 0 || player.ResonanceXP > math.MaxInt-participant.XP {
		return progression, false, ErrDungeonRoomRewardConflict
	}
	earned := (player.ResonanceXP + participant.XP) / ResonanceXPPerLevel
	if player.ResonanceLevel < 0 || player.ResonancePoints < 0 || player.ResonanceLevel > math.MaxInt-earned || player.ResonancePoints > math.MaxInt-earned {
		return progression, false, ErrDungeonRoomRewardConflict
	}
	inventory := cloneItems(player.Inventory)
	if len(inventory) > MaxInventorySize {
		return progression, false, ErrDungeonRoomRewardConflict
	}
	inventory = append(inventory, make([]Item, MaxInventorySize-len(inventory))...)
	for _, payload := range participant.Items {
		item, err := decodeGroundItem(payload)
		if err != nil {
			return progression, false, err
		}
		for _, storage := range [][]Item{player.Inventory, player.Stash, player.Buyback} {
			for _, owned := range storage {
				if owned.ID == item.ID {
					return progression, false, ErrDungeonRoomRewardConflict
				}
			}
		}
		for _, owned := range player.Equipment {
			if owned.ID == item.ID {
				return progression, false, ErrDungeonRoomRewardConflict
			}
		}
		var remainder int
		inventory, remainder = placeGroundItem(inventory, item, item.ID)
		if remainder != 0 {
			return progression, false, ErrDungeonRoomRewardFull
		}
	}
	// All refusal paths above are pure. Late delivery never resurrects a corpse,
	// heals someone in a different instance or renews a timed shrine buff.
	if player.InstanceID == op.InstanceID && !player.Disconnected && player.Health > 0 && player.State != "DEAD" {
		player.Health += min(participant.Health, max(0, player.MaxHealth-player.Health))
		player.Mana += min(participant.Mana, max(0, player.MaxMana-player.Mana))
		if op.RoomHook == "shrine" && time.Now().Before(op.CreatedAt.Add(8*time.Second)) {
			player.SanctuaryDamageReduction, player.SanctuaryEndTime = true, op.CreatedAt.Add(8*time.Second)
		}
	}
	player.Inventory = inventory
	player.Gold += participant.Gold
	progression = (&World{}).awardExperienceLocked(player, participant.XP)
	if player.ItemDeliveryReceipts == nil {
		player.ItemDeliveryReceipts = map[string]string{}
	}
	player.ItemDeliveryReceipts[op.ID] = op.Fingerprint
	player.UnjournaledSave = true
	return progression, true, nil
}
