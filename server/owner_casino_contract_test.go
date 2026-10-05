package main

import (
	"sort"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestOwnerCasinoCatalogMatchesCurrentWriters(t *testing.T) {
	expected := map[string]bool{}
	for _, table := range game.CasinoTables() {
		if table.Game != "slots" {
			expected[table.ID] = true
		}
	}
	for _, table := range game.CasinoBlackjackRecoveryTables() {
		expected[table.ID] = true
	}
	for _, machine := range game.SlotMachines() {
		for _, currency := range []string{"gold", "ep"} {
			expected[slotRecordKey("player-owner", machine.Theme, currency)] = true
		}
	}
	actual := database.OwnerCasinoRecordIDs("owner")
	if len(actual) != len(expected) || len(actual) != 37 || !sort.StringsAreSorted(actual) {
		t.Fatal("closed export catalog no longer matches game/recovery/slot writers")
	}
	for _, id := range actual {
		if !expected[id] {
			t.Fatal("unrelated record selected")
		}
		delete(expected, id)
	}
	if len(expected) != 0 {
		t.Fatal("current record omitted")
	}
}

func TestOwnerExportCasinoLogicalCursor(t *testing.T) {
	payload := strings.Replace(validOwnerExportPayload, `"section":"profile"`, `"section":"casino"`, 1)
	for _, cursor := range []string{"", "public-blackjack", "public-blackjack-water", "vip-poker-air", "slots-gold-earth", "slots-ep-water"} {
		request, err := decodeOwnerExport([]byte(strings.Replace(payload, `"characterName":""`, `"characterName":"","before":"`+cursor+`"`, 1)))
		if err != nil || request.Before != cursor {
			t.Fatal("known logical cursor rejected", err)
		}
	}
	for _, cursor := range []string{"other", "public-poker-water", "vip-roulette-air", strings.Repeat("a", 24), strings.Repeat("a", 64), "slots:other:earth"} {
		if _, err := decodeOwnerExport([]byte(strings.Replace(payload, `"characterName":""`, `"characterName":"","before":"`+cursor+`"`, 1))); err == nil {
			t.Fatal("arbitrary/incorrect cursor accepted")
		}
	}
}
