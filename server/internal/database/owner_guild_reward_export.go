package database

import (
	"context"
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ownerGuildMembership struct {
	PlayerID   string     `bson:"player_id" json:"-"`
	Rank       string     `bson:"rank" json:"rank"`
	JoinedAt   time.Time  `bson:"joined_at" json:"joined_at"`
	LastOnline *time.Time `bson:"last_online,omitempty" json:"last_online,omitempty"`
}

type ownerGuildSource struct {
	ID         primitive.ObjectID     `bson:"_id" json:"-"`
	GuildID    string                 `bson:"id" json:"-"`
	Name       string                 `bson:"name" json:"-"`
	Tag        string                 `bson:"tag" json:"-"`
	OwnMembers []ownerGuildMembership `bson:"own_members" json:"-"`
}

type ownerGuildEntry struct {
	ID         primitive.ObjectID   `json:"id"`
	GuildID    string               `json:"guild_id"`
	Name       string               `json:"name"`
	Tag        string               `json:"tag"`
	Membership ownerGuildMembership `json:"own_membership"`
}

type ownerInviteSource struct {
	ID        primitive.ObjectID `bson:"_id" json:"-"`
	GuildID   string             `bson:"guild_id" json:"-"`
	GuildName string             `bson:"guild_name" json:"-"`
	GuildTag  string             `bson:"guild_tag" json:"-"`
	InviterID string             `bson:"inviter_id" json:"-"`
	TargetID  string             `bson:"target_id" json:"-"`
	CreatedAt time.Time          `bson:"created_at" json:"-"`
	ExpiresAt time.Time          `bson:"expires_at" json:"-"`
}

type ownerInviteEntry struct {
	ID          primitive.ObjectID `json:"id"`
	GuildID     string             `json:"guild_id"`
	GuildName   string             `json:"guild_name"`
	GuildTag    string             `json:"guild_tag"`
	Direction   string             `json:"direction"`
	Counterpart string             `json:"counterpart_player_id"`
	CreatedAt   time.Time          `json:"created_at"`
	ExpiresAt   time.Time          `json:"expires_at"`
}

type ownerCompetitiveResult struct {
	Won           bool   `bson:"won" json:"won"`
	Forfeit       bool   `bson:"forfeit" json:"forfeit"`
	TeamScore     int    `bson:"team_score" json:"team_score"`
	OpponentScore int    `bson:"opponent_score" json:"opponent_score"`
	RatingBefore  int    `bson:"rating_before" json:"rating_before"`
	RatingChange  int    `bson:"rating_change" json:"rating_change"`
	HonorAwarded  int    `bson:"honor_awarded" json:"honor_awarded"`
	SeasonAwarded int    `bson:"season_awarded" json:"season_awarded"`
	Reason        string `bson:"reason" json:"reason"`
}

type ownerCompetitiveSeason struct {
	Season       string `bson:"season" json:"season"`
	Rating       int    `bson:"rating" json:"rating"`
	Wins         int    `bson:"wins" json:"wins"`
	Losses       int    `bson:"losses" json:"losses"`
	EligibleWins int    `bson:"eligible_wins" json:"eligible_wins"`
	Medal        string `bson:"medal" json:"medal"`
	HonorAwarded int    `bson:"honor_awarded" json:"honor_awarded"`
	SettledAt    int64  `bson:"settled_at" json:"settled_at_unix"`
}

type ownerCompetitiveSummary struct {
	Rating          int                      `bson:"rating" json:"rating"`
	Wins            int                      `bson:"wins" json:"wins"`
	Losses          int                      `bson:"losses" json:"losses"`
	Honor           int                      `bson:"honor" json:"honor"`
	SeasonPoints    int                      `bson:"season_points" json:"season_points"`
	SeasonVictories int                      `bson:"season_victories" json:"season_victories"`
	Season          string                   `bson:"season" json:"season"`
	UpdatedAt       time.Time                `bson:"updated_at" json:"updated_at"`
	LastResult      ownerCompetitiveResult   `bson:"last_result" json:"last_result"`
	SeasonHistory   []ownerCompetitiveSeason `bson:"season_history" json:"season_history"`
	QueuePenalty    struct {
		Day           string `bson:"day" json:"day"`
		DeserterUntil int64  `bson:"deserter_until" json:"deserter_until_unix"`
	} `bson:"reward_state" json:"queue_penalty"`
}

type ownerCompetitiveSource struct {
	ID       primitive.ObjectID      `bson:"_id" json:"-"`
	PlayerID string                  `bson:"player_id" json:"-"`
	Summary  ownerCompetitiveSummary `bson:",inline" json:"-"`
}

type ownerCompetitiveEntry struct {
	ID      primitive.ObjectID      `json:"id"`
	Summary ownerCompetitiveSummary `json:"summary"`
}

type ownerRaidSource struct {
	ID              primitive.ObjectID `bson:"_id" json:"-"`
	PlayerID        string             `bson:"player_id" json:"-"`
	Week            string             `bson:"week" json:"-"`
	CompletedAt     time.Time          `bson:"completed_at" json:"-"`
	DeliveryPending bool               `bson:"delivery_pending" json:"-"`
}

type ownerRaidEntry struct {
	ID              primitive.ObjectID `json:"id"`
	Week            string             `json:"week"`
	CompletedAt     time.Time          `json:"completed_at"`
	DeliveryPending bool               `json:"delivery_pending"`
}

func encodeOwnerDataPage[T any](format, section string, at time.Time, entries []T, next string, maxBytes int) ([]byte, error) {
	page := struct {
		Format      string              `json:"format"`
		Version     int                 `json:"version"`
		GeneratedAt time.Time           `json:"generated_at"`
		Coverage    ownerExportCoverage `json:"coverage"`
		Entries     []T                 `json:"entries"`
		Next        string              `json:"next,omitempty"`
	}{format, 1, at.UTC(), ownerSectionCoverage(section), entries, next}
	data, err := json.Marshal(page)
	if err != nil || len(data) > maxBytes {
		return nil, errOwnerExportSection
	}
	return data, nil
}

func ownerGuildPagePipeline(owner, before string) mongo.Pipeline {
	playerID := "player-" + owner
	projection := bson.M{"_id": 1, "id": 1, "name": 1, "tag": 1, "own_members": bson.M{"$map": bson.M{"input": bson.M{"$filter": bson.M{"input": bson.M{"$ifNull": bson.A{"$members", bson.A{}}}, "as": "member", "cond": bson.M{"$eq": bson.A{"$$member.player_id", playerID}}}}, "as": "own", "in": bson.M{"player_id": "$$own.player_id", "rank": "$$own.rank", "joined_at": "$$own.joined_at", "last_online": "$$own.last_online"}}}}
	return ownerDataPagePipeline(bson.M{"members.player_id": playerID}, projection, before, 2048)
}

func (db *DB) readOwnerGuildPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	playerID := "player-" + owner
	valid := func(row ownerGuildSource) bool {
		return row.GuildID != "" && row.Name != "" && row.Tag != "" && len(row.OwnMembers) == 1 && row.OwnMembers[0].PlayerID == playerID &&
			(row.OwnMembers[0].Rank == GuildRankLeader || row.OwnMembers[0].Rank == GuildRankOfficer || row.OwnMembers[0].Rank == GuildRankMember) && !row.OwnMembers[0].JoinedAt.IsZero()
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.guilds, ownerGuildPagePipeline(owner, before), before, func(row ownerGuildSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerGuildEntry, 0, len(sources))
	for _, row := range sources {
		member := row.OwnMembers[0]
		member.JoinedAt = member.JoinedAt.UTC()
		if member.LastOnline != nil {
			if member.LastOnline.IsZero() {
				member.LastOnline = nil
			} else {
				last := member.LastOnline.UTC()
				member.LastOnline = &last
			}
		}
		entries = append(entries, ownerGuildEntry{row.ID, row.GuildID, row.Name, row.Tag, member})
	}
	return encodeOwnerDataPage("eidolon-owner-guild-memberships", "guilds", at, entries, next, maxBytes)
}

func (db *DB) readOwnerInvitePage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	playerID := "player-" + owner
	filter := bson.M{"$or": bson.A{bson.M{"inviter_id": playerID}, bson.M{"target_id": playerID}}, "expires_at": bson.M{"$gt": at}}
	projection := bson.M{"_id": 1, "guild_id": 1, "guild_name": 1, "guild_tag": 1, "inviter_id": 1, "target_id": 1, "created_at": 1, "expires_at": 1}
	valid := func(row ownerInviteSource) bool {
		return row.GuildID != "" && row.GuildName != "" && row.InviterID != "" && row.TargetID != "" && row.InviterID != row.TargetID && (row.InviterID == playerID || row.TargetID == playerID) && !row.CreatedAt.IsZero() && row.ExpiresAt.After(at)
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.guildInvites, ownerDataPagePipeline(filter, projection, before, 2048), before, func(row ownerInviteSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerInviteEntry, 0, len(sources))
	for _, row := range sources {
		direction, counterpart := "received", row.InviterID
		if row.InviterID == playerID {
			direction, counterpart = "sent", row.TargetID
		}
		entries = append(entries, ownerInviteEntry{row.ID, row.GuildID, row.GuildName, row.GuildTag, direction, counterpart, row.CreatedAt.UTC(), row.ExpiresAt.UTC()})
	}
	return encodeOwnerDataPage("eidolon-owner-guild-invitations", "invites", at, entries, next, maxBytes)
}

func ownerCompetitivePagePipeline(owner, before string) mongo.Pipeline {
	projection := bson.M{"_id": 1, "player_id": 1, "rating": 1, "wins": 1, "losses": 1, "honor": 1, "season_points": 1, "season_victories": 1, "season": 1, "updated_at": 1, "reward_state.day": 1, "reward_state.deserter_until": 1}
	for _, field := range []string{"won", "forfeit", "team_score", "opponent_score", "rating_before", "rating_change", "honor_awarded", "season_awarded", "reason"} {
		projection["last_result."+field] = 1
	}
	for _, field := range []string{"season", "rating", "wins", "losses", "eligible_wins", "medal", "honor_awarded", "settled_at"} {
		projection["season_history."+field] = 1
	}
	return ownerDataPagePipeline(bson.M{"player_id": "player-" + owner}, projection, before, 16<<10)
}

func (db *DB) readOwnerCompetitivePage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerCompetitiveSource) bool {
		s := row.Summary
		return row.PlayerID == "player-"+owner && s.Rating >= 0 && s.Wins >= 0 && s.Losses >= 0 && s.Honor >= 0 && s.SeasonPoints >= 0 && s.SeasonVictories >= 0 && s.Season != "" && !s.UpdatedAt.IsZero()
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.pvpProfiles, ownerCompetitivePagePipeline(owner, before), before, func(row ownerCompetitiveSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerCompetitiveEntry, 0, len(sources))
	for _, row := range sources {
		summary := row.Summary
		summary.UpdatedAt = summary.UpdatedAt.UTC()
		summary.SeasonHistory = append([]ownerCompetitiveSeason{}, summary.SeasonHistory...)
		entries = append(entries, ownerCompetitiveEntry{row.ID, summary})
	}
	return encodeOwnerDataPage("eidolon-owner-competitive-records", "pvp", at, entries, next, maxBytes)
}

func (db *DB) readOwnerRaidPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	projection := bson.M{"_id": 1, "player_id": 1, "week": 1, "completed_at": 1, "delivery_pending": 1}
	valid := func(row ownerRaidSource) bool {
		return row.PlayerID == "player-"+owner && !row.CompletedAt.IsZero() && row.Week == CurrentRaidWeek(row.CompletedAt)
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.raidLockouts, ownerDataPagePipeline(bson.M{"player_id": "player-" + owner}, projection, before, 2048), before, func(row ownerRaidSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerRaidEntry, 0, len(sources))
	for _, row := range sources {
		entries = append(entries, ownerRaidEntry{row.ID, row.Week, row.CompletedAt.UTC(), row.DeliveryPending})
	}
	return encodeOwnerDataPage("eidolon-owner-weekly-raid-records", "raids", at, entries, next, maxBytes)
}
