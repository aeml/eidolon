package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"testing"
)

func TestBlackjackTablesKeepRoundCachesAndPendingOwnersSeparate(t *testing.T) {
	oldDB, oldExtra, oldAvailable := db, extraBlackjack, extraBlackjackAvailable
	defer func() { db, extraBlackjack, extraBlackjackAvailable = oldDB, oldExtra, oldAvailable }()
	db = nil
	extraBlackjack = map[string]*database.BlackjackTableRecord{}
	extraBlackjackAvailable = map[string]bool{}
	a, b := "public-blackjack-earth", "public-blackjack-fire"
	first := &database.BlackjackTableRecord{TableID: a, Version: 2, Pending: &database.BlackjackTransfer{PlayerID: "player-table-owner", Currency: "gold", Amount: -20}}
	second := &database.BlackjackTableRecord{TableID: b, Version: 9}
	setBlackjackCache(a, first, true)
	setBlackjackCache(b, second, true)
	if err := recoverAccountBlackjackLocked("unrelated-guest"); err != nil {
		t.Fatal("unrelated table admission performed IO", err)
	}
	if err := recoverAccountBlackjackLocked("table-owner"); err == nil {
		t.Fatal("pending owner admitted while persistence unavailable")
	}
	retained, _ := getBlackjackCache(a)
	other, available := getBlackjackCache(b)
	if retained != first || retained.Pending == nil || other != second || !available {
		t.Fatal("table cache or pending fence crossed/vanished")
	}
	if !game.IsCasinoBlackjackTable(a) || game.IsCasinoBlackjackTable("public-blackjack-forged") {
		t.Fatal("unlisted table allowed")
	}
}
