package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var ErrRemovalReviewUnavailable = errors.New("removal review unavailable or case changed")

type RemovalReviewQuery struct {
	ReportID         string `json:"reportId"`
	ExpectedRevision int64  `json:"expectedRevision"`
	ExpectedStatus   string `json:"expectedStatus"`
}

func (q RemovalReviewQuery) Validate() error {
	id, err := primitive.ObjectIDFromHex(q.ReportID)
	if err != nil || id.IsZero() || id.Hex() != q.ReportID || q.ExpectedRevision < 0 || q.ExpectedRevision > MaximumReportReviews ||
		(q.ExpectedStatus != ReportStatusOpen && q.ExpectedStatus != ReportStatusResolved) {
		return ErrRemovalReviewUnavailable
	}
	return nil
}

// Presence is not an unresolved-obligation count, custody reconciliation,
// account-ownership proof, deletion approval or cross-store snapshot.
type RemovalReferenceCheck struct {
	Source           string `json:"source"`
	ReferencePresent bool   `json:"referencePresent"`
}

type RemovalReviewSnapshot struct {
	Owner                string                  `json:"-"`
	ReportID             string                  `json:"reportId"`
	ReviewRevision       int64                   `json:"reviewRevision"`
	CaseStatus           string                  `json:"caseStatus"`
	CheckedAt            time.Time               `json:"checkedAt"`
	RemovalSupported     bool                    `json:"removalSupported"`
	RemovalAuthorized    bool                    `json:"removalAuthorized"`
	AccountPresent       bool                    `json:"accountPresent"`
	OnlineObserved       *bool                   `json:"onlineObserved,omitempty"`
	PendingCharacterSave *bool                   `json:"pendingCharacterSave,omitempty"`
	References           []RemovalReferenceCheck `json:"references"`
	RequiredReview       []string                `json:"requiredReview"`
}

type removalReferenceSource struct {
	Name       string
	Collection *mongo.Collection
	Filter     bson.M
}

func (db *DB) removalReferenceSources(owner string) []removalReferenceSource {
	playerID := "player-" + owner
	casinoIDs := bson.A{}
	for _, id := range OwnerCasinoRecordIDs(owner) {
		casinoIDs = append(casinoIDs, id)
	}
	return []removalReferenceSource{
		{"auctions", db.auctions, ownerMarketFilter(owner)},
		{"auction intents", db.auctionBids, bson.M{"player_id": playerID}},
		{"direct trades", db.directTradeOperations, bson.M{"participants.username": owner}},
		{"guild membership / shared bank", db.guilds, bson.M{"members.player_id": playerID}},
		{"guild invitations", db.guildInvites, bson.M{"$or": bson.A{bson.M{"inviter_id": playerID}, bson.M{"target_id": playerID}}}},
		{"guild bank intents", db.guildBankOperations, bson.M{"username": owner}},
		{"ground item intents", db.groundItemOperations, bson.M{"username": owner}},
		{"room rewards", db.dungeonRoomRewards, bson.M{"participants.username": owner}},
		{"boss rewards", db.bossVictories, bson.M{"participants.username": owner}},
		{"weekly raid delivery", db.raidLockouts, bson.M{"player_id": playerID}},
		{"administration intents", db.adminOperations, bson.M{"target": owner}},
		{"social references", db.friendships, bson.M{"$or": bson.A{bson.M{"requester_id": playerID}, bson.M{"addressee_id": playerID}}}},
		{"competitive profile", db.pvpProfiles, bson.M{"player_id": playerID}},
		// Shared keys indicate catalog state to review, not owner participation.
		{"casino catalog / own slot records (participation unverified)", db.blackjackTables, bson.M{"_id": bson.M{"$in": casinoIDs}}},
	}
}

func removalReferencePresent(ctx context.Context, collection *mongo.Collection, filter bson.M) (bool, error) {
	if collection == nil {
		return false, ErrRemovalReviewUnavailable
	}
	// No raw IDs, private payloads, account/character snapshots or counterpart
	// fields leave Mongo. Bound output to one constant boolean, not a raw count.
	pipeline := mongo.Pipeline{bson.D{{Key: "$match", Value: filter}}, bson.D{{Key: "$limit", Value: 1}},
		bson.D{{Key: "$project", Value: bson.M{"_id": 0, "present": bson.M{"$literal": true}}}}}
	cursor, err := collection.Aggregate(ctx, pipeline, options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(1).SetCollation(&options.Collation{Locale: "simple"}))
	if err != nil {
		return false, ErrRemovalReviewUnavailable
	}
	defer cursor.Close(ctx)
	present := false
	for cursor.Next(ctx) {
		var row struct {
			Present bool `bson:"present"`
		}
		if present || cursor.Decode(&row) != nil || !row.Present {
			return false, ErrRemovalReviewUnavailable
		}
		present = true
	}
	if cursor.Err() != nil || ctx.Err() != nil {
		return false, ErrRemovalReviewUnavailable
	}
	return present, nil
}

func (db *DB) removalCaseOwner(ctx context.Context, filter bson.M) (string, error) {
	within := bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, 1024}}
	pipeline := mongo.Pipeline{bson.D{{Key: "$match", Value: filter}}, bson.D{{Key: "$limit", Value: 1}},
		bson.D{{Key: "$project", Value: bson.M{"_id": 0, "username": 1}}},
		bson.D{{Key: "$project", Value: bson.M{"_id": 0, "owner": bson.M{"$cond": bson.A{within, "$username", nil}}}}}}
	cursor, err := db.reports.Aggregate(ctx, pipeline, options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(1).SetCollation(&options.Collation{Locale: "simple"}))
	if err != nil {
		return "", ErrRemovalReviewUnavailable
	}
	defer cursor.Close(ctx)
	owner := ""
	for cursor.Next(ctx) {
		var row struct {
			Owner string `bson:"owner"`
		}
		if owner != "" || cursor.Decode(&row) != nil || !boundedActivityText(row.Owner, 128, true) {
			return "", ErrRemovalReviewUnavailable
		}
		owner = row.Owner
	}
	if owner == "" || cursor.Err() != nil || ctx.Err() != nil {
		return "", ErrRemovalReviewUnavailable
	}
	return owner, nil
}

// Caller verifies current durable staff role and audits access. This method
// NEVER deletes, settles, recovers, drains writers or authorizes future removal.
// In particular all-false presence checks still require every manual safeguard.
func (db *DB) ReadRemovalReview(query RemovalReviewQuery) (RemovalReviewSnapshot, error) {
	if query.Validate() != nil || db == nil || db.reports == nil || db.users == nil {
		return RemovalReviewSnapshot{}, ErrRemovalReviewUnavailable
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	id, _ := primitive.ObjectIDFromHex(query.ReportID)
	filter := bson.M{"_id": id, "report_type": "Account Removal Request", "status": query.ExpectedStatus,
		"$and": bson.A{approvalRevisionFence("review_revision", query.ExpectedRevision)}}
	owner, err := db.removalCaseOwner(ctx, filter)
	if err != nil {
		return RemovalReviewSnapshot{}, ErrRemovalReviewUnavailable
	}
	result := RemovalReviewSnapshot{Owner: owner, ReportID: query.ReportID, ReviewRevision: query.ExpectedRevision, CaseStatus: query.ExpectedStatus,
		References: []RemovalReferenceCheck{}, RequiredReview: []string{
			"Verify current account ownership, exact scope and separate explicit authorization; case resolution is not erasure.",
			"Stop and drain all account writers/sessions; coordinate pending character, activity, guild and PvP journals without blind replay or purge.",
			"Reconcile shared custody and pending wagers/rewards/transfers; preserve other players' data and durable replay identities.",
			"Review retained cases/audit, live RAM, logs, archives, browser and Postmark/analytics copies under unchanged retention.",
			"Before enabling any removal, implement and verify durable removal/restore fences against old writers, journals and pre-removal backups.",
			"Verify separately authorized execution and retained-copy limits before claiming fulfillment; no removal command is enabled.",
		}}
	if result.AccountPresent, err = removalReferencePresent(ctx, db.users, bson.M{"username": owner}); err != nil {
		return RemovalReviewSnapshot{}, err
	}
	for _, source := range db.removalReferenceSources(owner) {
		present, err := removalReferencePresent(ctx, source.Collection, source.Filter)
		if err != nil {
			return RemovalReviewSnapshot{}, err
		}
		result.References = append(result.References, RemovalReferenceCheck{source.Name, present})
	}
	filter["username"] = owner
	if finalOwner, err := db.removalCaseOwner(ctx, filter); err != nil || finalOwner != owner {
		return RemovalReviewSnapshot{}, ErrRemovalReviewUnavailable
	}
	result.CheckedAt = time.Now().UTC()
	return result, nil
}
