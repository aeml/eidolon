package database

import (
	"context"
	"encoding/json"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ownerGroundSource struct {
	ID           string     `bson:"_id" json:"-"`
	Version      int        `bson:"version" json:"-"`
	Username     string     `bson:"username" json:"-"`
	PlayerID     string     `bson:"player_id" json:"-"`
	Kind         string     `bson:"kind" json:"-"`
	State        string     `bson:"state" json:"-"`
	CreatedAt    time.Time  `bson:"created_at" json:"-"`
	AvailableAt  *time.Time `bson:"available_at" json:"-"`
	ExpiresAt    *time.Time `bson:"expires_at" json:"-"`
	MovedPayload string     `bson:"moved_payload" json:"-"`
}

type ownerGroundEntry struct {
	Reference      string            `json:"reference"`
	Kind           string            `json:"kind"`
	OperationState string            `json:"operation_state"`
	CreatedAt      time.Time         `json:"created_at"`
	AvailableAt    *time.Time        `json:"recorded_available_at,omitempty"`
	ExpiresAt      *time.Time        `json:"recorded_expires_at,omitempty"`
	Item           ownerItemSnapshot `json:"moved_item"`
}

func validOwnerGroundSource(row ownerGroundSource, owner string) bool {
	if row.Version != 1 || row.Username != owner || row.PlayerID != "player-"+owner || row.CreatedAt.IsZero() || (row.Kind != GroundItemDrop && row.Kind != GroundItemPickup) || (row.State != GroundItemPending && row.State != GroundItemComplete) {
		return false
	}
	if row.Kind == GroundItemDrop && row.State == GroundItemPending {
		return (row.AvailableAt == nil || row.AvailableAt.IsZero()) && (row.ExpiresAt == nil || row.ExpiresAt.IsZero())
	}
	if row.AvailableAt == nil || row.ExpiresAt == nil || row.AvailableAt.IsZero() || !row.ExpiresAt.Equal(row.AvailableAt.Add(time.Minute)) {
		return false
	}
	if row.Kind == GroundItemDrop {
		return !row.AvailableAt.Before(row.CreatedAt)
	}
	return !row.CreatedAt.Before(*row.AvailableAt) && row.CreatedAt.Before(*row.ExpiresAt)
}

func ownerGroundPagePipeline(owner, before string) mongo.Pipeline {
	projection := bson.M{"_id": 1, "version": 1, "username": 1, "player_id": 1, "kind": 1, "state": 1, "created_at": 1, "available_at": 1, "expires_at": 1, "moved_payload": 1}
	return ownerOperationPagePipeline(bson.M{"username": owner}, projection, groundItemPrefix, before, 72<<10)
}

func (db *DB) readOwnerGroundPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerGroundSource) bool {
		if !validOwnerGroundSource(row, owner) {
			return false
		}
		_, err := snapshotOwnerRewardItems([]string{row.MovedPayload}, 1)
		return err == nil
	}
	sources, next, err := readOwnerOperationPage(ctx, db.groundItemOperations, ownerGroundPagePipeline(owner, before), groundItemPrefix, before, func(row ownerGroundSource) string { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerGroundEntry, 0, len(sources))
	for _, row := range sources {
		items, err := snapshotOwnerRewardItems([]string{row.MovedPayload}, 1)
		if err != nil {
			return nil, errOwnerExportSection
		}
		available, expires := row.AvailableAt, row.ExpiresAt
		if available != nil && available.IsZero() {
			available = nil
		}
		if expires != nil && expires.IsZero() {
			expires = nil
		}
		entries = append(entries, ownerGroundEntry{strings.TrimPrefix(row.ID, groundItemPrefix), row.Kind, row.State, row.CreatedAt.UTC(), available, expires, items[0]})
	}
	return encodeOwnerDataPage(OwnerExportFormat("ground"), "ground", at, entries, next, maxBytes)
}

type ownerAuctionOperationSource struct {
	ID            primitive.ObjectID `bson:"_id" json:"-"`
	AuctionID     string             `bson:"auction_id" json:"-"`
	PlayerID      string             `bson:"player_id" json:"-"`
	CharacterName string             `bson:"character_name" json:"-"`
	Kind          string             `bson:"kind" json:"-"`
	Amount        int                `bson:"amount" json:"-"`
	PreviousBid   int                `bson:"previous_bid" json:"-"`
	Fee           int                `bson:"fee" json:"-"`
	EndTime       time.Time          `bson:"end_time" json:"-"`
	ItemPayload   string             `bson:"item_payload" json:"-"`
	ClaimStatus   string             `bson:"claim_status" json:"-"`
	ListingBid    int                `bson:"listing_bid" json:"-"`
	ListingBuyout int                `bson:"listing_buyout" json:"-"`
	ListingHours  int                `bson:"listing_hours" json:"-"`
	ListingStart  time.Time          `bson:"listing_start" json:"-"`
}

type ownerAuctionListingSnapshot struct {
	Bid    int       `json:"bid"`
	Buyout int       `json:"buyout"`
	Hours  int       `json:"hours"`
	Start  time.Time `json:"start"`
}

type ownerAuctionOperationEntry struct {
	ID                 primitive.ObjectID           `json:"id"`
	AuctionID          string                       `json:"auction_id"`
	CharacterName      string                       `json:"character_name"`
	Kind               string                       `json:"kind"`
	PlannedGoldAmount  int                          `json:"planned_gold_amount"`
	Fee                int                          `json:"fee"`
	PreviousListingBid int                          `json:"previous_listing_bid"`
	RecordedEndTime    time.Time                    `json:"recorded_end_time"`
	ClaimStatus        string                       `json:"claim_status,omitempty"`
	Item               *ownerItemSnapshot           `json:"planned_item,omitempty"`
	Listing            *ownerAuctionListingSnapshot `json:"listing,omitempty"`
}

func ownerAuctionOperationItem(row ownerAuctionOperationSource) (*ownerItemSnapshot, error) {
	if row.Amount < 0 || row.PreviousBid < 0 || row.Fee < 0 {
		return nil, errOwnerExportSection
	}
	needsItem := false
	switch row.Kind {
	case "":
		if row.Amount <= 0 || row.Fee != 0 || row.ClaimStatus != "" {
			return nil, errOwnerExportSection
		}
	case AuctionOperationSellerPayout:
		if row.Amount <= 0 || row.PreviousBid != 0 || row.ClaimStatus != "" {
			return nil, errOwnerExportSection
		}
	case AuctionOperationItemClaim:
		needsItem = true
		if row.Amount != 0 || row.Fee != 0 || row.PreviousBid != 0 || (row.ClaimStatus != "SOLD" && row.ClaimStatus != "EXPIRED" && row.ClaimStatus != "CANCELLED") {
			return nil, errOwnerExportSection
		}
	case AuctionOperationBuyout:
		needsItem = true
		if row.Amount <= 0 || row.Fee != 0 || row.ClaimStatus != "" {
			return nil, errOwnerExportSection
		}
	case AuctionOperationListing:
		needsItem = true
		if row.Fee != 0 || row.ClaimStatus != "" || row.PreviousBid != 0 || row.ListingBid <= 0 || row.ListingBuyout < row.ListingBid || row.ListingBuyout > 1_000_000_000 || row.ListingHours < 1 || row.ListingHours > 168 || row.ListingStart.IsZero() || !row.EndTime.Equal(row.ListingStart.Add(time.Duration(row.ListingHours)*time.Hour)) || row.Amount != AuctionListingDeposit(row.ListingBuyout) {
			return nil, errOwnerExportSection
		}
	default:
		return nil, errOwnerExportSection
	}
	if row.Kind != AuctionOperationListing && (row.ListingBid != 0 || row.ListingBuyout != 0 || row.ListingHours != 0 || !row.ListingStart.IsZero()) {
		return nil, errOwnerExportSection
	}
	if !needsItem {
		if row.ItemPayload != "" {
			return nil, errOwnerExportSection
		}
		return nil, nil
	}
	var item Item
	if !utf8.ValidString(row.ItemPayload) || !ValidAuctionItemPayload(row.ItemPayload) || json.Unmarshal([]byte(row.ItemPayload), &item) != nil || !boundedActivityText(item.ID, 256, true) {
		return nil, errOwnerExportSection
	}
	out := snapshotOwnerItem(item)
	return &out, nil
}

func ownerAuctionOperationPagePipeline(owner, before string) mongo.Pipeline {
	projection := bson.M{}
	for _, field := range []string{"_id", "auction_id", "player_id", "character_name", "kind", "amount", "previous_bid", "fee", "end_time", "item_payload", "claim_status", "listing_bid", "listing_buyout", "listing_hours", "listing_start"} {
		projection[field] = 1
	}
	return ownerDataPagePipeline(bson.M{"player_id": "player-" + owner}, projection, before, 72<<10)
}

func (db *DB) readOwnerAuctionOperationPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerAuctionOperationSource) bool {
		if row.PlayerID != "player-"+owner || row.CharacterName != owner || !boundedActivityText(row.AuctionID, 256, true) || row.EndTime.IsZero() {
			return false
		}
		_, err := ownerAuctionOperationItem(row)
		return err == nil
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.auctionBids, ownerAuctionOperationPagePipeline(owner, before), before, func(row ownerAuctionOperationSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerAuctionOperationEntry, 0, len(sources))
	for _, row := range sources {
		item, err := ownerAuctionOperationItem(row)
		if err != nil {
			return nil, errOwnerExportSection
		}
		kind := row.Kind
		if kind == "" {
			kind = "bid"
		}
		entry := ownerAuctionOperationEntry{ID: row.ID, AuctionID: row.AuctionID, CharacterName: row.CharacterName, Kind: kind, PlannedGoldAmount: row.Amount, Fee: row.Fee, PreviousListingBid: row.PreviousBid, RecordedEndTime: row.EndTime.UTC(), ClaimStatus: row.ClaimStatus, Item: item}
		if row.Kind == AuctionOperationListing {
			entry.Listing = &ownerAuctionListingSnapshot{row.ListingBid, row.ListingBuyout, row.ListingHours, row.ListingStart.UTC()}
		}
		entries = append(entries, entry)
	}
	return encodeOwnerDataPage(OwnerExportFormat("auction-ops"), "auction-ops", at, entries, next, maxBytes)
}

type ownerAdminOperationSource struct {
	ID      string `bson:"_id" json:"-"`
	Version int    `bson:"version" json:"-"`
	Target  string `bson:"target" json:"-"`
	Action  string `bson:"action" json:"-"`
	State   string `bson:"state" json:"-"`
	Audit   struct {
		At     time.Time `bson:"at"`
		Result string    `bson:"result"`
	} `bson:"audit" json:"-"`
	GrantPayload []byte `bson:"grant_payload" json:"-"`
}

type ownerAdminGrantSnapshot struct {
	Gold  int                 `json:"gold,omitempty"`
	Items []ownerItemSnapshot `json:"items,omitempty"`
}

type ownerAdminOperationEntry struct {
	Reference           string                   `json:"reference"`
	Action              string                   `json:"action"`
	OperationState      string                   `json:"operation_state"`
	RecordedAuditAt     time.Time                `json:"recorded_audit_at"`
	RecordedAuditResult string                   `json:"recorded_audit_result"`
	RetainedGrantPlan   *ownerAdminGrantSnapshot `json:"retained_grant_plan,omitempty"`
}

func snapshotOwnerAdminGrant(row ownerAdminOperationSource) (*ownerAdminGrantSnapshot, error) {
	if len(row.GrantPayload) == 0 {
		if row.State == AdminOperationPending && row.Action != "admin_teleport" {
			return nil, errOwnerExportSection
		}
		return nil, nil
	}
	if row.State == AdminOperationComplete || row.Action == "admin_teleport" || len(row.GrantPayload) > 64<<10 || !utf8.Valid(row.GrantPayload) {
		return nil, errOwnerExportSection
	}
	var plan struct {
		Action string `json:"action"`
		Amount int    `json:"amount"`
		Items  []Item `json:"items"`
	}
	if json.Unmarshal(row.GrantPayload, &plan) != nil || plan.Action != row.Action {
		return nil, errOwnerExportSection
	}
	if row.Action == "admin_grant_gold" {
		if plan.Amount < 1 || plan.Amount > AdminGoldGrantLimit || len(plan.Items) != 0 {
			return nil, errOwnerExportSection
		}
		return &ownerAdminGrantSnapshot{Gold: plan.Amount}, nil
	}
	if row.Action != "admin_grant_item" || plan.Amount != 0 || len(plan.Items) < 1 || len(plan.Items) > 25 {
		return nil, errOwnerExportSection
	}
	seen := map[string]bool{}
	for _, item := range plan.Items {
		if !boundedActivityText(item.ID, 256, true) || seen[item.ID] || item.Stack < 1 || item.MaxStack < item.Stack {
			return nil, errOwnerExportSection
		}
		seen[item.ID] = true
	}
	return &ownerAdminGrantSnapshot{Items: snapshotOwnerItems(plan.Items)}, nil
}

func ownerAdminOperationPagePipeline(owner, before string) mongo.Pipeline {
	projection := bson.M{"_id": 1, "version": 1, "target": 1, "action": 1, "state": 1, "audit.at": 1, "audit.result": 1,
		"grant_payload": bson.M{"$cond": bson.A{bson.M{"$and": bson.A{bson.M{"$ne": bson.A{"$state", AdminOperationComplete}}, bson.M{"$in": bson.A{"$action", bson.A{"admin_grant_gold", "admin_grant_item"}}}}}, "$payload", nil}},
	}
	return ownerOperationPagePipeline(bson.M{"target": owner}, projection, "admin:", before, 68<<10)
}

func (db *DB) readOwnerAdminOperationPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerAdminOperationSource) bool {
		if row.Version != 1 || row.Target != owner || row.Audit.At.IsZero() || (row.Action != "admin_grant_gold" && row.Action != "admin_grant_item" && row.Action != "admin_teleport") || (row.State != AdminOperationPending && row.State != AdminOperationAuditing && row.State != AdminOperationComplete) || (row.Audit.Result != "success" && row.Audit.Result != "denied" && row.Audit.Result != "error") {
			return false
		}
		_, err := snapshotOwnerAdminGrant(row)
		return err == nil
	}
	sources, next, err := readOwnerOperationPage(ctx, db.adminOperations, ownerAdminOperationPagePipeline(owner, before), "admin:", before, func(row ownerAdminOperationSource) string { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerAdminOperationEntry, 0, len(sources))
	for _, row := range sources {
		plan, err := snapshotOwnerAdminGrant(row)
		if err != nil {
			return nil, errOwnerExportSection
		}
		entries = append(entries, ownerAdminOperationEntry{strings.TrimPrefix(row.ID, "admin:"), row.Action, row.State, row.Audit.At.UTC(), row.Audit.Result, plan})
	}
	return encodeOwnerDataPage(OwnerExportFormat("admin-ops"), "admin-ops", at, entries, next, maxBytes)
}
