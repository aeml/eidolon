package database

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"go.mongodb.org/mongo-driver/bson"
)

const characterJournalVersion = 1
const maxCharacterJournalBytes = 16 << 20

// PendingCharacterSave is detached from the live entity. One durable file per
// account always contains the newest attempted complete character snapshot.
type PendingCharacterSave struct {
	Version  int    `bson:"version"`
	Username string `bson:"username"`
	SaveID   string `bson:"save_id"`
	Payload  []byte `bson:"payload"`
	Checksum []byte `bson:"checksum"`
}

func (save *PendingCharacterSave) Character() (*Character, error) {
	var character Character
	if err := bson.Unmarshal(save.Payload, &character); err != nil {
		return nil, err
	}
	if character.Name == "" {
		return nil, errors.New("journal character name missing")
	}
	return &character, nil
}

type CharacterSaveJournal struct {
	dir string
	mu  sync.Mutex // Filesystem operations only; never held during database IO.
}

func OpenCharacterSaveJournal(dir string) (*CharacterSaveJournal, error) {
	if dir == "" {
		return nil, errors.New("character journal directory is required")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return &CharacterSaveJournal{dir: dir}, nil
}

func (journal *CharacterSaveJournal) filename(username string) string {
	digest := sha256.Sum256([]byte(username))
	return filepath.Join(journal.dir, hex.EncodeToString(digest[:])+".bson")
}

func (journal *CharacterSaveJournal) syncDirectory() error {
	dir, err := os.Open(journal.dir)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func (journal *CharacterSaveJournal) Write(username string, character *Character) (*PendingCharacterSave, error) {
	if username == "" || character == nil || character.Name == "" {
		return nil, errors.New("invalid character journal save")
	}
	payload, err := bson.Marshal(character)
	if err != nil {
		return nil, err
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return nil, err
	}
	digest := sha256.Sum256(payload)
	save := &PendingCharacterSave{Version: characterJournalVersion, Username: username,
		SaveID: hex.EncodeToString(id), Payload: payload, Checksum: digest[:]}
	encoded, err := bson.Marshal(save)
	if err != nil {
		return nil, err
	}
	if len(encoded) > maxCharacterJournalBytes {
		return nil, errors.New("character journal snapshot exceeds size limit")
	}
	journal.mu.Lock()
	defer journal.mu.Unlock()
	temporary, err := os.CreateTemp(journal.dir, ".pending-")
	if err != nil {
		return nil, err
	}
	defer os.Remove(temporary.Name()) // Only this attempt's uncommitted temporary file.
	if _, err = temporary.Write(encoded); err == nil {
		err = temporary.Sync()
	}
	closeErr := temporary.Close()
	if err != nil {
		return nil, err
	}
	if closeErr != nil {
		return nil, closeErr
	}
	if err := os.Rename(temporary.Name(), journal.filename(username)); err != nil {
		return nil, err
	}
	if err := journal.syncDirectory(); err != nil {
		return nil, err
	}
	return save, nil
}

func (journal *CharacterSaveJournal) readFile(name string) (*PendingCharacterSave, error) {
	info, err := os.Stat(name)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if info.Size() > maxCharacterJournalBytes {
		return nil, errors.New("oversized character journal file")
	}
	encoded, err := os.ReadFile(name)
	if err != nil {
		return nil, err
	}
	var save PendingCharacterSave
	if err := bson.Unmarshal(encoded, &save); err != nil {
		return nil, err
	}
	digest := sha256.Sum256(save.Payload)
	if save.Version != characterJournalVersion || save.Username == "" || len(save.SaveID) != 32 ||
		hex.EncodeToString(digest[:]) != hex.EncodeToString(save.Checksum) || journal.filename(save.Username) != name {
		return nil, errors.New("invalid or unsupported character journal record")
	}
	if _, err := hex.DecodeString(save.SaveID); err != nil {
		return nil, errors.New("invalid journal save identity")
	}
	if _, err := save.Character(); err != nil {
		return nil, err
	}
	return &save, nil
}

func (journal *CharacterSaveJournal) Read(username string) (*PendingCharacterSave, error) {
	journal.mu.Lock()
	defer journal.mu.Unlock()
	return journal.readFile(journal.filename(username))
}

func (journal *CharacterSaveJournal) PendingUsers() ([]string, error) {
	journal.mu.Lock()
	defer journal.mu.Unlock()
	entries, err := os.ReadDir(journal.dir)
	if err != nil {
		return nil, err
	}
	var users []string
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".pending-") {
			continue
		}
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".bson") {
			return nil, fmt.Errorf("unexpected character journal entry %q", entry.Name())
		}
		save, err := journal.readFile(filepath.Join(journal.dir, entry.Name()))
		if err != nil {
			return nil, err
		}
		if save != nil {
			users = append(users, save.Username)
		}
	}
	return users, nil
}

// A delayed acknowledgement may never remove a newer queued snapshot.
func (journal *CharacterSaveJournal) Acknowledge(username, saveID string) error {
	journal.mu.Lock()
	defer journal.mu.Unlock()
	save, err := journal.readFile(journal.filename(username))
	if err != nil || save == nil {
		return err
	}
	if save.SaveID != saveID {
		return nil
	}
	if err := os.Remove(journal.filename(username)); err != nil {
		return err
	}
	return journal.syncDirectory()
}
