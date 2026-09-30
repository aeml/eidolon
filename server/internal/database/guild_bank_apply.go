package database

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// ApplyGuildBankOperation commits only the guild side of a saved intent. The
// character side and its durable save are still required before completion.
// A single pending operation per guild keeps the last receipt sufficient for
// recovery; immutable versions fence delayed executors after newer transfers.
// Do not use legacy bank writers concurrently with this protocol.
func (db *DB) ApplyGuildBankOperation(id, fingerprint string) (*Guild, error) {
	op, err := db.GetGuildBankOperation(id)
	if err != nil {
		return nil, err
	}
	if op == nil || op.Fingerprint != fingerprint {
		return nil, ErrGuildBankOperationConflict
	}
	if op.State == GuildBankRejected {
		return nil, ErrGuildBankOperationRejected
	}
	if db.guilds == nil {
		return nil, errors.New("guild bank storage is unavailable")
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		return nil, err
	}
	// Terminal requests never apply again, even if newer transfers have since
	// replaced the bounded last receipt or the guild has been disbanded.
	if op.State == GuildBankComplete {
		return guild, nil
	}
	if guild == nil {
		return nil, errors.New("guild not found")
	}
	if guild.LastBankOperationID == op.ID {
		if guild.LastBankOperationFingerprint != op.Fingerprint {
			return nil, ErrGuildBankOperationConflict
		}
		return guild, nil
	}
	if guild.Version != op.GuildVersion {
		return nil, ErrGuildBankOperationStale
	}
	if guildMember(guild, op.PlayerID) == nil {
		return nil, errors.New("guild membership is required")
	}
	if op.Action == GuildBankWithdrawGold || op.Action == GuildBankWithdrawItem {
		if err := requireGuildPermission(guild, op.PlayerID, GuildPermissionWithdrawBank); err != nil {
			return nil, err
		}
	}
	bank, entry, err := stagedGuildBankEffect(guild.Bank, *op)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{"id": guild.ID, "version": op.GuildVersion}
	if op.GuildVersion == 0 {
		delete(filter, "version")
		filter["$or"] = bson.A{bson.M{"version": 0}, bson.M{"version": bson.M{"$exists": false}}}
	}
	now := time.Now().UTC()
	result, err := db.guilds.UpdateOne(ctx, filter, bson.M{
		"$set": bson.M{"bank": bank, "updated_at": now,
			"last_bank_operation_id": op.ID, "last_bank_operation_fingerprint": op.Fingerprint},
		"$inc":  bson.M{"version": 1},
		"$push": bson.M{"audit": bson.M{"$each": bson.A{entry}, "$slice": -GuildAuditLimit}},
	})
	if err != nil {
		// Unknown acknowledgement: leave the intent pending and re-read its
		// receipt using the SAME ID. Never compensate or invent another request.
		return nil, err
	}
	current, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		return nil, err
	}
	if current != nil && current.LastBankOperationID == op.ID && current.LastBankOperationFingerprint == op.Fingerprint {
		return current, nil
	}
	if result.MatchedCount == 0 {
		return nil, ErrGuildBankOperationStale
	}
	return nil, errors.New("guild bank receipt requires recovery")
}

func stagedGuildBankEffect(bank GuildBank, op GuildBankOperation) (GuildBank, GuildAuditEntry, error) {
	entry := GuildAuditEntry{OperationID: op.ID, At: op.CreatedAt, ActorID: op.PlayerID, Action: op.Action}
	if bank.Gold < 0 {
		return GuildBank{}, GuildAuditEntry{}, errors.New("guild bank Gold is invalid")
	}
	switch op.Action {
	case GuildBankDepositGold:
		if op.Gold > math.MaxInt-bank.Gold {
			return GuildBank{}, GuildAuditEntry{}, errors.New("guild bank Gold limit reached")
		}
		bank.Gold += op.Gold
		entry.Amount = op.Gold
	case GuildBankWithdrawGold:
		if bank.Gold < op.Gold {
			return GuildBank{}, GuildAuditEntry{}, errors.New("guild bank has insufficient Gold")
		}
		bank.Gold -= op.Gold
		entry.Amount = -op.Gold
	case GuildBankDepositItem, GuildBankWithdrawItem:
		var item Item
		if err := json.Unmarshal([]byte(op.ItemPayload), &item); err != nil {
			return GuildBank{}, GuildAuditEntry{}, err
		}
		entry.ItemName = item.Name
		index := -1
		for i := range bank.Items {
			if bank.Items[i].ID == item.ID {
				index = i
				break
			}
		}
		if op.Action == GuildBankDepositItem {
			if index >= 0 || len(bank.Items) >= GuildBankItemLimit {
				return GuildBank{}, GuildAuditEntry{}, errors.New("guild bank is full or already contains this item")
			}
			bank.Items = append(append([]Item(nil), bank.Items...), item)
		} else {
			if index < 0 || !reflect.DeepEqual(bank.Items[index], item) {
				return GuildBank{}, GuildAuditEntry{}, errors.New("guild bank item no longer matches the saved transfer")
			}
			items := append([]Item(nil), bank.Items[:index]...)
			bank.Items = append(items, bank.Items[index+1:]...)
		}
	default:
		return GuildBank{}, GuildAuditEntry{}, errors.New("unsupported guild bank effect")
	}
	return bank, entry, nil
}
