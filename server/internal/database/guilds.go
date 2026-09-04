package database

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	GuildRankLeader  = "leader"
	GuildRankOfficer = "officer"
	GuildRankMember  = "member"

	GuildPermissionInvite       = "invite"
	GuildPermissionKick         = "kick"
	GuildPermissionSetRank      = "set_rank"
	GuildPermissionWithdrawBank = "withdraw_bank"
	GuildPermissionViewAudit    = "view_audit"
	GuildPermissionManageMOTD   = "manage_motd"

	GuildMemberLimit   = 100
	GuildBankItemLimit = 80
	GuildAuditLimit    = 100
)

var (
	guildNamePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9 '\-]{2,23}$`)
	guildTagPattern  = regexp.MustCompile(`^[A-Za-z0-9]{2,5}$`)
)

type GuildMember struct {
	PlayerID   string    `bson:"player_id" json:"playerId"`
	Username   string    `bson:"username" json:"username"`
	Rank       string    `bson:"rank" json:"rank"`
	JoinedAt   time.Time `bson:"joined_at" json:"joinedAt"`
	LastOnline time.Time `bson:"last_online" json:"lastOnline"`
}

type GuildBank struct {
	Gold  int    `bson:"gold" json:"gold"`
	Items []Item `bson:"items" json:"items"`
}

type GuildAuditEntry struct {
	At       time.Time `bson:"at" json:"at"`
	ActorID  string    `bson:"actor_id" json:"actorId"`
	Action   string    `bson:"action" json:"action"`
	TargetID string    `bson:"target_id,omitempty" json:"targetId,omitempty"`
	Amount   int       `bson:"amount,omitempty" json:"amount,omitempty"`
	ItemName string    `bson:"item_name,omitempty" json:"itemName,omitempty"`
}

type Guild struct {
	ID        string            `bson:"id" json:"id"`
	Name      string            `bson:"name" json:"name"`
	NameKey   string            `bson:"name_key" json:"-"`
	Tag       string            `bson:"tag" json:"tag"`
	MOTD      string            `bson:"motd,omitempty" json:"motd,omitempty"`
	LeaderID  string            `bson:"leader_id" json:"leaderId"`
	Members   []GuildMember     `bson:"members" json:"members"`
	Bank      GuildBank         `bson:"bank" json:"bank"`
	Audit     []GuildAuditEntry `bson:"audit" json:"audit"`
	CreatedAt time.Time         `bson:"created_at" json:"createdAt"`
	UpdatedAt time.Time         `bson:"updated_at" json:"updatedAt"`
	Version   int               `bson:"version" json:"-"`
}

type GuildInvite struct {
	GuildID   string    `bson:"guild_id" json:"guildId"`
	GuildName string    `bson:"guild_name" json:"guildName"`
	GuildTag  string    `bson:"guild_tag" json:"guildTag"`
	InviterID string    `bson:"inviter_id" json:"inviterId"`
	TargetID  string    `bson:"target_id" json:"targetId"`
	CreatedAt time.Time `bson:"created_at" json:"createdAt"`
	ExpiresAt time.Time `bson:"expires_at" json:"expiresAt"`
}

func ValidateGuildIdentity(name, tag string) (string, string, error) {
	name = strings.Join(strings.Fields(strings.TrimSpace(name)), " ")
	tag = strings.ToUpper(strings.TrimSpace(tag))
	if !guildNamePattern.MatchString(name) {
		return "", "", errors.New("guild name must be 3-24 letters, numbers, spaces, apostrophes, or hyphens")
	}
	if !guildTagPattern.MatchString(tag) {
		return "", "", errors.New("guild tag must be 2-5 letters or numbers")
	}
	return name, tag, nil
}

func GuildRankCan(rank, permission string) bool {
	switch rank {
	case GuildRankLeader:
		return true
	case GuildRankOfficer:
		return permission == GuildPermissionInvite || permission == GuildPermissionKick || permission == GuildPermissionWithdrawBank || permission == GuildPermissionViewAudit || permission == GuildPermissionManageMOTD
	default:
		return false
	}
}

func newGuildID() (string, error) {
	bytes := make([]byte, 12)
	if _, err := crand.Read(bytes); err != nil {
		return "", err
	}
	return "guild-" + hex.EncodeToString(bytes), nil
}

func (db *DB) CreateGuild(name, tag, leaderID, leaderUsername string) (*Guild, error) {
	if db == nil || db.guilds == nil {
		return nil, errors.New("guild service unavailable")
	}
	name, tag, err := ValidateGuildIdentity(name, tag)
	if err != nil {
		return nil, err
	}
	if leaderID == "" || leaderUsername == "" {
		return nil, errors.New("guild leader is required")
	}
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	if existing, err := db.getGuildForPlayer(leaderID); err != nil {
		return nil, err
	} else if existing != nil {
		return nil, errors.New("you are already in a guild")
	}
	id, err := newGuildID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	guild := &Guild{
		ID: id, Name: name, NameKey: strings.ToLower(name), Tag: tag, LeaderID: leaderID,
		Members:   []GuildMember{{PlayerID: leaderID, Username: leaderUsername, Rank: GuildRankLeader, JoinedAt: now, LastOnline: now}},
		Bank:      GuildBank{Items: []Item{}},
		Audit:     []GuildAuditEntry{{At: now, ActorID: leaderID, Action: "guild_created"}},
		CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := db.guilds.InsertOne(ctx, guild); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, errors.New("guild name, tag, or membership is already in use")
		}
		return nil, err
	}
	return guild, nil
}

func (db *DB) GetGuildByID(guildID string) (*Guild, error) {
	if db == nil || db.guilds == nil || guildID == "" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var guild Guild
	err := db.guilds.FindOne(ctx, bson.M{"id": guildID}).Decode(&guild)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &guild, err
}

func (db *DB) getGuildForPlayer(playerID string) (*Guild, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var guild Guild
	err := db.guilds.FindOne(ctx, bson.M{"members.player_id": playerID}).Decode(&guild)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &guild, err
}

func (db *DB) GetGuildForPlayer(playerID string) (*Guild, error) {
	if db == nil || db.guilds == nil || playerID == "" {
		return nil, nil
	}
	return db.getGuildForPlayer(playerID)
}

func guildMember(guild *Guild, playerID string) *GuildMember {
	if guild == nil {
		return nil
	}
	for index := range guild.Members {
		if guild.Members[index].PlayerID == playerID {
			return &guild.Members[index]
		}
	}
	return nil
}

func requireGuildPermission(guild *Guild, playerID, permission string) error {
	member := guildMember(guild, playerID)
	if member == nil {
		return errors.New("you are not a guild member")
	}
	if !GuildRankCan(member.Rank, permission) {
		return errors.New("your guild rank does not have permission")
	}
	return nil
}

func (db *DB) InviteToGuild(guildID, inviterID, targetID string) error {
	if targetID == "" || targetID == inviterID {
		return errors.New("invalid guild invite target")
	}
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.GetGuildByID(guildID)
	if err != nil || guild == nil {
		return errors.New("guild not found")
	}
	if err := requireGuildPermission(guild, inviterID, GuildPermissionInvite); err != nil {
		return err
	}
	if len(guild.Members) >= GuildMemberLimit {
		return errors.New("guild is full")
	}
	if existing, err := db.getGuildForPlayer(targetID); err != nil {
		return err
	} else if existing != nil {
		return errors.New("player is already in a guild")
	}
	now := time.Now().UTC()
	invite := GuildInvite{GuildID: guild.ID, GuildName: guild.Name, GuildTag: guild.Tag, InviterID: inviterID, TargetID: targetID, CreatedAt: now, ExpiresAt: now.Add(7 * 24 * time.Hour)}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = db.guildInvites.InsertOne(ctx, invite)
	if mongo.IsDuplicateKeyError(err) {
		return errors.New("guild invite is already pending")
	}
	return err
}

func (db *DB) GetGuildInvites(targetID string) ([]GuildInvite, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.guildInvites.Find(ctx, bson.M{"target_id": targetID, "expires_at": bson.M{"$gt": time.Now().UTC()}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var invites []GuildInvite
	if err := cursor.All(ctx, &invites); err != nil {
		return nil, err
	}
	return invites, nil
}

func (db *DB) RespondGuildInvite(targetID, guildID, targetUsername string, accepted bool) (*Guild, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var invite GuildInvite
	err := db.guildInvites.FindOne(ctx, bson.M{"target_id": targetID, "guild_id": guildID, "expires_at": bson.M{"$gt": time.Now().UTC()}}).Decode(&invite)
	if err == mongo.ErrNoDocuments {
		return nil, errors.New("guild invite not found or expired")
	}
	if err != nil {
		return nil, err
	}
	if !accepted {
		_, err = db.guildInvites.DeleteOne(ctx, bson.M{"target_id": targetID, "guild_id": guildID})
		return nil, err
	}
	if existing, err := db.getGuildForPlayer(targetID); err != nil {
		return nil, err
	} else if existing != nil {
		return nil, errors.New("you are already in a guild")
	}
	guild, err := db.GetGuildByID(guildID)
	if err != nil || guild == nil {
		return nil, errors.New("guild not found")
	}
	if len(guild.Members) >= GuildMemberLimit {
		return nil, errors.New("guild is full")
	}
	now := time.Now().UTC()
	member := GuildMember{PlayerID: targetID, Username: targetUsername, Rank: GuildRankMember, JoinedAt: now, LastOnline: now}
	entry := GuildAuditEntry{At: now, ActorID: targetID, Action: "member_joined", TargetID: targetID}
	update := bson.M{
		"$addToSet": bson.M{"members": member},
		"$push":     bson.M{"audit": bson.M{"$each": []GuildAuditEntry{entry}, "$slice": -GuildAuditLimit}},
		"$set":      bson.M{"updated_at": now},
		"$inc":      bson.M{"version": 1},
	}
	result, err := db.guilds.UpdateOne(ctx, bson.M{"id": guildID, "members.player_id": bson.M{"$ne": targetID}}, update)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, errors.New("player is already in a guild")
		}
		return nil, err
	}
	if result.ModifiedCount == 0 {
		return nil, errors.New("guild membership changed; refresh and try again")
	}
	_, _ = db.guildInvites.DeleteMany(ctx, bson.M{"target_id": targetID})
	return db.GetGuildByID(guildID)
}

func (db *DB) LeaveGuild(playerID string) (*Guild, bool, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.getGuildForPlayer(playerID)
	if err != nil || guild == nil {
		return nil, false, errors.New("guild not found")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if len(guild.Members) == 1 {
		_, err := db.guilds.DeleteOne(ctx, bson.M{"id": guild.ID})
		if err == nil {
			_, _ = db.guildInvites.DeleteMany(ctx, bson.M{"guild_id": guild.ID})
		}
		return nil, true, err
	}
	now := time.Now().UTC()
	oldLeaderID := guild.LeaderID
	newLeaderID := oldLeaderID
	if guild.LeaderID == playerID {
		candidates := append([]GuildMember(nil), guild.Members...)
		sort.SliceStable(candidates, func(i, j int) bool {
			if candidates[i].Rank != candidates[j].Rank {
				return candidates[i].Rank == GuildRankOfficer
			}
			return candidates[i].JoinedAt.Before(candidates[j].JoinedAt)
		})
		for _, candidate := range candidates {
			if candidate.PlayerID != playerID {
				newLeaderID = candidate.PlayerID
				break
			}
		}
	}
	for index := range guild.Members {
		if guild.Members[index].PlayerID == newLeaderID {
			guild.Members[index].Rank = GuildRankLeader
		}
	}
	filtered := make([]GuildMember, 0, len(guild.Members)-1)
	for _, member := range guild.Members {
		if member.PlayerID != playerID {
			filtered = append(filtered, member)
		}
	}
	guild.Members = filtered
	guild.LeaderID = newLeaderID
	guild.UpdatedAt = now
	guild.Version++
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: playerID, Action: "member_left", TargetID: playerID})
	if newLeaderID != oldLeaderID {
		guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: playerID, Action: "leadership_transferred", TargetID: newLeaderID})
	}
	_, err = db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID}, guild)
	return guild, false, err
}

func appendBoundedGuildAudit(entries []GuildAuditEntry, entry GuildAuditEntry) []GuildAuditEntry {
	entries = append(entries, entry)
	if len(entries) > GuildAuditLimit {
		entries = append([]GuildAuditEntry(nil), entries[len(entries)-GuildAuditLimit:]...)
	}
	return entries
}

func (db *DB) KickGuildMember(actorID, targetID string) (*Guild, error) {
	return db.mutateGuildMembers(actorID, targetID, "member_kicked", func(guild *Guild, actor, target *GuildMember) error {
		if err := requireGuildPermission(guild, actorID, GuildPermissionKick); err != nil {
			return err
		}
		if target.Rank == GuildRankLeader || target.PlayerID == actor.PlayerID {
			return errors.New("guild leader cannot be kicked")
		}
		filtered := guild.Members[:0]
		for _, member := range guild.Members {
			if member.PlayerID != targetID {
				filtered = append(filtered, member)
			}
		}
		guild.Members = filtered
		return nil
	})
}

func (db *DB) SetGuildMemberRank(actorID, targetID, rank string) (*Guild, error) {
	if rank != GuildRankOfficer && rank != GuildRankMember {
		return nil, errors.New("rank must be officer or member")
	}
	return db.mutateGuildMembers(actorID, targetID, "rank_changed", func(guild *Guild, actor, target *GuildMember) error {
		if err := requireGuildPermission(guild, actorID, GuildPermissionSetRank); err != nil {
			return err
		}
		if target.Rank == GuildRankLeader || target.PlayerID == actor.PlayerID {
			return errors.New("leader rank changes require leadership transfer")
		}
		target.Rank = rank
		return nil
	})
}

func (db *DB) TransferGuildLeadership(actorID, targetID string) (*Guild, error) {
	return db.mutateGuildMembers(actorID, targetID, "leadership_transferred", func(guild *Guild, actor, target *GuildMember) error {
		if guild.LeaderID != actorID || actor.PlayerID == target.PlayerID {
			return errors.New("only the guild leader can transfer leadership")
		}
		actor.Rank = GuildRankOfficer
		target.Rank = GuildRankLeader
		guild.LeaderID = targetID
		return nil
	})
}

func (db *DB) mutateGuildMembers(actorID, targetID, action string, mutate func(*Guild, *GuildMember, *GuildMember) error) (*Guild, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.getGuildForPlayer(actorID)
	if err != nil || guild == nil {
		return nil, errors.New("guild not found")
	}
	actor, target := guildMember(guild, actorID), guildMember(guild, targetID)
	if actor == nil || target == nil {
		return nil, errors.New("guild member not found")
	}
	if err := mutate(guild, actor, target); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	guild.UpdatedAt = now
	guild.Version++
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: actorID, Action: action, TargetID: targetID})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID}, guild); err != nil {
		return nil, err
	}
	return guild, nil
}

func (db *DB) DepositGuildGold(guildID, playerID string, amount int) (*Guild, error) {
	if amount <= 0 {
		return nil, errors.New("deposit must be positive")
	}
	return db.updateGuildBankGold(guildID, playerID, amount, false)
}

func (db *DB) WithdrawGuildGold(guildID, playerID string, amount int) (*Guild, error) {
	if amount <= 0 {
		return nil, errors.New("withdrawal must be positive")
	}
	return db.updateGuildBankGold(guildID, playerID, -amount, true)
}

func (db *DB) updateGuildBankGold(guildID, playerID string, delta int, requireWithdraw bool) (*Guild, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.GetGuildByID(guildID)
	if err != nil || guild == nil || guildMember(guild, playerID) == nil {
		return nil, errors.New("guild not found")
	}
	if requireWithdraw {
		if err := requireGuildPermission(guild, playerID, GuildPermissionWithdrawBank); err != nil {
			return nil, err
		}
		if guild.Bank.Gold+delta < 0 {
			return nil, errors.New("guild bank has insufficient gold")
		}
	}
	guild.Bank.Gold += delta
	now := time.Now().UTC()
	action := "bank_gold_deposit"
	if delta < 0 {
		action = "bank_gold_withdraw"
	}
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: playerID, Action: action, Amount: delta})
	guild.UpdatedAt = now
	guild.Version++
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID}, guild); err != nil {
		return nil, err
	}
	return guild, nil
}

func (db *DB) DepositGuildItem(guildID, playerID string, item Item) (*Guild, error) {
	if item.ID == "" {
		return nil, errors.New("item is required")
	}
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.GetGuildByID(guildID)
	if err != nil || guild == nil || guildMember(guild, playerID) == nil {
		return nil, errors.New("guild not found")
	}
	if len(guild.Bank.Items) >= GuildBankItemLimit {
		return nil, errors.New("guild bank is full")
	}
	for _, stored := range guild.Bank.Items {
		if stored.ID == item.ID {
			return nil, errors.New("item is already in the guild bank")
		}
	}
	guild.Bank.Items = append(guild.Bank.Items, item)
	now := time.Now().UTC()
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: playerID, Action: "bank_item_deposit", ItemName: item.Name})
	guild.UpdatedAt = now
	guild.Version++
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID}, guild)
	return guild, err
}

func (db *DB) WithdrawGuildItem(guildID, playerID, itemID string) (*Guild, *Item, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.GetGuildByID(guildID)
	if err != nil || guild == nil {
		return nil, nil, errors.New("guild not found")
	}
	if err := requireGuildPermission(guild, playerID, GuildPermissionWithdrawBank); err != nil {
		return nil, nil, err
	}
	index := -1
	for i := range guild.Bank.Items {
		if guild.Bank.Items[i].ID == itemID {
			index = i
			break
		}
	}
	if index < 0 {
		return nil, nil, errors.New("guild bank item not found")
	}
	item := guild.Bank.Items[index]
	guild.Bank.Items = append(guild.Bank.Items[:index], guild.Bank.Items[index+1:]...)
	now := time.Now().UTC()
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: playerID, Action: "bank_item_withdraw", ItemName: item.Name})
	guild.UpdatedAt = now
	guild.Version++
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID}, guild); err != nil {
		return nil, nil, err
	}
	return guild, &item, nil
}

func (db *DB) TouchGuildMember(playerID string, at time.Time) error {
	if db == nil || db.guilds == nil || playerID == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.guilds.UpdateOne(ctx, bson.M{"members.player_id": playerID}, bson.M{
		"$set": bson.M{"members.$.last_online": at.UTC(), "updated_at": at.UTC()},
	})
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return nil
	}
	return nil
}

func FormatGuildAudit(entry GuildAuditEntry) string {
	return fmt.Sprintf("%s:%s:%s:%d", entry.ActorID, entry.Action, entry.TargetID, entry.Amount)
}
