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

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// The private outbox shares the existing durable save volume. It contains only
// allowlisted activity fields, never auth requests or character snapshots.
type AdminActivityJournal struct {
	dir string
	mu  sync.Mutex
}
type adminActivityEnvelope struct {
	Payload  []byte `json:"payload"`
	Checksum string `json:"checksum"`
}

func OpenAdminActivityJournal(dir string) (*AdminActivityJournal, error) {
	if dir == "" {
		return nil, errors.New("activity journal directory required")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return &AdminActivityJournal{dir: dir}, nil
}

func (j *AdminActivityJournal) syncDirectory() error {
	f, err := os.Open(j.dir)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}

func (j *AdminActivityJournal) filename(id primitive.ObjectID) string {
	return filepath.Join(j.dir, id.Hex()+".json")
}

func (j *AdminActivityJournal) Write(event AdminActivity) error {
	if err := ValidateAdminActivity(event); err != nil {
		return err
	}
	// BSON includes private expiration metadata omitted from public JSON.
	payload, err := bson.Marshal(event)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(payload)
	data, err := json.Marshal(adminActivityEnvelope{Payload: payload, Checksum: hex.EncodeToString(digest[:])})
	if err != nil {
		return err
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	name := j.filename(event.ID)
	if existing, err := os.ReadFile(name); err == nil {
		if string(existing) != string(data) {
			return errors.New("conflicting activity journal event")
		}
		return j.syncDirectory()
	} else if !os.IsNotExist(err) {
		return err
	}
	f, err := os.CreateTemp(j.dir, ".activity-pending-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name()) // Only our uncommitted temporary file.
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
	if err := os.Rename(f.Name(), name); err != nil {
		return err
	}
	return j.syncDirectory()
}

func (j *AdminActivityJournal) Pending(limit int) ([]AdminActivity, error) {
	if limit < 1 || limit > 100 {
		return nil, errors.New("activity retry batch must contain 1 to 100 events")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	dir, err := os.Open(j.dir)
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	// Read directory entries in bounded chunks; outages do not make every retry
	// allocate or decode the entire backlog. ObjectID order is not a dependency.
	var events []AdminActivity
	for {
		entries, err := dir.ReadDir(100)
		if err != nil && len(entries) == 0 {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		for _, entry := range entries {
			if strings.HasPrefix(entry.Name(), ".activity-pending-") && !entry.IsDir() {
				continue
			}
			if !strings.HasSuffix(entry.Name(), ".json") {
				return nil, errors.New("unexpected activity journal entry")
			}
			info, err := entry.Info()
			if err != nil {
				return nil, err
			}
			if !info.Mode().IsRegular() || info.Size() > 4096 {
				return nil, errors.New("invalid activity journal file")
			}
			data, err := os.ReadFile(filepath.Join(j.dir, entry.Name()))
			if err != nil {
				return nil, err
			}
			var envelope adminActivityEnvelope
			if err := json.Unmarshal(data, &envelope); err != nil {
				return nil, err
			}
			digest := sha256.Sum256(envelope.Payload)
			if hex.EncodeToString(digest[:]) != envelope.Checksum {
				return nil, errors.New("activity journal checksum mismatch")
			}
			var event AdminActivity
			if err := bson.Unmarshal(envelope.Payload, &event); err != nil {
				return nil, err
			}
			if err := ValidateAdminActivity(event); err != nil {
				return nil, err
			}
			if filepath.Base(j.filename(event.ID)) != entry.Name() {
				return nil, errors.New("activity journal identity mismatch")
			}
			events = append(events, event)
			if len(events) == limit {
				return events, nil
			}
		}
	}
	return events, nil
}

func (j *AdminActivityJournal) Acknowledge(id primitive.ObjectID) error {
	if id.IsZero() {
		return errors.New("activity identity required")
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	if err := os.Remove(j.filename(id)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return j.syncDirectory()
}
