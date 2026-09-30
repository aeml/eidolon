package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Every non-transfer writer must use this filter, including legacy bank paths.
// Reservation acquisition uses the same version predicate: exactly one wins.
func unreservedGuildFilter(id string, version int) bson.M {
	filter := bson.M{"id": id, "pending_bank_operation_id": bson.M{"$in": bson.A{"", nil}}}
	if version == 0 {
		filter["$or"] = bson.A{bson.M{"version": 0}, bson.M{"version": bson.M{"$exists": false}}}
	} else {
		filter["version"] = version
	}
	return filter
}

func (db *DB) guildMutationConflict(id string) error {
	guild, err := db.GetGuildByID(id)
	if err != nil {
		return err
	}
	if guild != nil && guild.PendingBankOperationID != "" {
		return ErrGuildBankOperationBusy
	}
	return errors.New("guild changed; refresh and try again")
}

func (db *DB) saveUnreservedGuild(ctx context.Context, guild *Guild, previousVersion int) error {
	if guild.PendingBankOperationID != "" {
		return ErrGuildBankOperationBusy
	}
	result, err := db.guilds.ReplaceOne(ctx, unreservedGuildFilter(guild.ID, previousVersion), guild)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return db.guildMutationConflict(guild.ID)
	}
	return nil
}

// Reserve before ANY character effect. The durable hold freezes bank contents,
// membership and permissions while ordinary presence updates remain available.
// No Gold or item is moved by this operation.
func (db *DB) ReserveGuildBankOperation(id, fingerprint string) (*Guild, error) {
	op, err := db.GetGuildBankOperation(id)
	if err != nil {
		return nil, err
	}
	if op == nil || op.Fingerprint != fingerprint {
		return nil, ErrGuildBankOperationConflict
	}
	if op.State != GuildBankPending {
		return nil, ErrGuildBankOperationRejected
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		return nil, err
	}
	if guild == nil {
		return nil, fmt.Errorf("%w: guild no longer exists", ErrGuildBankOperationRejected)
	}
	if guild.PendingBankOperationID != "" {
		if guild.PendingBankOperationID != id {
			return nil, ErrGuildBankOperationBusy
		}
		if guild.PendingBankFingerprint != fingerprint {
			return nil, ErrGuildBankOperationConflict
		}
		if guild.Version == op.GuildVersion ||
			(guild.Version == op.GuildVersion+1 && guild.LastBankOperationID == id && guild.LastBankOperationFingerprint == fingerprint) {
			return guild, nil
		}
		return nil, ErrGuildBankOperationStale
	}
	if guild.Version != op.GuildVersion {
		return nil, ErrGuildBankOperationStale
	}
	if guildMember(guild, op.PlayerID) == nil {
		return nil, fmt.Errorf("%w: guild membership is required", ErrGuildBankOperationRejected)
	}
	if op.Action == GuildBankWithdrawGold || op.Action == GuildBankWithdrawItem {
		if err := requireGuildPermission(guild, op.PlayerID, GuildPermissionWithdrawBank); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrGuildBankOperationRejected, err)
		}
	}
	if _, _, err := stagedGuildBankEffect(guild.Bank, *op); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGuildBankOperationRejected, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = db.guilds.UpdateOne(ctx, unreservedGuildFilter(guild.ID, op.GuildVersion), bson.M{"$set": bson.M{
		"pending_bank_operation_id": id, "pending_bank_operation_fingerprint": fingerprint,
	}})
	if err != nil {
		return nil, err // Unknown acknowledgement: retry this exact saved intent.
	}
	current, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		return nil, err
	}
	if current != nil && current.PendingBankOperationID == id && current.PendingBankFingerprint == fingerprint {
		return current, nil
	}
	return nil, ErrGuildBankOperationStale
}

// Release only a terminal intent. Completion requires both durable effects;
// rejection requires proof that neither side changed. Never release an unknown
// or pending outcome. A later operation's hold cannot be cleared by an old retry.
func (db *DB) ReleaseGuildBankOperation(id, fingerprint string) error {
	op, err := db.GetGuildBankOperation(id)
	if err != nil {
		return err
	}
	if op == nil || op.Fingerprint != fingerprint {
		return ErrGuildBankOperationConflict
	}
	if op.State == GuildBankPending {
		return ErrGuildBankOperationBusy
	}
	guild, err := db.GetGuildByID(op.GuildID)
	if err != nil {
		return err
	}
	if guild == nil || guild.PendingBankOperationID != id {
		return nil
	}
	if guild.PendingBankFingerprint != fingerprint ||
		(op.State == GuildBankComplete && (guild.LastBankOperationID != id || guild.LastBankOperationFingerprint != fingerprint)) ||
		(op.State == GuildBankRejected && guild.LastBankOperationID == id) {
		return ErrGuildBankOperationConflict
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// Even rejection advances the version: a pre-reservation governance read
	// must not overwrite presence changes that occurred while the hold existed.
	_, err = db.guilds.UpdateOne(ctx, bson.M{"id": op.GuildID,
		"pending_bank_operation_id": id, "pending_bank_operation_fingerprint": fingerprint}, bson.M{
		"$unset": bson.M{"pending_bank_operation_id": "", "pending_bank_operation_fingerprint": ""},
		"$inc":   bson.M{"version": 1},
	})
	return err
}

// A stop after terminal acknowledgement but before hold release must not leave
// the guild permanently locked. Include these IDs alongside pending intents in
// startup/runtime recovery; never infer completion merely from the hold.
func (db *DB) ReservedGuildBankOperationIDs(limit int) ([]string, error) {
	if db == nil || db.guilds == nil || limit < 1 || limit > 50 {
		return nil, errors.New("invalid reserved guild recovery query")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.guilds.Find(ctx, bson.M{"pending_bank_operation_id": bson.M{"$type": "string", "$ne": ""}},
		options.Find().SetProjection(bson.M{"pending_bank_operation_id": 1}).SetLimit(int64(limit)).
			SetSort(bson.D{{Key: "pending_bank_operation_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var holds []struct {
		ID string `bson:"pending_bank_operation_id"`
	}
	if err := cursor.All(ctx, &holds); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(holds))
	for _, hold := range holds {
		if !guildBankOperationIDPattern.MatchString(hold.ID) {
			return nil, errors.New("invalid saved guild bank reservation")
		}
		ids = append(ids, hold.ID)
	}
	return ids, nil
}
