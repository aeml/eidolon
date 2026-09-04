package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	ReportStatusOpen     = "open"
	ReportStatusResolved = "resolved"
	maximumReportLength  = 4000
)

type Report struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username   string             `bson:"username" json:"username"`
	ReportType string             `bson:"report_type" json:"reportType"`
	Text       string             `bson:"text" json:"text"`
	Status     string             `bson:"status" json:"status"`
	CreatedAt  time.Time          `bson:"created_at" json:"createdAt"`
	ResolvedAt *time.Time         `bson:"resolved_at,omitempty" json:"resolvedAt,omitempty"`
}

func NewReport(username, reportType, text string, now time.Time) (Report, error) {
	username = strings.TrimSpace(username)
	reportType = strings.TrimSpace(reportType)
	text = strings.TrimSpace(text)
	if username == "" {
		return Report{}, errors.New("report username is required")
	}
	if reportType != "Bug Report" && reportType != "Feature Request" {
		return Report{}, errors.New("unsupported report type")
	}
	if text == "" {
		return Report{}, errors.New("report text is required")
	}
	if len([]rune(text)) > maximumReportLength {
		return Report{}, errors.New("report text is too long")
	}
	return Report{
		Username:   username,
		ReportType: reportType,
		Text:       text,
		Status:     ReportStatusOpen,
		CreatedAt:  now.UTC(),
	}, nil
}

func (db *DB) CreateReport(username, reportType, text string) (*Report, error) {
	report, err := NewReport(username, reportType, text, time.Now())
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.reports.InsertOne(ctx, report)
	if err != nil {
		return nil, err
	}
	if id, ok := result.InsertedID.(primitive.ObjectID); ok {
		report.ID = id
	}
	return &report, nil
}

func (db *DB) ListReports(status string, limit int64) ([]Report, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cursor, err := db.reports.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var reports []Report
	if err := cursor.All(ctx, &reports); err != nil {
		return nil, err
	}
	return reports, nil
}

func (db *DB) ResolveReport(id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid report id")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	now := time.Now().UTC()
	result, err := db.reports.UpdateOne(
		ctx,
		bson.M{"_id": objectID, "status": ReportStatusOpen},
		bson.M{"$set": bson.M{"status": ReportStatusResolved, "resolved_at": now}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("open report not found")
	}
	return nil
}
