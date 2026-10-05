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

// Internal building block, deliberately not exposed through any transport.
// This proves a current password and bounds one owner-scoped source/response.
// It is NOT admin approval, a complete account export, delivery or restoration.
// The eventual request workflow must additionally admit an explicitly approved
// case, bind owner to its current authenticated session and bound concurrency.
func (db *DB) readOwnerExportSection(parent context.Context, owner, password, section, characterName string, at time.Time, maxBytes int) ([]byte, error) {
	if parent == nil || db == nil || db.users == nil || owner == "" || len(owner) > 128 || len(password) < 1 || len(password) > 72 ||
		at.IsZero() || maxBytes < 1 || maxBytes > maximumOwnerExportResponse ||
		(section != "profile" && section != "progress") || (section == "profile" && characterName != "") ||
		(section == "progress" && (characterName == "" || len(characterName) > 128)) {
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
		for _, field := range []string{"public_name", "email", "created_at", "recovery_email.address", "recovery_email.verified_at"} {
			projection[field] = 1
		}
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
