package database

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// The transport must bind owner to its current authenticated session, enforce
// admission and recheck connection ownership before delivery. Admin privilege
// alone cannot substitute for this owner's current password. No export artifact
// is persisted. Permission is checked before reading AND before returning data.
func (db *DB) ReadApprovedOwnerExportSection(parent context.Context, owner, password, reportID string, approvalRevision int64, section, character string, at time.Time, maxBytes int) ([]byte, error) {
	id, err := primitive.ObjectIDFromHex(reportID)
	if parent == nil || db == nil || db.reports == nil || owner == "" || len(owner) > 128 || err != nil || id.IsZero() || id.Hex() != reportID ||
		approvalRevision < 1 || approvalRevision >= MaximumPrivacyExportChanges || approvalRevision%2 != 1 {
		return nil, errOwnerExportSection
	}
	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()
	filter := bson.M{"_id": id, "username": owner, "report_type": "Account Data Export",
		"export_approval.enabled": true, "export_approval.revision": approvalRevision}
	allowed := func() bool {
		var marker struct {
			Approval struct {
				Enabled  bool      `bson:"enabled"`
				Revision int64     `bson:"revision"`
				At       time.Time `bson:"at"`
			} `bson:"export_approval"`
		}
		err := db.reports.FindOne(ctx, filter, options.FindOne().SetMaxTime(3*time.Second).SetProjection(bson.M{
			"_id": 0, "export_approval.enabled": 1, "export_approval.revision": 1, "export_approval.at": 1,
		})).Decode(&marker)
		return err == nil && ctx.Err() == nil && marker.Approval.Enabled && marker.Approval.Revision == approvalRevision && !marker.Approval.At.IsZero()
	}
	if !allowed() {
		return nil, errOwnerExportSection
	}
	encoded, err := db.readOwnerExportSection(ctx, owner, password, section, character, at, maxBytes)
	if err != nil || !allowed() {
		return nil, errOwnerExportSection
	}
	return encoded, nil
}
