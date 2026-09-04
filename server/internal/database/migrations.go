package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CurrentSchemaVersion = 7

type schemaMigration struct {
	Version int
	Name    string
	Apply   func(context.Context, *DB) error
}

type appliedMigration struct {
	Version   int       `bson:"version"`
	Name      string    `bson:"name"`
	AppliedAt time.Time `bson:"applied_at"`
}

var schemaMigrations = []schemaMigration{
	{
		Version: 1,
		Name:    "core_query_indexes",
		Apply:   applyCoreQueryIndexes,
	},
	{
		Version: 2,
		Name:    "report_queue_indexes",
		Apply:   applyReportQueueIndexes,
	},
	{
		Version: 3,
		Name:    "character_resume_indexes",
		Apply:   applyCharacterResumeIndexes,
	},
	{
		Version: 4,
		Name:    "guild_indexes",
		Apply:   applyGuildIndexes,
	},
	{
		Version: 5,
		Name:    "pvp_profile_indexes",
		Apply:   applyPvPProfileIndexes,
	},
	{
		Version: 6,
		Name:    "weekly_raid_lockout_indexes",
		Apply:   applyWeeklyRaidLockoutIndexes,
	},
	{
		Version: 7,
		Name:    "guild_dungeon_leaderboard_indexes",
		Apply:   applyGuildDungeonLeaderboardIndexes,
	},
}

// RunMigrations applies every missing migration in ascending version order.
// Migrations are deliberately idempotent so concurrent server starts are safe:
// both processes may attempt an index build, while the unique migration record
// decides which process records completion.
func (db *DB) RunMigrations(ctx context.Context) error {
	if db == nil || db.migrations == nil {
		return fmt.Errorf("migration collection is not initialized")
	}

	_, err := db.migrations.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "version", Value: 1}},
		Options: options.Index().SetName("version_1").SetUnique(true),
	})
	if err != nil {
		return fmt.Errorf("create migration version index: %w", err)
	}

	for _, migration := range schemaMigrations {
		if migration.Version <= 0 || migration.Name == "" || migration.Apply == nil {
			return fmt.Errorf("invalid schema migration version %d", migration.Version)
		}

		err := db.migrations.FindOne(ctx, bson.M{"version": migration.Version}).Err()
		switch err {
		case nil:
			continue
		case mongo.ErrNoDocuments:
			// Apply below.
		default:
			return fmt.Errorf("check schema migration %d: %w", migration.Version, err)
		}

		if err := migration.Apply(ctx, db); err != nil {
			return fmt.Errorf("apply schema migration %d (%s): %w", migration.Version, migration.Name, err)
		}
		_, err = db.migrations.InsertOne(ctx, appliedMigration{
			Version:   migration.Version,
			Name:      migration.Name,
			AppliedAt: time.Now().UTC(),
		})
		if err != nil && !mongo.IsDuplicateKeyError(err) {
			return fmt.Errorf("record schema migration %d: %w", migration.Version, err)
		}
	}
	return nil
}

// SchemaVersion returns the highest migration recorded by the database.
func (db *DB) SchemaVersion(ctx context.Context) (int, error) {
	if db == nil || db.migrations == nil {
		return 0, fmt.Errorf("migration collection is not initialized")
	}
	var latest appliedMigration
	err := db.migrations.FindOne(
		ctx,
		bson.M{},
		options.FindOne().SetSort(bson.D{{Key: "version", Value: -1}}),
	).Decode(&latest)
	if err == mongo.ErrNoDocuments {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return latest.Version, nil
}

func applyCoreQueryIndexes(ctx context.Context, db *DB) error {
	indexSets := []struct {
		name       string
		collection *mongo.Collection
		models     []mongo.IndexModel
	}{
		{
			name:       "users",
			collection: db.users,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetName("username_1").SetUnique(true)},
				{Keys: bson.D{{Key: "characters.name", Value: 1}}, Options: options.Index().SetName("characters.name_1")},
			},
		},
		{
			name:       "auctions",
			collection: db.auctions,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetName("id_1").SetUnique(true)},
				{Keys: bson.D{{Key: "status", Value: 1}, {Key: "end_time", Value: 1}}, Options: options.Index().SetName("status_1_end_time_1")},
				{Keys: bson.D{{Key: "seller_id", Value: 1}, {Key: "status", Value: 1}}, Options: options.Index().SetName("seller_id_1_status_1")},
			},
		},
		{
			name:       "friendships",
			collection: db.friendships,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "requester_id", Value: 1}, {Key: "addressee_id", Value: 1}}, Options: options.Index().SetName("requester_id_1_addressee_id_1").SetUnique(true)},
				{Keys: bson.D{{Key: "addressee_id", Value: 1}, {Key: "status", Value: 1}}, Options: options.Index().SetName("addressee_id_1_status_1")},
				{Keys: bson.D{{Key: "requester_id", Value: 1}, {Key: "status", Value: 1}}, Options: options.Index().SetName("requester_id_1_status_1")},
			},
		},
	}

	for _, set := range indexSets {
		if set.collection == nil {
			return fmt.Errorf("%s collection is not initialized", set.name)
		}
		if _, err := set.collection.Indexes().CreateMany(ctx, set.models); err != nil {
			return fmt.Errorf("create %s indexes: %w", set.name, err)
		}
	}
	return nil
}

func applyReportQueueIndexes(ctx context.Context, db *DB) error {
	if db.reports == nil {
		return fmt.Errorf("reports collection is not initialized")
	}
	_, err := db.reports.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: 1}}, Options: options.Index().SetName("status_1_created_at_1")},
		{Keys: bson.D{{Key: "username", Value: 1}, {Key: "created_at", Value: -1}}, Options: options.Index().SetName("username_1_created_at_-1")},
	})
	return err
}

func applyCharacterResumeIndexes(ctx context.Context, db *DB) error {
	if db.users == nil {
		return fmt.Errorf("users collection is not initialized")
	}
	_, err := db.users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "characters.instance_id", Value: 1}},
		Options: options.Index().SetName("characters.instance_id_1").SetSparse(true),
	})
	return err
}

func applyGuildIndexes(ctx context.Context, db *DB) error {
	if db.guilds == nil || db.guildInvites == nil {
		return fmt.Errorf("guild collections are not initialized")
	}
	if _, err := db.guilds.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetName("id_1").SetUnique(true)},
		{Keys: bson.D{{Key: "name_key", Value: 1}}, Options: options.Index().SetName("name_key_1").SetUnique(true)},
		{Keys: bson.D{{Key: "tag", Value: 1}}, Options: options.Index().SetName("tag_1").SetUnique(true)},
		{Keys: bson.D{{Key: "members.player_id", Value: 1}}, Options: options.Index().SetName("members.player_id_1").SetUnique(true)},
	}); err != nil {
		return err
	}
	_, err := db.guildInvites.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "guild_id", Value: 1}, {Key: "target_id", Value: 1}}, Options: options.Index().SetName("guild_id_1_target_id_1").SetUnique(true)},
		{Keys: bson.D{{Key: "target_id", Value: 1}, {Key: "expires_at", Value: 1}}, Options: options.Index().SetName("target_id_1_expires_at_1")},
		{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetName("expires_at_1_ttl").SetExpireAfterSeconds(0)},
	})
	return err
}

func applyPvPProfileIndexes(ctx context.Context, db *DB) error {
	if db.pvpProfiles == nil {
		return fmt.Errorf("pvp profile collection is not initialized")
	}
	_, err := db.pvpProfiles.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "player_id", Value: 1}}, Options: options.Index().SetName("player_id_1").SetUnique(true)},
		{Keys: bson.D{{Key: "season", Value: 1}, {Key: "rating", Value: -1}}, Options: options.Index().SetName("season_1_rating_-1")},
	})
	return err
}

func applyWeeklyRaidLockoutIndexes(ctx context.Context, db *DB) error {
	if db.raidLockouts == nil {
		return fmt.Errorf("raid lockout collection is not initialized")
	}
	_, err := db.raidLockouts.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "player_id", Value: 1}, {Key: "week", Value: 1}}, Options: options.Index().SetName("player_id_1_week_1").SetUnique(true)},
		{Keys: bson.D{{Key: "week", Value: 1}, {Key: "completed_at", Value: -1}}, Options: options.Index().SetName("week_1_completed_at_-1")},
	})
	return err
}

func applyGuildDungeonLeaderboardIndexes(ctx context.Context, db *DB) error {
	if db.guildRuns == nil {
		return fmt.Errorf("guild dungeon run collection is not initialized")
	}
	_, err := db.guildRuns.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "season", Value: 1}, {Key: "dungeon_type", Value: 1},
				{Key: "difficulty", Value: 1}, {Key: "run_level", Value: 1}, {Key: "guild_id", Value: 1},
			},
			Options: options.Index().SetName("season_1_dungeon_1_difficulty_1_level_1_guild_1").SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "season", Value: 1}, {Key: "dungeon_type", Value: 1},
				{Key: "difficulty", Value: 1}, {Key: "run_level", Value: -1}, {Key: "duration_ms", Value: 1},
			},
			Options: options.Index().SetName("season_1_dungeon_1_difficulty_1_level_-1_duration_1"),
		},
	})
	return err
}
