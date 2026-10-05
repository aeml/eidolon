package main

import (
	"errors"
	"reflect"
	"testing"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type identityCommitter struct {
	*testCharacterCommitter
	account    primitive.ObjectID
	boundCalls int
	failBound  error
}

func (c *identityCommitter) CommitBoundCharacterSave(account primitive.ObjectID, _ string, character *database.Character, id string) error {
	c.boundCalls++
	c.account = account
	if c.failBound != nil {
		return c.failBound
	}
	c.saved = character
	c.ids = append(c.ids, id)
	return nil
}

func TestCharacterBoundReplayNeverDowngradesAndRetainsRejectedSave(t *testing.T) {
	_, old := setupCharacterJournalTest(t)
	account := primitive.NewObjectID()
	save, err := characterSaveJournal.WriteForAccount(account, "owner", &database.Character{Name: "hero", Gold: 123, EP: 7})
	if err != nil {
		t.Fatal(err)
	}
	if err := commitPendingCharacterSave(save); err == nil || len(old.ids) != 0 {
		t.Fatal("bound record downgraded to username-only commit")
	}
	if actual, err := characterSaveJournal.Read("owner"); err != nil || !reflect.DeepEqual(actual, save) {
		t.Fatal("unsupported committer lost evidence", err)
	}
	bound := &identityCommitter{testCharacterCommitter: old, failBound: errors.New("original account absent")}
	characterSaveCommitter = bound
	if err := commitPendingCharacterSave(save); err == nil || bound.account != account || bound.boundCalls != 1 || len(old.ids) != 0 {
		t.Fatal("bound failure was hidden or retried without identity")
	}
	if actual, err := characterSaveJournal.Read("owner"); err != nil || !reflect.DeepEqual(actual, save) {
		t.Fatal("rejected commit erased evidence", err)
	}
	bound.failBound = nil
	if err := commitPendingCharacterSave(save); err != nil || bound.saved.Gold != 123 || bound.saved.EP != 7 || len(old.ids) != 1 || old.ids[0] != save.SaveID {
		t.Fatal("bound retry lost exact outcome", err)
	}
	if actual, err := characterSaveJournal.Read("owner"); err != nil || actual != nil {
		t.Fatal("confirmed bound save not acknowledged", err)
	}
}
