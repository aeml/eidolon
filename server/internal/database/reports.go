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
	AdminReportPageSize  = 10
)

type ReportQuery struct {
	Before     string `json:"before"`
	Status     string `json:"status"`
	ReportType string `json:"reportType,omitempty"`
}

type ReportPage struct {
	Reports []Report `json:"reports"`
	Next    string   `json:"next,omitempty"`
}

// An owner's status view deliberately excludes allegations, account identifiers,
// staff reasons and all review receipts, including the latest private review.
type ReportStatusView struct {
	ID         primitive.ObjectID `bson:"_id" json:"id"`
	ReportType string             `bson:"report_type" json:"reportType"`
	Status     string             `bson:"status" json:"status"`
	CreatedAt  time.Time          `bson:"created_at" json:"createdAt"`
	ResolvedAt *time.Time         `bson:"resolved_at,omitempty" json:"resolvedAt,omitempty"`
}

func (db *DB) OwnReportStatus(username, reference string) (ReportStatusView, error) {
	id, err := primitive.ObjectIDFromHex(reference)
	if err != nil || id.IsZero() || id.Hex() != reference || username == "" || db == nil || db.reports == nil {
		return ReportStatusView{}, errors.New("report status unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var view ReportStatusView
	err = db.reports.FindOne(ctx, bson.M{"_id": id, "username": username}, options.FindOne().SetProjection(
		bson.M{"report_type": 1, "status": 1, "created_at": 1, "resolved_at": 1})).Decode(&view)
	if err != nil {
		return ReportStatusView{}, err
	}
	if !SupportedReportType(view.ReportType) || view.Status != ReportStatusOpen && view.Status != ReportStatusResolved {
		return ReportStatusView{}, errors.New("report status unavailable")
	}
	return view, nil
}

func reportPageFilter(query ReportQuery) (bson.M, error) {
	filter := bson.M{}
	if query.Status != "" && query.Status != ReportStatusOpen && query.Status != ReportStatusResolved {
		return nil, errors.New("invalid report status")
	}
	if query.Status != "" {
		filter["status"] = query.Status
	}
	if query.ReportType != "" {
		if !SupportedReportType(query.ReportType) {
			return nil, errors.New("invalid report type")
		}
		filter["report_type"] = query.ReportType
	}
	if query.Before != "" {
		id, err := primitive.ObjectIDFromHex(query.Before)
		if err != nil {
			return nil, errors.New("invalid report cursor")
		}
		filter["_id"] = bson.M{"$lt": id}
	}
	return filter, nil
}

// Keyset pages use Mongo's indexed immutable report IDs; no offsets, full
// collection dumps or mutations. Reviews use a separate confirmed CAS operation.
func (db *DB) ReadReportPage(query ReportQuery) (ReportPage, error) {
	page := ReportPage{Reports: []Report{}}
	filter, err := reportPageFilter(query)
	if err != nil {
		return page, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.reports.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(AdminReportPageSize+1))
	if err != nil {
		return page, err
	}
	defer cursor.Close(ctx)
	if err := cursor.All(ctx, &page.Reports); err != nil {
		return ReportPage{}, err
	}
	if len(page.Reports) > AdminReportPageSize {
		page.Reports = page.Reports[:AdminReportPageSize]
		page.Next = page.Reports[len(page.Reports)-1].ID.Hex()
	}
	return page, nil
}

type Report struct {
	ID             primitive.ObjectID             `bson:"_id,omitempty" json:"id"`
	Username       string                         `bson:"username" json:"username"`
	ReportType     string                         `bson:"report_type" json:"reportType"`
	Text           string                         `bson:"text" json:"text"`
	Status         string                         `bson:"status" json:"status"`
	CreatedAt      time.Time                      `bson:"created_at" json:"createdAt"`
	ResolvedAt     *time.Time                     `bson:"resolved_at,omitempty" json:"resolvedAt,omitempty"`
	ReviewRevision int64                          `bson:"review_revision,omitempty" json:"reviewRevision"`
	LastReview     *ReportReviewReceipt           `bson:"last_review,omitempty" json:"lastReview,omitempty"`
	ReviewReceipts map[string]ReportReviewReceipt `bson:"review_receipts,omitempty" json:"-"`
}

func NewReport(username, reportType, text string, now time.Time) (Report, error) {
	username = strings.TrimSpace(username)
	reportType = strings.TrimSpace(reportType)
	text = strings.TrimSpace(text)
	if username == "" {
		return Report{}, errors.New("report username is required")
	}
	if !SupportedReportType(reportType) {
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

// SupportedReportType is shared by submission and strict staff queue filters.
func SupportedReportType(value string) bool {
	return value == "Bug Report" || value == "Feature Request" || value == "Player Report" || value == "Moderation Appeal"
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
