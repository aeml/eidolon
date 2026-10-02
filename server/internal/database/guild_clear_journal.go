package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Immutable, server-produced qualifying guild results for one completed run.
// No wallets, character snapshots, auth payloads or replay-time membership.
type GuildClearReceipt struct {
	InstanceID string            `json:"instanceId"`
	Runs       []GuildDungeonRun `json:"runs"`
}

type GuildClearJournal struct {
	dir string
	mu  sync.Mutex // Filesystem only; never held during Mongo/world/session IO.
}

type guildClearEnvelope struct {
	Payload  json.RawMessage `json:"payload"`
	Checksum string          `json:"checksum"`
}

const maxGuildClearBytes = 32 << 10

func validateGuildClear(receipt GuildClearReceipt) error {
	if receipt.InstanceID == "" || len(receipt.InstanceID) > 160 || len(receipt.Runs) < 1 || len(receipt.Runs) > 5 {
		return errors.New("invalid guild clear identity or result count")
	}
	seen := make(map[string]bool)
	members := 0
	first := receipt.Runs[0]
	for _, run := range receipt.Runs {
		if run.GuildID == "" || len(run.GuildID) > 80 || seen[run.GuildID] || len(run.GuildName) > 160 || len(run.GuildTag) > 16 ||
			run.MemberCount < 2 || run.MemberCount > 10 || run.RunLevel < 1 || run.RunLevel > 100 ||
			run.DungeonType == "" || len(run.DungeonType) > 80 || run.DurationMS < 1 || run.DurationMS > 86400000 ||
			run.FirstClearAt.IsZero() || run.Season != CurrentGuildDungeonSeason(run.FirstClearAt) ||
			(run.Difficulty != "normal" && run.Difficulty != "heroic" && run.Difficulty != "mythic") {
			return errors.New("invalid recorded guild clear")
		}
		members += run.MemberCount
		if members > 10 || run.DungeonType != first.DungeonType || run.Difficulty != first.Difficulty || run.RunLevel != first.RunLevel ||
			run.DurationMS != first.DurationMS || !run.FirstClearAt.Equal(first.FirstClearAt) {
			return errors.New("inconsistent guild clear groups")
		}
		seen[run.GuildID] = true
	}
	return nil
}

func OpenGuildClearJournal(dir string) (*GuildClearJournal, error) {
	if dir == "" {
		return nil, errors.New("guild clear journal directory required")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return &GuildClearJournal{dir: dir}, nil
}

func (j *GuildClearJournal) filename(id string) string {
	digest := sha256.Sum256([]byte(id))
	return filepath.Join(j.dir, hex.EncodeToString(digest[:])+".json")
}

func (j *GuildClearJournal) syncDirectory() error {
	f, err := os.Open(j.dir)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}

func readGuildClearFile(name string) ([]byte, error) {
	info, err := os.Lstat(name)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxGuildClearBytes {
		return nil, errors.New("invalid guild clear file")
	}
	f, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	data, readErr := io.ReadAll(io.LimitReader(f, maxGuildClearBytes+1))
	closeErr := f.Close()
	if err := errors.Join(readErr, closeErr); err != nil {
		return nil, err
	}
	if len(data) > maxGuildClearBytes {
		return nil, errors.New("oversized guild clear file")
	}
	return data, nil
}

func (j *GuildClearJournal) Write(receipt GuildClearReceipt) error {
	if err := validateGuildClear(receipt); err != nil {
		return err
	}
	payload, err := json.Marshal(receipt)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(payload)
	data, err := json.Marshal(guildClearEnvelope{Payload: payload, Checksum: hex.EncodeToString(digest[:])})
	if err != nil {
		return err
	}
	if len(data) > maxGuildClearBytes {
		return errors.New("oversized guild clear receipt")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	name := j.filename(receipt.InstanceID)
	if existing, err := readGuildClearFile(name); err == nil {
		if string(existing) != string(data) {
			return errors.New("conflicting guild clear receipt")
		}
		return j.syncDirectory()
	} else if !os.IsNotExist(err) {
		return err
	}
	f, err := os.CreateTemp(j.dir, ".guild-clear-pending-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name()) // Only this write's uncommitted temporary file.
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err := errors.Join(err, closeErr); err != nil {
		return err
	}
	if err := os.Rename(f.Name(), name); err != nil {
		return err
	}
	return j.syncDirectory()
}

func (j *GuildClearJournal) Pending(limit int) ([]GuildClearReceipt, error) {
	if limit < 1 || limit > 100 {
		return nil, errors.New("guild clear retry batch must contain 1 to 100 receipts")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	dir, err := os.Open(j.dir)
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	var receipts []GuildClearReceipt
	for len(receipts) < limit {
		entries, err := dir.ReadDir(32)
		if err != nil && len(entries) == 0 {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		for _, entry := range entries {
			if strings.HasPrefix(entry.Name(), ".guild-clear-pending-") && !entry.IsDir() {
				continue
			}
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
				return nil, errors.New("unexpected guild clear journal entry")
			}
			data, err := readGuildClearFile(filepath.Join(j.dir, entry.Name()))
			if err != nil {
				return nil, err
			}
			var envelope guildClearEnvelope
			if err := json.Unmarshal(data, &envelope); err != nil {
				return nil, err
			}
			digest := sha256.Sum256(envelope.Payload)
			if hex.EncodeToString(digest[:]) != envelope.Checksum {
				return nil, errors.New("guild clear checksum mismatch")
			}
			var receipt GuildClearReceipt
			if err := json.Unmarshal(envelope.Payload, &receipt); err != nil {
				return nil, err
			}
			if err := validateGuildClear(receipt); err != nil {
				return nil, err
			}
			if filepath.Base(j.filename(receipt.InstanceID)) != entry.Name() {
				return nil, errors.New("guild clear identity mismatch")
			}
			receipts = append(receipts, receipt)
			if len(receipts) == limit {
				break
			}
		}
	}
	return receipts, nil
}

func (j *GuildClearJournal) Acknowledge(instanceID string) error {
	if instanceID == "" {
		return errors.New("guild clear identity required")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	if err := os.Remove(j.filename(instanceID)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return j.syncDirectory()
}
