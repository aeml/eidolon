package database

import (
	"errors"
	"os"
)

// CheckAccountBoundCharacterSaveJournal is read-only. The old writer must be
// stopped before deployment relies on this result; startup independently checks
// again. Missing directories are valid for a fresh installation, not created.
func CheckAccountBoundCharacterSaveJournal(dir string) error {
	if dir == "" {
		return errors.New("character journal directory is required")
	}
	info, err := os.Lstat(dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return errors.New("character journal must be a real directory")
	}
	journal := &CharacterSaveJournal{dir: dir}
	return journal.ValidateAccountBoundRecords()
}
