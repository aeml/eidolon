package database

import (
	"errors"
	"strings"
)

var ErrInsufficientEP = errors.New("insufficient EP")

// Casino EP is a separate signed receipt ledger. Never invoke Gold delivery,
// item rewards, exchange or membership issuance when settling these transfers.
// Keep receipts after spending: recovery may replay any previously saved hand.
func ApplyEPTransfer(ep *int, receipts *map[string]int, id string, amount int) error {
	if ep == nil || receipts == nil || !strings.HasPrefix(id, "casino:") || len(id) < 12 || len(id) > 240 || amount == 0 || *ep < 0 {
		return errors.New("invalid durable EP transfer")
	}
	if previous, exists := (*receipts)[id]; exists {
		if previous != amount {
			return errors.New("EP transfer identity reused with different amount")
		}
		return nil
	}
	// Compare without negating amount, including the minimum signed integer.
	if amount < 0 && amount < -*ep {
		return ErrInsufficientEP
	}
	if amount > 0 && *ep > int(^uint(0)>>1)-amount {
		return errors.New("EP transfer would overflow")
	}
	if *receipts == nil {
		*receipts = make(map[string]int)
	}
	*ep += amount
	(*receipts)[id] = amount
	return nil
}
