package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// One immutable receipt per decided ranked match. This small disk outbox shares
// the character journal's durable volume, not Mongo availability or tick memory.
type PvPResultReceipt struct {
	MatchID  string       `json:"matchId"`
	Profiles []PvPProfile `json:"profiles"`
}

type PvPResultJournal struct {
	dir string
	mu  sync.Mutex
}

type arenaJournalEnvelope struct {
	Payload  json.RawMessage `json:"payload"`
	Checksum string          `json:"checksum"`
}

const maxArenaReceiptBytes = 1 << 20

func (j *PvPResultJournal) syncDirectory() error {
	dir, err := os.Open(j.dir)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func OpenPvPResultJournal(dir string) (*PvPResultJournal, error) {
	if dir == "" {
		return nil, errors.New("arena journal directory required")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return &PvPResultJournal{dir: dir}, nil
}

func (j *PvPResultJournal) filename(id string) string {
	hash := sha256.Sum256([]byte(id))
	return filepath.Join(j.dir, hex.EncodeToString(hash[:])+".json")
}

func validatePvPReceipt(receipt PvPResultReceipt) error {
	if receipt.MatchID == "" || len(receipt.Profiles) == 0 || len(receipt.Profiles) > 4 {
		return errors.New("invalid arena receipt")
	}
	seen := map[string]bool{}
	for _, p := range receipt.Profiles {
		if p.PlayerID == "" || seen[p.PlayerID] || p.Revision <= 0 || p.LastMatchID != receipt.MatchID || p.UpdatedAt.IsZero() {
			return errors.New("invalid arena receipt profile")
		}
		seen[p.PlayerID] = true
	}
	return nil
}

func (j *PvPResultJournal) Write(receipt PvPResultReceipt) error {
	if err := validatePvPReceipt(receipt); err != nil {
		return err
	}
	payload, err := json.Marshal(receipt)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(payload)
	data, err := json.Marshal(arenaJournalEnvelope{Payload: payload, Checksum: hex.EncodeToString(digest[:])})
	if err != nil {
		return err
	}
	if len(data) > maxArenaReceiptBytes {
		return errors.New("oversized arena receipt")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	name := j.filename(receipt.MatchID)
	if existing, err := readArenaReceiptFile(name); err == nil {
		if string(existing) != string(data) {
			return errors.New("conflicting arena receipt")
		}
		return j.syncDirectory()
	} else if !os.IsNotExist(err) {
		return err
	}
	f, err := os.CreateTemp(j.dir, ".arena-pending-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name()) // Only this write's own uncommitted temporary file.
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = os.Rename(f.Name(), name); err != nil {
		return err
	}
	return j.syncDirectory()
}

func readArenaReceiptFile(name string) ([]byte, error) {
	info, err := os.Lstat(name)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxArenaReceiptBytes {
		return nil, errors.New("invalid arena receipt file")
	}
	f, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	data, readErr := io.ReadAll(io.LimitReader(f, maxArenaReceiptBytes+1))
	closeErr := f.Close()
	if err := errors.Join(readErr, closeErr); err != nil {
		return nil, err
	}
	if len(data) > maxArenaReceiptBytes {
		return nil, errors.New("oversized arena receipt")
	}
	return data, nil
}

// Pending loads at most limit immutable results. Directory reads are chunked;
// an outage must not make every retry allocate/decode the whole disk backlog.
// Revisions protect full-profile snapshots across batches read out of order.
func (j *PvPResultJournal) Pending(limit int) ([]PvPResultReceipt, error) {
	if limit < 1 || limit > 100 {
		return nil, errors.New("arena retry batch must contain 1 to 100 results")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	dir, err := os.Open(j.dir)
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	var receipts []PvPResultReceipt
	for len(receipts) < limit {
		entries, err := dir.ReadDir(64)
		if err != nil && len(entries) == 0 {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}
			data, err := readArenaReceiptFile(filepath.Join(j.dir, entry.Name()))
			if err != nil {
				return nil, err
			}
			var envelope arenaJournalEnvelope
			if err = json.Unmarshal(data, &envelope); err != nil {
				return nil, err
			}
			digest := sha256.Sum256(envelope.Payload)
			if hex.EncodeToString(digest[:]) != envelope.Checksum {
				return nil, errors.New("arena receipt checksum mismatch")
			}
			var receipt PvPResultReceipt
			if err = json.Unmarshal(envelope.Payload, &receipt); err != nil {
				return nil, err
			}
			if err = validatePvPReceipt(receipt); err != nil {
				return nil, err
			}
			if filepath.Base(j.filename(receipt.MatchID)) != entry.Name() {
				return nil, errors.New("arena receipt identity mismatch")
			}
			receipts = append(receipts, receipt)
			if len(receipts) == limit {
				break
			}
		}
	}
	// Full snapshots plus monotonic revisions also tolerate replay out of order.
	sort.Slice(receipts, func(a, b int) bool {
		return receipts[a].Profiles[0].UpdatedAt.Before(receipts[b].Profiles[0].UpdatedAt)
	})
	return receipts, nil
}

func (j *PvPResultJournal) Acknowledge(matchID string) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if err := os.Remove(j.filename(matchID)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return j.syncDirectory()
}

func (db *DB) CommitPvPReceipt(receipt PvPResultReceipt) error {
	if err := validatePvPReceipt(receipt); err != nil {
		return err
	}
	for _, profile := range receipt.Profiles {
		if err := db.SavePvPProfile(profile); err != nil {
			return err
		}
	}
	return nil
}
