package database

import "errors"

var ErrInsufficientGold = errors.New("insufficient gold")

// The existing private receipt ledger also stores signed auction debits. Check
// its receipt BEFORE balance: a replay after spending must not charge again.
func ApplyGoldDebit(gold *int, receipts *map[string]int, id string, amount int) error {
	if id == "" || amount <= 0 || gold == nil || receipts == nil {
		return errors.New("invalid durable gold debit")
	}
	if previous, exists := (*receipts)[id]; exists {
		if previous != -amount {
			return errors.New("gold debit identity reused with different amount")
		}
		return nil
	}
	if *gold < amount {
		return ErrInsufficientGold
	}
	if *receipts == nil {
		*receipts = make(map[string]int)
	}
	*gold -= amount
	(*receipts)[id] = -amount
	return nil
}

// Stored in the same auction update that displaces a bid. Never acknowledge
// this intent until the character's gold AND matching receipt are committed.
type AuctionRefund struct {
	ID            string `bson:"id"`
	PlayerID      string `bson:"player_id"`
	CharacterName string `bson:"character_name"`
	Amount        int    `bson:"amount"`
}

// Receipts travel with every full character snapshot. Retain them after delivery
// so an ambiguous acknowledgement/restarted worker cannot pay the refund twice.
func ApplyGoldCredit(gold *int, receipts *map[string]int, id string, amount int) error {
	if id == "" || amount <= 0 || gold == nil || receipts == nil {
		return errors.New("invalid durable gold credit")
	}
	if previous, exists := (*receipts)[id]; exists {
		if previous != amount {
			return errors.New("gold credit identity reused with different amount")
		}
		return nil
	}
	if *gold > int(^uint(0)>>1)-amount {
		return errors.New("gold credit would overflow")
	}
	if *receipts == nil {
		*receipts = make(map[string]int)
	}
	*gold += amount
	(*receipts)[id] = amount
	return nil
}
