package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const maximumOwnerExportResponse = 512 << 10
const maximumOwnerExportPasswordCost = 14

var errOwnerExportSection = errors.New("account export section unavailable")

// Internal query selection; the approved reader and transport supply case,
// session and concurrency admission. These helpers alone prove only current
// ownership and bounded section reads, not complete account coverage/restoration.
type OwnerExportQuery struct {
	Section       string
	CharacterName string
	Before        string
}

func (db *DB) readOwnerExportSection(parent context.Context, owner, password, section, characterName string, at time.Time, maxBytes int) ([]byte, error) {
	return db.readOwnerExportQuery(parent, owner, password, OwnerExportQuery{Section: section, CharacterName: characterName}, at, maxBytes)
}

func (db *DB) readOwnerExportQuery(parent context.Context, owner, password string, query OwnerExportQuery, at time.Time, maxBytes int) ([]byte, error) {
	section, characterName := query.Section, query.CharacterName
	if parent == nil || db == nil || db.users == nil || owner == "" || len(owner) > 128 || len(password) < 1 || len(password) > 72 ||
		at.IsZero() || maxBytes < 1 || maxBytes > maximumOwnerExportResponse ||
		!ValidOwnerExportQuery(query) {
		return nil, errOwnerExportSection
	}
	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()
	var proof struct {
		Hash string `bson:"password_hash" json:"-"`
	}
	// Bound the credential before driver decoding; never load a whole User or
	// character array to verify the password. Malformed legacy hashes fail closed.
	filter := bson.M{"username": owner, "$expr": bson.M{"$lte": bson.A{
		bson.M{"$strLenBytes": bson.M{"$ifNull": bson.A{"$password_hash", ""}}}, 1024,
	}}}
	if err := db.users.FindOne(ctx, filter, options.FindOne().SetProjection(bson.M{"_id": 0, "password_hash": 1}).SetMaxTime(3*time.Second)).Decode(&proof); err != nil || ctx.Err() != nil {
		return nil, errOwnerExportSection
	}
	// The context cannot interrupt bcrypt. Reject malformed or unusually costly
	// stored proofs before CPU work; legacy exceptions need separate staff review.
	cost, err := bcrypt.Cost([]byte(proof.Hash))
	if err != nil || cost > maximumOwnerExportPasswordCost || bcrypt.CompareHashAndPassword([]byte(proof.Hash), []byte(password)) != nil || ctx.Err() != nil {
		return nil, errOwnerExportSection
	}
	if section != "profile" && section != "progress" {
		var encoded []byte
		if section == "reports" {
			encoded, err = db.readOwnerReportPage(ctx, owner, query.Before, at, maxBytes)
		} else if section == "sessions" {
			encoded, err = db.readOwnerSessionPage(ctx, owner, query.Before, at, maxBytes)
		} else if section == "social" {
			encoded, err = db.readOwnerFriendPage(ctx, owner, query.Before, at, maxBytes)
		} else if section == "market" {
			encoded, err = db.readOwnerMarketPage(ctx, owner, query.Before, at, maxBytes)
		} else {
			switch section {
			case "guilds":
				encoded, err = db.readOwnerGuildPage(ctx, owner, query.Before, at, maxBytes)
			case "invites":
				encoded, err = db.readOwnerInvitePage(ctx, owner, query.Before, at, maxBytes)
			case "pvp":
				encoded, err = db.readOwnerCompetitivePage(ctx, owner, query.Before, at, maxBytes)
			case "raids":
				encoded, err = db.readOwnerRaidPage(ctx, owner, query.Before, at, maxBytes)
			case "trades":
				encoded, err = db.readOwnerTradePage(ctx, owner, query.Before, at, maxBytes)
			case "bank":
				encoded, err = db.readOwnerBankPage(ctx, owner, query.Before, at, maxBytes)
			case "rooms", "bosses":
				encoded, err = db.readOwnerEncounterPage(ctx, owner, section, query.Before, at, maxBytes)
			case "market-items":
				encoded, err = db.readOwnerMarketItemPage(ctx, owner, query.Before, at, maxBytes)
			case "ground":
				encoded, err = db.readOwnerGroundPage(ctx, owner, query.Before, at, maxBytes)
			case "auction-ops":
				encoded, err = db.readOwnerAuctionOperationPage(ctx, owner, query.Before, at, maxBytes)
			case "admin-ops":
				encoded, err = db.readOwnerAdminOperationPage(ctx, owner, query.Before, at, maxBytes)
			case "casino":
				encoded, err = db.readOwnerCasinoPage(ctx, owner, query.Before, at, maxBytes)
			}
		}
		// These pages are in other collections: recheck the exact credential after
		// the page read so a concurrent reset/removal cannot admit old proof.
		var current struct {
			Hash string `bson:"password_hash"`
		}
		if err != nil || db.users.FindOne(ctx, bson.M{"username": owner, "password_hash": proof.Hash}, options.FindOne().SetProjection(bson.M{"_id": 0, "password_hash": 1}).SetMaxTime(3*time.Second)).Decode(&current) != nil || current.Hash != proof.Hash || ctx.Err() != nil {
			return nil, errOwnerExportSection
		}
		return encoded, nil
	}
	pipeline := ownerExportSectionPipeline(owner, proof.Hash, section, characterName)
	cursor, err := db.users.Aggregate(ctx, pipeline, options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(1))
	if err != nil {
		return nil, errOwnerExportSection
	}
	defer cursor.Close(ctx)
	if !cursor.Next(ctx) {
		return nil, errOwnerExportSection
	}
	var encoded []byte
	if section == "profile" {
		var source ownerProfileSource
		if cursor.Decode(&source) != nil || ctx.Err() != nil {
			return nil, errOwnerExportSection
		}
		encoded, err = encodeOwnerProfileSnapshot(source, owner, at, maxBytes)
	} else {
		var source struct {
			Username  string     `bson:"username" json:"-"`
			Character *Character `bson:"character" json:"-"`
		}
		if cursor.Decode(&source) != nil || ctx.Err() != nil || source.Username != owner || source.Character == nil || source.Character.Name != characterName {
			return nil, errOwnerExportSection
		}
		encoded, err = encodeOwnerProgressSnapshot(source.Character, at, maxBytes)
	}
	if err != nil || ctx.Err() != nil {
		return nil, errOwnerExportSection
	}
	return encoded, nil
}

func ownerExportSectionPipeline(owner, hash, section, characterName string) mongo.Pipeline {
	// The credential is matched again atomically with the restricted data read.
	// A reset between proof and this query cannot authorize a read with old proof.
	pipeline := mongo.Pipeline{bson.D{{Key: "$match", Value: bson.M{"username": owner, "password_hash": hash}}}}
	projection := bson.M{"_id": 0, "username": 1}
	inputLimit := 16 << 10
	if section == "profile" {
		for _, field := range []string{"public_name", "email", "created_at", "recovery_email.address", "recovery_email.verified_at",
			"vip_periods.id", "vip_periods.starts_at", "vip_periods.ends_at", "vip_periods.revoked"} {
			projection[field] = 1
		}
		for _, notice := range []string{"mute", "suspension", "name_change"} {
			for _, field := range []string{"id", "kind", "started_at", "expires_at", "reason"} {
				projection["chat_moderation."+notice+"."+field] = 1
			}
		}
		projection["character_roster"] = bson.M{"$map": bson.M{"input": bson.M{"$ifNull": bson.A{"$characters", bson.A{}}}, "as": "entry", "in": bson.M{"name": "$$entry.name", "class": "$$entry.class", "level": "$$entry.level"}}}
	} else {
		inputLimit = 256 << 10
		pipeline = append(pipeline, bson.D{{Key: "$project", Value: bson.M{"_id": 0, "username": 1,
			"character": bson.M{"$arrayElemAt": bson.A{bson.M{"$filter": bson.M{
				"input": bson.M{"$ifNull": bson.A{"$characters", bson.A{}}}, "as": "candidate",
				"cond": bson.M{"$eq": bson.A{"$$candidate.name", characterName}},
			}}, 0}},
		}}})
		for _, field := range []string{
			"name", "class", "level", "xp", "resonance_level", "resonance_xp", "resonance_points", "resonance_ranks",
			"gold", "ep", "stats", "resources", "well_rested", "inventory", "stash", "buyback", "equipment",
			"equipment_loadouts", "saved_hotbar", "quests", "skill_points", "selected_branch", "unlocked_skills",
			"skill_runes", "unlocked_talents", "talent_ranks", "appearance_collection", "appearances",
		} {
			projection["character."+field] = 1
		}
	}
	// Mongo projects before the source-size predicate and before driver decoding.
	// Deny oversized sources rather than slicing a bag or reporting partial data.
	pipeline = append(pipeline,
		bson.D{{Key: "$project", Value: projection}},
		bson.D{{Key: "$match", Value: bson.M{"$expr": bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, inputLimit}}}}},
		bson.D{{Key: "$limit", Value: 1}},
	)
	return pipeline
}
