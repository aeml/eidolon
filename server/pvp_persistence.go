package main

import (
	"errors"
	"sync"

	"eidolon-server/internal/arena"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

var arenaResultJournal *database.PvPResultJournal
var arenaReplayMu sync.Mutex

const arenaReplayBatchSize = 32

var errArenaReplayPending = errors.New("arena result backlog remains pending")

func arenaResultReceipt(result game.PvPMatchResult) database.PvPResultReceipt {
	receipt := database.PvPResultReceipt{MatchID: result.MatchID}
	for _, p := range result.Profiles {
		season := p.Season
		if season == "" {
			season = database.CurrentArenaSeason(p.UpdatedAt)
		}
		receipt.Profiles = append(receipt.Profiles, database.PvPProfile{PlayerID: p.PlayerID,
			SeasonVictories: p.SeasonVictories, SeasonHistory: append([]arena.SeasonRecord(nil), p.SeasonHistory...),
			LastResult: p.LastResult, RewardState: arena.CloneRewardState(p.RewardState),
			Revision: p.Revision, LastMatchID: result.MatchID, Season: season, Rating: p.Rating, Wins: p.Wins,
			Losses: p.Losses, Honor: p.Honor, SeasonPoints: p.SeasonPoints, UpdatedAt: p.UpdatedAt})
	}
	return receipt
}

// Invoked before the game commits profiles or releases ranked participants.
// Filesystem-only: do not acquire gameplay locks or call Mongo from this hook.
func recordPvPResult(result game.PvPMatchResult) error {
	if len(result.Profiles) == 0 {
		return nil
	}
	if arenaResultJournal == nil {
		return errors.New("arena result journal unavailable")
	}
	return arenaResultJournal.Write(arenaResultReceipt(result))
}

func commitPvPResult(result game.PvPMatchResult) error {
	if len(result.Profiles) == 0 {
		return nil
	}
	arenaReplayMu.Lock()
	defer arenaReplayMu.Unlock()
	if err := db.CommitPvPReceipt(arenaResultReceipt(result)); err != nil {
		return err
	}
	if arenaResultJournal != nil {
		return arenaResultJournal.Acknowledge(result.MatchID)
	}
	return nil
}

func retryPendingPvPResults() error {
	if arenaResultJournal == nil {
		return nil
	}
	arenaReplayMu.Lock()
	defer arenaReplayMu.Unlock()
	return replayPvPResultBatch(arenaResultJournal, db.CommitPvPReceipt)
}

// One ordinary pass commits at most32 receipts. Read one additional result as
// an honest pending marker; never roll over/hydrate a profile while any decided
// result could still be owed. The shared periodic coordinator requests again.
func replayPvPResultBatch(journal *database.PvPResultJournal, commit func(database.PvPResultReceipt) error) error {
	receipts, err := journal.Pending(arenaReplayBatchSize + 1)
	if err != nil {
		return err
	}
	more := len(receipts) > arenaReplayBatchSize
	if more {
		receipts = receipts[:arenaReplayBatchSize]
	}
	for _, receipt := range receipts {
		if err := commit(receipt); err != nil {
			return err
		}
		if err := journal.Acknowledge(receipt.MatchID); err != nil {
			return err
		}
	}
	if more {
		return errArenaReplayPending
	}
	return nil
}

// Startup must finish all decided results before allowing potentially stale
// logins, but uses the same bounded decoder/commit batches. Any real read/write
// failure still refuses startup; a larger healthy backlog is not an outage.
func recoverPvPResultsAtStartup() error {
	for {
		err := retryPendingPvPResults()
		if !errors.Is(err, errArenaReplayPending) {
			return err
		}
	}
}
