package database

import (
	"errors"
	"regexp"
)

const GoldPerEP = 1_000_000

var epExchangeID = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)

// Save Gold, EP and the receipt in ONE character snapshot. Eidolon currently
// has one character per account. EP is private, non-transferable, and never
// credited to the ordinary Gold receipt ledger. No reverse operation exists.
func ApplyEPExchange(gold, ep *int, receipts *map[string]int, id string, amount int) (bool, error) {
	maxInt := int(^uint(0) >> 1)
	if gold == nil || ep == nil || receipts == nil || !epExchangeID.MatchString(id) || amount <= 0 || amount > maxInt/GoldPerEP {
		return false, errors.New("invalid EP exchange; choose a positive whole number of EP")
	}
	if previous, exists := (*receipts)[id]; exists {
		if previous != amount {
			return false, errors.New("exchange receipt reused with a different amount")
		}
		return false, nil
	}
	if *ep < 0 || *ep > maxInt-amount {
		return false, errors.New("EP balance limit reached")
	}
	cost := amount * GoldPerEP
	if *gold < cost {
		return false, ErrInsufficientGold
	}
	if *receipts == nil {
		*receipts = make(map[string]int)
	}
	*gold -= cost
	*ep += amount
	(*receipts)[id] = amount
	return true, nil
}
