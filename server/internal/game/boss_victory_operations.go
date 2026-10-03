package game

import (
	"errors"
	"math"
	"slices"

	"eidolon-server/internal/database"
)

var ErrBossVictoryEffectConflict = errors.New("boss victory character identity or owned state conflicts")

// Caller owns actor.Mu or this is an isolated offline entity. Runtime must
// confirm the shared FIRST victory before calling this primitive. The receipt
// is not durable until it is saved with the entire earned post-image.
func (player *Entity) ApplyBossVictoryCharacterEffect(op database.BossVictoryOperation) (ExperienceRewardReceipt, bool, error) {
	return player.applyBossVictoryCharacterEffect(op, false)
}

func (player *Entity) applyBossVictoryCharacterEffect(op database.BossVictoryOperation, retainOnly bool) (ExperienceRewardReceipt, bool, error) {
	var progression ExperienceRewardReceipt
	if err := op.Validate(); err != nil {
		return progression, false, err
	}
	if player == nil || player.Type != TypePlayer || player.Level < 1 || player.Level > MaxPlayerLevel {
		return progression, false, ErrBossVictoryEffectConflict
	}
	participant, eligible := database.BossVictoryRecipientFor(op, player.Name)
	if !eligible || player.ID != participant.PlayerID {
		return progression, false, ErrBossVictoryEffectConflict
	}
	if fingerprint, found := player.ItemDeliveryReceipts[op.ID]; found {
		if fingerprint != op.Fingerprint {
			return progression, false, ErrBossVictoryEffectConflict
		}
		return progression, false, nil
	}
	if player.Gold < 0 || player.Gold > math.MaxInt-participant.Gold || player.Experience < 0 ||
		(player.Level < MaxPlayerLevel && player.Experience > math.MaxInt-participant.XP) || player.ResonanceXP < 0 || player.ResonanceXP > math.MaxInt-participant.XP {
		return progression, false, ErrBossVictoryEffectConflict
	}
	earned := (player.ResonanceXP + participant.XP) / ResonanceXPPerLevel
	if player.ResonanceLevel < 0 || player.ResonancePoints < 0 || player.ResonanceLevel > math.MaxInt-earned || player.ResonancePoints > math.MaxInt-earned || len(player.Inventory) > MaxInventorySize {
		return progression, false, ErrBossVictoryEffectConflict
	}
	preview := &Entity{Inventory: cloneItems(player.Inventory), Stash: player.Stash, Buyback: player.Buyback, Equipment: player.Equipment, PendingBossLoot: slices.Clone(player.PendingBossLoot)}
	for _, payload := range participant.Items {
		item, err := decodeGroundItem(payload)
		if err != nil {
			return progression, false, err // Original unsupported payload retained in the shared record.
		}
		delivered, err := preview.awardBossItemLocked(item, retainOnly)
		if err != nil {
			return progression, false, err
		}
		if !delivered {
			// Keep the immutable record's bytes, not a newly serialized version
			// of even known metadata (field order/omitted fields may differ).
			preview.PendingBossLoot[len(preview.PendingBossLoot)-1] = payload
		}
	}
	quests := slices.Clone(player.Quests)
	for _, credit := range participant.Quests {
		for index := range quests {
			quest := &quests[index]
			if quest.ID != credit.QuestID {
				continue
			}
			if quest.Type != "KILL" || quest.Target != credit.Target || quest.MaxCount != credit.Maximum || quest.Count < 0 || quest.Count > quest.MaxCount {
				return progression, false, ErrBossVictoryEffectConflict
			}
			// Respect a later turn-in/abandonment. Do not accept or complete a
			// quest for the owner, overwrite its quote or erase independent kills.
			if quest.Accepted && !quest.Completed {
				quest.Count += min(credit.Amount, quest.MaxCount-quest.Count)
			}
		}
	}
	// Every refusal above is pure. Full bags retain exact original rolls rather
	// than delaying the rest of the earned victory or partially losing items.
	player.Inventory, player.PendingBossLoot, player.Quests = preview.Inventory, preview.PendingBossLoot, quests
	player.Gold += participant.Gold
	progression = (&World{}).awardExperienceLocked(player, participant.XP)
	if op.BossType == "UmbraPrime" {
		player.queueWeeklyRaidCompletionLocked(op.CreatedAt)
	}
	if player.ItemDeliveryReceipts == nil {
		player.ItemDeliveryReceipts = map[string]string{}
	}
	player.ItemDeliveryReceipts[op.ID] = op.Fingerprint
	player.UnjournaledSave = true
	return progression, true, nil
}

// Runtime admission owns account work; this method only takes short world/actor
// locks. A live trade's offered bag stays unchanged: incoming earned items go
// to private retention until normal post-trade collection can deliver them.
func (w *World) ApplyBossVictoryCharacterEffect(playerID string, op database.BossVictoryOperation) (bool, ExperienceRewardReceipt, bool, error) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, ExperienceRewardReceipt{}, false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	progression, changed, err := player.applyBossVictoryCharacterEffect(op, w.TradeByPlayer[playerID] != "")
	return true, progression, changed, err
}
