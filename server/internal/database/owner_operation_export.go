package database

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var ownerOperationCursorPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

// Navigation references are existing hashed-ID suffixes, not authorization or
// encrypted secrets. Each page still requires current owner proof/approval.
func ownerOperationPrefix(section string) string {
	switch section {
	case "trades":
		return "directtrade:"
	case "bank":
		return "guildbank:"
	case "rooms":
		return dungeonRoomRewardPrefix
	case "bosses":
		return bossVictoryPrefix
	}
	return ""
}

func ownerOperationPagePipeline(filter, projection bson.M, prefix, before string, inputBytes int) mongo.Pipeline {
	if before != "" {
		filter["_id"] = bson.M{"$lt": prefix + before}
	}
	within := bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, inputBytes}}
	return mongo.Pipeline{
		bson.D{{Key: "$match", Value: filter}}, bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: -1}}}}, bson.D{{Key: "$limit", Value: ownerDataPageSize + 1}},
		bson.D{{Key: "$project", Value: projection}}, bson.D{{Key: "$project", Value: bson.M{"_id": 0, "within_bound": within, "entry": bson.M{"$cond": bson.A{within, "$$ROOT", nil}}}}},
	}
}

func readOwnerOperationPage[T any](ctx context.Context, collection *mongo.Collection, pipeline mongo.Pipeline, prefix, before string, identity func(T) string, valid func(T) bool) ([]T, string, error) {
	if collection == nil {
		return nil, "", errOwnerExportSection
	}
	cursor, err := collection.Aggregate(ctx, pipeline, options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(ownerDataPageSize+1).SetCollation(&options.Collation{Locale: "simple"}))
	if err != nil {
		return nil, "", errOwnerExportSection
	}
	defer cursor.Close(ctx)
	entries := make([]T, 0, ownerDataPageSize+1)
	previous := before
	for cursor.Next(ctx) {
		var source struct {
			Within bool `bson:"within_bound"`
			Entry  *T   `bson:"entry"`
		}
		if len(entries) >= ownerDataPageSize+1 || cursor.Decode(&source) != nil || !source.Within || source.Entry == nil {
			return nil, "", errOwnerExportSection
		}
		entry := *source.Entry
		id := identity(entry)
		key := strings.TrimPrefix(id, prefix)
		if !strings.HasPrefix(id, prefix) || !ownerOperationCursorPattern.MatchString(key) || previous != "" && key >= previous || !valid(entry) {
			return nil, "", errOwnerExportSection
		}
		previous = key
		entries = append(entries, entry)
	}
	if cursor.Err() != nil || ctx.Err() != nil {
		return nil, "", errOwnerExportSection
	}
	next := ""
	if len(entries) > ownerDataPageSize {
		entries = entries[:ownerDataPageSize]
		next = strings.TrimPrefix(identity(entries[len(entries)-1]), prefix)
	}
	return entries, next, nil
}

type ownerTradePartySource struct {
	PlayerID      string `bson:"player_id" json:"-"`
	CharacterName string `bson:"character_name" json:"-"`
	OfferPayload  string `bson:"offer_payload" json:"-"`
}

type ownerTradeSource struct {
	ID               string                  `bson:"_id" json:"-"`
	Version          int                     `bson:"version" json:"-"`
	Decision         string                  `bson:"decision" json:"-"`
	State            string                  `bson:"state" json:"-"`
	CreatedAt        time.Time               `bson:"created_at" json:"-"`
	ParticipantCount int                     `bson:"participant_count" json:"-"`
	Own              []ownerTradePartySource `bson:"own" json:"-"`
	Incoming         []struct {
		OfferPayload string `bson:"offer_payload"`
	} `bson:"incoming" json:"-"`
}

type ownerTradeOffer struct {
	Gold  int                 `json:"gold"`
	Items []ownerItemSnapshot `json:"items"`
}

type ownerTradeEntry struct {
	Reference      string           `json:"reference"`
	CharacterName  string           `json:"character_name"`
	Decision       string           `json:"decision"`
	OperationState string           `json:"operation_state"`
	CreatedAt      time.Time        `json:"created_at"`
	OwnOffer       ownerTradeOffer  `json:"own_offer"`
	AgreedIncoming *ownerTradeOffer `json:"agreed_incoming_offer,omitempty"`
}

func snapshotOwnerTradeOffer(payload string) (ownerTradeOffer, error) {
	if _, err := parseDirectTradeOffer(payload); err != nil {
		return ownerTradeOffer{}, errOwnerExportSection
	}
	var source struct {
		Gold  int    `json:"gold"`
		Items []Item `json:"items"`
	}
	if json.Unmarshal([]byte(payload), &source) != nil {
		return ownerTradeOffer{}, errOwnerExportSection
	}
	return ownerTradeOffer{Gold: source.Gold, Items: snapshotOwnerItems(source.Items)}, nil
}

func ownerTradePagePipeline(owner, before string) mongo.Pipeline {
	parties := bson.M{"$ifNull": bson.A{"$participants", bson.A{}}}
	selected := func(own bool, fields bson.M) bson.M {
		operator := "$eq"
		if !own {
			operator = "$ne"
		}
		return bson.M{"$map": bson.M{"input": bson.M{"$filter": bson.M{"input": parties, "as": "party", "cond": bson.M{operator: bson.A{"$$party.username", owner}}}}, "as": "party", "in": fields}}
	}
	projection := bson.M{"_id": 1, "version": 1, "decision": 1, "state": 1, "created_at": 1,
		"participant_count": bson.M{"$size": parties},
		"own":               selected(true, bson.M{"player_id": "$$party.player_id", "character_name": "$$party.character_name", "offer_payload": "$$party.offer_payload"}),
		// Cancellation returns only the owner's offer; no peer inventory plan.
		"incoming": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$decision", DirectTradeSettle}}, selected(false, bson.M{"offer_payload": "$$party.offer_payload"}), bson.A{}}},
	}
	return ownerOperationPagePipeline(bson.M{"participants.username": owner}, projection, "directtrade:", before, 272<<10)
}

func (db *DB) readOwnerTradePage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerTradeSource) bool {
		if row.Version != 1 || row.CreatedAt.IsZero() || row.ParticipantCount != 2 || len(row.Own) != 1 || row.Own[0].PlayerID != "player-"+owner || !boundedActivityText(row.Own[0].CharacterName, 256, true) ||
			(row.State != DirectTradePending && row.State != DirectTradeComplete) || (row.Decision != DirectTradeSettle && row.Decision != DirectTradeCancel) {
			return false
		}
		if _, err := snapshotOwnerTradeOffer(row.Own[0].OfferPayload); err != nil {
			return false
		}
		if row.Decision == DirectTradeCancel {
			return len(row.Incoming) == 0
		}
		if len(row.Incoming) != 1 {
			return false
		}
		_, err := snapshotOwnerTradeOffer(row.Incoming[0].OfferPayload)
		return err == nil
	}
	sources, next, err := readOwnerOperationPage(ctx, db.directTradeOperations, ownerTradePagePipeline(owner, before), "directtrade:", before, func(row ownerTradeSource) string { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerTradeEntry, 0, len(sources))
	for _, row := range sources {
		offer, err := snapshotOwnerTradeOffer(row.Own[0].OfferPayload)
		if err != nil {
			return nil, errOwnerExportSection
		}
		entry := ownerTradeEntry{Reference: strings.TrimPrefix(row.ID, "directtrade:"), CharacterName: row.Own[0].CharacterName, Decision: row.Decision, OperationState: row.State, CreatedAt: row.CreatedAt.UTC(), OwnOffer: offer}
		if row.Decision == DirectTradeSettle {
			incoming, err := snapshotOwnerTradeOffer(row.Incoming[0].OfferPayload)
			if err != nil {
				return nil, errOwnerExportSection
			}
			entry.AgreedIncoming = &incoming
		}
		entries = append(entries, entry)
	}
	return encodeOwnerDataPage(OwnerExportFormat("trades"), "trades", at, entries, next, maxBytes)
}

type ownerBankSource struct {
	ID            string    `bson:"_id" json:"-"`
	Version       int       `bson:"version" json:"-"`
	Username      string    `bson:"username" json:"-"`
	PlayerID      string    `bson:"player_id" json:"-"`
	CharacterName string    `bson:"character_name" json:"-"`
	GuildID       string    `bson:"guild_id" json:"-"`
	Action        string    `bson:"action" json:"-"`
	Gold          int       `bson:"gold" json:"-"`
	ItemPayload   string    `bson:"item_payload" json:"-"`
	State         string    `bson:"state" json:"-"`
	CreatedAt     time.Time `bson:"created_at" json:"-"`
}

type ownerBankEntry struct {
	Reference      string             `json:"reference"`
	CharacterName  string             `json:"character_name"`
	GuildID        string             `json:"guild_id"`
	Action         string             `json:"action"`
	Gold           int                `json:"gold"`
	Item           *ownerItemSnapshot `json:"item,omitempty"`
	OperationState string             `json:"operation_state"`
	CreatedAt      time.Time          `json:"created_at"`
}

func snapshotOwnerBankItem(row ownerBankSource) (*ownerItemSnapshot, error) {
	switch row.Action {
	case GuildBankDepositGold, GuildBankWithdrawGold:
		if row.Gold <= 0 || row.ItemPayload != "" {
			return nil, errOwnerExportSection
		}
		return nil, nil
	case GuildBankDepositItem, GuildBankWithdrawItem:
		var item Item
		if row.Gold != 0 || len(row.ItemPayload) > 65536 || !utf8.ValidString(row.ItemPayload) || json.Unmarshal([]byte(row.ItemPayload), &item) != nil || !boundedActivityText(item.ID, 256, true) || item.Stack <= 0 || strings.HasPrefix(item.ID, "chronicle-item-") {
			return nil, errOwnerExportSection
		}
		out := snapshotOwnerItem(item)
		return &out, nil
	default:
		return nil, errOwnerExportSection
	}
}

func ownerBankPagePipeline(owner, before string) mongo.Pipeline {
	projection := bson.M{}
	for _, field := range []string{"_id", "version", "username", "player_id", "character_name", "guild_id", "action", "gold", "item_payload", "state", "created_at"} {
		projection[field] = 1
	}
	return ownerOperationPagePipeline(bson.M{"username": owner}, projection, "guildbank:", before, 72<<10)
}

func (db *DB) readOwnerBankPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerBankSource) bool {
		if row.Version != 1 || row.Username != owner || row.PlayerID != "player-"+owner || row.CreatedAt.IsZero() || !boundedActivityText(row.CharacterName, 256, true) || !boundedActivityText(row.GuildID, 128, true) ||
			(row.State != GuildBankPending && row.State != GuildBankComplete && row.State != GuildBankRejected) {
			return false
		}
		_, err := snapshotOwnerBankItem(row)
		return err == nil
	}
	sources, next, err := readOwnerOperationPage(ctx, db.guildBankOperations, ownerBankPagePipeline(owner, before), "guildbank:", before, func(row ownerBankSource) string { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerBankEntry, 0, len(sources))
	for _, row := range sources {
		item, err := snapshotOwnerBankItem(row)
		if err != nil {
			return nil, errOwnerExportSection
		}
		entries = append(entries, ownerBankEntry{Reference: strings.TrimPrefix(row.ID, "guildbank:"), CharacterName: row.CharacterName, GuildID: row.GuildID, Action: row.Action, Gold: row.Gold, Item: item, OperationState: row.State, CreatedAt: row.CreatedAt.UTC()})
	}
	return encodeOwnerDataPage(OwnerExportFormat("bank"), "bank", at, entries, next, maxBytes)
}
