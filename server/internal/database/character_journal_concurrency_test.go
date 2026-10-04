package database

import (
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCharacterJournalDifferentShardDoesNotWaitForBlockedAccount(t *testing.T) {
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	blocked := "blocked-owner"
	other := ""
	for i := 0; i < 1000; i++ {
		candidate := fmt.Sprintf("other-owner-%d", i)
		if journal.accountMutex(candidate) != journal.accountMutex(blocked) {
			other = candidate
			break
		}
	}
	if other == "" {
		t.Fatal("could not find distinct journal shards")
	}
	lock := journal.accountMutex(blocked)
	lock.Lock() // Model a stalled account's filesystem operation, not stalled DB IO.
	var once sync.Once
	unblock := func() { once.Do(lock.Unlock) }
	defer unblock()
	blockedDone := make(chan error, 1)
	go func() {
		_, err := journal.Write(blocked, &Character{Name: blocked, Gold: 17})
		blockedDone <- err
	}()
	otherDone := make(chan error, 1)
	go func() {
		saved, err := journal.Write(other, &Character{Name: other, Gold: 43})
		if err == nil {
			var actual *PendingCharacterSave
			actual, err = journal.Read(other)
			if err == nil && (actual == nil || actual.SaveID != saved.SaveID) {
				err = fmt.Errorf("unrelated account lost its saved image")
			}
			if err == nil {
				err = journal.Acknowledge(other, saved.SaveID)
			}
		}
		otherDone <- err
	}()
	select {
	case err := <-otherDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("another shard's write/read/ack waited for the blocked account")
	}
	select {
	case <-blockedDone:
		t.Fatal("blocked account bypassed its filesystem lock")
	default:
	}
	unblock()
	select {
	case err := <-blockedDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("unblocked account did not finish")
	}
}

func TestCharacterJournalDiscoverySelectsCanonicalAccountShard(t *testing.T) {
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 1000; i++ {
		username := fmt.Sprintf("../account-%d", i)
		lock, err := journal.pendingFileMutex(filepath.Base(journal.filename(username)))
		if err != nil || lock != journal.accountMutex(username) {
			t.Fatal("discovery and account operations disagree about locking", username, err)
		}
	}
	for _, name := range []string{"bad.bson", strings.Repeat("0", 64), strings.Repeat("z", 64) + ".bson", strings.Repeat("A", 64) + ".bson", "../" + strings.Repeat("0", 64) + ".bson"} {
		if _, err := journal.pendingFileMutex(name); err == nil {
			t.Fatal("noncanonical filename admitted", name)
		}
	}
}

func TestCharacterJournalConcurrentOldAckAndNewWritePreserveLatest(t *testing.T) {
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	previous, err := journal.Write("owner", &Character{Name: "owner", Gold: 1000})
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 50; i++ {
		start := make(chan struct{})
		ackDone := make(chan error, 1)
		type writeResult struct {
			save *PendingCharacterSave
			err  error
		}
		writeDone := make(chan writeResult, 1)
		oldID := previous.SaveID
		go func() {
			<-start
			ackDone <- journal.Acknowledge("owner", oldID)
		}()
		gold := 1000 + i
		go func() {
			<-start
			save, err := journal.Write("owner", &Character{Name: "owner", Gold: gold})
			writeDone <- writeResult{save, err}
		}()
		close(start)
		result := <-writeDone
		ackErr := <-ackDone
		if result.err != nil || ackErr != nil {
			t.Fatal("concurrent filesystem operation failed", result.err, ackErr)
		}
		pending, err := journal.Read("owner")
		if err != nil || pending == nil || pending.SaveID != result.save.SaveID {
			t.Fatal("racing old acknowledgement deleted newer snapshot", i, err)
		}
		character, err := pending.Character()
		if err != nil || character.Gold != gold {
			t.Fatal("racing acknowledgement changed saved contents", i, err)
		}
		previous = result.save
	}
}

func TestCharacterJournalConcurrentDiscoveryAndStaleAcknowledgements(t *testing.T) {
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	const accounts, saves = 20, 5
	want := make([]*Character, accounts)
	latest := make([]string, accounts)
	errors := make(chan error, accounts+1)
	stop := make(chan struct{})
	scanDone := make(chan struct{})
	go func() {
		defer close(scanDone)
		for {
			if _, err := journal.PendingUsers(); err != nil {
				errors <- err
				return
			}
			select {
			case <-stop:
				return
			case <-time.After(time.Millisecond):
			}
		}
	}()
	var workers sync.WaitGroup
	for account := 0; account < accounts; account++ {
		workers.Add(1)
		go func(account int) {
			defer workers.Done()
			username := fmt.Sprintf("owner-%d", account)
			previous := ""
			for save := 1; save <= saves; save++ {
				character := &Character{Name: username, Gold: 1000 + save, EP: 43,
					GroundAccountOrdinal: int64(save), GroundAccountOperationID: fmt.Sprintf("ground-%d", save), GroundAccountFingerprint: strings.Repeat("a", 64),
					CasinoWalletCheckpoints: map[string]CasinoWalletCheckpoint{"table": {Version: int64(save), ID: fmt.Sprintf("casino-%d", save), Fingerprint: strings.Repeat("b", 64)}},
					GoldCreditReceipts:      map[string]int{"legacy": 9}, EPCasinoReceipts: map[string]int{"legacy": 3}}
				pending, err := journal.Write(username, character)
				if err != nil {
					errors <- err
					return
				}
				if previous != "" {
					if err := journal.Acknowledge(username, previous); err != nil {
						errors <- err
						return
					}
				}
				actual, err := journal.Read(username)
				if err != nil || actual == nil || actual.SaveID != pending.SaveID {
					errors <- fmt.Errorf("newest image lost during stale acknowledgement: %s: %v", username, err)
					return
				}
				previous = pending.SaveID
				want[account], latest[account] = character, pending.SaveID
			}
		}(account)
	}
	workers.Wait()
	close(stop)
	<-scanDone
	close(errors)
	for err := range errors {
		t.Error(err)
	}
	if t.Failed() {
		return
	}
	reopened, err := OpenCharacterSaveJournal(journal.dir)
	if err != nil {
		t.Fatal(err)
	}
	users, err := reopened.PendingUsers()
	if err != nil || len(users) != accounts {
		t.Fatal("reopen discovery lost accounts", len(users), err)
	}
	for account, character := range want {
		pending, err := reopened.Read(character.Name)
		if err != nil || pending == nil || pending.SaveID != latest[account] {
			t.Fatal("reopen changed save identity", account, err)
		}
		actual, err := pending.Character()
		if err != nil || !reflect.DeepEqual(actual, character) {
			t.Fatal("reopen changed wallet, checkpoints or legacy receipts", account, err)
		}
		if err := reopened.Acknowledge(character.Name, pending.SaveID); err != nil {
			t.Fatal(err)
		}
	}
	if users, err := reopened.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("latest acknowledgements did not clear confirmed records", users, err)
	}
}
