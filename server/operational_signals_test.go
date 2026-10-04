package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/operations"
)

func resetOperationalMetricsForTest(t *testing.T) {
	t.Helper()
	operationalResults.Lock()
	previous := operationalResults.metrics
	operationalResults.metrics = operations.OperationalMetrics{}
	operationalResults.Unlock()
	t.Cleanup(func() {
		operationalResults.Lock()
		operationalResults.metrics = previous
		operationalResults.Unlock()
	})
}

func TestOperationalSignalsConcurrentSnapshotsAreCoherent(t *testing.T) {
	resetOperationalMetricsForTest(t)
	var workers sync.WaitGroup
	for index := 0; index < 8; index++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for call := 0; call < 100; call++ {
				recordOperationalResult(boundaryCasinoEP, errors.New("private-error-marker"), time.Microsecond)
				snapshot := operationalMetricsSnapshot()
				if snapshot.CasinoEP.Completed != snapshot.CasinoEP.Failed || snapshot.CasinoEP.TimedSamples != snapshot.CasinoEP.Completed || snapshot.CasinoEP.TotalMicros != snapshot.CasinoEP.Completed {
					t.Error("torn aggregate snapshot")
				}
			}
		}()
	}
	workers.Wait()
	recordOperationalResult(operationalBoundary(255), errors.New("private-error-marker"), time.Microsecond)
	snapshot := operationalMetricsSnapshot()
	if snapshot.CasinoEP.Completed != 800 || snapshot.CasinoEP.Failed != 800 || snapshot.CasinoGold.Completed != 0 ||
		snapshot.CasinoEP.TimedSamples != 800 || snapshot.CasinoEP.TotalMicros != 800 || snapshot.CasinoEP.MaxMicros != 1 {
		t.Fatalf("unknown label or race changed counters: %+v", snapshot)
	}
	encoded, _ := json.Marshal(snapshot)
	if strings.Contains(string(encoded), "private-error-marker") {
		t.Fatal("private error reached aggregate metrics")
	}
}

func TestOperationalSignalsRealJournalAndRecoveryFailureBoundaries(t *testing.T) {
	dir, committer := setupCharacterJournalTest(t)
	resetOperationalMetricsForTest(t)
	character := &database.Character{Name: "private-player-marker", Gold: 1234, EP: 83}
	// A missing owned directory forces real IO failure regardless of root access.
	if err := os.Rename(dir, dir+"-held"); err != nil {
		t.Fatal(err)
	}
	if err := persistCharacterSnapshot(character.Name, character); err == nil {
		t.Fatal("journal failure was hidden")
	}
	if len(committer.ids) != 0 {
		t.Fatal("instrumentation allowed commit before journal")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	committer.fail = errors.New("private-database-marker")
	if err := persistCharacterSnapshot(character.Name, character); err == nil {
		t.Fatal("database failure was hidden")
	}
	if err := retryPendingCharacterSaves(); err == nil {
		t.Fatal("recovery failure was hidden")
	}
	committer.fail = nil
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if committer.saved.Gold != 1234 || committer.saved.EP != 83 {
		t.Fatal("instrumentation altered recovered value")
	}
	snapshot := operationalMetricsSnapshot()
	if !operationalCountsMatch(snapshot.CharacterJournal, 2, 1) ||
		!operationalCountsMatch(snapshot.CharacterCommit, 3, 2) ||
		!operationalCountsMatch(snapshot.CharacterCleanup, 1, 0) ||
		!operationalCountsMatch(snapshot.CharacterRecovery, 2, 1) {
		t.Fatalf("wrong storage boundary counts: %+v", snapshot)
	}
	recorder := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return nil })(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	var response healthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || response.Operational != snapshot || recorder.Code != 200 {
		t.Fatal("health lost constant-time aggregate snapshot", err)
	}
	for _, private := range []string{"private-player-marker", "private-database-marker", dir, "\"gold\":", "\"ep\":", "\"username\":"} {
		if strings.Contains(recorder.Body.String(), private) {
			t.Fatal("private state reached public health")
		}
	}
}

type operationalCleanupFailureCommitter struct{ dir string }

func (committer operationalCleanupFailureCommitter) CommitCharacterSave(string, *database.Character, string) error {
	if err := os.Rename(committer.dir, committer.dir+"-held"); err != nil {
		return err
	}
	// A missing record is correctly treated as already acknowledged. Instead
	// substitute an owned file where the directory was: real ENOTDIR is an IO
	// failure, while the original receipt remains intact in the held directory.
	return os.WriteFile(committer.dir, []byte("owned cleanup failure fixture"), 0600)
}

func TestOperationalSignalsCleanupFailureDoesNotUndoConfirmedCommit(t *testing.T) {
	dir, _ := setupCharacterJournalTest(t)
	resetOperationalMetricsForTest(t)
	characterSaveCommitter = operationalCleanupFailureCommitter{dir: dir}
	if err := persistCharacterSnapshot("private-player-marker", &database.Character{Name: "private-player-marker", Gold: 1234}); err != nil {
		t.Fatal("instrumentation changed confirmed commit into a failed/refundable operation", err)
	}
	snapshot := operationalMetricsSnapshot()
	if !operationalCountsMatch(snapshot.CharacterCommit, 1, 0) || !operationalCountsMatch(snapshot.CharacterCleanup, 1, 1) {
		t.Fatalf("cleanup failure disappeared or became a database failure: %+v", snapshot)
	}
	if err := os.Remove(dir); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	pending, err := characterSaveJournal.Read("private-player-marker")
	if err != nil || pending == nil || len(failedCharacterSaves.users) != 0 {
		t.Fatal("pending cleanup must retain original replay proof without falsely marking confirmed value missing", err)
	}
}

func TestOperationalSignalsSeparateCurrencyAndRecordRejectedTransfers(t *testing.T) {
	resetOperationalMetricsForTest(t)
	// Invalid operations stop before any world/database access, but their returned
	// errors are still measured at the requested fixed wallet boundary.
	if err := applyCasinoGoldTransferLocked(database.BlackjackTransfer{}); err == nil {
		t.Fatal("invalid Gold operation accepted")
	}
	if err := applyCasinoEPTransferLocked(database.BlackjackTransfer{}); err == nil {
		t.Fatal("invalid EP operation accepted")
	}
	snapshot := operationalMetricsSnapshot()
	if !operationalCountsMatch(snapshot.CasinoGold, 1, 1) || !operationalCountsMatch(snapshot.CasinoEP, 1, 1) || snapshot.CharacterCommit.Completed != 0 {
		t.Fatalf("wallet boundaries mixed or invented a commit: %+v", snapshot)
	}
}

func operationalCountsMatch(counts operations.OutcomeCounts, completed, failed uint64) bool {
	return counts.Completed == completed && counts.Failed == failed &&
		counts.TimedSamples == completed && counts.MaxMicros <= counts.TotalMicros
}

func TestOperationalSignalsTimingIsBoundedAndDistinguishesUntimedCalls(t *testing.T) {
	resetOperationalMetricsForTest(t)
	recordOperationalResult(boundaryCharacterJournal, nil, 0)
	recordOperationalResult(boundaryCharacterJournal, errors.New("private-duration-marker"), 2500*time.Microsecond)
	recordOperationalResult(boundaryCharacterJournal, nil, -time.Microsecond)
	counts := operationalMetricsSnapshot().CharacterJournal
	if counts != (operations.OutcomeCounts{Completed: 3, Failed: 1, TimedSamples: 2, TotalMicros: 2500, MaxMicros: 2500}) {
		t.Fatal("zero, failed or invalid duration recorded incorrectly", counts)
	}
	operationalResults.Lock()
	operationalResults.metrics.CasinoGold = operations.OutcomeCounts{Completed: 1, TimedSamples: 1, TotalMicros: ^uint64(0) - 1, MaxMicros: 2}
	operationalResults.Unlock()
	recordOperationalResult(boundaryCasinoGold, nil, 2*time.Microsecond)
	counts = operationalMetricsSnapshot().CasinoGold
	if counts.TotalMicros != ^uint64(0) || counts.MaxMicros != 2 || counts.TimedSamples != 2 {
		t.Fatal("aggregate duration wrapped instead of saturating", counts)
	}
}

type operationalSlowCommitter struct{ inner characterCommitter }

func (committer operationalSlowCommitter) CommitCharacterSave(username string, character *database.Character, saveID string) error {
	time.Sleep(20 * time.Millisecond)
	return committer.inner.CommitCharacterSave(username, character, saveID)
}

func TestOperationalSignalsMeasureSlowCommitWithoutChangingSavedValue(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	resetOperationalMetricsForTest(t)
	characterSaveCommitter = operationalSlowCommitter{inner: committer}
	character := &database.Character{Name: "private-timed-player-marker", Gold: 1234, EP: 83}
	if err := persistCharacterSnapshot(character.Name, character); err != nil {
		t.Fatal(err)
	}
	counts := operationalMetricsSnapshot().CharacterCommit
	if !operationalCountsMatch(counts, 1, 0) || counts.TotalMicros < 5000 || counts.MaxMicros != counts.TotalMicros {
		t.Fatal("actual delayed commit was not timed", counts)
	}
	if committer.saved.Gold != 1234 || committer.saved.EP != 83 {
		t.Fatal("timing changed saved value")
	}
}
