package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

const GuildInactiveLeaderAfter = 30 * 24 * time.Hour

func (db *DB) SetGuildMOTD(actorID, motd string) (*Guild, error) {
	motd = strings.Join(strings.Fields(strings.TrimSpace(motd)), " ")
	if len(motd) > 160 {
		return nil, errors.New("guild message must be 160 characters or fewer")
	}
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.getGuildForPlayer(actorID)
	if err != nil || guild == nil {
		return nil, errors.New("guild not found")
	}
	if err := requireGuildPermission(guild, actorID, GuildPermissionManageMOTD); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	guild.MOTD = motd
	guild.UpdatedAt = now
	guild.Version++
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now, ActorID: actorID, Action: "motd_changed"})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID, "version": guild.Version - 1}, guild)
	if err != nil {
		return nil, err
	}
	if result.ModifiedCount == 0 {
		return nil, errors.New("guild changed; refresh and try again")
	}
	return guild, nil
}

func (db *DB) DisbandGuild(actorID string) (string, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.getGuildForPlayer(actorID)
	if err != nil || guild == nil {
		return "", errors.New("guild not found")
	}
	if guild.LeaderID != actorID {
		return "", errors.New("only the guild leader can disband the guild")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.guilds.DeleteOne(ctx, bson.M{"id": guild.ID, "leader_id": actorID, "version": guild.Version})
	if err != nil {
		return "", err
	}
	if result.DeletedCount == 0 {
		return "", errors.New("guild changed; refresh and try again")
	}
	_, _ = db.guildInvites.DeleteMany(ctx, bson.M{"guild_id": guild.ID})
	return guild.ID, nil
}

// ClaimInactiveGuildLeadership gives an officer a recovery path when a leader
// has not logged in for 30 days. It is deliberately explicit and audited.
func (db *DB) ClaimInactiveGuildLeadership(actorID string, now time.Time) (*Guild, error) {
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.getGuildForPlayer(actorID)
	if err != nil || guild == nil {
		return nil, errors.New("guild not found")
	}
	actor := guildMember(guild, actorID)
	leader := guildMember(guild, guild.LeaderID)
	if actor == nil || actor.Rank != GuildRankOfficer {
		return nil, errors.New("only an officer can claim inactive leadership")
	}
	if leader == nil || leader.LastOnline.IsZero() || now.UTC().Sub(leader.LastOnline) < GuildInactiveLeaderAfter {
		return nil, errors.New("guild leader is not inactive long enough")
	}
	oldLeaderID := guild.LeaderID
	leader.Rank = GuildRankOfficer
	actor.Rank = GuildRankLeader
	guild.LeaderID = actorID
	guild.UpdatedAt = now.UTC()
	guild.Version++
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now.UTC(), ActorID: actorID, Action: "inactive_leadership_claimed", TargetID: oldLeaderID})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID, "version": guild.Version - 1, "leader_id": oldLeaderID}, guild)
	if err != nil {
		return nil, err
	}
	if result.ModifiedCount == 0 {
		return nil, errors.New("guild changed; refresh and try again")
	}
	return guild, nil
}
