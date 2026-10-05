package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ownerCasinoCandidate struct{ ID, Reference, Game, Currency, Theme string }

// Closed current catalog plus the retired funded blackjack table. Root contract
// tests bind this list and slot hash formula to the actual game catalog/writers.
// This is selection, not authorization. No arbitrary collection/table ID input.
func ownerCasinoCandidates(owner string) []ownerCasinoCandidate {
	result := make([]ownerCasinoCandidate, 0, 37)
	for _, floor := range []string{"public", "vip"} {
		currency := "gold"
		if floor == "vip" {
			currency = "ep"
		}
		for _, game := range []string{"blackjack", "poker", "baccarat", "roulette"} {
			count := 4
			if game == "roulette" {
				count = 2
			}
			for _, suffix := range []string{"", "-earth", "-air", "-fire"}[:count] {
				id := floor + "-" + game + suffix
				result = append(result, ownerCasinoCandidate{id, id, game, currency, ""})
			}
		}
	}
	result = append(result, ownerCasinoCandidate{"public-blackjack-water", "public-blackjack-water", "blackjack", "gold", ""})
	digest := sha256.Sum256([]byte("player-" + owner))
	for _, currency := range []string{"gold", "ep"} {
		prefix := "slots:"
		if currency == "ep" {
			prefix = "slots:ep:"
		}
		for _, theme := range []string{"earth", "air", "fire", "water"} {
			result = append(result, ownerCasinoCandidate{prefix + hex.EncodeToString(digest[:]) + ":" + theme, "slots-" + currency + "-" + theme, "slots", currency, theme})
		}
	}
	return result
}

// Used by current-writer contract tests; does not query or grant access.
func OwnerCasinoRecordIDs(owner string) []string {
	items := ownerCasinoCandidates(owner)
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	sort.Strings(ids)
	return ids
}

func validOwnerCasinoCursor(cursor string) bool {
	if cursor == "" {
		return true
	}
	for _, item := range ownerCasinoCandidates("") {
		if item.Reference == cursor {
			return true
		}
	}
	return false
}

type ownerCasinoPending struct {
	Currency string `bson:"currency" json:"currency"`
	Amount   int    `bson:"amount" json:"amount"`
}
type ownerCasinoSource struct {
	ID      string              `bson:"_id" json:"-"`
	Version int64               `bson:"version" json:"-"`
	State   []byte              `bson:"state" json:"-"`
	Pending *ownerCasinoPending `bson:"own_pending" json:"-"`
}

type ownerCasinoWager struct {
	Spot   string `json:"spot"`
	Amount int    `json:"amount"`
}
type ownerCasinoHand struct {
	Cards   []int  `json:"cards"`
	Bet     int    `json:"bet"`
	Split   bool   `json:"split"`
	Done    bool   `json:"done"`
	Outcome string `json:"outcome,omitempty"`
	Payout  int    `json:"payout"`
}
type ownerCasinoParticipant struct {
	Name   string             `json:"name,omitempty"`
	Seat   int                `json:"seat"`
	Bet    int                `json:"bet,omitempty"`
	BuyIn  int                `json:"buyIn,omitempty"`
	Paid   bool               `json:"paid"`
	Wagers []ownerCasinoWager `json:"wagers,omitempty"`
}
type ownerCasinoRoundPlayer struct {
	Seat      int               `json:"seat"`
	BuyIn     int               `json:"buyIn,omitempty"`
	Stack     int               `json:"stack,omitempty"`
	Committed int               `json:"committed,omitempty"`
	StreetBet int               `json:"streetBet,omitempty"`
	Cards     []int             `json:"cards,omitempty"`
	Folded    bool              `json:"folded,omitempty"`
	Acted     bool              `json:"acted,omitempty"`
	Payout    int               `json:"payout,omitempty"`
	Hands     []ownerCasinoHand `json:"hands,omitempty"`
}
type ownerCasinoSlotLast struct {
	Landed      [5][3]int `json:"landed"`
	Payout      int       `json:"payout"`
	BonusPicked int       `json:"bonusPicked"`
	BonusPayout int       `json:"bonusPayout"`
	Free        bool      `json:"free"`
	FreeAwarded int       `json:"freeAwarded"`
	Scatters    int       `json:"scatters"`
}
type ownerCasinoSlot struct {
	Theme      string               `json:"theme"`
	Currency   string               `json:"currency,omitempty"`
	Bet        int                  `json:"bet"`
	FreeSpins  int                  `json:"freeSpins"`
	StickyRows [3]bool              `json:"stickyRows"`
	Bonus      bool                 `json:"bonus"`
	Last       *ownerCasinoSlotLast `json:"last,omitempty"`
}
type ownerCasinoSlotRecord struct {
	Owner   string          `json:"owner"`
	Session ownerCasinoSlot `json:"session"`
	Owed    int             `json:"owed"`
	Payment string          `json:"payment"`
}

// Closed opaque-state envelope. Decks, burns/dealer holes, round identities,
// timeout/seat tokens and hidden bonus offers have no decoded/public DTO fields.
type ownerCasinoEnvelope struct {
	Phase   string            `json:"phase"`
	Game    string            `json:"game"`
	Players []json.RawMessage `json:"players"`
	Round   *struct {
		Players  []json.RawMessage `json:"players"`
		Currency string            `json:"currency"`
	} `json:"round"`
}
type ownerCasinoEntry struct {
	ID              string                  `json:"id"`
	Game            string                  `json:"game"`
	Currency        string                  `json:"currency"`
	Phase           string                  `json:"phase,omitempty"`
	Participant     *ownerCasinoParticipant `json:"own_participant,omitempty"`
	RoundPlayer     *ownerCasinoRoundPlayer `json:"own_round_player,omitempty"`
	Slot            *ownerCasinoSlot        `json:"own_slot,omitempty"`
	RecordedOwed    *int                    `json:"recorded_owed,omitempty"`
	RecordedPayment string                  `json:"recorded_payment,omitempty"`
	Pending         *ownerCasinoPending     `json:"own_pending_transfer,omitempty"`
}

func selectOwnerCasinoPlayer(rows []json.RawMessage, playerID string) (json.RawMessage, error) {
	if len(rows) > 6 {
		return nil, errOwnerExportSection
	}
	var own json.RawMessage
	for _, raw := range rows {
		var marker struct {
			PlayerID string `json:"playerId"`
		}
		if json.Unmarshal(raw, &marker) != nil || marker.PlayerID == "" || len(marker.PlayerID) > 128 {
			return nil, errOwnerExportSection
		}
		if marker.PlayerID == playerID {
			if own != nil {
				return nil, errOwnerExportSection
			}
			own = raw
		}
	}
	return own, nil
}

func validOwnerCasinoCards(cards []int) bool {
	if len(cards) > 52 {
		return false
	}
	seen := map[int]bool{}
	for _, card := range cards {
		if card < 0 || card > 51 || seen[card] {
			return false
		}
		seen[card] = true
	}
	return true
}
func ownerCasinoMoneyBound(currency string) int {
	if currency == "ep" {
		return 20000
	}
	return 20000000
}

func snapshotOwnerCasinoRecord(row ownerCasinoSource, candidate ownerCasinoCandidate, owner string) (*ownerCasinoEntry, error) {
	if row.ID != candidate.ID || row.Version < 1 || len(row.State) == 0 || len(row.State) > 256<<10 || !utf8.Valid(row.State) || !json.Valid(row.State) {
		return nil, errOwnerExportSection
	}
	bound := ownerCasinoMoneyBound(candidate.Currency)
	entry := &ownerCasinoEntry{ID: candidate.Reference, Game: candidate.Game, Currency: candidate.Currency, Pending: row.Pending}
	if row.Pending != nil {
		debit := 100000
		if candidate.Currency == "ep" {
			debit = 100
		}
		if row.Pending.Currency != candidate.Currency || row.Pending.Amount == 0 || row.Pending.Amount < -debit || row.Pending.Amount > bound {
			return nil, errOwnerExportSection
		}
	}
	playerID := "player-" + owner
	if candidate.Game == "slots" {
		var state ownerCasinoSlotRecord
		if json.Unmarshal(row.State, &state) != nil || state.Owner != playerID || state.Session.Theme != candidate.Theme || (state.Session.Currency != "" && state.Session.Currency != candidate.Currency) || candidate.Currency == "ep" && state.Session.Currency != "ep" || state.Session.Bet < 1 || state.Session.Bet > 100000 || state.Session.FreeSpins < 0 || state.Session.FreeSpins > 12 || state.Owed < 0 || state.Owed > bound || (state.Payment != "" && state.Payment != "spin" && state.Payment != "bonus") || state.Payment == "" && state.Owed != 0 {
			return nil, errOwnerExportSection
		}
		if candidate.Currency == "ep" && state.Session.Bet > 100 {
			return nil, errOwnerExportSection
		}
		if last := state.Session.Last; last != nil {
			if last.Payout < 0 || last.Payout > state.Session.Bet*200 || last.BonusPayout < 0 || last.BonusPayout > state.Session.Bet*5 || last.BonusPicked < -1 || last.BonusPicked > 2 || last.BonusPicked == -1 && last.BonusPayout != 0 || state.Session.Bonus && (last.BonusPicked != -1 || last.BonusPayout != 0) || last.FreeAwarded < 0 || last.FreeAwarded > 12 || last.Scatters < 0 || last.Scatters > 15 {
				return nil, errOwnerExportSection
			}
			for _, reel := range last.Landed {
				for _, symbol := range reel {
					if symbol < 0 || symbol > 7 {
						return nil, errOwnerExportSection
					}
				}
			}
		}
		if state.Session.Bonus && state.Session.Last == nil || state.Payment == "spin" && (state.Session.Last == nil || state.Owed <= 0 || state.Owed != state.Session.Last.Payout) || state.Payment == "bonus" && (state.Session.Last == nil || state.Owed <= 0 || state.Owed != state.Session.Last.BonusPayout || state.Session.Bonus || state.Session.Last.BonusPicked < 0) {
			return nil, errOwnerExportSection
		}
		entry.Slot = &state.Session
		entry.RecordedOwed = &state.Owed
		entry.RecordedPayment = state.Payment
		return entry, nil
	}
	var state ownerCasinoEnvelope
	if json.Unmarshal(row.State, &state) != nil || !boundedActivityText(state.Phase, 32, true) {
		return nil, errOwnerExportSection
	}
	if (candidate.Game == "roulette" || candidate.Game == "baccarat") && state.Game != candidate.Game {
		return nil, errOwnerExportSection
	}
	entry.Phase = state.Phase
	raw, err := selectOwnerCasinoPlayer(state.Players, playerID)
	if err != nil {
		return nil, errOwnerExportSection
	}
	if raw != nil {
		var participant ownerCasinoParticipant
		if json.Unmarshal(raw, &participant) != nil || participant.Seat < 0 || participant.Seat >= 6 || !boundedActivityText(participant.Name, 128, false) || participant.Bet < 0 || participant.Bet > bound || participant.BuyIn < 0 || participant.BuyIn > bound || len(participant.Wagers) > 160 {
			return nil, errOwnerExportSection
		}
		for _, wager := range participant.Wagers {
			if !boundedActivityText(wager.Spot, 128, true) || wager.Amount < 1 || wager.Amount > bound {
				return nil, errOwnerExportSection
			}
		}
		entry.Participant = &participant
	}
	if state.Round != nil {
		if state.Round.Currency != "" && state.Round.Currency != candidate.Currency || candidate.Currency == "ep" && state.Round.Currency != "ep" {
			return nil, errOwnerExportSection
		}
		raw, err := selectOwnerCasinoPlayer(state.Round.Players, playerID)
		if err != nil {
			return nil, errOwnerExportSection
		}
		if raw != nil {
			var player ownerCasinoRoundPlayer
			if json.Unmarshal(raw, &player) != nil || player.Seat < 0 || player.Seat >= 6 || !validOwnerCasinoCards(player.Cards) || player.BuyIn < 0 || player.BuyIn > bound || player.Stack < 0 || player.Stack > bound || player.Committed < 0 || player.Committed > bound || player.StreetBet < 0 || player.StreetBet > bound || player.Payout < 0 || player.Payout > bound || len(player.Hands) > 4 {
				return nil, errOwnerExportSection
			}
			for _, hand := range player.Hands {
				if !validOwnerCasinoCards(hand.Cards) || hand.Bet < 0 || hand.Bet > bound || hand.Payout < 0 || hand.Payout > bound || !boundedActivityText(hand.Outcome, 64, false) {
					return nil, errOwnerExportSection
				}
			}
			entry.RoundPlayer = &player
		}
	}
	if entry.Participant == nil && entry.RoundPlayer == nil && entry.Pending == nil {
		return nil, nil
	}
	return entry, nil
}

func ownerCasinoPagePipeline(owner, before string) mongo.Pipeline {
	ids := bson.A{}
	for _, item := range ownerCasinoCandidates(owner) {
		if before == "" || item.Reference < before {
			ids = append(ids, item.ID)
		}
	}
	projection := bson.M{"_id": 1, "version": 1, "state": 1, "own_pending": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$pending.player_id", "player-" + owner}}, bson.M{"currency": "$pending.currency", "amount": "$pending.amount"}, nil}}}
	within := bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, 264 << 10}}
	return mongo.Pipeline{bson.D{{Key: "$match", Value: bson.M{"_id": bson.M{"$in": ids}}}}, bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: 1}}}}, bson.D{{Key: "$limit", Value: 38}}, bson.D{{Key: "$project", Value: projection}}, bson.D{{Key: "$project", Value: bson.M{"_id": 0, "within_bound": within, "entry": bson.M{"$cond": bson.A{within, "$$ROOT", nil}}}}}}
}

func (db *DB) readOwnerCasinoPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	if db.blackjackTables == nil {
		return nil, errOwnerExportSection
	}
	candidates := map[string]ownerCasinoCandidate{}
	for _, item := range ownerCasinoCandidates(owner) {
		if before == "" || item.Reference < before {
			candidates[item.ID] = item
		}
	}
	cursor, err := db.blackjackTables.Aggregate(ctx, ownerCasinoPagePipeline(owner, before), options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(1).SetCollation(&options.Collation{Locale: "simple"}))
	if err != nil {
		return nil, errOwnerExportSection
	}
	defer cursor.Close(ctx)
	entries := make([]ownerCasinoEntry, 0, len(candidates))
	seen := map[string]bool{}
	for cursor.Next(ctx) {
		var source struct {
			Within bool               `bson:"within_bound"`
			Entry  *ownerCasinoSource `bson:"entry"`
		}
		if cursor.Decode(&source) != nil || !source.Within || source.Entry == nil || len(seen) >= len(candidates) {
			return nil, errOwnerExportSection
		}
		candidate, known := candidates[source.Entry.ID]
		if !known || seen[candidate.ID] {
			return nil, errOwnerExportSection
		}
		seen[candidate.ID] = true
		entry, err := snapshotOwnerCasinoRecord(*source.Entry, candidate, owner)
		if err != nil {
			return nil, errOwnerExportSection
		}
		if entry != nil {
			entries = append(entries, *entry)
		}
	}
	if cursor.Err() != nil || ctx.Err() != nil {
		return nil, errOwnerExportSection
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].ID > entries[j].ID })
	next := ""
	if len(entries) > ownerDataPageSize {
		entries = entries[:ownerDataPageSize]
		next = entries[len(entries)-1].ID
	}
	return encodeOwnerDataPage(OwnerExportFormat("casino"), "casino", at, entries, next, maxBytes)
}
