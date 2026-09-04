package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type GuildDungeonRun struct {
	GuildID      string    `bson:"guild_id" json:"guildId"`
	GuildName    string    `bson:"guild_name" json:"guildName"`
	GuildTag     string    `bson:"guild_tag" json:"guildTag"`
	Season       string    `bson:"season" json:"season"`
	DungeonType  string    `bson:"dungeon_type" json:"dungeonType"`
	Difficulty   string    `bson:"difficulty" json:"difficulty"`
	RunLevel     int       `bson:"run_level" json:"runLevel"`
	DurationMS   int64     `bson:"duration_ms" json:"durationMs"`
	MemberCount  int       `bson:"member_count" json:"memberCount"`
	FirstClearAt time.Time `bson:"first_clear_at" json:"firstClearAt"`
	UpdatedAt    time.Time `bson:"updated_at" json:"updatedAt"`
}

func CurrentGuildDungeonSeason(at time.Time) string {
	return CurrentArenaSeason(at)
}

// RecordGuildDungeonRun atomically keeps each guild's fastest clear for one
// dungeon, difficulty, level band, and season. A qualifying guild run needs at
// least two members so a solo clear cannot borrow a guild tag.
func (db *DB) RecordGuildDungeonRun(run GuildDungeonRun) error {
	if db == nil || db.guildRuns == nil {
		return errors.New("guild leaderboard service unavailable")
	}
	run.GuildID = strings.TrimSpace(run.GuildID)
	run.DungeonType = strings.TrimSpace(run.DungeonType)
	run.Difficulty = strings.ToLower(strings.TrimSpace(run.Difficulty))
	if run.GuildID == "" || run.DungeonType == "" || run.MemberCount < 2 || run.RunLevel < 1 || run.DurationMS < 1 || run.DurationMS > int64((24*time.Hour)/time.Millisecond) {
		return errors.New("invalid guild dungeon run")
	}
	now := time.Now().UTC()
	if run.Season == "" {
		run.Season = CurrentGuildDungeonSeason(now)
	}
	filter := bson.M{
		"guild_id": run.GuildID, "season": run.Season, "dungeon_type": run.DungeonType,
		"difficulty": run.Difficulty, "run_level": run.RunLevel,
	}
	update := bson.M{
		"$setOnInsert": bson.M{
			"guild_id": run.GuildID, "season": run.Season, "dungeon_type": run.DungeonType,
			"difficulty": run.Difficulty, "run_level": run.RunLevel, "first_clear_at": now,
		},
		"$set": bson.M{"guild_name": run.GuildName, "guild_tag": run.GuildTag, "updated_at": now},
		"$min": bson.M{"duration_ms": run.DurationMS},
		"$max": bson.M{"member_count": run.MemberCount},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.guildRuns.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	return err
}

func (db *DB) GuildDungeonLeaderboard(dungeonType, difficulty string, runLevel, limit int, at time.Time) ([]GuildDungeonRun, error) {
	if db == nil || db.guildRuns == nil {
		return nil, errors.New("guild leaderboard service unavailable")
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	filter := bson.M{"season": CurrentGuildDungeonSeason(at)}
	if dungeonType = strings.TrimSpace(dungeonType); dungeonType != "" {
		filter["dungeon_type"] = dungeonType
	}
	if difficulty = strings.ToLower(strings.TrimSpace(difficulty)); difficulty != "" {
		filter["difficulty"] = difficulty
	}
	if runLevel > 0 {
		filter["run_level"] = runLevel
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.guildRuns.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "duration_ms", Value: 1}, {Key: "updated_at", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var runs []GuildDungeonRun
	if err := cursor.All(ctx, &runs); err != nil {
		return nil, err
	}
	return runs, nil
}
