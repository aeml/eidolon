package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
)

// One private head per durable casino record, not one entry per wager. Current
// furniture has 29 card recovery records and eight owner/theme/currency slot
// records per account. Future catalog expansion must review this explicit cap.
const MaxCasinoWalletCheckpoints = 64

type CasinoWalletCheckpoint struct {
	Version     int64  `bson:"version"`
	ID          string `bson:"id"`
	Fingerprint string `bson:"fingerprint"`
}

func casinoTransferFingerprint(op BlackjackTransfer) (string, error) {
	op.Fingerprint = ""
	encoded, err := json.Marshal(op)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

// Called by the durable table admission, never by a player-supplied marker.
func (op BlackjackTransfer) WithCasinoCheckpoint(tableID string, version int64) (BlackjackTransfer, error) {
	if op.TableVersion != 0 || op.TableID != "" || op.Fingerprint != "" {
		if op.TableID != tableID || op.TableVersion != version || op.ValidateForTable(tableID) != nil {
			return BlackjackTransfer{}, ErrBlackjackTableConflict
		}
		return op, nil
	}
	op.TableID, op.TableVersion = tableID, version
	var err error
	op.Fingerprint, err = casinoTransferFingerprint(op)
	if err != nil {
		return BlackjackTransfer{}, err
	}
	return op, op.ValidateForTable(tableID)
}

func validCasinoCheckpoint(head CasinoWalletCheckpoint) bool {
	fp, err := hex.DecodeString(head.Fingerprint)
	return head.Version >= 2 && strings.HasPrefix(head.ID, "casino:") && len(head.ID) >= 12 && len(head.ID) <= 240 && err == nil && len(fp) == 32 && hex.EncodeToString(fp) == head.Fingerprint
}

// Only an actual canonical pending table intent may enter this helper. Table
// CAS cannot advance past a transfer until its owner's full save is confirmed.
// Thus a later saved head proves earlier transfers for that same account/table,
// even when other players' intervening table versions were legitimately skipped.
// Historical signed map receipts are preserved, including mixed-version replay.
func ApplyCasinoWalletCheckpoint(gold, ep *int, goldReceipts, epReceipts map[string]int, heads *map[string]CasinoWalletCheckpoint, op BlackjackTransfer) (bool, error) {
	if gold == nil || ep == nil || heads == nil || op.TableVersion < 2 || op.ValidateForTable(op.TableID) != nil {
		return false, errors.New("invalid casino wallet checkpoint")
	}
	balance, legacy := gold, goldReceipts
	if op.Currency == "ep" {
		balance, legacy = ep, epReceipts
	}
	if *balance < 0 {
		return false, errors.New("invalid casino balance")
	}
	previous, legacyApplied := legacy[op.ID]
	if legacyApplied && previous != op.Amount {
		return false, ErrBlackjackTableConflict
	}
	head, exists := (*heads)[op.TableID]
	if exists {
		if !validCasinoCheckpoint(head) {
			return false, ErrBlackjackTableConflict
		}
		if head.Version > op.TableVersion {
			return false, nil
		}
		if head.Version == op.TableVersion {
			if head.ID != op.ID || head.Fingerprint != op.Fingerprint {
				return false, ErrBlackjackTableConflict
			}
			return false, nil
		}
	} else if len(*heads) >= MaxCasinoWalletCheckpoints {
		return false, errors.New("casino checkpoint catalog limit reached")
	}
	if !legacyApplied {
		if op.Amount < 0 && op.Amount < -*balance {
			if op.Currency == "ep" {
				return false, ErrInsufficientEP
			}
			return false, ErrInsufficientGold
		}
		if op.Amount > 0 && *balance > int(^uint(0)>>1)-op.Amount {
			return false, errors.New("casino return would overflow")
		}
		*balance += op.Amount
	}
	if *heads == nil {
		*heads = make(map[string]CasinoWalletCheckpoint)
	}
	(*heads)[op.TableID] = CasinoWalletCheckpoint{Version: op.TableVersion, ID: op.ID, Fingerprint: op.Fingerprint}
	return !legacyApplied, nil
}
