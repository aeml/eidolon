package main

import (
	"testing"

	"eidolon-server/internal/database"
)

func TestBlackjackPendingAccountGateFailsClosedWithoutBlockingOthers(t *testing.T) {
	oldDB, oldCache, oldAvailable := db, blackjackCached, blackjackAvailable
	defer func() { db, blackjackCached, blackjackAvailable = oldDB, oldCache, oldAvailable }()
	db = nil
	blackjackCached = &database.BlackjackTableRecord{TableID: publicBlackjackTable, Version: 2, State: []byte(`{"phase":"betting"}`),
		Pending: &database.BlackjackTransfer{ID: "casino:round:bet", PlayerID: "player-alice", Currency: "gold", Amount: -100, NextState: []byte(`{"phase":"playing"}`)}}
	if err := recoverAccountBlackjackLocked("bob"); err != nil {
		t.Fatal("unrelated player attempted table database IO", err)
	}
	if err := recoverAccountBlackjackLocked("alice"); err == nil {
		t.Fatal("pending owner admitted with unavailable funds storage")
	}
	if blackjackCached.Pending == nil {
		t.Fatal("failed admission discarded recovery intent")
	}
	blackjackCached = nil
	if err := recoverAccountBlackjackLocked("alice"); err != nil {
		t.Fatal("ordinary command queried casino storage")
	}
}
