package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
)

const (
	DirectTradeSettle        = "settle"
	DirectTradeCancel        = "cancel"
	DirectTradePending       = "pending"
	DirectTradeComplete      = "complete"
	MaxDirectTradeOfferItems = 25
	MaxDirectTradeOfferGold  = 100_000
	MaxDirectTradeOfferBytes = 128 << 10
)

var (
	directTradeOperationIDPattern = regexp.MustCompile(`^directtrade:[0-9a-f]{64}$`)
	directTradeFingerprintPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	ErrDirectTradeConflict        = errors.New("direct trade decision conflicts with saved state")
)

// Payloads are server-authored complete game-item JSON. Keeping them opaque
// preserves exact Stats/Gems/ForgeBasis and future item metadata; database
// recovery must not normalize, rescale or silently reconstruct those items.
type DirectTradeEscrowState struct {
	TradeID           string `bson:"trade_id"`
	OfferPayload      string `bson:"offer_payload"`
	PeerUsername      string `bson:"peer_username,omitempty"`
	PeerPlayerID      string `bson:"peer_player_id,omitempty"`
	PeerCharacterName string `bson:"peer_character_name,omitempty"`
}

type DirectTradeDeliveryState struct {
	OperationID  string `bson:"operation_id"`
	OfferPayload string `bson:"offer_payload"`
}

type DirectTradeCharacterState struct {
	Version                  int                       `bson:"version"`
	Revision                 int64                     `bson:"revision"`
	Escrow                   *DirectTradeEscrowState   `bson:"escrow,omitempty"`
	Delivery                 *DirectTradeDeliveryState `bson:"delivery,omitempty"`
	LastOperationID          string                    `bson:"last_operation_id,omitempty"`
	LastOperationFingerprint string                    `bson:"last_operation_fingerprint,omitempty"`
	LastOperationRevision    int64                     `bson:"last_operation_revision,omitempty"`
}

type DirectTradeParticipant struct {
	Username         string `bson:"username"`
	PlayerID         string `bson:"player_id"`
	CharacterName    string `bson:"character_name"`
	ExpectedRevision int64  `bson:"expected_revision"`
	OfferPayload     string `bson:"offer_payload"`
}

// One shared immutable settlement OR cancellation decision per trade. Prepare
// durably before either participant effect; never compensate an unknown prepare
// result or replace a committed settlement with a new cancellation plan.
// The coordinator must fence both accounts and freeze this exact payload.
type DirectTradeOperation struct {
	Version      int                       `bson:"version"`
	ID           string                    `bson:"_id"`
	TradeID      string                    `bson:"trade_id"`
	Decision     string                    `bson:"decision"`
	Fingerprint  string                    `bson:"fingerprint"`
	Participants [2]DirectTradeParticipant `bson:"participants"`
	CreatedAt    time.Time                 `bson:"created_at"`
	State        string                    `bson:"state"`
}

func DirectTradeOperationID(tradeID string) string {
	digest := sha256.Sum256([]byte(tradeID))
	return "directtrade:" + hex.EncodeToString(digest[:])
}

func DirectTradeOperationFingerprint(op DirectTradeOperation) (string, error) {
	// Mutable recovery state and the retry's timestamp are not an economic plan.
	// Either account may reconstruct an orphan cancellation after restart.
	// Participant array order is not custody: bind each offer/revision to its
	// account and sort only the fingerprint projection, not the stored record.
	participants := op.Participants
	if participants[0].Username > participants[1].Username {
		participants[0], participants[1] = participants[1], participants[0]
	}
	encoded, err := json.Marshal(struct {
		TradeID, Decision string
		Participants      [2]DirectTradeParticipant
	}{op.TradeID, op.Decision, participants})
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func validDirectTradeID(id string) bool {
	return boundedActivityText(id, 512, true)
}

type directTradeOfferInfo struct {
	Gold  int `json:"gold"`
	Items []struct {
		ID       string `json:"id"`
		Stack    int    `json:"stack"`
		MaxStack int    `json:"maxStack"`
	} `json:"items"`
}

func parseDirectTradeOffer(payload string) (directTradeOfferInfo, error) {
	var offer directTradeOfferInfo
	trimmed := strings.TrimSpace(payload)
	if len(trimmed) == 0 || trimmed[0] != '{' || len(payload) > MaxDirectTradeOfferBytes || !utf8.ValidString(payload) ||
		json.Unmarshal([]byte(payload), &offer) != nil || offer.Gold < 0 || offer.Gold > MaxDirectTradeOfferGold || len(offer.Items) > MaxDirectTradeOfferItems {
		return offer, errors.New("invalid direct trade offer payload")
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal([]byte(payload), &fields) != nil {
		return offer, errors.New("invalid direct trade offer object")
	}
	for field := range fields {
		if field != "items" && field != "gold" {
			return offer, errors.New("unsupported direct trade currency or offer field")
		}
	}
	seen := map[string]bool{}
	for _, item := range offer.Items {
		// Legacy zero Stack/MaxStack retain the game's single-item defaults;
		// negative or explicitly overfilled stacks are never silently repaired.
		if !boundedActivityText(item.ID, 256, true) || seen[item.ID] || strings.HasPrefix(item.ID, "chronicle-item-") ||
			item.Stack < 0 || item.MaxStack < 0 || (item.MaxStack > 0 && max(1, item.Stack) > item.MaxStack) {
			return offer, errors.New("invalid direct trade item custody")
		}
		seen[item.ID] = true
	}
	return offer, nil
}

func (op DirectTradeOperation) Validate() error {
	fingerprint, err := DirectTradeOperationFingerprint(op)
	if err != nil || op.Version != 1 || !validDirectTradeID(op.TradeID) || op.ID != DirectTradeOperationID(op.TradeID) ||
		!directTradeOperationIDPattern.MatchString(op.ID) || op.Fingerprint != fingerprint || op.CreatedAt.IsZero() ||
		(op.State != DirectTradePending && op.State != DirectTradeComplete) || (op.Decision != DirectTradeSettle && op.Decision != DirectTradeCancel) {
		return errors.New("invalid direct trade decision")
	}
	seen := map[string]bool{}
	for _, participant := range op.Participants {
		if !boundedActivityText(participant.Username, 256, true) || participant.PlayerID != "player-"+participant.Username ||
			!boundedActivityText(participant.CharacterName, 256, true) || participant.ExpectedRevision < 0 || participant.ExpectedRevision == math.MaxInt64 {
			return errors.New("invalid direct trade participant")
		}
		offer, err := parseDirectTradeOffer(participant.OfferPayload)
		if err != nil {
			return err
		}
		for _, item := range offer.Items {
			if seen[item.ID] {
				return errors.New("ambiguous direct trade item custody")
			}
			seen[item.ID] = true
		}
	}
	if op.Participants[0].Username == op.Participants[1].Username || (op.Decision == DirectTradeSettle && len(seen) == 0) {
		return errors.New("self or gold-only direct trade is not allowed")
	}
	return nil
}

// Readers/snapshots preserve even an unknown future format byte-for-byte.
// Only the versioned writer below interprets or changes the state.
func CloneDirectTradeState(payload []byte) bson.Raw {
	return append(bson.Raw(nil), payload...)
}

func directTradeKnownFields(raw bson.Raw, allowed ...string) error {
	fields, err := raw.Elements()
	if err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, field := range fields {
		known := false
		for _, key := range allowed {
			known = known || field.Key() == key
		}
		if !known || seen[field.Key()] {
			return errors.New("unsupported direct trade state fields")
		}
		seen[field.Key()] = true
	}
	return nil
}

func DecodeDirectTradeState(raw bson.Raw) (*DirectTradeCharacterState, error) {
	if len(raw) == 0 {
		return &DirectTradeCharacterState{Version: 1}, nil
	}
	if len(raw) > 2*MaxDirectTradeOfferBytes+4096 {
		return nil, errors.New("direct trade state exceeds size limit")
	}
	if err := directTradeKnownFields(raw, "version", "revision", "escrow", "delivery", "last_operation_id", "last_operation_fingerprint", "last_operation_revision"); err != nil {
		return nil, err
	}
	for key, fields := range map[string][]string{"escrow": {"trade_id", "offer_payload", "peer_username", "peer_player_id", "peer_character_name"}, "delivery": {"operation_id", "offer_payload"}} {
		if value, err := raw.LookupErr(key); err == nil {
			nested, ok := value.DocumentOK()
			if !ok {
				return nil, errors.New("invalid direct trade state object")
			}
			if err := directTradeKnownFields(nested, fields...); err != nil {
				return nil, err
			}
		}
	}
	var state DirectTradeCharacterState
	if err := bson.Unmarshal(raw, &state); err != nil {
		return nil, err
	}
	if err := state.Validate(); err != nil {
		return nil, err
	}
	return &state, nil
}

func (state DirectTradeCharacterState) Validate() error {
	if state.Version != 1 || state.Revision < 0 || state.LastOperationRevision < 0 || state.LastOperationRevision > state.Revision {
		return errors.New("unsupported direct trade character state")
	}
	if state.LastOperationID == "" {
		if state.LastOperationFingerprint != "" || state.LastOperationRevision != 0 {
			return ErrDirectTradeConflict
		}
	} else if !directTradeOperationIDPattern.MatchString(state.LastOperationID) || !directTradeFingerprintPattern.MatchString(state.LastOperationFingerprint) || state.LastOperationRevision == 0 {
		return ErrDirectTradeConflict
	}
	if state.Escrow != nil {
		if !validDirectTradeID(state.Escrow.TradeID) || state.Revision == 0 {
			return ErrDirectTradeConflict
		}
		if _, err := parseDirectTradeOffer(state.Escrow.OfferPayload); err != nil {
			return err
		}
		// Earlier prepared model fixtures have no peer. Readers retain them, but
		// orphan recovery must not guess their recipient. The runtime producer
		// always supplies all three bindings before acknowledging an offer.
		peer := state.Escrow
		if peer.PeerUsername != "" || peer.PeerPlayerID != "" || peer.PeerCharacterName != "" {
			if !boundedActivityText(peer.PeerUsername, 256, true) || peer.PeerPlayerID != "player-"+peer.PeerUsername ||
				!boundedActivityText(peer.PeerCharacterName, 256, true) {
				return ErrDirectTradeConflict
			}
		}
	}
	if state.Delivery != nil {
		if state.Escrow != nil || state.Delivery.OperationID != state.LastOperationID || !directTradeOperationIDPattern.MatchString(state.Delivery.OperationID) {
			return ErrDirectTradeConflict
		}
		if _, err := parseDirectTradeOffer(state.Delivery.OfferPayload); err != nil {
			return err
		}
	}
	return nil
}

func EncodeDirectTradeState(state DirectTradeCharacterState) (bson.Raw, error) {
	if err := state.Validate(); err != nil {
		return nil, err
	}
	encoded, err := bson.Marshal(state)
	if err != nil {
		return nil, err
	}
	if len(encoded) > 2*MaxDirectTradeOfferBytes+4096 {
		return nil, errors.New("direct trade state exceeds size limit")
	}
	return encoded, nil
}

// Caller holds the account work lock and has re-read the shared pending intent.
// This consumes ONLY the participant's persisted escrow into an owned delivery
// plus a replay receipt. It does not yet claim that delivery into bag/Gold or
// acknowledge the shared operation; both participant receipts must be saved.
func ApplyDirectTradeCharacterDecision(username string, character *Character, op DirectTradeOperation) (bool, error) {
	if err := op.Validate(); err != nil {
		return false, err
	}
	if op.State != DirectTradePending || character == nil {
		return false, ErrDirectTradeConflict
	}
	index := -1
	for i, participant := range op.Participants {
		if participant.Username == username && participant.CharacterName == character.Name {
			index = i
		}
	}
	if index < 0 {
		return false, ErrDirectTradeConflict
	}
	participant := op.Participants[index]
	state, err := DecodeDirectTradeState(character.DirectTradeState)
	if err != nil {
		return false, err
	}
	if state.LastOperationID == op.ID {
		if state.LastOperationFingerprint != op.Fingerprint || state.LastOperationRevision != participant.ExpectedRevision+1 {
			return false, ErrDirectTradeConflict
		}
		return false, nil
	}
	if state.Revision != participant.ExpectedRevision || state.Delivery != nil {
		return false, ErrDirectTradeConflict
	}
	if state.Escrow == nil {
		ownOffer, _ := parseDirectTradeOffer(participant.OfferPayload)
		if ownOffer.Gold != 0 || len(ownOffer.Items) != 0 {
			return false, ErrDirectTradeConflict
		}
	} else if state.Escrow.TradeID != op.TradeID || state.Escrow.OfferPayload != participant.OfferPayload {
		return false, ErrDirectTradeConflict
	} else if state.Escrow.PeerUsername != "" {
		peer := op.Participants[1-index]
		if state.Escrow.PeerUsername != peer.Username || state.Escrow.PeerPlayerID != peer.PlayerID || state.Escrow.PeerCharacterName != peer.CharacterName {
			return false, ErrDirectTradeConflict
		}
	}
	payload := participant.OfferPayload
	if op.Decision == DirectTradeSettle {
		payload = op.Participants[1-index].OfferPayload
	}
	state.Escrow = nil
	state.Revision++
	state.LastOperationID, state.LastOperationFingerprint, state.LastOperationRevision = op.ID, op.Fingerprint, state.Revision
	info, _ := parseDirectTradeOffer(payload)
	if info.Gold != 0 || len(info.Items) != 0 {
		state.Delivery = &DirectTradeDeliveryState{OperationID: op.ID, OfferPayload: payload}
	}
	encoded, err := EncodeDirectTradeState(*state)
	if err != nil {
		return false, err
	}
	character.DirectTradeState = encoded
	return true, nil
}
