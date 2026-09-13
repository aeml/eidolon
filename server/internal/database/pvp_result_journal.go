package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	j.mu.Lock()
	defer j.mu.Unlock()
	name := j.filename(receipt.MatchID)
	if existing, err := os.ReadFile(name); err == nil {
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

func (j *PvPResultJournal) Pending() ([]PvPResultReceipt, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	entries, err := os.ReadDir(j.dir)
	if err != nil {
		return nil, err
	}
	var receipts []PvPResultReceipt
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		if info.Size() > 1<<20 {
			return nil, errors.New("oversized arena receipt")
		}
		data, err := os.ReadFile(filepath.Join(j.dir, entry.Name()))
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
