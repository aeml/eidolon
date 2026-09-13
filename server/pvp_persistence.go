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

func arenaResultReceipt(result game.PvPMatchResult) database.PvPResultReceipt {
	receipt := database.PvPResultReceipt{MatchID: result.MatchID}
	for _, p := range result.Profiles {
		season := p.Season
		if season == "" {
			season = database.CurrentArenaSeason(p.UpdatedAt)
		}
		receipt.Profiles = append(receipt.Profiles, database.PvPProfile{PlayerID: p.PlayerID,
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
	receipts, err := arenaResultJournal.Pending()
	if err != nil {
		return err
	}
	for _, receipt := range receipts {
		if err := db.CommitPvPReceipt(receipt); err != nil {
			return err
		}
		if err := arenaResultJournal.Acknowledge(receipt.MatchID); err != nil {
			return err
		}
	}
	return nil
}
