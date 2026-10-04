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
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const characterJournalVersion = 1
const maxCharacterJournalBytes = 16 << 20
const characterJournalLockShards = 64

// PendingCharacterSave is detached from the live entity. One durable file per
// account always contains the newest attempted complete character snapshot.
type PendingCharacterSave struct {
	Version   int                `bson:"version"`
	AccountID primitive.ObjectID `bson:"account_id,omitempty"`
	Username  string             `bson:"username"`
	SaveID    string             `bson:"save_id"`
	Payload   []byte             `bson:"payload"`
	Checksum  []byte             `bson:"checksum"`
}

func (save *PendingCharacterSave) Character() (*Character, error) {
	var character Character
	if err := bson.Unmarshal(save.Payload, &character); err != nil {
		return nil, err
	}
	if character.Name == "" {
		return nil, errors.New("journal character name missing")
	}
	character.AccountID = save.AccountID
	return &character, nil
}

type CharacterSaveJournal struct {
	dir string
	// Fixed-size account shards serialize write/read/ack filesystem operations,
	// never database IO. Hash collisions may serialize unrelated accounts, but
	// a slow save no longer holds a single process-wide journal lock.
	accountLocks [characterJournalLockShards]sync.Mutex
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

func (journal *CharacterSaveJournal) accountMutex(username string) *sync.Mutex {
	digest := sha256.Sum256([]byte(username))
	return &journal.accountLocks[int(digest[0])%characterJournalLockShards]
}

// Discovery has only the filename, not the account identity. Select exactly
// the same shard as accountMutex before inspecting a record that can be
// replaced or acknowledged concurrently. Malformed names still fail closed.
func (journal *CharacterSaveJournal) pendingFileMutex(name string) (*sync.Mutex, error) {
	encoded := strings.TrimSuffix(name, ".bson")
	if len(encoded) != sha256.Size*2 || encoded+".bson" != name {
		return nil, fmt.Errorf("unexpected character journal entry %q", name)
	}
	digest, err := hex.DecodeString(encoded)
	if err != nil || hex.EncodeToString(digest) != encoded {
		return nil, fmt.Errorf("unexpected character journal entry %q", name)
	}
	return &journal.accountLocks[int(digest[0])%characterJournalLockShards], nil
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
	return journal.write(primitive.NilObjectID, username, character)
}

// WriteForAccount binds replay to the existing Mongo account identity, not to a
// reusable username. Legacy writes remain readable during the staged rollout;
// an unbound record cannot be upgraded by looking up whoever now owns its name.
func (journal *CharacterSaveJournal) WriteForAccount(accountID primitive.ObjectID, username string, character *Character) (*PendingCharacterSave, error) {
	if accountID.IsZero() {
		return nil, errors.New("character journal account identity required")
	}
	return journal.write(accountID, username, character)
}

func (journal *CharacterSaveJournal) write(accountID primitive.ObjectID, username string, character *Character) (*PendingCharacterSave, error) {
	if username == "" || character == nil || character.Name == "" {
		return nil, errors.New("invalid character journal save")
	}
	if !character.AccountID.IsZero() && character.AccountID != accountID {
		return nil, errors.New("character journal load identity conflict")
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
	if !accountID.IsZero() {
		save.Version, save.AccountID = 2, accountID
	}
	encoded, err := bson.Marshal(save)
	if err != nil {
		return nil, err
	}
	if len(encoded) > maxCharacterJournalBytes {
		return nil, errors.New("character journal snapshot exceeds size limit")
	}
	lock := journal.accountMutex(username)
	lock.Lock()
	defer lock.Unlock()
	// A newer live snapshot may replace only the same account generation's
	// pending work. Legacy retry must not erase a bound rejection before the
	// dispatcher can enforce the identity fence.
	existing, err := journal.readFile(journal.filename(username))
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.AccountID != accountID {
		return nil, errors.New("pending character journal account identity conflict")
	}
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
	validVersion := (save.Version == characterJournalVersion && save.AccountID.IsZero()) || (save.Version == 2 && !save.AccountID.IsZero())
	if !validVersion || save.Username == "" || len(save.SaveID) != 32 ||
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
	lock := journal.accountMutex(username)
	lock.Lock()
	defer lock.Unlock()
	return journal.readFile(journal.filename(username))
}

// Review-only observation: existence is not validation of the pending save or
// proof that account writers are drained. Do not read/export the character body.
func (journal *CharacterSaveJournal) HasPendingAccountSave(username string) (bool, error) {
	if journal == nil || username == "" {
		return false, errors.New("pending save observation unavailable")
	}
	journal.mu.Lock()
	defer journal.mu.Unlock()
	if info, err := os.Stat(journal.dir); err != nil || !info.IsDir() {
		return false, errors.New("pending save directory unavailable")
	}
	info, err := os.Lstat(journal.filename(username))
	if errors.Is(err, os.ErrNotExist) {
		if info, err := os.Stat(journal.dir); err != nil || !info.IsDir() {
			return false, errors.New("pending save directory unavailable")
		}
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxCharacterJournalBytes {
		return false, errors.New("pending save requires separate operator handling")
	}
	return true, nil
}

func (journal *CharacterSaveJournal) PendingUsers() ([]string, error) {
	// This is discovery, not an atomic directory snapshot. A concurrently
	// acknowledged record may disappear; a new record is found on the next scan.
	entries, err := os.ReadDir(journal.dir)
	if err != nil {
		return nil, err
	}
	var users []string
	for _, entry := range entries {
		// Ranked/guild receipts and activity events share this durable volume but have their own readers.
		// Only its real directory is delegated; files, links and unknown entries
		// must still fail closed. Dedicated readers validate/recover their own receipts.
		if (entry.Name() == "arena-results" || entry.Name() == "admin-activity" || entry.Name() == "guild-clears") && entry.IsDir() {
			continue
		}
		if strings.HasPrefix(entry.Name(), ".pending-") {
			continue
		}
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".bson") {
			return nil, fmt.Errorf("unexpected character journal entry %q", entry.Name())
		}
		lock, err := journal.pendingFileMutex(entry.Name())
		if err != nil {
			return nil, err
		}
		lock.Lock()
		save, err := journal.readFile(filepath.Join(journal.dir, entry.Name()))
		lock.Unlock()
		if err != nil {
			return nil, err
		}
		if save != nil {
			users = append(users, save.Username)
		}
	}
	return users, nil
}

// Startup only, before database migrations or admission and with no concurrent
// writer. Legacy records need reconciliation with their original recovery point,
// not a guess using today's account lookup. Never rewrite or discard them here.
func (journal *CharacterSaveJournal) ValidateAccountBoundRecords() error {
	users, err := journal.PendingUsers()
	if err != nil {
		return err
	}
	for _, username := range users {
		save, err := journal.Read(username)
		if err != nil {
			return err
		}
		if save == nil || save.Version != 2 || save.AccountID.IsZero() {
			return errors.New("legacy character journal requires controlled transition before database migration")
		}
	}
	return nil
}

// A delayed acknowledgement may never remove a newer queued snapshot.
func (journal *CharacterSaveJournal) Acknowledge(username, saveID string) error {
	lock := journal.accountMutex(username)
	lock.Lock()
	defer lock.Unlock()
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
