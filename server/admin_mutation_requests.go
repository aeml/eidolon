package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"eidolon-server/internal/game"
)

const (
	MsgAdminGrantGold         = "admin_grant_gold"
	MsgAdminGrantItem         = "admin_grant_item"
	MsgAdminTeleport          = "admin_teleport"
	adminMutationPayloadLimit = 4 << 10
	adminGoldGrantLimit       = 100_000_000
	// All balances must remain exactly representable in the JavaScript client.
	adminGoldBalanceLimit = 9_007_199_254_740_991
)

// Kept separate from the read protocol. These types are not registered until
// their durable mutation/audit recovery handler is ready; defining them alone
// must not expose an unaudited grant endpoint.
type adminMutationRequest struct {
	ID                string             `json:"id"`
	Target            string             `json:"target"`
	Reason            string             `json:"reason"`
	Confirmed         bool               `json:"confirmed"`
	Amount            int                `json:"amount,omitempty"`
	Item              game.AdminItemSpec `json:"itemSpec,omitempty"`
	Destination       string             `json:"destination,omitempty"`
	DestinationPlayer string             `json:"destinationPlayer,omitempty"`
}

func validAdminText(value string, limit int) bool {
	if value == "" || len(value) > limit || !utf8.ValidString(value) || strings.TrimSpace(value) == "" {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) {
			return false
		}
	}
	return true
}

// Closed, flat JSON with unique exact-case keys. Nulls, nested objects, coerced
// booleans, fractional/exponent numbers and cross-operation fields are rejected.
// In particular there is no actor, role, player ID, raw item or coordinate field.
func decodeAdminMutation(msg Message) (adminMutationRequest, error) {
	var request adminMutationRequest
	invalid := errors.New("invalid administration operation")
	if len(msg.Payload) > adminMutationPayloadLimit || !utf8.Valid(msg.Payload) {
		return request, invalid
	}
	required := map[string]bool{"id": true, "target": true, "reason": true, "confirmed": true}
	switch msg.Type {
	case MsgAdminGrantGold:
		required["amount"] = true
	case MsgAdminGrantItem:
		for _, key := range []string{"item", "rarity", "level", "quantity"} {
			required[key] = true
		}
	case MsgAdminTeleport:
		required["destination"] = true
	default:
		return request, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(msg.Payload))
	decoder.UseNumber()
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return request, invalid
	}
	seen := map[string]bool{}
	for decoder.More() {
		token, err = decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] || !required[key] && !(msg.Type == MsgAdminTeleport && key == "destinationPlayer") {
			return request, invalid
		}
		seen[key] = true
		token, err = decoder.Token()
		if err != nil {
			return request, invalid
		}
		if key == "confirmed" {
			if token != true {
				return request, invalid
			}
			request.Confirmed = true
			continue
		}
		if key == "amount" || key == "level" || key == "quantity" {
			number, ok := token.(json.Number)
			if !ok {
				return request, invalid
			}
			integer, err := strconv.ParseInt(string(number), 10, 32)
			if err != nil || integer < 1 {
				return request, invalid
			}
			switch key {
			case "amount":
				request.Amount = int(integer)
			case "level":
				request.Item.Level = int(integer)
			case "quantity":
				request.Item.Quantity = int(integer)
			}
			continue
		}
		value, ok := token.(string)
		if !ok {
			return request, invalid
		}
		switch key {
		case "id":
			request.ID = value
		case "target":
			request.Target = value
		case "reason":
			request.Reason = value
		case "item":
			request.Item.Item = value
		case "rarity":
			request.Item.Rarity = game.ItemRarity(value)
		case "destination":
			request.Destination = value
		case "destinationPlayer":
			request.DestinationPlayer = value
		}
	}
	if token, err = decoder.Token(); err != nil || token != json.Delim('}') {
		return request, invalid
	}
	if _, err = decoder.Token(); err != io.EOF {
		return request, invalid
	}
	for key := range required {
		if !seen[key] {
			return request, invalid
		}
	}
	if !adminRequestID.MatchString(request.ID) || !validAdminText(request.Target, 256) || !validAdminText(request.Reason, 160) {
		return request, invalid
	}
	switch msg.Type {
	case MsgAdminGrantGold:
		if request.Amount > adminGoldGrantLimit {
			return request, invalid
		}
	case MsgAdminGrantItem:
		if err := request.Item.Validate(); err != nil {
			return request, err
		}
	case MsgAdminTeleport:
		switch request.Destination {
		case "town":
			if seen["destinationPlayer"] {
				return request, invalid
			}
		case "player":
			if !validAdminText(request.DestinationPlayer, 256) || request.Target == request.DestinationPlayer {
				return request, invalid
			}
		default:
			return request, invalid
		}
	}
	return request, nil
}

// Identity is actor+request ID, not target/action. Reusing an ID for any different
// operation must conflict, including a different target, reason or destination.
// The actor argument must come from the authenticated connection, never JSON.
func (request adminMutationRequest) identities(actor, action string) (id, fingerprint string) {
	identity, _ := json.Marshal([2]string{actor, request.ID})
	payload, _ := json.Marshal(struct {
		Action  string               `json:"action"`
		Request adminMutationRequest `json:"request"`
	}{action, request})
	identityHash, payloadHash := sha256.Sum256(identity), sha256.Sum256(payload)
	return "admin:" + hex.EncodeToString(identityHash[:]), hex.EncodeToString(payloadHash[:])
}

// Acquire before the usual single-account dispatch lock, then recheck actor
// ownership and role. Exact target existence/ownership/state is checked under
// these locks by the mutation handler; parsing does not authorize any action.
func (request adminMutationRequest) lockAccounts(actor string) func() {
	return lockCharactersWork(actor, request.Target, request.DestinationPlayer)
}

func validateAdminGoldBalance(balance, amount int) error {
	if balance < 0 || amount < 1 || amount > adminGoldGrantLimit || balance > adminGoldBalanceLimit-amount {
		return errors.New("Gold grant would exceed the permitted amount or balance")
	}
	return nil
}
